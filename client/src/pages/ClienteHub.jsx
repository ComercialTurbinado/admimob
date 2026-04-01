import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API, proxyImageUrl } from '../api';
import { DEFAULT_PALETTE, getDominantColorFromImageUrl, getPaletteFromPrimary } from '../lib/dominantColor';

// ─── Admin Light theme tokens ──────────────────────────────────────────────────
const T = {
  bg: '#f5f4f0',
  surfaceLow: '#ffffff',
  surface: '#f0efe9',
  surfaceHigh: '#eceae2',
  surfaceHighest: '#e3e0d5',
  primary: '#c9a227',
  primaryCt: '#a8861a',
  onSurface: '#1a1916',
  onSurfaceVariant: '#5c5750',
  outlineVariant: '#dedad0',
  danger: '#c0392b',
  success: '#276749',
};

// ─── Color fields ──────────────────────────────────────────────────────────────
// group: which section each field belongs to (for the grouped UI)
const COLOR_FIELDS = [
  // ── Fundo geral ──
  { key: '--page-bg',       label: 'Fundo das Páginas',    hint: 'Fundo de todas as páginas — padrão: #131313 (preto escuro)', group: 'site' },
  // ── Cabeçalho — header web + tela de contato do vídeo ──
  { key: '--contact-bg',    label: 'Cor de Marca (Cabeçalho)', hint: 'Fundo do cabeçalho em todas as páginas E tela final do vídeo — gerado escuro e rico automaticamente', group: 'header' },
  { key: '--contact-text',  label: 'Texto sobre a Cor de Marca', hint: 'Texto e ícones sobre o cabeçalho/tela de contato — mantenha #ffffff para fundo escuro', group: 'header' },
  // ── Destaque — preços, links, ícones ──
  { key: '--primary',       label: 'Cor de Destaque',      hint: 'Preços, ícones, links e destaques em todas as páginas e no vídeo', group: 'brand' },
  // ── Botão CTA ──
  { key: '--btn-bg',        label: 'Botão — Fundo',        hint: 'Fundo do botão de ação (gerado em cor split-complementar para contrastar com o cabeçalho)', group: 'brand' },
  { key: '--btn-text',      label: 'Botão — Texto',        hint: 'Texto do botão — calculado automaticamente para contraste, mas pode ajustar', group: 'brand' },
  // ── Badge / chip — catálogo e vídeo ──
  { key: '--bg-poster',     label: 'Badge / Chip',         hint: 'Fundo dos chips "À VENDA" nos cards e no vídeo — gerado como versão escura da cor de destaque', group: 'brand' },
  // ── Vídeo — vars exclusivas (geradas do logo) ──
  { key: '--text-poster',   label: 'Texto Principal (Vídeo)',    hint: 'Preço e textos principais no poster de vídeo (fundo branco)', group: 'poster' },
  { key: '--detail-poster', label: 'Texto Secundário (Vídeo)',   hint: 'Referências, rótulos de stats e textos menores no vídeo', group: 'poster' },
  { key: '--line-poster',   label: 'Linhas / Bordas (Vídeo)',    hint: 'Separadores da seção de quartos/banheiros/vagas no vídeo', group: 'poster' },
  { key: '--amen-bg',       label: 'Lazer — Fundo (Vídeo)',      hint: 'Fundo dos cards de amenidades no vídeo', group: 'poster' },
  { key: '--amen-bd',       label: 'Lazer — Borda (Vídeo)',      hint: 'Borda dos cards de amenidades no vídeo', group: 'poster' },
];

const COLOR_GROUPS = [
  { key: 'site',   label: 'Fundo das Páginas',      hint: 'Cor de fundo de todas as páginas públicas' },
  { key: 'header', label: 'Cabeçalho & Cor de Marca', hint: 'Aparece no topo de todas as páginas e na tela final do vídeo' },
  { key: 'brand',  label: 'Destaque, Botões & Badges', hint: 'Cor de destaque (preços/ícones), botão CTA e chips nos cards' },
  { key: 'poster', label: 'Vídeo Poster (exclusivo)', hint: 'Cores do poster de vídeo gerado — fundo branco, derivadas do logo' },
];

const PRESET_COLORS = [
  '#f2ca50','#c9a227','#a8861a','#f5e67a',
  '#131313','#1c1b1b','#2a2828','#4a4540',
  '#ffffff','#f5f4f0','#e5e2e1','#9ca3af',
  '#2563eb','#0ea5e9','#22c55e','#c0392b',
  '#8b5cf6','#f97316','#ec4899','#14b8a6',
];

const SECTION_LABELS = {
  cta:   { icon: 'apartment', label: 'Botão Catálogo',      hint: 'CTA principal para ver imóveis' },
  links: { icon: 'link',      label: 'Links Estratégicos',  hint: 'WhatsApp, Instagram, site, etc.' },
  about: { icon: 'article',   label: 'Quem Somos',          hint: 'Bio, vídeo e galeria de imagens' },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function parseJson(raw) {
  if (!raw) return {};
  try { return typeof raw === 'string' ? JSON.parse(raw) : (raw || {}); } catch { return {}; }
}

function generateId() {
  return Date.now().toString() + Math.random().toString(36).slice(2);
}

function buildCatalogUrl(client) {
  if (!client?.slug) return null;
  const base = (import.meta.env.VITE_CATALOG_URL || '').replace(/\/$/, '');
  if (base) return `${base}/${client.slug}/catalogo`;
  const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:3333').replace(/\/api$/, '').replace(/\/$/, '');
  return `${apiBase}/${client.slug}/catalogo`;
}

function clientSlugify(name = '') {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'corretor';
}

function buildCorretorUrl(client, corretorSlugOrName) {
  if (!client?.slug || !corretorSlugOrName) return null;
  const base = (import.meta.env.VITE_CATALOG_URL || '').replace(/\/$/, '');
  if (base) return `${base}/${client.slug}/${corretorSlugOrName}`;
  const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:3333').replace(/\/api$/, '').replace(/\/$/, '');
  return `${apiBase}/${client.slug}/${corretorSlugOrName}`;
}

// ─── Shared style primitives ───────────────────────────────────────────────────
const inputStyle = {
  width: '100%',
  background: T.surfaceHighest,
  border: 'none',
  borderRadius: 3,
  color: T.onSurface,
  padding: '0.6rem 0.85rem',
  fontSize: '0.9rem',
  fontFamily: 'Manrope, sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.72rem',
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  color: T.onSurfaceVariant,
  marginBottom: '0.4rem',
  fontFamily: 'Manrope, sans-serif',
};

const formGroupStyle = { marginBottom: '1rem' };

const cardStyle = {
  background: T.surfaceLow,
  border: `1px solid ${T.outlineVariant}`,
  borderRadius: 6,
  padding: '1.5rem',
  marginBottom: '1.25rem',
};

const sectionTitleStyle = {
  fontFamily: 'Noto Serif, serif',
  fontSize: '1.05rem',
  fontWeight: 700,
  color: T.onSurface,
  margin: '0 0 0.35rem',
};

const sectionSubtitleStyle = {
  fontSize: '0.8rem',
  color: T.onSurfaceVariant,
  margin: '0 0 1.25rem',
  fontFamily: 'Manrope, sans-serif',
};

// ─── Toggle component ──────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', userSelect: 'none' }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          background: checked ? T.primaryCt : T.surfaceHighest,
          border: `1px solid ${checked ? T.primaryCt : T.outlineVariant}`,
          position: 'relative',
          cursor: 'pointer',
          transition: 'background 0.2s',
          flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute',
          top: 3,
          left: checked ? 22 : 3,
          width: 16,
          height: 16,
          background: checked ? '#3c2f00' : T.onSurfaceVariant,
          borderRadius: '50%',
          transition: 'left 0.2s',
        }} />
      </div>
      {label && (
        <span style={{ fontSize: '0.88rem', color: T.onSurface, fontFamily: 'Manrope, sans-serif' }}>
          {label}
        </span>
      )}
    </label>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
// ─── Custom Color Picker ───────────────────────────────────────────────────────
function hexToHsv(hex) {
  const r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  let h = 0;
  if (d) {
    if (max===r) h=((g-b)/d)%6;
    else if (max===g) h=(b-r)/d+2;
    else h=(r-g)/d+4;
    h = Math.round(h*60); if (h<0) h+=360;
  }
  return { h, s: max ? d/max : 0, v: max };
}
function hsvToHex(h, s, v) {
  const f = n => { const k=(n+h/60)%6; return v - v*s*Math.max(0,Math.min(k,4-k,1)); };
  return '#'+[f(5),f(3),f(1)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('');
}

function ColorSVSquare({ hue, sat, val, onChange }) {
  const ref = useRef(null);
  const dragging = useRef(false);
  function pick(e) {
    const rect = ref.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const s = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    onChange(s, v);
  }
  function onMouseDown(e) {
    e.stopPropagation(); e.preventDefault();
    dragging.current = true; pick(e);
    const onMove = ev => { ev.preventDefault(); pick(ev); };
    const onUp   = ev => { ev.stopPropagation(); dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }
  return (
    <div ref={ref} onMouseDown={onMouseDown}
      style={{ width:'100%', height:140, borderRadius:4, cursor:'crosshair', position:'relative', userSelect:'none',
        background:`linear-gradient(to bottom,transparent,#000),linear-gradient(to right,#fff,hsl(${hue},100%,50%))` }}>
      <div style={{ position:'absolute', left:`${sat*100}%`, top:`${(1-val)*100}%`, transform:'translate(-50%,-50%)',
        width:13, height:13, borderRadius:'50%', border:'2px solid #fff', boxShadow:'0 0 0 1px rgba(0,0,0,0.5)', pointerEvents:'none' }} />
    </div>
  );
}

function ColorHueSlider({ hue, onChange }) {
  const ref = useRef(null);
  function pick(e) {
    const rect = ref.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onChange(Math.round(x * 360));
  }
  function onMouseDown(e) {
    e.stopPropagation(); e.preventDefault();
    pick(e);
    const onMove = ev => { ev.preventDefault(); pick(ev); };
    const onUp   = ev => { ev.stopPropagation(); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }
  return (
    <div ref={ref} onMouseDown={onMouseDown}
      style={{ height:14, borderRadius:7, cursor:'pointer', position:'relative', userSelect:'none',
        background:'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }}>
      <div style={{ position:'absolute', left:`${(hue/360)*100}%`, top:'50%', transform:'translate(-50%,-50%)',
        width:18, height:18, borderRadius:'50%', border:'2px solid #fff', boxShadow:'0 0 0 1px rgba(0,0,0,0.4)',
        background:`hsl(${hue},100%,50%)`, pointerEvents:'none' }} />
    </div>
  );
}

export default function ClienteHub() {
  const { id } = useParams();

  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('identity');
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);

  // Identidade
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [creci, setCreci] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [logoStyle, setLogoStyle] = useState('contain');
  const [logoUploadMsg, setLogoUploadMsg] = useState(null);
  const logoFileRef = useRef(null);

  function handleLogoFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 800 * 1024) {
      setLogoUploadMsg('⚠ Imagem muito grande. Use menos de 800 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setLogoUrl(dataUrl);
      setLogoUploadMsg(`✓ "${file.name}" carregado — gerando paleta...`);
      // Auto-extract palette from uploaded logo
      getDominantColorFromImageUrl(dataUrl).then((result) => {
        if (result?.dominant) {
          const palette = getPaletteFromPrimary(result.dominant, result.darkest ?? null, result.lightest ?? null);
          setColors((prev) => {
            const next = { ...prev };
            COLOR_FIELDS.forEach(({ key }) => {
              if (key !== '--page-bg' && palette[key]) next[key] = palette[key];
            });
            return next;
          });
          setColorMsg('Paleta gerada automaticamente do logo. Revise na aba Visual e salve.');
        } else {
          setLogoUploadMsg(`✓ "${file.name}" carregado`);
        }
      }).catch(() => {
        setLogoUploadMsg(`✓ "${file.name}" carregado`);
      });
    };
    reader.onerror = () => setLogoUploadMsg('Erro ao ler arquivo.');
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  // Links
  const [links, setLinks] = useState([]);

  // Quem Somos
  const [aboutEnabled, setAboutEnabled] = useState(true);
  const [aboutBio, setAboutBio] = useState('');
  const [aboutVideo, setAboutVideo] = useState('');
  const [aboutImages, setAboutImages] = useState(['', '', '']);

  // Visual
  const [colors, setColors] = useState({});
  const [extractingFromLogo, setExtractingFromLogo] = useState(false);
  const [colorMsg, setColorMsg] = useState(null);
  const [btnRounded, setBtnRounded] = useState(false);
  const [heroBgImage, setHeroBgImage] = useState('');
  const [heroBgMsg, setHeroBgMsg] = useState(null);
  const [previewTab, setPreviewTab] = useState('profile');
  const [openColorField, setOpenColorField] = useState(null);
  const heroBgFileRef = useRef(null);

  // Corretores
  const [corretores, setCorretores] = useState([]);
  const [loadingCorretores, setLoadingCorretores] = useState(false);
  const [corretorMsg, setCorretorMsg] = useState(null);
  const [copiedCorretorId, setCopiedCorretorId] = useState(null);
  const [editingCorretor, setEditingCorretor] = useState(null); // null = nenhum, 'new' = novo, {id,...} = editando
  const [corretorForm, setCorretorForm] = useState({ name:'', slug:'', photo_url:'', creci:'', phone:'', whatsapp:'', email:'', specialty:'', bio:'' });
  const corretorPhotoRef = useRef(null);

  function handleHeroBgFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1500 * 1024) {
      setHeroBgMsg('⚠ Imagem muito grande. Use menos de 1.5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setHeroBgImage(ev.target.result);
      setHeroBgMsg(`✓ "${file.name}" carregado como fundo`);
    };
    reader.onerror = () => setHeroBgMsg('Erro ao ler arquivo.');
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  // Layout
  const [sectionsOrder, setSectionsOrder] = useState(['cta', 'links', 'about']);

  // Imóveis
  const [listings, setListings] = useState([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [listingUrl, setListingUrl] = useState('');
  const [listingJson, setListingJson] = useState('');
  const [importingLinkL, setImportingLinkL] = useState(false);
  const [importingJsonL, setImportingJsonL] = useState(false);
  const [listingMsg, setListingMsg] = useState(null);

  function fetchListings() {
    setLoadingListings(true);
    fetch(`${API}/listings?client_id=${id}`)
      .then(r => r.json())
      .then(d => setListings(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingListings(false));
  }

  async function handleImportListingUrl() {
    if (!listingUrl.trim()) return;
    setImportingLinkL(true); setListingMsg(null);
    try {
      const res = await fetch(`${API}/listings/import-from-url`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: listingUrl.trim(), client_id: Number(id) }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setListingMsg('✓ ' + (data.message || 'Imóvel importado.'));
      setListingUrl('');
      fetchListings();
    } catch (e) { setListingMsg('Erro: ' + e.message); }
    finally { setImportingLinkL(false); }
  }

  async function handleImportListingJson() {
    if (!listingJson.trim()) return;
    setImportingJsonL(true); setListingMsg(null);
    try {
      const items = (() => { const d = JSON.parse(listingJson); return Array.isArray(d) ? d : [d]; })();
      if (!items.length) throw new Error('Nenhum item no JSON.');
      const client_id = Number(id);
      if (items.length === 1) {
        const res = await fetch(`${API}/listings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw_data: items[0], client_id }) });
        const body = await res.json(); if (body.error) throw new Error(body.error);
        setListingMsg('✓ 1 imóvel cadastrado.');
      } else {
        const res = await fetch(`${API}/listings/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items, client_id }) });
        const body = await res.json(); if (body.error) throw new Error(body.error);
        setListingMsg(`✓ ${body.imported} imóveis cadastrados.`);
      }
      setListingJson(''); fetchListings();
    } catch (e) { setListingMsg('Erro: ' + (e.message || 'JSON inválido.')); }
    finally { setImportingJsonL(false); }
  }

  async function handleRemoveListing(listingId) {
    if (!confirm('Excluir este imóvel? Esta ação não pode ser desfeita.')) return;
    try {
      const res = await fetch(`${API}/listings/${listingId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      fetchListings();
    } catch (e) { setListingMsg('Erro ao excluir: ' + e.message); }
  }

  function listingTitle(l) {
    if (l.title && String(l.title).trim()) return l.title;
    if (l.description && String(l.description).trim()) return l.description.trim().substring(0, 80);
    if (l.salePrice) return l.salePrice;
    return '(Sem título)';
  }

  // Load Google Fonts
  useEffect(() => {
    const id_ = 'hub-google-fonts';
    if (document.getElementById(id_)) return;
    const link = document.createElement('link');
    link.id = id_;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;0,900;1,400&family=Manrope:wght@300;400;500;600;700;800&display=swap';
    document.head.appendChild(link);

    const icons = document.getElementById('hub-material-symbols');
    if (!icons) {
      const iconLink = document.createElement('link');
      iconLink.id = 'hub-material-symbols';
      iconLink.rel = 'stylesheet';
      iconLink.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200';
      document.head.appendChild(iconLink);
    }
  }, []);

  // Load client data
  useEffect(() => {
    fetchListings();
    fetch(`${API}/clients/${id}`)
      .then((r) => r.json())
      .then((c) => {
        setClient(c);
        setName(c.name || '');
        setLogoUrl(c.logo_url || '');
        setCreci(c.creci || '');

        const pc = parseJson(c.profile_config);
        setSpecialty(pc.specialty || '');
        setLogoStyle(pc.logo_style || 'contain');
        setHeroBgImage(pc.hero_bg_image || '');
        setAboutEnabled(pc.about_enabled !== false);
        setAboutBio(pc.about_bio || '');
        setAboutVideo(pc.about_video || '');
        const imgs = Array.isArray(pc.about_images) ? pc.about_images : [];
        setAboutImages([imgs[0] || '', imgs[1] || '', imgs[2] || '']);
        setSectionsOrder(Array.isArray(pc.sections_order) ? pc.sections_order : ['cta', 'links', 'about']);

        // Links: always start with auto catalog link
        const catalogLink = { id: 'catalog', label: 'Ver Catálogo de Imóveis', url: 'auto' };
        const savedLinks = Array.isArray(pc.links) ? pc.links : [];
        const hasAutoLink = savedLinks.some((l) => l.url === 'auto' || l.id === 'catalog');
        const otherLinks = savedLinks.filter((l) => l.id !== 'catalog' && l.url !== 'auto');
        setLinks(hasAutoLink ? [catalogLink, ...otherLinks] : [catalogLink, ...savedLinks]);

        // Colors
        const dc = parseJson(c.design_config);
        const colorObj = {};
        COLOR_FIELDS.forEach(({ key }) => {
          colorObj[key] = dc[key] ?? DEFAULT_PALETTE[key] ?? '';
        });
        setColors(colorObj);
        setBtnRounded((dc['--btn-radius'] || '2px') !== '2px');
      })
      .catch((e) => setError('Erro ao carregar: ' + e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Save ──────────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const profile_config = {
        specialty,
        logo_style: logoStyle,
        hero_bg_image: heroBgImage || null,
        links: links.filter((l) => l.label || l.url),
        about_enabled: aboutEnabled,
        about_bio: aboutBio,
        about_video: aboutVideo,
        about_images: aboutImages.filter(Boolean),
        sections_order: sectionsOrder,
      };

      // Build design_config — only include keys with values
      const design_config = {};
      COLOR_FIELDS.forEach(({ key }) => {
        const v = colors[key];
        if (v && String(v).trim()) design_config[key] = String(v).trim();
      });
      design_config['--btn-radius'] = btnRounded ? '50px' : '2px';

      const body = {
        name,
        logo_url: logoUrl,
        creci,
        design_config: Object.keys(design_config).length ? design_config : null,
        profile_config,
      };

      const res = await fetch(`${API}/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Links helpers ─────────────────────────────────────────────────────────────
  function updateLink(linkId, field, value) {
    setLinks((prev) => prev.map((l) => l.id === linkId ? { ...l, [field]: value } : l));
  }

  function addLink() {
    if (links.length >= 5) return;
    setLinks((prev) => [...prev, { id: generateId(), label: '', url: '' }]);
  }

  function removeLink(linkId) {
    if (linkId === 'catalog') return;
    setLinks((prev) => prev.filter((l) => l.id !== linkId));
  }

  // ── Sections reorder ──────────────────────────────────────────────────────────
  function moveSection(idx, dir) {
    const arr = [...sectionsOrder];
    const swap = idx + dir;
    if (swap < 0 || swap >= arr.length) return;
    [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    setSectionsOrder(arr);
  }

  // ── Color helpers ─────────────────────────────────────────────────────────────
  function handleColorChange(key, value) {
    setColors((prev) => ({ ...prev, [key]: value }));
  }

  async function handleGenerateFromPrimary() {
    const primary = colors['--primary'];
    if (!primary) {
      setColorMsg('Defina primeiro a Cor Principal.');
      return;
    }
    const palette = getPaletteFromPrimary(primary, null, null);
    const next = { ...colors };
    COLOR_FIELDS.forEach(({ key }) => {
      if (palette[key]) next[key] = palette[key];
    });
    setColors(next);
    setColorMsg('Paleta gerada a partir da cor principal. Revise e salve.');
  }

  async function handleExtractFromLogo() {
    if (!logoUrl?.trim()) {
      setColorMsg('Defina o Logo URL na aba Identidade primeiro.');
      return;
    }
    setExtractingFromLogo(true);
    setColorMsg(null);
    try {
      const url = logoUrl.startsWith('data:') ? logoUrl : proxyImageUrl(logoUrl);
      const result = await getDominantColorFromImageUrl(url);
      if (result?.dominant) {
        const palette = getPaletteFromPrimary(result.dominant, result.darkest ?? null, result.lightest ?? null);
        const next = { ...colors };
        COLOR_FIELDS.forEach(({ key }) => {
          if (palette[key]) next[key] = palette[key];
        });
        setColors(next);
        setColorMsg('Cores extraídas do logo. Revise e salve.');
      } else {
        setColorMsg('Não foi possível extrair cores do logo. Tente ajustar manualmente.');
      }
    } catch (e) {
      setColorMsg('Erro ao extrair cores: ' + (e?.message || 'tente de novo'));
    } finally {
      setExtractingFromLogo(false);
    }
  }

  // ── Corretores helpers ────────────────────────────────────────────────────────
  function fetchCorretores() {
    setLoadingCorretores(true);
    fetch(`${API}/clients/${id}/corretores`)
      .then(r => r.json())
      .then(d => setCorretores(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingCorretores(false));
  }

  function openNewCorretor() {
    setCorretorForm({ name:'', slug:'', photo_url:'', creci:'', phone:'', whatsapp:'', email:'', specialty:'', bio:'' });
    setEditingCorretor('new');
    setCorretorMsg(null);
  }

  function openEditCorretor(c) {
    setCorretorForm({ name: c.name||'', slug: c.slug||'', photo_url: c.photo_url||'', creci: c.creci||'', phone: c.phone||'', whatsapp: c.whatsapp||'', email: c.email||'', specialty: c.specialty||'', bio: c.bio||'' });
    setEditingCorretor(c);
    setCorretorMsg(null);
  }

  function handleCorretorPhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 800 * 1024) { setCorretorMsg('⚠ Foto muito grande. Use menos de 800 KB.'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setCorretorForm(p => ({ ...p, photo_url: ev.target.result }));
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleSaveCorretor() {
    if (!corretorForm.name.trim()) { setCorretorMsg('⚠ Nome é obrigatório.'); return; }
    setCorretorMsg(null);
    try {
      if (editingCorretor === 'new') {
        const res = await fetch(`${API}/clients/${id}/corretores`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...corretorForm, active: 1 }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setCorretorMsg('✓ Corretor adicionado.');
      } else {
        const res = await fetch(`${API}/corretores/${editingCorretor.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(corretorForm),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setCorretorMsg('✓ Corretor atualizado.');
      }
      setEditingCorretor(null);
      fetchCorretores(); // recarrega para pegar slug gerado pelo servidor
    } catch (e) { setCorretorMsg('Erro: ' + e.message); }
  }

  async function handleToggleCorretorActive(c) {
    try {
      await fetch(`${API}/corretores/${c.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: c.active ? 0 : 1 }),
      });
      fetchCorretores();
    } catch {}
  }

  async function handleDeleteCorretor(c) {
    if (!confirm(`Excluir ${c.name}? Esta ação não pode ser desfeita.`)) return;
    try {
      await fetch(`${API}/corretores/${c.id}`, { method: 'DELETE' });
      fetchCorretores();
    } catch (e) { setCorretorMsg('Erro ao excluir: ' + e.message); }
  }

  const catalogUrl = client ? buildCatalogUrl(client) : null;

  // ── Loading / error states ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: T.onSurfaceVariant, fontFamily: 'Manrope, sans-serif' }}>Carregando...</p>
      </div>
    );
  }

  if (error && !client) {
    return (
      <div style={{ background: T.bg, minHeight: '100vh', padding: '2rem' }}>
        <p style={{ color: T.danger, fontFamily: 'Manrope, sans-serif' }}>{error}</p>
      </div>
    );
  }

  // ── Tabs config ───────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'identity',   icon: 'badge',    label: 'Identidade' },
    { id: 'links',      icon: 'link',     label: 'Links' },
    { id: 'about',      icon: 'article',  label: 'Quem Somos' },
    { id: 'visual',     icon: 'palette',  label: 'Visual' },
    { id: 'layout',     icon: 'reorder',  label: 'Layout' },
    { id: 'corretores', icon: 'group',    label: 'Corretores' },
    { id: 'imoveis',    icon: 'home',     label: 'Imóveis' },
  ];

  // ── Save button shared component ──────────────────────────────────────────────
  const SaveButton = ({ compact = false }) => (
    <button
      type="button"
      onClick={handleSave}
      disabled={saving}
      style={{
        background: saving ? T.surfaceHigh : T.primaryCt,
        color: '#3c2f00',
        border: 'none',
        borderRadius: 3,
        padding: compact ? '0.6rem 1.2rem' : '0.65rem 1.6rem',
        fontFamily: 'Manrope, sans-serif',
        fontWeight: 700,
        fontSize: compact ? '0.82rem' : '0.88rem',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        cursor: saving ? 'not-allowed' : 'pointer',
        opacity: saving ? 0.7 : 1,
        transition: 'opacity 0.2s',
        whiteSpace: 'nowrap',
      }}
    >
      {saving ? 'Publicando...' : 'Publicar Alterações'}
    </button>
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: T.bg,
      minHeight: '100vh',
      color: T.onSurface,
      fontFamily: 'Manrope, sans-serif',
      paddingBottom: '5rem',
    }}>

      {/* ── TopBar ── */}
      <div style={{
        background: T.surfaceLow,
        borderBottom: `1px solid ${T.outlineVariant}`,
        padding: '0.85rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        flexWrap: 'wrap',
      }}>
        {/* Breadcrumb */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link
            to={`/cliente/${id}/area`}
            style={{
              color: T.onSurfaceVariant,
              textDecoration: 'none',
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span style={{ fontSize: '1rem' }}>←</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
              {client?.name || 'Cliente'}
            </span>
          </Link>
          <h1 style={{
            fontFamily: 'Noto Serif, serif',
            fontSize: '1.25rem',
            fontWeight: 700,
            color: T.onSurface,
            margin: '0.15rem 0 0',
            lineHeight: 1.2,
          }}>
            Hub do Cliente
          </h1>
        </div>

        {/* Status + save button (desktop) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }} className="hub-topbar-actions">
          {saved && (
            <span style={{ color: T.success, fontSize: '0.82rem' }}>Alterações publicadas.</span>
          )}
          {saveError && (
            <span style={{ color: T.danger, fontSize: '0.82rem' }}>{saveError}</span>
          )}
          <SaveButton />
        </div>
      </div>

      {/* ── TabBar (sticky) ── */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: T.surface,
        borderBottom: `1px solid ${T.outlineVariant}`,
        display: 'flex',
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveTab(tab.id); if (tab.id === 'corretores' && corretores.length === 0) fetchCorretores(); }}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid ${T.primary}` : '2px solid transparent',
                color: isActive ? T.primary : T.onSurfaceVariant,
                padding: '0.85rem 1.1rem',
                fontFamily: 'Manrope, sans-serif',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.82rem',
                letterSpacing: '0.04em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                flexShrink: 0,
                transition: 'color 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', fontVariationSettings: "'FILL' 0, 'wght' 400" }}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <div style={{ padding: '1.5rem', maxWidth: 900, margin: '0 auto' }}>

        {/* ══ Tab 1: Identidade ══ */}
        {activeTab === 'identity' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={sectionTitleStyle}>Identidade</h2>
              <p style={sectionSubtitleStyle}>Logo, nome, CRECI e especialidade do cliente.</p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.5fr)',
              gap: '1.25rem',
              alignItems: 'start',
            }}>
              {/* Left: Logo preview + style toggle */}
              <div style={cardStyle}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={labelStyle}>Preview do Logo</label>
                  <div style={{
                    background: T.surfaceHigh,
                    borderRadius: 6,
                    border: `1px solid ${T.outlineVariant}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 120,
                    overflow: 'hidden',
                  }}>
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Logo preview"
                        style={{
                          maxHeight: 100,
                          maxWidth: '100%',
                          objectFit: 'contain',
                          borderRadius: logoStyle === 'circle' ? '50%' : 0,
                        }}
                      />
                    ) : (
                      <span style={{
                        fontFamily: 'Noto Serif, serif',
                        fontWeight: 900,
                        fontSize: '2.5rem',
                        color: T.outlineVariant,
                      }}>
                        {(name || '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Formato do Logo</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {[
                      { value: 'contain', label: 'Conter (recomendado)' },
                      { value: 'circle', label: 'Circular (avatar)' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setLogoStyle(opt.value)}
                        style={{
                          padding: '0.5rem 0.85rem',
                          borderRadius: 3,
                          border: `1px solid ${logoStyle === opt.value ? T.primaryCt : T.outlineVariant}`,
                          fontFamily: 'Manrope, sans-serif',
                          fontSize: '0.82rem',
                          fontWeight: logoStyle === opt.value ? 700 : 400,
                          cursor: 'pointer',
                          background: logoStyle === opt.value ? `${T.primaryCt}22` : 'transparent',
                          color: logoStyle === opt.value ? T.primary : T.onSurfaceVariant,
                          textAlign: 'left',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: inputs */}
              <div style={cardStyle}>
                <div style={formGroupStyle}>
                  <label style={labelStyle}>Logo</label>
                  {/* Upload de arquivo */}
                  <input
                    ref={logoFileRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleLogoFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => logoFileRef.current?.click()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      width: '100%',
                      padding: '0.6rem 0.85rem',
                      marginBottom: '0.5rem',
                      background: `${T.primaryCt}22`,
                      border: `1px solid ${T.primaryCt}`,
                      borderRadius: 3,
                      color: T.primary,
                      fontFamily: 'Manrope, sans-serif',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: '1rem' }}>↑</span> Fazer upload da imagem
                  </button>
                  {logoUploadMsg && (
                    <p style={{ fontSize: '0.78rem', color: T.success, margin: '0 0 0.4rem' }}>
                      {logoUploadMsg}
                    </p>
                  )}
                  {/* Ou colar URL */}
                  <p style={{ fontSize: '0.72rem', color: T.onSurfaceVariant, margin: '0 0 0.35rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    ou cole uma URL
                  </p>
                  <input
                    type="url"
                    value={logoUrl.startsWith('data:') ? '' : logoUrl}
                    onChange={(e) => { setLogoUrl(e.target.value); setLogoUploadMsg(null); }}
                    placeholder="https://..."
                    style={inputStyle}
                  />
                  {logoUrl.startsWith('data:') && (
                    <p style={{ fontSize: '0.78rem', color: T.onSurfaceVariant, marginTop: '0.3rem' }}>
                      Imagem local carregada · <button
                        type="button"
                        onClick={() => { setLogoUrl(''); setLogoUploadMsg(null); }}
                        style={{ background: 'none', border: 'none', color: T.danger, cursor: 'pointer', fontSize: '0.78rem', padding: 0 }}
                      >remover</button>
                    </p>
                  )}
                </div>

                <div style={formGroupStyle}>
                  <label style={labelStyle}>Nome Profissional</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome completo ou da imobiliária"
                    style={inputStyle}
                  />
                </div>

                <div style={formGroupStyle}>
                  <label style={labelStyle}>Registro CRECI</label>
                  <input
                    type="text"
                    value={creci}
                    onChange={(e) => setCreci(e.target.value)}
                    placeholder="ex: 12345-F"
                    style={inputStyle}
                  />
                </div>

                <div style={formGroupStyle}>
                  <label style={labelStyle}>Especialidade / Tagline</label>
                  <input
                    type="text"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="Ex: Especialista em Alto Padrão"
                    style={inputStyle}
                  />
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.72rem', color: T.onSurfaceVariant }}>
                    Aparece abaixo do nome no perfil público
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ Tab 2: Links ══ */}
        {activeTab === 'links' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={sectionTitleStyle}>Links Estratégicos</h2>
              <p style={sectionSubtitleStyle}>
                O primeiro link (catálogo) é gerado automaticamente. Adicione até 4 links extras.
              </p>
            </div>

            <div style={cardStyle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {links.map((link, idx) => {
                  const isAuto = link.url === 'auto';
                  const isCatalog = link.id === 'catalog';
                  return (
                    <div key={link.id} style={{
                      background: T.surfaceHigh,
                      border: `1px solid ${isCatalog ? T.outlineVariant + '88' : T.outlineVariant}`,
                      borderRadius: 4,
                      padding: '0.85rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.7rem', color: T.onSurfaceVariant, fontFamily: 'Manrope, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase', flex: 1 }}>
                          Link {idx + 1}
                          {isCatalog && (
                            <span style={{
                              display: 'inline-block',
                              background: T.surfaceHighest,
                              color: T.primary,
                              borderRadius: 2,
                              padding: '0.1rem 0.45rem',
                              fontSize: '0.68rem',
                              letterSpacing: '0.08em',
                              fontFamily: 'Manrope, sans-serif',
                              marginLeft: 6,
                            }}>auto</span>
                          )}
                        </span>
                        {!isCatalog && (
                          <button
                            type="button"
                            onClick={() => removeLink(link.id)}
                            style={{
                              background: 'transparent',
                              color: T.danger,
                              border: `1px solid rgba(255,180,171,0.35)`,
                              borderRadius: 3,
                              padding: '0.25rem 0.5rem',
                              fontFamily: 'Manrope, sans-serif',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div>
                          <label style={{ ...labelStyle, marginBottom: '0.25rem' }}>Rótulo</label>
                          <input
                            type="text"
                            value={link.label}
                            onChange={(e) => updateLink(link.id, 'label', e.target.value)}
                            placeholder="ex: Falar no WhatsApp"
                            style={inputStyle}
                            readOnly={isCatalog}
                          />
                        </div>
                        <div>
                          <label style={{ ...labelStyle, marginBottom: '0.25rem' }}>URL</label>
                          {isAuto ? (
                            <div style={{
                              ...inputStyle,
                              background: T.surfaceHigh,
                              color: T.onSurfaceVariant,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              cursor: 'default',
                            }}>
                              <span style={{ fontSize: '0.78rem', opacity: 0.7 }}>→</span>
                              <span style={{ fontSize: '0.78rem', color: T.primary }}>
                                {catalogUrl ? `/${client.slug}/catalogo` : '/:slug/catalogo'}
                              </span>
                            </div>
                          ) : (
                            <input
                              type="url"
                              value={link.url}
                              onChange={(e) => updateLink(link.id, 'url', e.target.value)}
                              placeholder="https://..."
                              style={inputStyle}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={addLink}
                disabled={links.length >= 5}
                style={{
                  marginTop: '0.85rem',
                  width: '100%',
                  background: 'transparent',
                  border: `1px dashed ${links.length >= 5 ? T.outlineVariant + '55' : T.outlineVariant}`,
                  borderRadius: 4,
                  color: links.length >= 5 ? T.onSurfaceVariant + '55' : T.onSurfaceVariant,
                  padding: '0.65rem',
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '0.85rem',
                  cursor: links.length >= 5 ? 'not-allowed' : 'pointer',
                  textAlign: 'center',
                }}
              >
                ＋ Adicionar link ({links.length}/5)
              </button>
            </div>
          </div>
        )}

        {/* ══ Tab 3: Quem Somos ══ */}
        {activeTab === 'about' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={sectionTitleStyle}>Quem Somos</h2>
              <p style={sectionSubtitleStyle}>Bio, vídeo e galeria de imagens exibidos no perfil público.</p>
            </div>

            <div style={cardStyle}>
              {/* Toggle */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.25rem',
                paddingBottom: '1rem',
                borderBottom: `1px solid ${T.outlineVariant}`,
              }}>
                <div>
                  <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600, color: T.onSurface, fontSize: '0.92rem' }}>
                    Exibir seção Quem Somos
                  </div>
                  <div style={{ fontSize: '0.78rem', color: T.onSurfaceVariant, marginTop: 2 }}>
                    {aboutEnabled ? 'Visível no perfil público' : 'Oculto no perfil público'}
                  </div>
                </div>
                <Toggle checked={aboutEnabled} onChange={setAboutEnabled} />
              </div>

              {aboutEnabled && (
                <div>
                  {/* Bio */}
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Narrativa / Bio</label>
                    <textarea
                      value={aboutBio}
                      onChange={(e) => setAboutBio(e.target.value)}
                      placeholder="Escreva sobre sua trajetória..."
                      style={{
                        ...inputStyle,
                        minHeight: 140,
                        resize: 'vertical',
                        lineHeight: 1.55,
                      }}
                    />
                  </div>

                  {/* Video */}
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Vídeo (YouTube)</label>
                    <input
                      type="url"
                      value={aboutVideo}
                      onChange={(e) => setAboutVideo(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                      style={inputStyle}
                    />
                    <p style={{ margin: '0.3rem 0 0', fontSize: '0.72rem', color: T.onSurfaceVariant }}>
                      Opcional — será incorporado como player no perfil público
                    </p>
                  </div>

                  {/* Gallery */}
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Galeria de Imagens — Máx 3</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {aboutImages.map((img, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {img && (
                            <img
                              src={img}
                              alt={`Galeria ${idx + 1}`}
                              style={{
                                height: 30,
                                width: 50,
                                objectFit: 'contain',
                                borderRadius: 3,
                                background: T.surfaceHigh,
                                flexShrink: 0,
                                border: `1px solid ${T.outlineVariant}`,
                              }}
                            />
                          )}
                          <input
                            type="url"
                            value={img}
                            onChange={(e) => {
                              const next = [...aboutImages];
                              next[idx] = e.target.value;
                              setAboutImages(next);
                            }}
                            placeholder={`Imagem ${idx + 1} — https://...`}
                            style={{ ...inputStyle, flex: 1 }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {!aboutEnabled && (
                <p style={{ color: T.onSurfaceVariant, fontSize: '0.85rem', margin: 0 }}>
                  Este módulo está oculto no perfil público. Ative o toggle acima para configurá-lo.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ══ Tab 4: Visual ══ */}
        {activeTab === 'visual' && (() => {
          // Computed preview values — usa getPaletteFromPrimary como fallback para garantir harmonia
          const pPrimary    = colors['--primary']      || '#f2ca50';
          const _fb         = getPaletteFromPrimary(pPrimary);
          const pBtnBg      = colors['--btn-bg']        || _fb['--btn-bg'];
          const pBtnText    = colors['--btn-text']      || _fb['--btn-text'];
          const pHeroBg     = colors['--contact-bg']    || _fb['--contact-bg'];
          const pHeroText   = colors['--contact-text']  || '#ffffff';
          const pPageBg     = colors['--page-bg']       || '#131313';
          const pBadge      = colors['--bg-poster']     || _fb['--bg-poster'];
          const pBtnR       = btnRounded ? '50px' : '2px';
          const pPreviewName = name || 'Sua Empresa';

          // Color field row — custom picker (SV square + hue slider, sem input nativo do OS)
          function ColorRow({ field }) {
            const val = colors[field.key] || '';
            const safeHex = val.startsWith('#') && val.length === 7 ? val : '#000000';
            const isOpen = openColorField === field.key;
            const hsv = hexToHsv(safeHex);

            function onSVChange(s, v) { handleColorChange(field.key, hsvToHex(hsv.h, s, v)); }
            function onHueChange(h)   { handleColorChange(field.key, hsvToHex(h, hsv.s, hsv.v)); }

            return (
              <div style={{ position: 'relative' }}>
                <div style={{ background: T.surface, border: `1px solid ${isOpen ? T.primary : T.outlineVariant}`, borderRadius: 6, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', transition: 'border-color 0.15s' }}>
                  <div onClick={(e) => { e.stopPropagation(); setOpenColorField(isOpen ? null : field.key); }}
                    style={{ width: 32, height: 32, borderRadius: '50%', background: val || '#444', cursor: 'pointer', flexShrink: 0, border: `2px solid ${T.outlineVariant}`, boxShadow: isOpen ? `0 0 0 3px ${T.primary}55` : 'none', transition: 'box-shadow 0.15s' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: T.onSurface, marginBottom: 1 }}>{field.label}</div>
                    <div style={{ fontSize: '0.7rem', color: T.onSurfaceVariant, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{field.hint}</div>
                  </div>
                  <input type="text" value={val} onChange={(e) => handleColorChange(field.key, e.target.value)} placeholder="#hex"
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: 82, background: T.surfaceHighest, border: 'none', borderRadius: 3, color: T.onSurface, padding: '4px 8px', fontSize: '0.75rem', fontFamily: 'monospace', flexShrink: 0, outline: 'none' }} />
                </div>

                {isOpen && (
                  <div onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}
                    style={{ position: 'absolute', left: 0, top: 'calc(100% + 6px)', zIndex: 300, background: T.surfaceLow, border: `1px solid ${T.outlineVariant}`, borderRadius: 8, padding: '0.85rem', boxShadow: '0 8px 28px rgba(0,0,0,0.18)', width: '100%', minWidth: 240 }}>

                    {/* Gradiente SV */}
                    <ColorSVSquare hue={hsv.h} sat={hsv.s} val={hsv.v} onChange={onSVChange} />

                    {/* Slider de Hue */}
                    <div style={{ marginTop: '0.6rem', marginBottom: '0.75rem' }}>
                      <ColorHueSlider hue={hsv.h} onChange={onHueChange} />
                    </div>

                    {/* Hex + preview */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 4, background: val || '#000', border: `1px solid ${T.outlineVariant}`, flexShrink: 0 }} />
                      <input type="text" value={val} onChange={(e) => handleColorChange(field.key, e.target.value)}
                        placeholder="#rrggbb" onMouseDown={e => e.stopPropagation()}
                        style={{ flex: 1, background: T.surfaceHighest, border: `1px solid ${T.outlineVariant}`, borderRadius: 3, color: T.onSurface, padding: '6px 8px', fontSize: '0.8rem', fontFamily: 'monospace', outline: 'none' }} />
                    </div>

                    {/* Cores rápidas */}
                    <div style={{ fontSize: '0.62rem', fontWeight: 700, color: T.onSurfaceVariant, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Cores rápidas</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {PRESET_COLORS.map(c => (
                        <div key={c} title={c} onMouseDown={e => e.stopPropagation()} onClick={() => handleColorChange(field.key, c)}
                          style={{ width: 24, height: 24, borderRadius: 4, background: c, cursor: 'pointer', border: val===c ? `2px solid ${T.onSurface}` : `1px solid ${T.outlineVariant}`, flexShrink: 0 }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(260px,320px)', gap: '1.5rem', alignItems: 'start' }} onClick={() => setOpenColorField(null)}>

            {/* LEFT — editor */}
            <div>
              <div style={{ marginBottom: '1.25rem' }}>
                <h2 style={sectionTitleStyle}>Visual & Identidade</h2>
                <p style={sectionSubtitleStyle}>Todas as cores, imagem do cabeçalho e estilo dos botões são aplicados em tempo real no perfil, catálogo e poster de vídeo.</p>
              </div>

              {/* Action row */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                <button type="button" onClick={handleGenerateFromPrimary}
                  style={{ background: 'transparent', color: T.primary, border: `1px solid ${T.outlineVariant}`, borderRadius: 3, padding: '0.45rem 0.85rem', fontFamily: 'Manrope, sans-serif', fontSize: '0.8rem', cursor: 'pointer' }}>
                  ✦ Gerar paleta automática
                </button>
                {logoUrl && (
                  <button type="button" onClick={handleExtractFromLogo} disabled={extractingFromLogo}
                    style={{ background: 'transparent', color: T.onSurfaceVariant, border: `1px solid ${T.outlineVariant}`, borderRadius: 3, padding: '0.45rem 0.85rem', fontFamily: 'Manrope, sans-serif', fontSize: '0.8rem', cursor: extractingFromLogo ? 'not-allowed' : 'pointer', opacity: extractingFromLogo ? 0.6 : 1 }}>
                    {extractingFromLogo ? 'Detectando...' : 'Detectar da logo'}
                  </button>
                )}
              </div>

              {colorMsg && (
                <div style={{ background: colorMsg.startsWith('Erro')||colorMsg.startsWith('Não')||colorMsg.startsWith('⚠') ? `${T.danger}18` : `${T.success}18`, border: `1px solid ${(colorMsg.startsWith('Erro')||colorMsg.startsWith('Não')||colorMsg.startsWith('⚠')) ? T.danger+'44' : T.success+'44'}`, borderRadius: 4, padding: '0.6rem 0.85rem', fontSize: '0.82rem', color: (colorMsg.startsWith('Erro')||colorMsg.startsWith('Não')||colorMsg.startsWith('⚠')) ? T.danger : T.success, marginBottom: '1rem', fontFamily: 'Manrope, sans-serif' }}>
                  {colorMsg}
                </div>
              )}

              {/* ── Grupo: Site Body */}
              {COLOR_GROUPS.map((group) => (
                <div key={group.key} style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem', paddingBottom: '0.4rem', borderBottom: `1px solid ${T.outlineVariant}` }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: T.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{group.label}</span>
                    <span style={{ fontSize: '0.7rem', color: T.outlineVariant }}>{group.hint}</span>
                  </div>

                  {/* Hero bg image upload — only on 'header' group */}
                  {group.key === 'header' && (
                    <div style={{ marginBottom: '0.65rem', background: T.surface, border: `1px solid ${T.outlineVariant}`, borderRadius: 6, padding: '0.75rem 1rem' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: T.onSurface, marginBottom: '0.4rem' }}>Imagem de Fundo do Cabeçalho</div>
                      <div style={{ fontSize: '0.7rem', color: T.onSurfaceVariant, marginBottom: '0.6rem' }}>Fica atrás do gradiente de cor — efeito "foto de capa"</div>
                      {/* Preview strip */}
                      <div style={{ height: 48, borderRadius: 4, marginBottom: '0.6rem', overflow: 'hidden', background: heroBgImage ? `linear-gradient(160deg,${pHeroBg}cc,${pPageBg}f0), url('${heroBgImage}') center/cover` : `linear-gradient(160deg,${pHeroBg},${pPageBg})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '0.7rem', color: '#fff', opacity: 0.7 }}>{heroBgImage ? '✓ imagem ativa' : 'sem imagem (só cor)'}</span>
                      </div>
                      <input ref={heroBgFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleHeroBgFileChange} />
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => heroBgFileRef.current?.click()}
                          style={{ flex: 1, padding: '0.45rem 0.75rem', background: `${T.primaryCt}22`, border: `1px solid ${T.primaryCt}`, borderRadius: 3, color: T.primary, fontFamily: 'Manrope, sans-serif', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                          ↑ Upload de imagem
                        </button>
                        {heroBgImage && (
                          <button type="button" onClick={() => { setHeroBgImage(''); setHeroBgMsg(null); }}
                            style={{ padding: '0.45rem 0.75rem', background: 'transparent', border: `1px solid ${T.outlineVariant}`, borderRadius: 3, color: T.danger, fontFamily: 'Manrope, sans-serif', fontSize: '0.78rem', cursor: 'pointer' }}>
                            Remover
                          </button>
                        )}
                      </div>
                      {heroBgMsg && <p style={{ fontSize: '0.72rem', color: T.success, marginTop: '0.3rem' }}>{heroBgMsg}</p>}
                      <input type="url" value={heroBgImage.startsWith('data:') ? '' : heroBgImage} onChange={(e) => { setHeroBgImage(e.target.value); setHeroBgMsg(null); }}
                        placeholder="ou cole URL da imagem…" style={{ ...inputStyle, marginTop: '0.5rem', fontSize: '0.78rem' }} />
                    </div>
                  )}

                  {/* Button style — only on 'brand' group */}
                  {group.key === 'brand' && (
                    <div style={{ marginBottom: '0.65rem', background: T.surface, border: `1px solid ${T.outlineVariant}`, borderRadius: 6, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: T.onSurface, marginBottom: 2 }}>Botões arredondados</div>
                        <div style={{ fontSize: '0.7rem', color: T.onSurfaceVariant }}>
                          Preview:{' '}
                          <span style={{ display: 'inline-block', padding: '2px 10px', background: pBtnBg, color: pBtnText, borderRadius: pBtnR, fontSize: '0.7rem', fontWeight: 700 }}>Ver imóvel</span>
                        </div>
                      </div>
                      <Toggle checked={btnRounded} onChange={setBtnRounded} />
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.5rem' }}>
                    {COLOR_FIELDS.filter((f) => f.group === group.key).map((field) => (
                      <ColorRow key={field.key} field={field} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* RIGHT — preview panel */}
            <div style={{ position: 'sticky', top: 80 }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: T.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Prévia em tempo real</span>
              </div>
              {/* Preview tabs */}
              <div style={{ display: 'flex', gap: 0, marginBottom: '0.75rem', background: T.surfaceHigh, borderRadius: 6, padding: 3 }}>
                {[['profile','Perfil'],['catalog','Catálogo'],['video','Vídeo']].map(([k,lbl]) => (
                  <button key={k} type="button" onClick={() => setPreviewTab(k)}
                    style={{ flex: 1, padding: '0.35rem', borderRadius: 4, border: 'none', fontFamily: 'Manrope, sans-serif', fontSize: '0.75rem', fontWeight: previewTab===k ? 700 : 400, background: previewTab===k ? T.surfaceHighest : 'transparent', color: previewTab===k ? T.primary : T.onSurfaceVariant, cursor: 'pointer' }}>
                    {lbl}
                  </button>
                ))}
              </div>

              {/* ── Preview: Perfil ── */}
              {previewTab === 'profile' && (
                <div style={{ background: pPageBg, borderRadius: 8, overflow: 'hidden', fontFamily: 'Manrope, sans-serif', boxShadow: '0 4px 32px rgba(0,0,0,0.5)', border: `1px solid ${T.outlineVariant}` }}>
                  {/* header */}
                  <div style={{ background: heroBgImage ? `linear-gradient(160deg,${pHeroBg}cc,${pPageBg}f0), url('${heroBgImage}') center/cover` : `linear-gradient(160deg,${pHeroBg},${pPageBg})`, padding: '20px 16px 14px', textAlign: 'center' }}>
                    <div style={{ width: 44, height: 44, borderRadius: logoStyle==='circle'?'50%':'8px', background: `linear-gradient(135deg,${pBtnBg},${pPrimary})`, margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2 }}>
                      {logoUrl
                        ? <img src={logoUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: logoStyle==='circle'?'50%':'6px', background: '#1c1b1b' }} />
                        : <div style={{ width: '100%', height: '100%', background: '#2a2a2a', borderRadius: logoStyle==='circle'?'50%':'6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: pPrimary, fontWeight: 900, fontSize: 18 }}>{pPreviewName.charAt(0)}</div>
                      }
                    </div>
                    <div style={{ color: pHeroText, fontWeight: 700, fontSize: 12, letterSpacing: '0.05em' }}>{pPreviewName.toUpperCase()}</div>
                    {client?.creci && <div style={{ color: pPrimary, fontSize: 9, marginTop: 2 }}>CRECI {client.creci}</div>}
                  </div>
                  {/* cta */}
                  <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ background: pBtnBg, color: pBtnText, borderRadius: pBtnR, padding: '8px', textAlign: 'center', fontSize: 10, fontWeight: 700 }}>🏢 Ver Catálogo de Imóveis</div>
                    <div style={{ border: `1px solid rgba(77,70,53,0.4)`, borderRadius: 3, padding: '6px 10px', display: 'flex', justifyContent: 'space-between', color: '#e5e2e1', fontSize: 9 }}>
                      <span>📱 Falar no WhatsApp</span><span style={{ opacity: 0.4 }}>›</span>
                    </div>
                    <div style={{ border: `1px solid rgba(77,70,53,0.4)`, borderRadius: 3, padding: '6px 10px', display: 'flex', justifyContent: 'space-between', color: '#e5e2e1', fontSize: 9 }}>
                      <span>📸 Meu Instagram</span><span style={{ opacity: 0.4 }}>›</span>
                    </div>
                  </div>
                  {/* footer */}
                  <div style={{ background: '#0e0e0e', padding: '8px', textAlign: 'center', fontSize: 8, color: '#9ca3af' }}>© {pPreviewName.toUpperCase()}</div>
                </div>
              )}

              {/* ── Preview: Catálogo ── */}
              {previewTab === 'catalog' && (
                <div style={{ background: pPageBg, borderRadius: 8, overflow: 'hidden', fontFamily: 'Manrope, sans-serif', boxShadow: '0 4px 32px rgba(0,0,0,0.5)', border: `1px solid ${T.outlineVariant}` }}>
                  {/* hero */}
                  <div style={{ background: heroBgImage ? `linear-gradient(160deg,${pHeroBg}cc,${pPageBg}f0), url('${heroBgImage}') center/cover` : `linear-gradient(160deg,${pHeroBg},${pPageBg})`, padding: '16px', textAlign: 'center' }}>
                    {logoUrl && <img src={logoUrl} alt="logo" style={{ height: 30, width: 'auto', maxWidth: 100, objectFit: 'contain', margin: '0 auto 6px', background: 'rgba(0,0,0,0.2)', padding: 4, borderRadius: 4 }} />}
                    <div style={{ color: pHeroText, fontWeight: 700, fontSize: 11 }}>{pPreviewName}</div>
                    <div style={{ color: pHeroText, opacity: 0.7, fontSize: 8, marginTop: 2 }}>Imóveis selecionados para você</div>
                  </div>
                  {/* filters */}
                  <div style={{ background: `${pPageBg}ee`, borderBottom: `1px solid rgba(77,70,53,0.2)`, padding: '6px 10px', display: 'flex', gap: 5 }}>
                    <span style={{ background: pPrimary, color: pBtnText, borderRadius: 50, padding: '2px 8px', fontSize: 8, fontWeight: 700 }}>Todos</span>
                    <span style={{ border: '1px solid rgba(77,70,53,0.4)', borderRadius: 50, padding: '2px 8px', fontSize: 8, color: '#d0c5af' }}>Venda</span>
                    <span style={{ marginLeft: 'auto', fontSize: 8, color: '#9ca3af' }}>2 imóveis</span>
                  </div>
                  {/* cards */}
                  <div style={{ padding: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {[['R$ 1.999.000','Casa 4 quartos'],['R$ 400.000','Apto 2 quartos']].map(([price,title],i) => (
                      <div key={i} style={{ background: '#1c1b1b', borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(77,70,53,0.2)' }}>
                        <div style={{ height: 45, background: '#201f1f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 16, opacity: 0.2 }}>🏠</span>
                        </div>
                        <div style={{ padding: '5px 6px' }}>
                          <div style={{ fontSize: 7, color: '#d0c5af', marginBottom: 2 }}>{title}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: pPrimary, marginBottom: 4 }}>{price}</div>
                          <div style={{ background: pBtnBg, color: pBtnText, borderRadius: pBtnR, textAlign: 'center', padding: '3px', fontSize: 7, fontWeight: 700 }}>Ver detalhes →</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* footer */}
                  <div style={{ background: '#0e0e0e', padding: '6px', textAlign: 'center', fontSize: 7, color: '#9ca3af' }}>© {pPreviewName.toUpperCase()}</div>
                </div>
              )}

              {/* ── Preview: Vídeo ── */}
              {previewTab === 'video' && (
                <div style={{ background: pPageBg, borderRadius: 8, overflow: 'hidden', fontFamily: 'Manrope, sans-serif', boxShadow: '0 4px 32px rgba(0,0,0,0.5)', border: `1px solid ${T.outlineVariant}`, maxWidth: 220, margin: '0 auto' }}>
                  {/* photo area */}
                  <div style={{ height: 80, background: '#201f1f', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <span style={{ fontSize: 28, opacity: 0.15 }}>🏠</span>
                    {logoUrl && (
                      <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)', borderRadius: 4, padding: '2px 4px' }}>
                        <img src={logoUrl} alt="logo" style={{ height: 18, width: 'auto', maxWidth: 60, objectFit: 'contain', display: 'block' }} />
                      </div>
                    )}
                    <div style={{ position: 'absolute', bottom: 4, left: 4, background: pBadge, color: pPrimary, fontSize: 7, fontWeight: 700, padding: '1px 5px', borderRadius: 50 }}>VENDA</div>
                  </div>
                  {/* price */}
                  <div style={{ padding: '8px 10px', borderBottom: `1px solid ${colors['--line-poster']||'rgba(255,255,255,0.1)'}` }}>
                    <div style={{ color: colors['--text-poster']||'#ffffff', fontSize: 14, fontWeight: 800 }}>R$ 1.999.000</div>
                    <div style={{ color: colors['--detail-poster']||'rgba(255,255,255,0.6)', fontSize: 7, marginTop: 1 }}>Casa · Nova Peruíbe · Peruíbe/SP</div>
                  </div>
                  {/* feats */}
                  <div style={{ padding: '6px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {[['🛏','4 quartos'],['🚿','6 banheiros'],['🚗','4 vagas'],['📐','230 m²']].map(([ic,lbl]) => (
                      <div key={lbl} style={{ background: colors['--amen-bg']||'rgba(0,0,0,0.2)', border: `1px solid ${colors['--amen-bd']||'rgba(255,255,255,0.1)'}`, borderRadius: 3, padding: '3px 5px', fontSize: 7, color: colors['--text-poster']||'#fff', display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span>{ic}</span>{lbl}
                      </div>
                    ))}
                  </div>
                  {/* amenities */}
                  <div style={{ padding: '0 10px 6px' }}>
                    <div style={{ fontSize: 7, color: colors['--detail-poster']||'rgba(255,255,255,0.5)', marginBottom: 3 }}>Lazer e comodidades</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {['Piscina','Grill','Academia'].map(a => (
                        <span key={a} style={{ background: colors['--amen-bg']||'rgba(0,0,0,0.2)', border: `1px solid ${colors['--amen-bd']||'rgba(255,255,255,0.1)'}`, borderRadius: 3, padding: '2px 5px', fontSize: 7, color: colors['--text-poster']||'#fff' }}>{a}</span>
                      ))}
                    </div>
                  </div>
                  {/* contact bar — usa a cor do cabeçalho (igual ao header do perfil/catálogo) */}
                  <div style={{ background: pHeroBg, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {logoUrl
                      ? <img src={logoUrl} alt="logo" style={{ height: 20, width: 'auto', maxWidth: 50, objectFit: 'contain', borderRadius: 3, background: 'rgba(0,0,0,0.2)', flexShrink: 0 }} />
                      : <div style={{ width: 20, height: 20, borderRadius: 3, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: pPrimary, fontWeight: 900, fontSize: 10, flexShrink: 0 }}>{pPreviewName.charAt(0)}</div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: pHeroText, fontSize: 7, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pPreviewName}</div>
                      <div style={{ color: pHeroText, opacity: 0.7, fontSize: 6 }}>Ver mais imóveis</div>
                    </div>
                  </div>
                </div>
              )}

              <p style={{ fontSize: '0.68rem', color: T.outlineVariant, textAlign: 'center', marginTop: '0.6rem' }}>
                ↑ prévia aproximada — salve e acesse o link real para ver completo
              </p>
            </div>
          </div>
          );
        })()}


        {/* ══ Tab 5: Layout ══ */}
        {activeTab === 'layout' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={sectionTitleStyle}>Ordem das Seções</h2>
              <p style={sectionSubtitleStyle}>Use as setas para definir a ordem de exibição no perfil público.</p>
            </div>

            <div style={cardStyle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {sectionsOrder.map((key, idx) => {
                  const section = SECTION_LABELS[key] || { icon: 'widgets', label: key, hint: '' };
                  return (
                    <div key={key} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.85rem',
                      background: T.surfaceHigh,
                      border: `1px solid ${T.outlineVariant}`,
                      borderLeft: `3px solid ${T.primaryCt}`,
                      borderRadius: 4,
                      padding: '0.75rem 0.85rem',
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: T.primaryCt, flexShrink: 0, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>
                        {section.icon}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600, color: T.onSurface, fontSize: '0.88rem' }}>
                          {section.label}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: T.onSurfaceVariant }}>
                          {section.hint}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveSection(idx, -1)}
                          style={{
                            background: 'transparent',
                            color: T.onSurfaceVariant,
                            border: `1px solid ${T.outlineVariant}`,
                            borderRadius: 3,
                            padding: '0.3rem 0.55rem',
                            fontFamily: 'Manrope, sans-serif',
                            fontSize: '0.75rem',
                            cursor: idx === 0 ? 'not-allowed' : 'pointer',
                            opacity: idx === 0 ? 0.3 : 1,
                          }}
                          aria-label="Mover para cima"
                        >▲</button>
                        <button
                          type="button"
                          disabled={idx === sectionsOrder.length - 1}
                          onClick={() => moveSection(idx, 1)}
                          style={{
                            background: 'transparent',
                            color: T.onSurfaceVariant,
                            border: `1px solid ${T.outlineVariant}`,
                            borderRadius: 3,
                            padding: '0.3rem 0.55rem',
                            fontFamily: 'Manrope, sans-serif',
                            fontSize: '0.75rem',
                            cursor: idx === sectionsOrder.length - 1 ? 'not-allowed' : 'pointer',
                            opacity: idx === sectionsOrder.length - 1 ? 0.3 : 1,
                          }}
                          aria-label="Mover para baixo"
                        >▼</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Fixed bottom bar (mobile save button) ── */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: `${T.bg}ee`,
        backdropFilter: 'blur(16px)',
        borderTop: `1px solid ${T.outlineVariant}`,
        padding: '0.75rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        zIndex: 100,
      }}>
        <div style={{ fontSize: '0.8rem' }}>
          {saved && <span style={{ color: T.success }}>Alterações publicadas.</span>}
          {saveError && <span style={{ color: T.danger }}>{saveError}</span>}
          {saving && <span style={{ color: T.onSurfaceVariant }}>Publicando...</span>}
        </div>
        <SaveButton compact />
      </div>

        {/* ══ Tab 6: Corretores ══ */}
        {activeTab === 'corretores' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={sectionTitleStyle}>Corretores / Vendedores</h2>
              <p style={sectionSubtitleStyle}>Gerencie os corretores vinculados a esta imobiliária.</p>
            </div>

            {/* Mensagem de status */}
            {corretorMsg && (
              <div style={{ background: corretorMsg.startsWith('Erro')||corretorMsg.startsWith('⚠') ? `${T.danger}18` : `${T.success}18`, border: `1px solid ${corretorMsg.startsWith('Erro')||corretorMsg.startsWith('⚠') ? T.danger+'44' : T.success+'44'}`, borderRadius: 4, padding: '0.6rem 0.85rem', fontSize: '0.82rem', color: corretorMsg.startsWith('Erro')||corretorMsg.startsWith('⚠') ? T.danger : T.success, marginBottom: '1rem', fontFamily: 'Manrope, sans-serif' }}>
                {corretorMsg}
              </div>
            )}

            {/* Formulário de adição/edição */}
            {editingCorretor && (
              <div style={{ ...cardStyle, border: `1.5px solid ${T.primaryCt}44`, marginBottom: '1.5rem' }}>
                <h3 style={{ ...sectionTitleStyle, fontSize: '0.95rem', marginBottom: '1rem' }}>
                  {editingCorretor === 'new' ? '+ Novo Corretor' : `Editar — ${editingCorretor.name}`}
                </h3>

                {/* Foto */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: T.surfaceHigh, border: `1px solid ${T.outlineVariant}`, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {corretorForm.photo_url
                      ? <img src={corretorForm.photo_url} alt="foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span className="material-symbols-outlined" style={{ fontSize: '2rem', color: T.onSurfaceVariant, fontVariationSettings: "'FILL' 0" }}>person</span>
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <input ref={corretorPhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleCorretorPhotoChange} />
                    <button type="button" onClick={() => corretorPhotoRef.current?.click()}
                      style={{ background: 'transparent', color: T.primary, border: `1px solid ${T.outlineVariant}`, borderRadius: 3, padding: '0.4rem 0.75rem', fontFamily: 'Manrope, sans-serif', fontSize: '0.78rem', cursor: 'pointer', display: 'block', marginBottom: '0.35rem' }}>
                      ↑ Upload da foto
                    </button>
                    <input type="url" value={corretorForm.photo_url.startsWith('data:') ? '' : corretorForm.photo_url}
                      onChange={e => setCorretorForm(p => ({ ...p, photo_url: e.target.value }))}
                      placeholder="ou cole URL da foto…"
                      style={{ ...inputStyle, fontSize: '0.78rem' }} />
                  </div>
                </div>

                {/* Campos em grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={labelStyle}>Nome *</label>
                    <input type="text" value={corretorForm.name} onChange={e => setCorretorForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome completo" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Especialidade</label>
                    <input type="text" value={corretorForm.specialty} onChange={e => setCorretorForm(p => ({ ...p, specialty: e.target.value }))} placeholder="Ex: Vendas · Alto Padrão" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>CRECI</label>
                    <input type="text" value={corretorForm.creci} onChange={e => setCorretorForm(p => ({ ...p, creci: e.target.value }))} placeholder="Ex: 123456-F" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>WhatsApp</label>
                    <input type="text" value={corretorForm.whatsapp} onChange={e => setCorretorForm(p => ({ ...p, whatsapp: e.target.value }))} placeholder="(11) 99999-9999" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Telefone</label>
                    <input type="text" value={corretorForm.phone} onChange={e => setCorretorForm(p => ({ ...p, phone: e.target.value }))} placeholder="(11) 3333-3333" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>E-mail</label>
                    <input type="email" value={corretorForm.email} onChange={e => setCorretorForm(p => ({ ...p, email: e.target.value }))} placeholder="corretor@email.com" style={inputStyle} />
                  </div>
                </div>
                {/* Slug — URL pública */}
                {editingCorretor !== 'new' && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={labelStyle}>Link público (slug)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: T.onSurfaceVariant, whiteSpace: 'nowrap' }}>…/{client?.slug}/</span>
                      <input type="text" value={corretorForm.slug} onChange={e => setCorretorForm(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'') }))}
                        placeholder="nome-do-corretor" style={{ ...inputStyle, flex: 1 }} />
                      {corretorForm.slug && client?.slug && (
                        <a href={buildCorretorUrl(client, corretorForm.slug)} target="_blank" rel="noopener"
                          style={{ padding: '0.5rem', color: T.primary, background: `${T.primaryCt}22`, border: `1px solid ${T.primaryCt}44`, borderRadius: 3, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                          title="Ver página pública">
                          <span className="material-symbols-outlined" style={{ fontSize: '1rem', display: 'block', fontVariationSettings: "'FILL' 0" }}>open_in_new</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={labelStyle}>Bio / Apresentação</label>
                  <textarea value={corretorForm.bio} onChange={e => setCorretorForm(p => ({ ...p, bio: e.target.value }))} rows={3} placeholder="Breve apresentação do corretor…" style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
                </div>

                {/* Botões */}
                <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                  <button type="button" onClick={handleSaveCorretor}
                    style={{ background: T.primaryCt, color: '#3c2f00', border: 'none', borderRadius: 3, padding: '0.6rem 1.4rem', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                    Salvar
                  </button>
                  <button type="button" onClick={() => { setEditingCorretor(null); setCorretorMsg(null); }}
                    style={{ background: 'transparent', color: T.onSurfaceVariant, border: `1px solid ${T.outlineVariant}`, borderRadius: 3, padding: '0.6rem 1rem', fontFamily: 'Manrope, sans-serif', fontSize: '0.85rem', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Lista de corretores */}
            {loadingCorretores ? (
              <p style={{ color: T.onSurfaceVariant, fontFamily: 'Manrope, sans-serif', fontSize: '0.88rem' }}>Carregando...</p>
            ) : corretores.length === 0 && !editingCorretor ? (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '2.5rem 1rem', color: T.onSurfaceVariant }}>
                <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem', opacity: 0.3, fontVariationSettings: "'FILL' 0" }}>group</span>
                <p style={{ fontSize: '0.9rem', marginBottom: '1rem', fontFamily: 'Manrope, sans-serif' }}>Nenhum corretor cadastrado ainda.</p>
                <button type="button" onClick={openNewCorretor}
                  style={{ background: T.primaryCt, color: '#3c2f00', border: 'none', borderRadius: 3, padding: '0.6rem 1.4rem', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                  + Adicionar primeiro corretor
                </button>
              </div>
            ) : (
              <div>
                {corretores.map((c) => (
                  <div key={c.id} style={{ ...cardStyle, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', opacity: c.active ? 1 : 0.5, marginBottom: '0.75rem' }}>
                    {/* Foto */}
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: T.surfaceHigh, border: `1px solid ${T.outlineVariant}`, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {c.photo_url
                        ? <img src={c.photo_url} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span className="material-symbols-outlined" style={{ fontSize: '1.6rem', color: T.onSurfaceVariant, fontVariationSettings: "'FILL' 0" }}>person</span>
                      }
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {(() => {
                        const cSlug = c.slug || clientSlugify(c.name);
                        const cUrl  = buildCorretorUrl(client, cSlug);
                        return (<>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: 'Noto Serif, serif', fontWeight: 700, color: T.onSurface, fontSize: '0.95rem' }}>{c.name}</span>
                            {!c.active && <span style={{ fontSize: '0.68rem', background: T.surfaceHigh, color: T.onSurfaceVariant, borderRadius: 3, padding: '1px 6px', fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>Inativo</span>}
                          </div>
                          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: 2 }}>
                            {c.specialty && <span style={{ fontSize: '0.75rem', color: T.primary, fontFamily: 'Manrope, sans-serif' }}>{c.specialty}</span>}
                            {c.creci && <span style={{ fontSize: '0.75rem', color: T.onSurfaceVariant, fontFamily: 'Manrope, sans-serif' }}>CRECI {c.creci}</span>}
                            {c.whatsapp && <span style={{ fontSize: '0.75rem', color: T.onSurfaceVariant, fontFamily: 'Manrope, sans-serif' }}>📱 {c.whatsapp}</span>}
                            {cUrl && <span style={{ fontSize: '0.7rem', color: T.outlineVariant, fontFamily: 'monospace' }}>/{client.slug}/{cSlug}</span>}
                          </div>
                        </>);
                      })()}
                    </div>
                    {/* Ações */}
                    {(() => {
                      const cSlug = c.slug || clientSlugify(c.name);
                      const cUrl  = buildCorretorUrl(client, cSlug);
                      return (
                    <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {/* Ver perfil público */}
                      {cUrl && (
                        <a href={cUrl} target="_blank" rel="noopener"
                          title="Ver perfil público"
                          style={{ background: `${T.primaryCt}22`, border: `1px solid ${T.primaryCt}66`, borderRadius: 3, padding: '0.35rem 0.65rem', cursor: 'pointer', color: T.primary, display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontFamily: 'Manrope, sans-serif', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '0.95rem', fontVariationSettings: "'FILL' 0" }}>open_in_new</span>
                          Ver
                        </a>
                      )}
                      {/* Copiar link */}
                      {cUrl && (
                        <button type="button"
                          title="Copiar link do perfil"
                          onClick={() => {
                            navigator.clipboard.writeText(cUrl).then(() => {
                              setCopiedCorretorId(c.id);
                              setTimeout(() => setCopiedCorretorId(null), 2000);
                            });
                          }}
                          style={{ background: copiedCorretorId === c.id ? `${T.success}22` : 'transparent', border: `1px solid ${copiedCorretorId === c.id ? T.success : T.outlineVariant}`, borderRadius: 3, padding: '0.35rem 0.65rem', cursor: 'pointer', color: copiedCorretorId === c.id ? T.success : T.onSurfaceVariant, display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', fontFamily: 'Manrope, sans-serif', fontWeight: 600, transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '0.95rem', fontVariationSettings: "'FILL' 0" }}>
                            {copiedCorretorId === c.id ? 'check' : 'content_copy'}
                          </span>
                          {copiedCorretorId === c.id ? 'Copiado!' : 'Copiar'}
                        </button>
                      )}
                      <button type="button" onClick={() => handleToggleCorretorActive(c)} title={c.active ? 'Desativar' : 'Ativar'}
                        style={{ background: 'transparent', border: `1px solid ${T.outlineVariant}`, borderRadius: 3, padding: '0.35rem 0.55rem', cursor: 'pointer', color: c.active ? T.success : T.onSurfaceVariant, fontSize: '0.75rem', fontFamily: 'Manrope, sans-serif' }}>
                        {c.active ? '✓ Ativo' : '○ Inativo'}
                      </button>
                      <button type="button" onClick={() => openEditCorretor(c)} title="Editar"
                        style={{ background: 'transparent', border: `1px solid ${T.outlineVariant}`, borderRadius: 3, padding: '0.35rem 0.55rem', cursor: 'pointer', color: T.primary }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem', display: 'block', fontVariationSettings: "'FILL' 0" }}>edit</span>
                      </button>
                      <button type="button" onClick={() => handleDeleteCorretor(c)} title="Excluir"
                        style={{ background: 'transparent', border: `1px solid ${T.outlineVariant}`, borderRadius: 3, padding: '0.35rem 0.55rem', cursor: 'pointer', color: T.danger }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem', display: 'block', fontVariationSettings: "'FILL' 0" }}>delete</span>
                      </button>
                    </div>
                      );
                    })()}
                  </div>
                ))}

                {!editingCorretor && (
                  <button type="button" onClick={openNewCorretor}
                    style={{ background: 'transparent', color: T.primary, border: `1.5px dashed ${T.primaryCt}66`, borderRadius: 6, padding: '0.75rem', fontFamily: 'Manrope, sans-serif', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', width: '100%', textAlign: 'center' }}>
                    + Adicionar corretor
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ Tab 7: Imóveis ══ */}
        {activeTab === 'imoveis' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={sectionTitleStyle}>Imóveis</h2>
              <p style={sectionSubtitleStyle}>Gerencie os imóveis deste cliente — edite, gere vídeos ou importe novos.</p>
            </div>

            {/* Import */}
            <div style={{ ...cardStyle, marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: T.onSurface, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Adicionar imóvel</div>
              <div style={formGroupStyle}>
                <label style={labelStyle}>Por link (ZAP, Viva Real…)</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <input type="url" value={listingUrl} onChange={e => setListingUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleImportListingUrl()}
                    placeholder="https://..." style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
                  <button type="button" disabled={importingLinkL || !listingUrl.trim()} onClick={handleImportListingUrl}
                    style={{ padding: '0.6rem 1.1rem', background: T.primary, color: '#fff', border: 'none', borderRadius: 3, fontFamily: 'Manrope, sans-serif', fontSize: '0.85rem', fontWeight: 700, cursor: importingLinkL ? 'not-allowed' : 'pointer', opacity: importingLinkL ? 0.6 : 1 }}>
                    {importingLinkL ? 'Importando…' : 'Importar'}
                  </button>
                </div>
              </div>
              <div style={formGroupStyle}>
                <label style={labelStyle}>Por JSON (cole o objeto ou array)</label>
                <textarea value={listingJson} onChange={e => setListingJson(e.target.value)}
                  placeholder={'{"title":"Casa 3 quartos","carousel_images":[...]}'}
                  style={{ ...inputStyle, minHeight: 90, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem', lineHeight: 1.5 }} />
                <button type="button" disabled={importingJsonL || !listingJson.trim()} onClick={handleImportListingJson}
                  style={{ marginTop: '0.4rem', padding: '0.5rem 1rem', background: T.surfaceHigh, color: T.onSurface, border: `1px solid ${T.outlineVariant}`, borderRadius: 3, fontFamily: 'Manrope, sans-serif', fontSize: '0.82rem', cursor: importingJsonL ? 'not-allowed' : 'pointer' }}>
                  {importingJsonL ? 'Importando…' : 'Importar JSON'}
                </button>
              </div>
              {listingMsg && (
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: listingMsg.startsWith('Erro') ? T.danger : T.success }}>{listingMsg}</p>
              )}
            </div>

            {/* Listings list */}
            {loadingListings ? (
              <p style={{ color: T.onSurfaceVariant, fontSize: '0.88rem' }}>Carregando imóveis…</p>
            ) : listings.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '2.5rem 1rem', color: T.onSurfaceVariant }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.3 }}>🏠</div>
                <p style={{ margin: 0, fontSize: '0.88rem' }}>Nenhum imóvel cadastrado. Importe um acima.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {listings.map(l => {
                  const img = (l.carousel_images && l.carousel_images[0]) || (l.images && l.images[0]);
                  return (
                    <div key={l.id} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap', padding: '0.85rem 1rem' }}>
                      {img && (
                        <img src={proxyImageUrl(img)} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 4, flexShrink: 0, background: T.surfaceHigh }} />
                      )}
                      {!img && (
                        <div style={{ width: 56, height: 56, borderRadius: 4, background: T.surfaceHigh, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', opacity: 0.3, flexShrink: 0 }}>🏠</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: T.onSurface, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listingTitle(l)}</div>
                        {l.salePrice && <div style={{ fontSize: '0.78rem', color: T.primary, fontWeight: 700, marginTop: 2 }}>{l.salePrice}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, flexWrap: 'wrap' }}>
                        <a href={`/cliente/${id}/produto/${l.id}`} style={{ padding: '0.45rem 0.85rem', background: T.primary, color: '#fff', borderRadius: 3, fontSize: '0.78rem', fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          ✏ Editar / Vídeo
                        </a>
                        <a href={`/cliente/${id}/produto/${l.id}/materiais`} style={{ padding: '0.45rem 0.85rem', background: T.surfaceHigh, color: T.onSurface, border: `1px solid ${T.outlineVariant}`, borderRadius: 3, fontSize: '0.78rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                          Materiais
                        </a>
                        <button type="button" onClick={() => handleRemoveListing(l.id)}
                          style={{ padding: '0.45rem 0.75rem', background: 'transparent', border: `1px solid ${T.outlineVariant}`, borderRadius: 3, fontSize: '0.78rem', color: T.danger, cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>
                          Excluir
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      {/* Inline style to hide desktop save button on mobile and vice versa */}
      <style>{`
        @media (max-width: 600px) {
          .hub-topbar-actions { display: none !important; }
        }
      `}</style>
    </div>
  );
}
