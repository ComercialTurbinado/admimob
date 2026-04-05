import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import db, { init } from './db.js';
import { Readable } from 'node:stream';
import { buildRemotionRenderPayload, mergeRemotionPayload } from './remotionListing.js';
import { slugify, renderProfilePage, renderCatalogPage, renderListingPage, renderSitemap, renderCorretorPage } from './catalog.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 3333;

async function getSetting(key, def = null) {
  const r = await db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return r ? JSON.parse(r.value) : def;
}

async function setSetting(key, value) {
  await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
}

// --- Dashboard / Settings ---
// KPIs calculados do banco (não editáveis em Config)
async function getKpisFromDb() {
  const leadsRow = await db.prepare("SELECT COUNT(*) as n FROM clients WHERE status = 'lead'").get();
  const clientesRow = await db.prepare("SELECT COUNT(*) as n FROM clients WHERE status = 'active'").get();
  const negocRow = await db.prepare("SELECT COUNT(*) as n FROM clients WHERE status = 'negotiation'").get();
  const vendasRow = await db.prepare(`
    SELECT COALESCE(SUM(valor), 0) as total FROM vendas
    WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
  `).get();
  return {
    leads: leadsRow?.n ?? 0,
    clientes_ativos: clientesRow?.n ?? 0,
    negociacoes: negocRow?.n ?? 0,
    vendas_mes: vendasRow?.total ?? 0,
  };
}

app.get('/api/dashboard', async (req, res) => {
  try {
    const kpis = await getKpisFromDb();
    const payment_links = await getSetting('payment_links', { plan_65: '', plan_297: '', plan_497: '' });
    const webhook_captacao = (await getSetting('webhook_captacao', '')) || '';
    const webhook_producao = (await getSetting('webhook_producao', '')) || '';
    const webhook_materiais = (await getSetting('webhook_materiais', '')) || '';
    const webhook_frames_save = (await getSetting('webhook_frames_save', '')) || '';
    const webhook_frames_done = (await getSetting('webhook_frames_done', '')) || '';
    const browserless_ws_url = (await getSetting('browserless_ws_url', '')) || '';
    const webhook_montar_mp4 = (await getSetting('webhook_montar_mp4', '')) || '';
    const webhook_logo = (await getSetting('webhook_logo', '')) || '';
    const webhook_remotion = (await getSetting('webhook_remotion', '')) || '';
    let plans = await getSetting('plans', [
      { id: '297', label: 'R$ 297', price: 297, credit_label: 'Vídeos simples', credit_count: 5, payment_url: '' },
      { id: '497', label: 'R$ 497', price: 497, credit_label: 'Vídeos simples', credit_count: 10, payment_url: '' },
      { id: '997', label: 'R$ 997', price: 997, credit_label: 'Vídeos com narração', credit_count: 10, payment_url: '' },
    ]);
    plans = plans.map((p) => ({ ...p, payment_url: p.payment_url ?? '' }));
    res.json({ kpis, payment_links, webhook_captacao, webhook_producao, webhook_materiais, webhook_frames_save, webhook_frames_done, browserless_ws_url, webhook_montar_mp4, webhook_logo, webhook_remotion, plans });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/dashboard', async (req, res) => {
  try {
    const { payment_links, webhook_captacao, webhook_producao, webhook_materiais, webhook_frames_save, webhook_frames_done, browserless_ws_url, webhook_montar_mp4, webhook_logo, webhook_remotion, plans } = req.body;
    if (payment_links !== undefined) await setSetting('payment_links', payment_links);
    if (webhook_captacao !== undefined) await setSetting('webhook_captacao', webhook_captacao);
    if (webhook_producao !== undefined) await setSetting('webhook_producao', webhook_producao);
    if (webhook_materiais !== undefined) await setSetting('webhook_materiais', webhook_materiais);
    if (webhook_frames_save !== undefined) await setSetting('webhook_frames_save', webhook_frames_save);
    if (webhook_frames_done !== undefined) await setSetting('webhook_frames_done', webhook_frames_done);
    if (browserless_ws_url !== undefined) await setSetting('browserless_ws_url', browserless_ws_url);
    if (webhook_montar_mp4 !== undefined) await setSetting('webhook_montar_mp4', webhook_montar_mp4);
    if (webhook_logo !== undefined) await setSetting('webhook_logo', webhook_logo);
    if (webhook_remotion !== undefined) await setSetting('webhook_remotion', webhook_remotion);
    if (plans !== undefined) await setSetting('plans', plans);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Envia logo do cliente para o webhook configurado (ex.: n8n). Payload: client_id, client_name, logo_url. */
app.post('/api/send-logo-to-webhook', async (req, res) => {
  try {
    const webhookUrl = (await getSetting('webhook_logo', '')).trim();
    if (!webhookUrl) return res.status(400).json({ error: 'Configure o webhook de logo em Configurações.' });
    const clientId = req.body?.client_id != null ? Number(req.body.client_id) : null;
    if (!clientId) return res.status(400).json({ error: 'client_id é obrigatório.' });
    const r = await db.prepare('SELECT id, name, logo_url FROM clients WHERE id = ?').get(clientId);
    if (!r) return res.status(404).json({ error: 'Cliente não encontrado.' });
    const payload = { client_id: r.id, client_name: r.name || '', logo_url: r.logo_url || null };
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    if (!response.ok) {
      return res.status(502).json({ error: `Webhook respondeu ${response.status}: ${text.slice(0, 200)}` });
    }
    res.json({ ok: true, message: 'Logo enviado para o webhook.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Proxy de imagem: evita CORS/taint no canvas ao capturar o poster (Browserless). */
const PROXY_IMAGE_MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const PROXY_IMAGE_TIMEOUT_MS = 15000;
app.get('/api/proxy-image', async (req, res) => {
  const rawUrl = req.query.url;
  if (!rawUrl || typeof rawUrl !== 'string') return res.status(400).send('Missing url');
  let targetUrl;
  try {
    targetUrl = new URL(rawUrl.trim());
  } catch {
    return res.status(400).send('Invalid url');
  }
  if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') return res.status(400).send('Only http(s) allowed');
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROXY_IMAGE_TIMEOUT_MS);
    const origin = `${targetUrl.protocol}//${targetUrl.host}`;
    const resp = await fetch(targetUrl.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
        Referer: origin + '/',
      },
    });
    clearTimeout(timeoutId);
    const cl = parseInt(resp.headers.get('content-length') || '0', 10);
    if (cl > PROXY_IMAGE_MAX_SIZE) return res.status(413).send('Image too large');
    const contentType = resp.headers.get('content-type') || 'image/jpeg';
    if (!resp.ok) return res.status(resp.status).send(await resp.text());
    const buf = await resp.arrayBuffer();
    if (buf.byteLength > PROXY_IMAGE_MAX_SIZE) return res.status(413).send('Image too large');
    res.set('Cache-Control', 'public, max-age=300');
    res.set('Access-Control-Allow-Origin', '*');
    res.type(contentType.split(';')[0].trim());
    res.send(Buffer.from(buf));
  } catch (e) {
    if (e.name === 'AbortError') return res.status(504).send('Timeout');
    res.status(502).send(e.message || 'Proxy error');
  }
});

// Registrar venda (alimenta o KPI "vendas_mes" do dashboard)
app.post('/api/vendas', async (req, res) => {
  try {
    const { valor, descricao } = req.body;
    const v = Number(valor);
    if (Number.isNaN(v) || v < 0) return res.status(400).json({ error: 'Valor inválido' });
    const result = await db.prepare('INSERT INTO vendas (valor, descricao) VALUES (?, ?)').run(v, descricao || null);
    res.status(201).json({ id: result.lastInsertRowid, valor: v, descricao: descricao || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Carregar cliente de exemplo (1 cliente + 1 imóvel)
app.post('/api/seed', async (req, res) => {
  try {
    const pragmaRows = await db.prepare('PRAGMA table_info(clients)').all();
    const hasCredits = (pragmaRows || []).some((c) => c.name === 'credits_remaining');
    const insertColsClients = [
      'name', 'logo_url', 'status', 'plan', 'credits_remaining',
      'email', 'phone', 'phone_secondary', 'document', 'creci', 'contact_name',
      'address', 'city', 'state', 'zip',
      'website', 'instagram', 'facebook', 'notes',
    ];
    const colsForInsert = hasCredits ? insertColsClients : insertColsClients.filter((c) => c !== 'credits_remaining');
    const client = {
      name: 'Regina Guerreiro Imoveis',
      logo_url: 'https://resizedimgs.vivareal.com/img/vr-listing/e9cfb78f81731ee3743dc1b24339625a/regina-guerreiro-imoveis.webp',
      status: 'active',
      plan: '497',
      credits_remaining: hasCredits ? 10 : null,
      contact_name: 'Regina Guerreiro',
      email: 'contato@reginaguerreiroimoveis.com.br',
      phone: '(13) 3456-7890',
      phone_secondary: '(13) 99999-1234',
      document: '12.345.678/0001-90',
      creci: '12345-F',
      address: 'Av. Beira Mar, 1000',
      city: 'Peruíbe',
      state: 'SP',
      zip: '11750-000',
      website: 'https://reginaguerreiroimoveis.com.br',
      instagram: '@reginaguerreiroimoveis',
      facebook: 'reginaguerreiroimoveis',
      notes: 'Cliente desde 2024. Foco em imóveis no litoral sul.',
    };
    const placeholders = colsForInsert.map(() => '?').join(', ');
    const values = colsForInsert.map((c) => client[c] ?? null);
    const clientResult = await db.prepare(`INSERT INTO clients (${colsForInsert.join(', ')}) VALUES (${placeholders})`).run(...values);
    const clientId = clientResult.lastInsertRowid;
    const listing = {
      carousel_images: [
        'https://resizedimgs.vivareal.com/img/vr-listing/9b66eb450db996a1e721b29ea90aab6e/casa-com-2-quartos-a-venda-82m-no-bal-stella-maris-peruibe.webp',
        'https://resizedimgs.vivareal.com/img/vr-listing/d218dc756eddcb139a84a6160140af4a/casa-com-2-quartos-a-venda-82m-no-bal-stella-maris-peruibe.webp',
        'https://resizedimgs.vivareal.com/img/vr-listing/c413fce3c20a97ae28849c6dba493726/casa-com-2-quartos-a-venda-82m-no-bal-stella-maris-peruibe.webp',
      ],
      title: 'Casa com 2 Quartos e 2 banheiros à Venda, 82 m² por R$ 455.000',
      description: 'Casa nova com piscina a venda em Peruíbe, bairro Flora Rica II.',
      imobname: 'Regina Guerreiro Imoveis',
      logoimob: 'https://resizedimgs.vivareal.com/img/vr-listing/e9cfb78f81731ee3743dc1b24339625a/regina-guerreiro-imoveis.webp',
      advertiserCode: 'CA2598',
      vivaRealCode: '2815108622',
      'amenities-list': [
        { name: 'floorSize', value: '82 m²' },
        { name: 'numberOfRooms', value: '2 quartos' },
        { name: 'numberOfBathroomsTotal', value: '2 banheiros' },
        { name: 'numberOfParkingSpaces', value: '2 vagas' },
      ],
      salePrice: 'R$ 455.000',
      prices: { Venda: 'R$ 455.000', Condomínio: 'Isento', IPTU: 'R$ 160' },
    };
    const colsList = await db.prepare('PRAGMA table_info(listings)').all();
    const cols = (colsList || []).map((c) => c.name);
    if (cols.includes('client_id')) {
      await db.prepare('INSERT INTO listings (client_id, raw_data, selected_images, webhook_payload) VALUES (?, ?, ?, ?)')
        .run(clientId, JSON.stringify(listing), null, null);
    } else {
      await db.prepare('INSERT INTO listings (raw_data, selected_images, webhook_payload) VALUES (?, ?, ?)')
        .run(JSON.stringify(listing), null, null);
    }
    res.json({ ok: true, message: 'Cliente de exemplo carregado.', client_id: clientId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Clients ---
const CLIENT_COLUMNS = [
  'id', 'name', 'logo_url', 'status', 'plan', 'credits_remaining',
  'email', 'phone', 'phone_secondary', 'document', 'creci', 'contact_name',
  'address', 'city', 'state', 'zip',
  'website', 'instagram', 'facebook', 'notes',
  'design_config',
  'slug', 'custom_domain', 'whatsapp',
  'profile_config',
  'created_at', 'updated_at',
];

app.get('/api/clients', async (req, res) => {
  try {
    const cols = CLIENT_COLUMNS.filter((c) => c !== 'id').join(', ');
    const rows = await db.prepare(`SELECT id, ${cols} FROM clients ORDER BY name`).all();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/clients/:id', async (req, res) => {
  try {
    const cols = CLIENT_COLUMNS.join(', ');
    const r = await db.prepare(`SELECT ${cols} FROM clients WHERE id = ?`).get(Number(req.params.id));
    if (!r) return res.status(404).json({ error: 'Não encontrado' });
    res.json(r);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/clients', async (req, res) => {
  try {
    const insertCols = CLIENT_COLUMNS.filter((c) => !['id', 'created_at', 'updated_at'].includes(c));
    const placeholders = insertCols.map(() => '?').join(', ');

    // Auto-gera slug único a partir do nome
    let baseSlug = slugify(req.body.name || '');
    let finalSlug = baseSlug;
    let attempt = 0;
    while (true) {
      const existing = await db.prepare('SELECT id FROM clients WHERE slug = ?').get(finalSlug);
      if (!existing) break;
      attempt++;
      finalSlug = `${baseSlug}-${attempt}`;
    }

    const values = insertCols.map((col) => {
      const v = req.body[col];
      if (col === 'name') return v || '';
      if (col === 'status') return v || 'lead';
      if (col === 'slug') return (v && String(v).trim()) ? String(v).trim() : finalSlug;
      if ((col === 'design_config' || col === 'profile_config') && v != null && v !== '') return typeof v === 'object' ? JSON.stringify(v) : v;
      return v ?? null;
    });
    const result = await db.prepare(`INSERT INTO clients (${insertCols.join(', ')}) VALUES (${placeholders})`).run(...values);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/clients/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updatable = CLIENT_COLUMNS.filter((c) => !['id', 'created_at', 'updated_at'].includes(c));
    const updates = [];
    const values = [];
    for (const col of updatable) {
      if (req.body[col] !== undefined) {
        updates.push(`${col} = ?`);
        const v = req.body[col];
        if ((col === 'design_config' || col === 'profile_config') && v !== null && v !== '') {
          values.push(typeof v === 'object' ? JSON.stringify(v) : v);
        } else {
          values.push(v === '' ? null : v);
        }
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'Nada para atualizar' });
    updates.push("updated_at = datetime('now')");
    values.push(id);
    await db.prepare(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/clients/:id', async (req, res) => {
  try {
    const result = await db.prepare('DELETE FROM clients WHERE id = ?').run(Number(req.params.id));
    if (result.changes === 0) return res.status(404).json({ error: 'Não encontrado' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Corretores ---
const CORRETOR_COLS = ['id', 'client_id', 'name', 'slug', 'photo_url', 'creci', 'phone', 'whatsapp', 'email', 'specialty', 'bio', 'active', 'sort_order', 'created_at', 'updated_at'];

app.get('/api/clients/:id/corretores', async (req, res) => {
  try {
    const rows = await db.prepare(
      `SELECT ${CORRETOR_COLS.join(', ')} FROM corretores WHERE client_id = ? ORDER BY sort_order ASC, name ASC`
    ).all(Number(req.params.id));
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/clients/:id/corretores', async (req, res) => {
  try {
    const client_id = Number(req.params.id);
    const { name, photo_url, creci, phone, whatsapp, email, specialty, bio, active, sort_order } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nome obrigatório' });
    // Gera slug único por cliente
    const RESERVED = ['catalogo', 'sitemap.xml', 'robots.txt'];
    let baseSlug = slugify(name.trim());
    if (!baseSlug || RESERVED.includes(baseSlug)) baseSlug = 'corretor';
    let finalSlug = baseSlug; let attempt = 0;
    while (true) {
      const ex = await db.prepare('SELECT id FROM corretores WHERE client_id = ? AND slug = ?').get(client_id, finalSlug);
      if (!ex) break;
      attempt++; finalSlug = `${baseSlug}-${attempt}`;
    }
    const result = await db.prepare(
      `INSERT INTO corretores (client_id, name, slug, photo_url, creci, phone, whatsapp, email, specialty, bio, active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(client_id, name.trim(), finalSlug, photo_url||null, creci||null, phone||null, whatsapp||null, email||null, specialty||null, bio||null, active??1, sort_order??0);
    res.status(201).json({ id: result.lastInsertRowid, slug: finalSlug });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/corretores/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const fields = ['name', 'slug', 'photo_url', 'creci', 'phone', 'whatsapp', 'email', 'specialty', 'bio', 'active', 'sort_order'];
    const updates = [];
    const values = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = ?`);
        values.push(req.body[f] === '' ? null : req.body[f]);
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'Nada para atualizar' });
    updates.push("updated_at = datetime('now')");
    values.push(id);
    const result = await db.prepare(`UPDATE corretores SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    if (result.changes === 0) return res.status(404).json({ error: 'Não encontrado' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/corretores/:id', async (req, res) => {
  try {
    const result = await db.prepare('DELETE FROM corretores WHERE id = ?').run(Number(req.params.id));
    if (result.changes === 0) return res.status(404).json({ error: 'Não encontrado' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- Listings ---
app.get('/api/listings', async (req, res) => {
  try {
    const client_id = req.query.client_id ? Number(req.query.client_id) : null;
    let sql = `
      SELECT id, client_id, source_url, raw_data, selected_images, webhook_payload, created_at, updated_at
      FROM listings ORDER BY updated_at DESC
    `;
    const params = [];
    if (client_id != null) {
      sql = `SELECT id, client_id, source_url, raw_data, selected_images, webhook_payload, created_at, updated_at FROM listings WHERE client_id = ? ORDER BY updated_at DESC`;
      params.push(client_id);
    }
    const rows = params.length ? await db.prepare(sql).all(...params) : await db.prepare(sql).all();
    const listings = rows.map((r) => ({
      id: r.id,
      client_id: r.client_id,
      source_url: r.source_url,
      ...JSON.parse(r.raw_data),
      selected_images: r.selected_images ? JSON.parse(r.selected_images) : null,
      webhook_payload: r.webhook_payload ? JSON.parse(r.webhook_payload) : null,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
    res.json(listings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/listings/:id', async (req, res) => {
  try {
    const r = await db.prepare(`
      SELECT id, client_id, source_url, raw_data, selected_images, webhook_payload, created_at, updated_at
      FROM listings WHERE id = ?
    `).get(Number(req.params.id));
    if (!r) return res.status(404).json({ error: 'Não encontrado' });
    res.json({
      id: r.id,
      client_id: r.client_id,
      source_url: r.source_url,
      ...JSON.parse(r.raw_data),
      selected_images: r.selected_images ? JSON.parse(r.selected_images) : null,
      webhook_payload: r.webhook_payload ? JSON.parse(r.webhook_payload) : null,
      created_at: r.created_at,
      updated_at: r.updated_at,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Materiais: webhook retorna lista no formato S3 (Key, LastModified, etc.) ou fallback manifest.json
// Cache em memória: só chama o webhook de novo se ?refresh=1
const materiaisCache = new Map();

const MATERIAIS_S3_BASE = 'https://firemode.s3.us-east-1.amazonaws.com/';
const MATERIAIS_BASE = 'https://firemode.s3.us-east-1.amazonaws.com/firemode/imob';
const MATERIAIS_FILES_BASE_DEFAULT = 'https://n8n-srcleads-ffmpeg-api.dtna1d.easypanel.host/data/render';

function classifyKey(key) {
  const k = (key || '').replace(/\/$/, '').toLowerCase();
  if (k.endsWith('.mp4')) return 'videos';
  if (k.endsWith('.mp3')) {
    if (k.includes('narracao') || k.includes('narration')) return 'narration';
    return 'music';
  }
  return null;
}

function parseWebhookMateriaisResponse(arr) {
  if (!Array.isArray(arr)) return { videos: [], narration: [], music: [] };
  const files = { videos: [], narration: [], music: [] };
  arr
    .filter((o) => o && o.Key)
    .sort((a, b) => (a.Key || '').localeCompare(b.Key || ''))
    .forEach((o) => {
      const key = o.Key.replace(/\/$/, '');
      const type = classifyKey(key);
      const url = key.startsWith('http') ? key : MATERIAIS_S3_BASE + key;
      if (type === 'videos') files.videos.push(url);
      else if (type === 'narration') files.narration.push(url);
      else if (type === 'music') files.music.push(url);
    });
  return files;
}

/** Detecta formato novo: array de { path, pathAbsolute?, recursive?, items: [{ name, path, type, size, mtime }] } */
function isFolderListingFormat(data) {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    data.every((entry) => entry && Array.isArray(entry.items))
  );
}

/** Extrai URLs de vídeos a partir de folderListing para compatibilidade com o visor. */
function videosFromFolderListing(folderListing, baseUrl) {
  if (!Array.isArray(folderListing) || !baseUrl) return [];
  const urls = [];
  folderListing.forEach((entry) => {
    (entry.items || []).forEach((item) => {
      if (item.type === 'file' && item.name && item.name.toLowerCase().endsWith('.mp4')) {
        const path = (item.path || item.name || '').trim();
        urls.push(path.startsWith('http') ? path : baseUrl.replace(/\/?$/, '/') + path.replace(/^\//, ''));
      }
    });
  });
  return urls;
}

async function listingWithClient(r, raw) {
  const listing = { id: r.id, client_id: r.client_id, ...raw };
  if (r.client_id) {
    try {
      const c = await db.prepare('SELECT email, phone, phone_secondary, website, instagram, design_config FROM clients WHERE id = ?').get(r.client_id);
      if (c) {
        listing.client = {
          email: c.email,
          phone: c.phone,
          phone_secondary: c.phone_secondary,
          website: c.website,
          instagram: c.instagram,
          design_config: c.design_config ? JSON.parse(c.design_config) : null,
        };
      }
    } catch (_) {}
  }
  return listing;
}

app.get('/api/listings/:id/materiais', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const listingId = Number(req.params.id);
    const refresh = req.query.refresh === '1' || req.query.refresh === 'true';

    const r = await db.prepare(`
      SELECT id, client_id, raw_data FROM listings WHERE id = ?
    `).get(listingId);
    if (!r) return res.status(404).json({ error: 'Não encontrado' });
    const raw = JSON.parse(r.raw_data);
    const advertiserCode = raw.advertiserCode || '';
    const imobname = raw.imobname || '';
    const baseUrl = (imobname && advertiserCode)
      ? `${MATERIAIS_S3_BASE}firemode/imob/${encodeURIComponent(imobname)}/${encodeURIComponent(advertiserCode)}/`
      : advertiserCode
        ? `${MATERIAIS_BASE}/${encodeURIComponent(advertiserCode)}/`
        : '';

    // Retornar cache se existir e não foi solicitada atualização
    if (!refresh && materiaisCache.has(listingId)) {
      const cached = materiaisCache.get(listingId);
      const listing = await listingWithClient(r, raw);
      return res.json({
        baseUrl: cached.baseUrl,
        files: cached.files,
        folderListing: cached.folderListing ?? null,
        folderBaseUrl: cached.folderBaseUrl ?? undefined,
        listing,
        webhook_consulted: cached.webhook_consulted,
        webhook_raw_response: cached.webhook_raw_response,
        webhook_status: cached.webhook_status,
      });
    }

    let files = { videos: [], narration: [], music: [] };
    let folderListing = null;
    let folderBaseUrl = '';
    let webhook_consulted = false;
    let webhook_raw_response = null;
    let webhook_status = null;

    const webhookUrl = (await getSetting('webhook_materiais', '')) || '';
    const urlToCall = webhookUrl.trim();
    if (urlToCall) {
      webhook_consulted = true;
      console.log('[Materiais] Chamando webhook:', urlToCall, 'listing_id:', req.params.id);
      try {
        const controller = new AbortController();
        const timeoutMs = 30000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const response = await fetch(urlToCall, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imobname, advertiserCode, listing_id: listingId }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        webhook_status = response.status;
        const ct = response.headers.get('content-type') || '';
        const text = await response.text();
        webhook_raw_response = text;
        if (ct.includes('application/json')) {
          const data = JSON.parse(text);
          if (isFolderListingFormat(Array.isArray(data) ? data : data.folderListing)) {
            folderListing = Array.isArray(data) ? data : data.folderListing;
            folderBaseUrl = Array.isArray(data) ? '' : (data.folderBaseUrl || '');
            if (!folderBaseUrl) folderBaseUrl = (process.env.MATERIAIS_FILES_BASE_URL || MATERIAIS_FILES_BASE_DEFAULT).replace(/\/$/, '') || MATERIAIS_FILES_BASE_DEFAULT;
            const fileBase = folderBaseUrl || baseUrl;
            const urls = videosFromFolderListing(folderListing, fileBase);
            if (urls.length) files.videos = urls;
          } else {
            const arr = Array.isArray(data) ? data : (data.Contents || data.files || data.items || []);
            files = parseWebhookMateriaisResponse(arr);
          }
        }
      } catch (err) {
        console.error('Webhook materiais:', err.message);
        webhook_raw_response = `Erro: ${err.message}`;
      }
    }

    if (files.videos.length === 0 && files.narration.length === 0 && files.music.length === 0 && baseUrl) {
      try {
        const manifestRes = await fetch(baseUrl + 'manifest.json', { signal: AbortSignal.timeout(5000) });
        if (manifestRes.ok) {
          const manifest = await manifestRes.json();
          files = {
            videos: Array.isArray(manifest.videos) ? manifest.videos : [],
            narration: Array.isArray(manifest.narration) ? manifest.narration : manifest.narration ? [manifest.narration] : [],
            music: Array.isArray(manifest.music) ? manifest.music : manifest.music ? [manifest.music] : [],
          };
        }
      } catch (_) {}
    }

    materiaisCache.set(listingId, { baseUrl, files, folderListing, folderBaseUrl, webhook_consulted, webhook_raw_response, webhook_status });

    const listing = await listingWithClient(r, raw);
    res.json({
      baseUrl,
      files,
      folderListing,
      folderBaseUrl: folderBaseUrl || undefined,
      listing,
      webhook_consulted,
      webhook_raw_response: webhook_raw_response,
      webhook_status: webhook_status,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Envia merge/render para a API FFmpeg. Body: { files: string[], outputPath: string } */
const RENDER_MERGE_URL = process.env.RENDER_MERGE_URL || (MATERIAIS_FILES_BASE_DEFAULT + '/merge');
app.post('/api/listings/:id/render-merge', async (req, res) => {
  try {
    const listingId = Number(req.params.id);
    const { files, outputPath } = req.body || {};
    if (!Array.isArray(files) || files.length === 0) return res.status(400).json({ error: 'files (array) é obrigatório e não pode ser vazio' });
    if (!outputPath || typeof outputPath !== 'string') return res.status(400).json({ error: 'outputPath é obrigatório' });
    const response = await fetch(RENDER_MERGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, outputPath }),
    });
    const text = await response.text();
    if (!response.ok) {
      return res.status(response.status).json({ error: text || 'Erro ao chamar API de render' });
    }
    res.set('Content-Type', response.headers.get('content-type') || 'application/json');
    res.status(response.status).send(text);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Proxy para o serviço Remotion: POST JSON → MP4. Env: REMOTION_RENDER_URL (origem sem /render). Timeout longo (20 min). */
const REMOTION_RENDER_BASE = (process.env.REMOTION_RENDER_URL || 'https://n8n-srcleads-remotion.dtna1d.easypanel.host').replace(/\/$/, '');
const REMOTION_RENDER_ENDPOINT = `${REMOTION_RENDER_BASE}/render`;
const REMOTION_RENDER_TIMEOUT_MS = Math.min(
  Math.max(Number(process.env.REMOTION_RENDER_TIMEOUT_MS) || 20 * 60 * 1000, 60_000),
  60 * 60 * 1000
);

/** Base pública da API para proxy de imagens no payload do Remotion (Chromium remoto não pode acessar VR/403). */
function remotionImageProxyBase(req) {
  const fromEnv = (
    process.env.REMOTION_IMAGE_PROXY_BASE ||
    process.env.PUBLIC_APP_URL ||
    process.env.CATALOG_BASE_URL ||
    ''
  )
    .trim()
    .replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  const host = req.get('host') || '';
  const hostFirst = host.split(':')[0];
  if (!host || /^127\.0\.0\.1$|^localhost$/i.test(hostFirst)) return '';
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
  return `${proto}://${host}`.replace(/\/$/, '');
}

app.post('/api/listings/:id/remotion-render', async (req, res) => {
  try {
    const listingId = Number(req.params.id);
    const { animation, subtitlesSrt, inputOverride } = req.body || {};
    const validAnim = new Set(['op1', 'op2', 'op3', 'op4', 'op5', 'op6']);
    if (!animation || !validAnim.has(String(animation))) {
      return res.status(400).json({ error: 'animation deve ser op1, op2, op3, op4, op5 ou op6' });
    }

    const r = await db.prepare(`
      SELECT id, client_id, raw_data FROM listings WHERE id = ?
    `).get(listingId);
    if (!r) return res.status(404).json({ error: 'Não encontrado' });

    const raw = JSON.parse(r.raw_data);
    let selected = null;
    try {
      const rowSel = await db.prepare('SELECT selected_images FROM listings WHERE id = ?').get(listingId);
      if (rowSel?.selected_images) selected = JSON.parse(rowSel.selected_images);
    } catch (_) {}
    const rawWithSelected = selected && Array.isArray(selected) ? { ...raw, selected_images: selected } : raw;

    const listing = await listingWithClient(r, rawWithSelected);

    const advertiserCode = raw.advertiserCode || '';
    const imobname = raw.imobname || '';
    const materiaisBaseUrl =
      imobname && advertiserCode
        ? `${MATERIAIS_S3_BASE}firemode/imob/${encodeURIComponent(imobname)}/${encodeURIComponent(advertiserCode)}/`
        : advertiserCode
          ? `${MATERIAIS_BASE}/${encodeURIComponent(advertiserCode)}/`
          : '';

    let payload = buildRemotionRenderPayload({
      listing,
      animation: String(animation),
      subtitlesSrt: typeof subtitlesSrt === 'string' ? subtitlesSrt : '',
      baseUrl: materiaisBaseUrl || undefined,
      imageProxyBase: remotionImageProxyBase(req) || undefined,
    });
    if (inputOverride && typeof inputOverride === 'object') {
      const { animation: _ignoredAnim, ...safeOverride } = inputOverride;
      payload = mergeRemotionPayload(payload, safeOverride);
    }

    const filename = `remotion-${animation}.mp4`;
    const remotionWebhookUrl = ((await getSetting('webhook_remotion', '')) || '').trim();

    // ── Modo webhook (n8n recebe dados, chama Remotion e salva) ─────────────
    // Se webhook_remotion estiver configurado nas Settings, envia o payload
    // completo para o n8n e retorna queued imediatamente (fire & forget).
    if (remotionWebhookUrl) {
      try {
        await fetch(remotionWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,           // animation + input.listing (fotos, preço, cores, contatos...)
            imobName: imobname,
            imovelRef: advertiserCode,
            listing_id: listingId,
            filename,
          }),
        });
      } catch (webhookErr) {
        console.error('[remotion-render] webhook error:', webhookErr.message);
        return res.status(502).json({ error: 'Falha ao enviar para o webhook: ' + webhookErr.message });
      }
      return res.json({
        ok: true,
        queued: true,
        message: `Dados enviados para o n8n. O vídeo será renderizado e salvo automaticamente.`,
        imobName: imobname,
        imovelRef: advertiserCode,
        animation,
        filename,
      });
    }

    // ── Modo direto (sem webhook): Railway chama Remotion e faz download ─────
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REMOTION_RENDER_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(REMOTION_RENDER_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const ct = (response.headers.get('content-type') || '').toLowerCase();
    if (!response.ok || ct.includes('application/json')) {
      const text = await response.text();
      let msg = text;
      try {
        const j = JSON.parse(text);
        if (j && typeof j.error === 'string') msg = j.error;
      } catch (_) {}
      return res.status(response.ok ? 502 : response.status).json({ error: msg || 'Erro no render Remotion' });
    }

    let buf;
    if (!response.body) {
      buf = Buffer.from(await response.arrayBuffer());
    } else {
      const chunks = [];
      const nodeStream = Readable.fromWeb(response.body);
      await new Promise((resolve, reject) => {
        nodeStream.on('data', (chunk) => chunks.push(chunk));
        nodeStream.on('end', resolve);
        nodeStream.on('error', reject);
      });
      buf = Buffer.concat(chunks);
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="remotion-${listingId}-${animation}.mp4"`);
    return res.send(buf);
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'Tempo esgotado aguardando o render (aumente REMOTION_RENDER_TIMEOUT_MS ou tente de novo).' : e.message;
    res.status(500).json({ error: msg });
  }
});

/** Calcula duração em ms a partir do conteúdo SRT (último timestamp + margem). */
function srtDurationMs(srt) {
  if (!srt || typeof srt !== 'string') return 0;
  const matches = [...srt.matchAll(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->/g)];
  if (!matches.length) return 0;
  const last = matches[matches.length - 1];
  const [, h, m, s, ms] = last;
  return (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000 + Number(ms) + 2000;
}

const REMOTION_ANIM_DURATION_MS = { op1: 30000, op2: 30000, op3: 30000, op4: 30000, op5: 25000, op6: 20000 };

/** Monta payload + HTML do preview Remotion para um listing. */
async function buildRemotionPreviewHtml(listingId, { animation, subtitlesSrt, inputOverride, imageProxyBase }) {
  const r = await db.prepare(`SELECT id, client_id, raw_data FROM listings WHERE id = ?`).get(listingId);
  if (!r) return { error: 'Não encontrado', status: 404 };

  const raw = JSON.parse(r.raw_data);
  let selected = null;
  try {
    const rowSel = await db.prepare('SELECT selected_images FROM listings WHERE id = ?').get(listingId);
    if (rowSel?.selected_images) selected = JSON.parse(rowSel.selected_images);
  } catch (_) {}
  const rawWithSelected = selected && Array.isArray(selected) ? { ...raw, selected_images: selected } : raw;
  const listing = await listingWithClient(r, rawWithSelected);

  const advertiserCode = raw.advertiserCode || '';
  const imobname = raw.imobname || '';
  const materiaisBaseUrl =
    imobname && advertiserCode
      ? `${MATERIAIS_S3_BASE}firemode/imob/${encodeURIComponent(imobname)}/${encodeURIComponent(advertiserCode)}/`
      : advertiserCode ? `${MATERIAIS_BASE}/${encodeURIComponent(advertiserCode)}/` : '';

  let payload = buildRemotionRenderPayload({
    listing, animation: String(animation),
    subtitlesSrt: typeof subtitlesSrt === 'string' ? subtitlesSrt : '',
    baseUrl: materiaisBaseUrl || undefined,
    imageProxyBase: imageProxyBase || undefined,
  });
  if (inputOverride && typeof inputOverride === 'object') {
    const { animation: _a, ...safeOverride } = inputOverride;
    payload = mergeRemotionPayload(payload, safeOverride);
  }

  // Auto-inject áudio e SRT salvos
  if (imobname && advertiserCode) {
    const ffmpegBase = 'https://n8n-srcleads-ffmpeg-api.dtna1d.easypanel.host';
    const audioUrl = `${ffmpegBase}/data/render/imob/${encodeURIComponent(imobname)}/${encodeURIComponent(advertiserCode)}/audio/narracao-${advertiserCode}.mp3`;
    const srtUrl   = `${ffmpegBase}/data/render/imob/${encodeURIComponent(imobname)}/${encodeURIComponent(advertiserCode)}/audio/narracao-${advertiserCode}.srt`;
    try {
      const audioCheck = await fetch(audioUrl, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
      if (audioCheck.ok) payload.input = { ...payload.input, audio_url: audioUrl };
    } catch (_) {}
    if (!payload.subtitlesSrt) {
      try {
        const srtRes = await fetch(srtUrl, { signal: AbortSignal.timeout(4000) });
        if (srtRes.ok) { const t = await srtRes.text(); if (t.trim()) payload.subtitlesSrt = t; }
      } catch (_) {}
    }
  }

  const previewResponse = await fetch(`${REMOTION_RENDER_BASE}/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  if (!previewResponse.ok) {
    const text = await previewResponse.text();
    let msg = text;
    try { const j = JSON.parse(text); if (j?.error) msg = j.error; } catch (_) {}
    return { error: msg, status: previewResponse.status };
  }

  let html = await previewResponse.text();

  // Preloader: aguarda assets carregarem e sinaliza window.__remotionReady = true
  // O Puppeteer (capture service) usa esse sinal para começar os screenshots nativos
  const carouselImages = payload.input?.listing?.carousel_images || [];
  const audioUrl = payload.input?.audio_url || '';
  const duration = srtDurationMs(payload.subtitlesSrt) || REMOTION_ANIM_DURATION_MS[animation] || 30000;
  const preloadInject = `
<style>
  #pre-overlay{position:fixed;inset:0;background:#000;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#fff;font-family:sans-serif;transition:opacity .5s;}
  #pre-overlay.out{opacity:0;pointer-events:none;}
  #root{opacity:0;transition:opacity .5s;}
  #root.rdy{opacity:1;}
</style>
<div id="pre-overlay"><div style="font-size:13px;opacity:.6">Carregando…</div><div id="pre-prog" style="font-size:11px;opacity:.4"></div></div>
<script>
(function(){
  var imgs=${JSON.stringify(carouselImages)};
  var audio=${JSON.stringify(audioUrl)};
  var total=imgs.length+(audio?1:0);var done=0;
  var prog=document.getElementById('pre-prog');
  function tick(){done++;if(prog)prog.textContent=done+' / '+total;if(done>=total)show();}
  function show(){
    var ov=document.getElementById('pre-overlay');
    var root=document.getElementById('root');
    if(ov){ov.classList.add('out');setTimeout(function(){ov.remove();},600);}
    if(root)root.classList.add('rdy');
    // Sinaliza ao Puppeteer que pode começar os screenshots
    setTimeout(function(){ window.__remotionReady=true; }, 1500);
  }
  if(total===0){show();return;}
  imgs.forEach(function(src){var i=new Image();i.onload=i.onerror=tick;i.src=src;});
  if(audio){var a=new Audio();a.preload='auto';a.addEventListener('canplaythrough',tick,{once:true});a.addEventListener('error',tick,{once:true});a.src=audio;}
  // Fallback: força show após 20s mesmo sem todos os assets
  setTimeout(show,20000);
})();
</script>`;

  html = html.replace('</body>', preloadInject + '\n</body>');

  return { html, payload, duration, imobname, advertiserCode };
}

/** GET: serve o preview HTML diretamente — URL pública acessível pelo Browserless. */
app.get('/api/listings/:id/remotion-preview-page', async (req, res) => {
  const listingId = Number(req.params.id);
  const animation = String(req.query.animation || 'op3');
  const validAnim = new Set(['op1', 'op2', 'op3', 'op4', 'op5', 'op6']);
  if (!validAnim.has(animation)) return res.status(400).json({ error: 'animation inválido' });
  try {
    const result = await buildRemotionPreviewHtml(listingId, { animation, imageProxyBase: remotionImageProxyBase(req) });
    if (result.error) return res.status(result.status || 500).json({ error: result.error });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(result.html);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** POST: captura Remotion via Puppeteer nativo no capture service (sem html2canvas). */
app.post('/api/listings/:id/remotion-capture', async (req, res) => {
  const listingId = Number(req.params.id);
  const { animation = 'op3', fps: fpsParam = 8 } = req.body || {};
  const validAnim = new Set(['op1', 'op2', 'op3', 'op4', 'op5', 'op6']);
  if (!validAnim.has(String(animation))) return res.status(400).json({ error: 'animation inválido' });

  const browserlessUrl = ((await getSetting('browserless_ws_url', '')).trim() || process.env.BROWSERLESS_WS_URL || '');
  if (!browserlessUrl) return res.status(503).json({ error: 'Configure o serviço de captura em Configurações (browserless_ws_url)' });

  // Lê dados do listing
  const rawRow = await db.prepare('SELECT raw_data FROM listings WHERE id = ?').get(listingId);
  if (!rawRow) return res.status(404).json({ error: 'Listing não encontrado' });
  const { imobname = '', advertiserCode = '' } = JSON.parse(rawRow.raw_data);

  // Calcula duração via SRT
  let durationMs = REMOTION_ANIM_DURATION_MS[animation] || 30000;
  if (imobname && advertiserCode) {
    try {
      const ffmpegBase = 'https://n8n-srcleads-ffmpeg-api.dtna1d.easypanel.host';
      const srtUrl = `${ffmpegBase}/data/render/imob/${encodeURIComponent(imobname)}/${encodeURIComponent(advertiserCode)}/audio/narracao-${advertiserCode}.srt`;
      const srtRes = await fetch(srtUrl, { signal: AbortSignal.timeout(4000) }).catch(() => null);
      if (srtRes?.ok) { const t = await srtRes.text(); const d = srtDurationMs(t); if (d > 0) durationMs = d; }
    } catch (_) {}
  }

  // Webhooks das configurações
  const webhookFramesUrl = (await getSetting('webhook_frames_save', '')).trim();
  const webhookDoneUrl   = (await getSetting('webhook_frames_done', '')).trim();
  const webhookMontarUrl = (await getSetting('webhook_montar_mp4', '')).trim();

  // URL pública do backend — necessária para o capture service (externo) conseguir acessar
  // Usa PUBLIC_APP_URL do env (Railway) ou x-forwarded-host se disponível
  const xForwardedHost = req.get('x-forwarded-host');
  const xForwardedProto = req.get('x-forwarded-proto') || 'https';
  const publicBase = (process.env.PUBLIC_APP_URL || process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : xForwardedHost ? `${xForwardedProto}://${xForwardedHost}` : null);

  if (!publicBase) {
    return res.status(503).json({ error: 'Configure PUBLIC_APP_URL no Railway para que o capture service consiga acessar o preview.' });
  }

  const captureUrl = `${publicBase}/api/listings/${listingId}/remotion-preview-page?animation=${animation}`;

  // Timeout: duração × 4 + 2 min de margem
  const captureTimeoutMs = Math.max(durationMs * 4, 3 * 60 * 1000) + 2 * 60 * 1000;

  console.log(`[remotion-capture] listing=${listingId} animation=${animation} duration=${durationMs}ms url=${captureUrl} capture_service=${browserlessUrl}`);

  // Responde imediatamente — captura roda em background no capture service
  res.json({ ok: true, listing_id: Number(listingId), animation, duration_ms: durationMs, capture_url: captureUrl });

  (async () => {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), captureTimeoutMs + 60000);
      const openRes = await fetch(browserlessUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: captureUrl,
          timeoutMs: captureTimeoutMs,
          viewportWidth: 1080,
          viewportHeight: 1920,
          captureFrames: {
            fps: Number(fpsParam) || 8,
            durationMs,
            webhookFramesUrl,
            webhookDoneUrl,
            webhookMontarUrl,
            listingId: Number(listingId),
            imobname,
            advertiserCode,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(tid);
      if (!openRes.ok) {
        console.error('[remotion-capture] capture service erro:', openRes.status, await openRes.text().catch(() => ''));
      } else {
        console.log('[remotion-capture] capture service OK para listing', listingId);
      }
    } catch (e) {
      console.error('[remotion-capture] erro background:', e.message);
    }
  })();
});

/** Proxy para o serviço Remotion: POST JSON → HTML com Player (preview sem render). */
app.post('/api/listings/:id/remotion-preview', async (req, res) => {
  try {
    const listingId = Number(req.params.id);
    const { animation, subtitlesSrt, inputOverride } = req.body || {};
    const validAnim = new Set(['op1', 'op2', 'op3', 'op4', 'op5', 'op6']);
    if (!animation || !validAnim.has(String(animation))) {
      return res.status(400).json({ error: 'animation deve ser op1, op2, op3, op4, op5 ou op6' });
    }
    const result = await buildRemotionPreviewHtml(listingId, { animation, subtitlesSrt, inputOverride, imageProxyBase: remotionImageProxyBase(req) });
    if (result.error) return res.status(result.status || 500).json({ error: result.error });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(result.html);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Duração da animação do poster (ms)
const POSTER_DURATION_MS = 5000;

/**
 * Gera screenshots dos frames da animação do poster e envia cada um para um webhook em base64.
 * Requer BROWSERLESS_WS_URL e PUBLIC_APP_URL. O webhook recebe: frame_number, total_frames, image_base64, listing_id, mime_type.
 */
app.post('/api/poster-frames-to-webhook', async (req, res) => {
  const browserlessUrlFromEnv = process.env.BROWSERLESS_WS_URL || process.env.BROWSERLESS_URL || '';
  const browserlessUrl = (await getSetting('browserless_ws_url', '')).trim() || browserlessUrlFromEnv;
  const publicAppUrlFromEnv = (process.env.PUBLIC_APP_URL || process.env.VITE_APP_URL || '').replace(/\/$/, '');
  const { listing_id: listingId, webhook_url: bodyWebhookUrl, fps: fpsParam, layout: layoutParam, public_app_url: bodyPublicAppUrl, duration_ms: durationMsParam, poster_url: posterUrlOverride, viewport_width: viewportWidthParam, viewport_height: viewportHeightParam } = req.body || {};
  const fps = Math.min(30, Math.max(10, Number(fpsParam) || 25));
  const layout = (layoutParam && String(layoutParam).trim()) || 'classic';
  const intervalMs = 1000 / fps;
  const effectiveDurationMs = (durationMsParam && Number(durationMsParam) > 0) ? Number(durationMsParam) : POSTER_DURATION_MS;
  const totalFrames = Math.ceil((effectiveDurationMs / 1000) * fps);

  const publicAppUrlFromBody = (bodyPublicAppUrl != null ? String(bodyPublicAppUrl).trim() : '').replace(/\/$/, '');
  const publicAppUrl = publicAppUrlFromBody || publicAppUrlFromEnv;

  if (!listingId) return res.status(400).json({ error: 'listing_id é obrigatório' });
  const webhookUrl = bodyWebhookUrl?.trim() || (await getSetting('webhook_frames_save', '')).trim();
  if (!publicAppUrl) return res.status(503).json({ error: 'URL base do frontend não informada. Ao clicar no botão o app envia automaticamente; se chamar a API de fora, envie public_app_url no body ou configure PUBLIC_APP_URL no servidor.' });

  const captureServiceUrl = browserlessUrl.trim();
  const isHttpOpenEndpoint = /^https?:\/\//i.test(captureServiceUrl);

  if (isHttpOpenEndpoint) {
    const fullPosterUrl = posterUrlOverride || `${publicAppUrl}/poster-video/${listingId}?capture=1&layout=${encodeURIComponent(layout)}`;
    // 156 frames a ~3s/frame ≈ 8 min; timeout da página no serviço de captura (timeoutMs)
    const captureTimeoutMs = 10 * 60 * 1000; // 10 min
    const requestTimeoutMs = captureTimeoutMs + 60000; // 11 min para o fetch não abortar antes
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
      const openRes = await fetch(captureServiceUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: fullPosterUrl,
          timeoutMs: captureTimeoutMs,
          ...(viewportWidthParam ? { viewportWidth: Number(viewportWidthParam) } : {}),
          ...(viewportHeightParam ? { viewportHeight: Number(viewportHeightParam) } : {}),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!openRes.ok) {
        const errText = await openRes.text();
        throw new Error(`Serviço de captura retornou ${openRes.status}: ${errText || openRes.statusText}`);
      }
      const result = { ok: true, listing_id: Number(listingId), layout, via: 'capture_service' };
      res.json(result);
      const payload = { listing_id: Number(listingId), status: 'done', layout, via: 'capture_service' };
      const webhookDoneUrl = (await getSetting('webhook_frames_done', '')).trim();
      if (webhookDoneUrl) {
        fetch(webhookDoneUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch((err) => console.error('[webhook_frames_done]', err.message));
      }
      const webhookMontarUrl = (await getSetting('webhook_montar_mp4', '')).trim();
      if (webhookMontarUrl) {
        fetch(webhookMontarUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, action: 'montar_mp4' }) }).catch((err) => console.error('[webhook_montar_mp4]', err.message));
      }
    } catch (e) {
      console.error('[poster-frames-to-webhook] capture_service', e.message);
      res.status(500).json({ error: e.message });
    }
    return;
  }

  if (!webhookUrl) return res.status(400).json({ error: 'webhook_url é obrigatório no body ou configure webhook_frames_save nas configurações' });
  if (!browserlessUrl) return res.status(503).json({ error: 'Configure o Browserless ou a URL do serviço de captura (/open) em Configurações' });

  let imobname = '';
  let advertiserCode = '';
  try {
    const row = await db.prepare('SELECT raw_data FROM listings WHERE id = ?').get(Number(listingId));
    if (row && row.raw_data) {
      const raw = JSON.parse(row.raw_data);
      imobname = raw.imobname || '';
      advertiserCode = raw.advertiserCode || '';
    }
  } catch (_) {}

  const posterUrl = posterUrlOverride || `${publicAppUrl}/poster-video/${listingId}?layout=${encodeURIComponent(layout)}`;

  try {
    const { chromium } = await import('playwright-core');
    const browser = await chromium.connectOverCDP(browserlessUrl, { timeout: 15000 });
    const context = await browser.newContext({ viewport: { width: 1080, height: 1920 } });
    const page = await context.newPage();
    await page.goto(posterUrl, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForSelector('.poster-preview', { timeout: 10000 });
    await new Promise((r) => setTimeout(r, 300));

    let sent = 0;
    for (let i = 0; i < totalFrames; i++) {
      const frameNumber = i + 1;
      const buffer = await page.screenshot({ type: 'jpeg', quality: 70, fullPage: false });
      const imageBase64 = buffer.toString('base64');
      const payload = {
        frame_number: frameNumber,
        total_frames: totalFrames,
        frame_name: `frame_${String(frameNumber).padStart(4, '0')}.jpg`,
        image_base64: imageBase64,
        listing_id: Number(listingId),
        imobname,
        advertiserCode,
        mime_type: 'image/jpeg',
        timestamp_ms: Math.round(i * intervalMs),
      };
      const fr = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!fr.ok) throw new Error(`Webhook retornou ${fr.status} no frame ${frameNumber}`);
      sent++;
      if (i < totalFrames - 1) await new Promise((r) => setTimeout(r, Math.max(0, intervalMs - 50)));
    }

    await context.close();
    await browser.close();
    const result = { ok: true, frames_sent: sent, total_frames: totalFrames, fps, listing_id: Number(listingId), layout };
    res.json(result);
    const payload = { listing_id: Number(listingId), frames_sent: sent, total_frames: totalFrames, status: 'done', layout };
    const webhookDoneUrl = (await getSetting('webhook_frames_done', '')).trim();
    if (webhookDoneUrl) {
      fetch(webhookDoneUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch((err) => console.error('[webhook_frames_done]', err.message));
    }
    const webhookMontarUrl = (await getSetting('webhook_montar_mp4', '')).trim();
    if (webhookMontarUrl) {
      fetch(webhookMontarUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, action: 'montar_mp4' }),
      }).catch((err) => console.error('[webhook_montar_mp4]', err.message));
    }
  } catch (e) {
    console.error('[poster-frames-to-webhook]', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/listings', async (req, res) => {
  try {
    const { client_id, source_url, raw_data, selected_images, webhook_payload } = req.body;
    const raw = typeof raw_data === 'string' ? raw_data : JSON.stringify(raw_data || {});
    const sel = selected_images != null ? JSON.stringify(selected_images) : null;
    const wh = webhook_payload != null ? JSON.stringify(webhook_payload) : null;
    const result = await db.prepare(`
      INSERT INTO listings (client_id, source_url, raw_data, selected_images, webhook_payload)
      VALUES (?, ?, ?, ?, ?)
    `).run(client_id ?? null, source_url ?? null, raw, sel, wh);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/listings/import', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Envie um array "items" com pelo menos um anúncio.' });
    }
    const client_id = req.body.client_id ?? null;
    const ids = [];
    for (const raw_data of items) {
      const raw = typeof raw_data === 'string' ? raw_data : JSON.stringify(raw_data || {});
      const result = await db.prepare(`
        INSERT INTO listings (client_id, raw_data, selected_images, webhook_payload)
        VALUES (?, ?, ?, ?)
      `).run(client_id, raw, null, null);
      ids.push(result.lastInsertRowid);
    }
    res.status(201).json({ imported: ids.length, ids });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Importar a partir de URL: dispara webhook n8n (captação); se o n8n devolver dados do imóvel, cadastramos
// Timeout longo (2 min) para o n8n processar o link e responder com "Respond to Webhook"
const WEBHOOK_CAPTACAO_TIMEOUT_MS = 120000;

app.post('/api/listings/import-from-url', async (req, res) => {
  try {
    const { url, client_id } = req.body;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'URL do anúncio é obrigatória.' });
    const webhookUrl = await getSetting('webhook_captacao', '');
    if (!webhookUrl) return res.status(400).json({ error: 'Configure a URL do webhook de captação em Configurações.' });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_CAPTACAO_TIMEOUT_MS);
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, client_id: client_id || null }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.json({ ok: true, message: 'Webhook disparado. O n8n pode cadastrar o imóvel no seu banco.', raw: text });
    }
    const listing = Array.isArray(data) ? data[0] : data;
    if (listing && (listing.carousel_images || listing.title)) {
      let effectiveClientId = client_id ?? null;
      if (effectiveClientId == null) {
        const imobname = (listing.imobname || listing.advertiserName || listing.title || 'Cliente').trim() || 'Cliente';
        const existing = await db.prepare('SELECT id FROM clients WHERE TRIM(LOWER(name)) = TRIM(LOWER(?))').get(imobname);
        if (existing) {
          effectiveClientId = existing.id;
        } else {
          const pragmaRows = await db.prepare('PRAGMA table_info(clients)').all();
          const existingCols = (pragmaRows || []).map((c) => c.name);
          const insertCols = CLIENT_COLUMNS.filter((c) => !['id', 'created_at', 'updated_at'].includes(c) && existingCols.includes(c));
          const placeholders = insertCols.map(() => '?').join(', ');
          const values = insertCols.map((col) => {
            if (col === 'name') return imobname;
            if (col === 'logo_url') return listing.logoimob || null;
            if (col === 'status') return 'lead';
            return null;
          });
          const clientResult = await db.prepare(`INSERT INTO clients (${insertCols.join(', ')}) VALUES (${placeholders})`).run(...values);
          effectiveClientId = clientResult.lastInsertRowid;
        }
      }
      const raw = JSON.stringify(listing);
      const result = await db.prepare(`
        INSERT INTO listings (client_id, source_url, raw_data, selected_images, webhook_payload)
        VALUES (?, ?, ?, ?, ?)
      `).run(effectiveClientId, url, raw, null, null);
      return res.status(201).json({ ok: true, id: result.lastInsertRowid, client_id: effectiveClientId, message: 'Imóvel cadastrado.' });
    }
    res.json({ ok: true, message: 'Webhook disparado.', raw: text });
  } catch (e) {
    if (e.name === 'AbortError') {
      return res.status(504).json({ error: 'O webhook de captação demorou mais de 2 minutos para responder. No n8n, use o nó "Respond to Webhook" ao final do fluxo e retorne o JSON do imóvel.' });
    }
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/listings/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { raw_data, selected_images, webhook_payload, source_url } = req.body;
    const updates = [];
    const values = [];
    if (raw_data !== undefined) {
      updates.push('raw_data = ?');
      values.push(typeof raw_data === 'string' ? raw_data : JSON.stringify(raw_data));
    }
    if (selected_images !== undefined) {
      updates.push('selected_images = ?');
      values.push(selected_images == null ? null : JSON.stringify(selected_images));
    }
    if (webhook_payload !== undefined) {
      updates.push('webhook_payload = ?');
      values.push(webhook_payload == null ? null : JSON.stringify(webhook_payload));
    }
    if (source_url !== undefined) {
      updates.push('source_url = ?');
      values.push(source_url);
    }
    if (updates.length === 0) return res.status(400).json({ error: 'Nada para atualizar' });
    updates.push("updated_at = datetime('now')");
    values.push(id);
    await db.prepare(`UPDATE listings SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/listings/:id', async (req, res) => {
  try {
    const result = await db.prepare('DELETE FROM listings WHERE id = ?').run(Number(req.params.id));
    if (result.changes === 0) return res.status(404).json({ error: 'Não encontrado' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// FireMode Now: envia payload para webhook de produção (n8n)
app.post('/api/listings/:id/firemode', async (req, res) => {
  try {
    const id = Number(req.params.id);
    let payload = req.body.payload;
    if (!payload) {
      const r = await db.prepare(`
        SELECT raw_data, selected_images, webhook_payload FROM listings WHERE id = ?
      `).get(id);
      if (!r) return res.status(404).json({ error: 'Não encontrado' });
      const raw = JSON.parse(r.raw_data);
      const selected = r.selected_images ? JSON.parse(r.selected_images) : raw.carousel_images || [];
      const custom = r.webhook_payload ? JSON.parse(r.webhook_payload) : null;
      payload = custom || {
        title: raw.title,
        description: raw.description,
        salePrice: raw.salePrice,
        prices: raw.prices,
        imobname: raw.imobname,
        logoimob: raw.logoimob,
        advertiserCode: raw.advertiserCode,
        vivaRealCode: raw.vivaRealCode,
        propertyCodes: raw.propertyCodes,
        amenities: raw['amenities-list'],
        images: selected,
      };
    }
    const webhookUrl = req.body.webhook_url || (await getSetting('webhook_producao', ''));
    if (!webhookUrl) return res.status(400).json({ error: 'Configure a URL do webhook de produção em Configurações.' });
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    res.json({ ok: response.ok, status: response.status, body: text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/webhook/send', async (req, res) => {
  try {
    const { url, payload } = req.body;
    if (!url || !payload) return res.status(400).json({ error: 'url e payload são obrigatórios' });
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    res.status(response.status).json({
      ok: response.ok,
      status: response.status,
      body: text,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── API: slug único e URL base do catálogo ───────────────────────────────────

/** Retorna a URL base do catálogo (configurável via CATALOG_BASE_URL ou auto-detectada) */
function getCatalogBase(req) {
  const env = process.env.CATALOG_BASE_URL;
  if (env) return env.replace(/\/$/, '');
  // Auto-detecção: usa mesma origem da API
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3333';
  return `${proto}://${host}`;
}

/** Retorna a URL base da API para proxying de imagens */
function getApiBase(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3333';
  return `${proto}://${host}`;
}

/** Busca cliente por slug (para a API do admin) */
app.get('/api/clients/by-slug/:slug', async (req, res) => {
  try {
    const cols = CLIENT_COLUMNS.join(', ');
    const r = await db.prepare(`SELECT ${cols} FROM clients WHERE slug = ?`).get(req.params.slug);
    if (!r) return res.status(404).json({ error: 'Não encontrado' });
    res.json(r);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Verifica se um slug já está em uso (exceto pelo cliente atual) */
app.get('/api/clients/check-slug', async (req, res) => {
  try {
    const { slug, exclude_id } = req.query;
    if (!slug) return res.json({ available: false });
    const existing = await db.prepare('SELECT id FROM clients WHERE slug = ?').get(slug);
    const available = !existing || (exclude_id && String(existing.id) === String(exclude_id));
    res.json({ available, slug });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Catálogo público SSR ─────────────────────────────────────────────────────

/**
 * Helper: resolve o cliente pelo slug da URL ou pelo custom_domain do Host header.
 * Domínio próprio tem prioridade sobre slug.
 */
async function resolveClientForCatalog(req, slugParam) {
  const host = (req.hostname || '').toLowerCase();
  // Tenta custom_domain primeiro (ex.: imoveis.imobiliariaxyz.com.br)
  const byDomain = await db.prepare(
    `SELECT ${CLIENT_COLUMNS.join(', ')} FROM clients WHERE LOWER(custom_domain) = ?`
  ).get(host);
  if (byDomain) return byDomain;
  // Senão usa slug da URL
  if (!slugParam) return null;
  return db.prepare(`SELECT ${CLIENT_COLUMNS.join(', ')} FROM clients WHERE slug = ?`).get(slugParam);
}

// Redirecionamentos de compatibilidade (URLs antigas → novas)
app.get('/catalogo/:slug', (req, res) => {
  res.redirect(301, `/${req.params.slug}/catalogo`);
});
app.get('/catalogo/:slug/:listingId', (req, res) => {
  res.redirect(301, `/${req.params.slug}/catalogo/${req.params.listingId}`);
});

// Perfil público do cliente (home)
app.get('/:slug([a-z0-9-]{2,60})', async (req, res, next) => {
  try {
    const client = await resolveClientForCatalog(req, req.params.slug);
    if (!client) return next();
    const corretores = await db.prepare('SELECT * FROM corretores WHERE client_id = ? AND active = 1 ORDER BY sort_order ASC, name ASC').all(client.id);
    const featuredListings = await db.prepare('SELECT id, raw_data, selected_images FROM listings WHERE client_id = ? ORDER BY updated_at DESC LIMIT 4').all(client.id);
    const html = renderProfilePage(client, getCatalogBase(req), getApiBase(req), corretores, featuredListings);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
    res.send(html);
  } catch (e) {
    console.error('[profile]', e);
    next();
  }
});

// Catálogo: lista de imóveis do cliente
app.get('/:slug([a-z0-9-]{2,60})/catalogo', async (req, res, next) => {
  try {
    const client = await resolveClientForCatalog(req, req.params.slug);
    if (!client) return res.status(404).send('<h1>Catálogo não encontrado</h1>');
    const listings = await db.prepare(
      'SELECT id, raw_data, selected_images, updated_at FROM listings WHERE client_id = ? ORDER BY updated_at DESC'
    ).all(client.id);
    const html = renderCatalogPage(client, listings, getCatalogBase(req), getApiBase(req));
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
    res.send(html);
  } catch (e) {
    console.error('[catalog]', e);
    res.status(500).send('<h1>Erro interno</h1>');
  }
});

// Catálogo: página individual do imóvel
app.get('/:slug([a-z0-9-]{2,60})/catalogo/:listingId', async (req, res) => {
  try {
    const client = await resolveClientForCatalog(req, req.params.slug);
    if (!client) return res.status(404).send('<h1>Catálogo não encontrado</h1>');
    const row = await db.prepare(
      'SELECT id, client_id, raw_data, selected_images, updated_at FROM listings WHERE id = ? AND client_id = ?'
    ).get(Number(req.params.listingId), client.id);
    if (!row) return res.status(404).send('<h1>Imóvel não encontrado</h1>');
    const html = renderListingPage(client, row, getCatalogBase(req), getApiBase(req));
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.send(html);
  } catch (e) {
    console.error('[catalog listing]', e);
    res.status(500).send('<h1>Erro interno</h1>');
  }
});

// Sitemap XML
app.get('/:slug([a-z0-9-]{2,60})/sitemap.xml', async (req, res) => {
  try {
    const client = await resolveClientForCatalog(req, req.params.slug);
    if (!client) return res.status(404).send('');
    const listings = await db.prepare(
      'SELECT id, updated_at FROM listings WHERE client_id = ? ORDER BY updated_at DESC'
    ).all(client.id);
    const xml = renderSitemap(client, listings, getCatalogBase(req));
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (e) {
    res.status(500).send('');
  }
});

// Robots.txt
app.get('/:slug([a-z0-9-]{2,60})/robots.txt', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send('User-agent: *\nAllow: /\n');
});

// Perfil público do corretor
app.get('/:slug([a-z0-9-]{2,60})/:corretorSlug([a-z0-9-]{2,60})', async (req, res, next) => {
  try {
    const client = await resolveClientForCatalog(req, req.params.slug);
    if (!client) return next();
    const cSlug = req.params.corretorSlug;
    // Busca por slug salvo; fallback: todos do cliente e compara nome slugificado
    let corretor = await db.prepare(
      'SELECT * FROM corretores WHERE client_id = ? AND slug = ? AND active = 1'
    ).get(client.id, cSlug);
    if (!corretor) {
      const todos = await db.prepare(
        'SELECT * FROM corretores WHERE client_id = ? AND active = 1'
      ).all(client.id);
      corretor = todos.find(c => slugify(c.name || '') === cSlug) || null;
      // Se achou pelo nome, persiste o slug para não repetir essa busca
      if (corretor) {
        db.prepare('UPDATE corretores SET slug = ? WHERE id = ?').run(cSlug, corretor.id).catch(() => {});
      }
    }
    if (!corretor) return next();
    const html = renderCorretorPage(client, corretor, getCatalogBase(req), getApiBase(req));
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
    res.send(html);
  } catch (e) {
    console.error('[corretor]', e);
    next();
  }
});

// Domínio próprio: raiz → perfil do cliente pelo custom_domain
app.get('/', async (req, res, next) => {
  try {
    const host = (req.hostname || '').toLowerCase();
    if (!host || host === 'localhost') return next();
    const client = await db.prepare(
      `SELECT ${CLIENT_COLUMNS.join(', ')} FROM clients WHERE LOWER(custom_domain) = ?`
    ).get(host);
    if (!client) return next();
    const corretores = await db.prepare('SELECT * FROM corretores WHERE client_id = ? AND active = 1 ORDER BY sort_order ASC, name ASC').all(client.id);
    const featuredListings = await db.prepare('SELECT id, raw_data, selected_images FROM listings WHERE client_id = ? ORDER BY updated_at DESC LIMIT 4').all(client.id);
    const html = renderProfilePage(client, `https://${host}`, getApiBase(req), corretores, featuredListings);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
    res.send(html);
  } catch (e) {
    next();
  }
});

// Domínio próprio: /:id → imóvel do cliente pelo custom_domain
app.get('/:listingId(\\d+)', async (req, res, next) => {
  try {
    const host = (req.hostname || '').toLowerCase();
    if (!host || host === 'localhost') return next();
    const client = await db.prepare(
      `SELECT ${CLIENT_COLUMNS.join(', ')} FROM clients WHERE LOWER(custom_domain) = ?`
    ).get(host);
    if (!client) return next();
    const row = await db.prepare(
      'SELECT id, client_id, raw_data, selected_images, updated_at FROM listings WHERE id = ? AND client_id = ?'
    ).get(Number(req.params.listingId), client.id);
    if (!row) return res.status(404).send('<h1>Imóvel não encontrado</h1>');
    const html = renderListingPage(client, row, `https://${host}`, getApiBase(req));
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.send(html);
  } catch (e) {
    next();
  }
});

// ─────────────────────────────────────────────────────────────────────────────

init()
  .then(async () => {
    // Gera slugs para corretores que ainda não têm (cadastrados antes da feature)
    try {
      const semSlug = await db.prepare('SELECT id, client_id, name FROM corretores WHERE slug IS NULL OR slug = ""').all();
      for (const c of semSlug) {
        const RESERVED = ['catalogo', 'sitemap.xml', 'robots.txt'];
        let base = slugify(c.name || '');
        if (!base || RESERVED.includes(base)) base = 'corretor';
        let final = base; let attempt = 0;
        while (true) {
          const ex = await db.prepare('SELECT id FROM corretores WHERE client_id = ? AND slug = ? AND id != ?').get(c.client_id, final, c.id);
          if (!ex) break;
          attempt++; final = `${base}-${attempt}`;
        }
        await db.prepare('UPDATE corretores SET slug = ? WHERE id = ?').run(final, c.id);
        console.log(`[corretores] slug gerado: ${c.name} → ${final}`);
      }
    } catch (e) { console.warn('[corretores] erro ao gerar slugs:', e.message); }

    app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT} (Turso)`));
  })
  .catch((err) => {
    console.error('Erro ao conectar ao Turso:', err.message);
    process.exit(1);
  });
