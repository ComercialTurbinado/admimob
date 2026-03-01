import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import db, { init } from './db.js';

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
    let plans = await getSetting('plans', [
      { id: '297', label: 'R$ 297', price: 297, credit_label: 'Vídeos simples', credit_count: 5, payment_url: '' },
      { id: '497', label: 'R$ 497', price: 497, credit_label: 'Vídeos simples', credit_count: 10, payment_url: '' },
      { id: '997', label: 'R$ 997', price: 997, credit_label: 'Vídeos com narração', credit_count: 10, payment_url: '' },
    ]);
    plans = plans.map((p) => ({ ...p, payment_url: p.payment_url ?? '' }));
    res.json({ kpis, payment_links, webhook_captacao, webhook_producao, plans });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/dashboard', async (req, res) => {
  try {
    const { payment_links, webhook_captacao, webhook_producao, plans } = req.body;
    if (payment_links !== undefined) await setSetting('payment_links', payment_links);
    if (webhook_captacao !== undefined) await setSetting('webhook_captacao', webhook_captacao);
    if (webhook_producao !== undefined) await setSetting('webhook_producao', webhook_producao);
    if (plans !== undefined) await setSetting('plans', plans);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
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
    const values = insertCols.map((col) => {
      const v = req.body[col];
      if (col === 'name') return v || '';
      if (col === 'status') return v || 'lead';
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
        values.push(req.body[col] === '' ? null : req.body[col]);
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

// Materiais: baseUrl S3 por advertiserCode + opcional manifest.json
const MATERIAIS_BASE = 'https://firemode.s3.us-east-1.amazonaws.com/firemode/imob';
app.get('/api/listings/:id/materiais', async (req, res) => {
  try {
    const r = await db.prepare(`
      SELECT id, client_id, raw_data FROM listings WHERE id = ?
    `).get(Number(req.params.id));
    if (!r) return res.status(404).json({ error: 'Não encontrado' });
    const raw = JSON.parse(r.raw_data);
    const advertiserCode = raw.advertiserCode || '';
    const baseUrl = advertiserCode ? `${MATERIAIS_BASE}/${encodeURIComponent(advertiserCode)}/` : '';
    let files = { videos: [], narration: [], music: [] };
    if (baseUrl) {
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
      } catch (_) {
        // manifest opcional
      }
    }
    res.json({ baseUrl, files, listing: { id: r.id, client_id: r.client_id, ...raw } });
  } catch (e) {
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
      const raw = JSON.stringify(listing);
      const result = await db.prepare(`
        INSERT INTO listings (client_id, source_url, raw_data, selected_images, webhook_payload)
        VALUES (?, ?, ?, ?, ?)
      `).run(client_id ?? null, url, raw, null, null);
      return res.status(201).json({ ok: true, id: result.lastInsertRowid, message: 'Imóvel cadastrado.' });
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

init()
  .then(() => {
    app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT} (Turso)`));
  })
  .catch((err) => {
    console.error('Erro ao conectar ao Turso:', err.message);
    process.exit(1);
  });
