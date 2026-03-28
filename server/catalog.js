/**
 * catalog.js — Catálogo público SSR (Server-Side Rendering)
 *
 * Gera HTML puro e otimizado para PageSpeed A e SEO.
 * Não usa frameworks no cliente — apenas HTML + CSS + JS mínimo inline.
 *
 * Rotas:
 *   GET /catalogo/:slug          → página do cliente (perfil + grid de imóveis)
 *   GET /catalogo/:slug/:id      → página individual do imóvel
 *   GET /catalogo/:slug/sitemap.xml → sitemap XML
 *   GET /catalogo/:slug/robots.txt  → robots.txt liberado
 *
 * Domínio próprio:
 *   Se o Host da requisição bater com o campo custom_domain do cliente,
 *   o slug é resolvido automaticamente e as rotas ficam em / e /:id.
 */

// ─── Utilitários ─────────────────────────────────────────────────────────────

/** Converte nome em slug URL-amigável */
export function slugify(name = '') {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60) || 'cliente';
}

/** Sanitiza string para uso seguro em HTML */
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Parse seguro do design_config do cliente */
function parseDesignConfig(raw) {
  if (!raw) return {};
  try { return typeof raw === 'string' ? JSON.parse(raw) : (raw || {}); } catch { return {}; }
}

/** Extrai cores do design_config e devolve variáveis CSS */
function buildCssVars(designConfig) {
  const d = parseDesignConfig(designConfig);
  const primary = d['--primary'] || '#2563eb';
  const heroBg = d['--contact-bg'] || darkenHex(primary, 0.25);
  const heroText = d['--contact-text'] || '#ffffff';
  const badge = d['--bg-poster'] || lightenHex(primary, 0.92);
  const badgeText = d['--primary'] || '#2563eb';
  return { primary, heroBg, heroText, badge, badgeText };
}

/** Escurece uma cor hex pelo fator dado (0-1) */
function darkenHex(hex, factor) {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const d = (c) => Math.max(0, Math.round(c * (1 - factor))).toString(16).padStart(2, '0');
    return '#' + d(r) + d(g) + d(b);
  } catch { return '#0f2b5b'; }
}

/** Clareia uma cor hex (mistura com branco) */
function lightenHex(hex, factor) {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const l = (c) => Math.min(255, Math.round(c + (255 - c) * factor)).toString(16).padStart(2, '0');
    return '#' + l(r) + l(g) + l(b);
  } catch { return '#eff6ff'; }
}

/** Parse completo de um row de listing do banco */
export function parseListing(row) {
  let raw = {};
  try { raw = typeof row.raw_data === 'string' ? JSON.parse(row.raw_data) : (row.raw_data || {}); } catch {}

  // Imagens: selected_images > carousel_images > images
  let images = [];
  if (row.selected_images) {
    try {
      const sel = typeof row.selected_images === 'string' ? JSON.parse(row.selected_images) : row.selected_images;
      if (Array.isArray(sel) && sel.length) images = sel;
    } catch {}
  }
  if (!images.length && Array.isArray(raw.carousel_images)) images = raw.carousel_images;
  if (!images.length && Array.isArray(raw.images)) images = raw.images;

  // Preço
  const price = raw.salePrice || raw.rentPrice
    || (raw.prices && (raw.prices.Venda || raw.prices.Aluguel || Object.values(raw.prices)[0]))
    || '';

  // Tipo de negócio
  const type = raw.rentPrice ? 'aluguel' : 'venda';

  // Amenidades
  const amenities = raw['amenities-list'] || [];
  const findAmen = (name) => amenities.find((a) => a.name === name)?.value || raw[name] || null;
  const rooms    = findAmen('numberOfRooms');
  const bath     = findAmen('numberOfBathroomsTotal');
  const area     = findAmen('floorSize');
  const parking  = findAmen('numberOfParkingSpaces');
  const suites   = findAmen('numberOfSuites');

  // Amenidades extras (excluindo as principais)
  const mainKeys = ['numberOfRooms','numberOfBathroomsTotal','floorSize','numberOfParkingSpaces','numberOfSuites'];
  const extras = amenities.filter((a) => !mainKeys.includes(a.name));

  // Título
  const title = (raw.title && String(raw.title).trim())
    ? raw.title
    : (raw.description && String(raw.description).trim().substring(0, 100))
    || price || 'Imóvel';

  return {
    id: row.id,
    title,
    description: raw.description || '',
    price,
    type,
    address: raw.address || '',
    images,
    rooms, bath, area, parking, suites,
    extras,
    prices: raw.prices || {},
    raw,
  };
}

// ─── CSS inline (compartilhado) ───────────────────────────────────────────────

function buildCss({ primary, heroBg, heroText, badge, badgeText }) {
  return `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:#f4f6f9;color:#111827;line-height:1.55;-webkit-font-smoothing:antialiased}
a{color:${primary};text-decoration:none}
a:hover{text-decoration:underline}
img{display:block;max-width:100%}

/* Layout */
.wrap{max-width:1180px;margin:0 auto;padding:0 1rem}

/* Hero */
.hero{background:linear-gradient(135deg,${heroBg} 0%,${primary} 100%);color:${heroText};padding:2.5rem 1rem 3rem;text-align:center;position:relative;overflow:hidden}
.hero::after{content:'';position:absolute;inset:0;background:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");pointer-events:none}
.hero-logo-wrap{width:90px;height:90px;border-radius:50%;overflow:hidden;border:3px solid rgba(255,255,255,0.35);margin:0 auto 1rem;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,0.2)}
.hero-logo-wrap img{width:100%;height:100%;object-fit:cover}
.hero-initial{font-size:2.2rem;font-weight:700;color:${primary}}
.hero h1{font-size:clamp(1.4rem,4vw,2rem);font-weight:700;margin-bottom:0.25rem;position:relative;z-index:1}
.hero-sub{font-size:0.95rem;opacity:0.88;margin-bottom:1.25rem;position:relative;z-index:1}
.hero-links{display:flex;gap:0.6rem;justify-content:center;flex-wrap:wrap;position:relative;z-index:1}
.hero-link{display:inline-flex;align-items:center;gap:0.4rem;padding:0.45rem 1rem;border-radius:50px;background:rgba(255,255,255,0.15);color:${heroText};font-size:0.85rem;font-weight:500;border:1px solid rgba(255,255,255,0.3);backdrop-filter:blur(4px);transition:background .15s}
.hero-link:hover{background:rgba(255,255,255,0.28);text-decoration:none}
.hero-link svg{width:16px;height:16px;flex-shrink:0}

/* Filtros */
.filters{background:#fff;border-bottom:1px solid #e5e7eb;padding:0.75rem 0;position:sticky;top:0;z-index:10;box-shadow:0 2px 8px rgba(0,0,0,0.06)}
.filters-inner{display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap}
.filter-pill{padding:0.35rem 1rem;border-radius:50px;border:1.5px solid #d1d5db;background:#fff;color:#374151;font-size:0.85rem;font-weight:500;cursor:pointer;transition:all .15s;white-space:nowrap}
.filter-pill:hover{border-color:${primary};color:${primary}}
.filter-pill.active{background:${primary};border-color:${primary};color:#fff}
.filter-count{font-size:0.8rem;color:#6b7280;margin-left:auto;white-space:nowrap}

/* Grid */
.section{padding:2rem 0}
.section-title{font-size:1.25rem;font-weight:700;margin-bottom:1.25rem;color:#111827}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1.25rem}
.card{background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.07),0 4px 16px rgba(0,0,0,0.06);transition:transform .2s,box-shadow .2s;position:relative}
.card:hover{transform:translateY(-3px);box-shadow:0 4px 12px rgba(0,0,0,0.1),0 12px 28px rgba(0,0,0,0.1)}
.card-img{width:100%;aspect-ratio:4/3;object-fit:cover;background:#e5e7eb}
.card-img-placeholder{width:100%;aspect-ratio:4/3;background:linear-gradient(135deg,#e5e7eb,#d1d5db);display:flex;align-items:center;justify-content:center}
.card-img-placeholder svg{width:48px;height:48px;opacity:.3}
.card-badge{position:absolute;top:0.75rem;left:0.75rem;background:${badge};color:${badgeText};font-size:0.72rem;font-weight:700;padding:0.22rem 0.6rem;border-radius:50px;text-transform:uppercase;letter-spacing:.04em}
.card-body{padding:1rem}
.card-title{font-size:0.92rem;font-weight:600;color:#111827;margin-bottom:0.5rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.4}
.card-price{font-size:1.1rem;font-weight:700;color:${primary};margin-bottom:0.65rem}
.card-features{display:flex;gap:0.6rem;flex-wrap:wrap;margin-bottom:0.85rem}
.feat{display:flex;align-items:center;gap:0.25rem;font-size:0.78rem;color:#4b5563}
.feat svg{width:13px;height:13px;opacity:.65;flex-shrink:0}
.card-footer{padding:0 1rem 1rem}
.btn-ver{display:block;text-align:center;padding:0.6rem;border-radius:8px;background:${primary};color:#fff;font-size:0.875rem;font-weight:600;transition:filter .15s}
.btn-ver:hover{filter:brightness(1.1);text-decoration:none}

/* Página de imóvel */
.back-link{display:inline-flex;align-items:center;gap:0.4rem;padding:0.75rem 0;color:#374151;font-size:0.9rem;font-weight:500}
.back-link:hover{color:${primary};text-decoration:none}
.back-link svg{width:16px;height:16px}
.gallery{display:grid;grid-template-columns:1fr;gap:0.5rem}
@media(min-width:640px){.gallery{grid-template-columns:2fr 1fr;grid-template-rows:auto auto}}
.gallery-main{border-radius:12px;overflow:hidden;aspect-ratio:4/3;background:#e5e7eb}
.gallery-main img{width:100%;height:100%;object-fit:cover}
.gallery-side{display:grid;gap:0.5rem}
.gallery-side img{border-radius:8px;aspect-ratio:4/3;object-fit:cover;width:100%;background:#e5e7eb}
.listing-wrap{display:grid;gap:1.5rem;padding:1.5rem 0}
@media(min-width:768px){.listing-wrap{grid-template-columns:1fr 340px}}
.listing-info{}
.listing-price{font-size:1.9rem;font-weight:800;color:${primary};margin-bottom:0.25rem}
.listing-title{font-size:1.1rem;font-weight:600;color:#111827;margin-bottom:0.5rem;line-height:1.4}
.listing-address{display:flex;align-items:center;gap:0.35rem;color:#6b7280;font-size:0.9rem;margin-bottom:1.25rem}
.listing-address svg{width:15px;height:15px;flex-shrink:0}
.feats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:0.75rem;margin-bottom:1.5rem}
.feat-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:0.85rem;display:flex;align-items:center;gap:0.6rem}
.feat-box svg{width:20px;height:20px;color:${primary};flex-shrink:0}
.feat-box-val{font-size:0.9rem;font-weight:600;color:#111827}
.feat-box-label{font-size:0.72rem;color:#6b7280}
.desc-section{margin-bottom:1.5rem}
.desc-section h2{font-size:1rem;font-weight:700;margin-bottom:0.6rem;color:#111827}
.desc-text{color:#374151;font-size:0.9rem;line-height:1.7;white-space:pre-line}
.extras-list{display:flex;flex-wrap:wrap;gap:0.5rem}
.extra-chip{background:${badge};color:${badgeText};font-size:0.78rem;font-weight:500;padding:0.3rem 0.75rem;border-radius:50px}
.prices-table{width:100%;border-collapse:collapse;font-size:0.9rem}
.prices-table td{padding:0.5rem 0;border-bottom:1px solid #e5e7eb;color:#374151}
.prices-table td:first-child{color:#6b7280}
.prices-table td:last-child{font-weight:600;text-align:right}

/* Sidebar CTA */
.cta-box{background:#fff;border-radius:14px;padding:1.5rem;box-shadow:0 1px 4px rgba(0,0,0,0.07),0 4px 16px rgba(0,0,0,0.06);position:sticky;top:80px}
.cta-box h3{font-size:1rem;font-weight:700;margin-bottom:0.25rem}
.cta-box p{font-size:0.85rem;color:#6b7280;margin-bottom:1.25rem}
.btn-whatsapp{display:flex;align-items:center;justify-content:center;gap:0.5rem;width:100%;padding:0.85rem;background:#25d366;color:#fff;border-radius:10px;font-size:0.95rem;font-weight:700;transition:filter .15s;margin-bottom:0.75rem}
.btn-whatsapp:hover{filter:brightness(1.08);text-decoration:none}
.btn-whatsapp svg{width:20px;height:20px}
.btn-catalog{display:flex;align-items:center;justify-content:center;gap:0.5rem;width:100%;padding:0.75rem;background:${primary};color:#fff;border-radius:10px;font-size:0.875rem;font-weight:600;transition:filter .15s}
.btn-catalog:hover{filter:brightness(1.1);text-decoration:none}

/* Footer */
.footer{background:#fff;border-top:1px solid #e5e7eb;padding:2rem 0;margin-top:2rem;text-align:center;color:#6b7280;font-size:0.85rem}
.footer-logo{width:48px;height:48px;border-radius:50%;overflow:hidden;margin:0 auto 0.75rem;background:#f3f4f6;display:flex;align-items:center;justify-content:center}
.footer-logo img{width:100%;height:100%;object-fit:cover}
.footer strong{color:#111827}

/* Estado vazio */
.empty{text-align:center;padding:4rem 1rem;color:#9ca3af}
.empty svg{width:56px;height:56px;margin:0 auto 1rem;opacity:.3}
.empty p{font-size:1rem}

/* Responsivo */
@media(max-width:480px){
  .hero{padding:2rem 1rem 2.5rem}
  .hero-logo-wrap{width:72px;height:72px}
  .section{padding:1.25rem 0}
  .listing-price{font-size:1.5rem}
}
`.trim();
}

// ─── SVG icons inline ─────────────────────────────────────────────────────────

const ICON = {
  home:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  bed:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>`,
  bath:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.683 3 4 3.683 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><line x1="10" y1="5" x2="8" y2="7"/><line x1="2" y1="12" x2="22" y2="12"/></svg>`,
  area:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>`,
  car:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="m16 8 4 3-1 5H1"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
  map:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  link:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  insta:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>`,
  wp:       `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>`,
  back:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`,
  img_ph:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  star:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
};

// ─── Proxy de imagem para o catálogo ─────────────────────────────────────────
/** Gera a URL de proxy para imagens externas (evita hotlink 403) */
function proxyImg(url, apiBase) {
  if (!url || typeof url !== 'string' || !url.trim()) return '';
  const u = url.trim();
  if (!u.startsWith('http')) return u;
  return `${apiBase}/api/proxy-image?url=${encodeURIComponent(u)}`;
}

// ─── Esqueleto HTML base ──────────────────────────────────────────────────────
function htmlShell({ title, description, canonical, ogImage, jsonLd, css, body, extraHead = '' }) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonical)}">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
${ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}">` : ''}
<link rel="canonical" href="${esc(canonical)}">
${extraHead}
<script type="application/ld+json">${jsonLd}</script>
<style>${css}</style>
</head>
<body>
${body}
</body>
</html>`;
}

// ─── Página do catálogo (lista de imóveis) ────────────────────────────────────
export function renderCatalogPage(client, listings, baseUrl, apiBase) {
  const colors = buildCssVars(client.design_config);
  const css = buildCss(colors);

  // WhatsApp: usa campo whatsapp, senão phone principal
  const wp = (client.whatsapp || client.phone || '').replace(/\D/g, '');
  const wpLink = wp ? `https://wa.me/55${wp}` : null;
  const clientUrl = `${baseUrl}/catalogo/${client.slug}`;

  // Hero links
  const heroLinks = [];
  if (wpLink) heroLinks.push({ href: wpLink, icon: ICON.wp, label: 'WhatsApp', rel: 'nofollow' });
  if (client.instagram) {
    const instaHandle = client.instagram.replace(/^@/, '');
    heroLinks.push({ href: `https://instagram.com/${instaHandle}`, icon: ICON.insta, label: 'Instagram', rel: 'nofollow' });
  }
  if (client.website) heroLinks.push({ href: client.website, icon: ICON.link, label: 'Site', rel: '' });

  const heroLinksHtml = heroLinks.map((l) =>
    `<a class="hero-link" href="${esc(l.href)}" target="_blank" rel="noopener${l.rel ? ' ' + l.rel : ''}">${l.icon} ${esc(l.label)}</a>`
  ).join('');

  // Logo ou inicial
  const logoHtml = client.logo_url
    ? `<img src="${esc(proxyImg(client.logo_url, apiBase))}" alt="${esc(client.name)}" width="90" height="90" loading="eager">`
    : `<span class="hero-initial">${esc((client.name || '?').charAt(0).toUpperCase())}</span>`;

  // Localização
  const location = [client.city, client.state].filter(Boolean).join(', ');

  // Metadata da empresa (JSON-LD)
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: client.name,
    url: clientUrl,
    image: client.logo_url || undefined,
    telephone: client.phone || undefined,
    email: client.email || undefined,
    address: location ? { '@type': 'PostalAddress', addressLocality: client.city || '', addressRegion: client.state || '', addressCountry: 'BR' } : undefined,
    sameAs: [client.website, client.instagram ? `https://instagram.com/${client.instagram.replace(/^@/, '')}` : undefined].filter(Boolean),
    numberOfItems: listings.length,
  });

  // Cards de imóveis
  const cardsHtml = listings.map((row) => {
    const l = parseListing(row);
    const img = l.images[0] ? proxyImg(l.images[0], apiBase) : null;
    const feats = [
      l.rooms    ? `${ICON.bed} <span>${esc(l.rooms)}</span>` : null,
      l.bath     ? `${ICON.bath} <span>${esc(l.bath)}</span>` : null,
      l.area     ? `${ICON.area} <span>${esc(l.area)}</span>` : null,
      l.parking  ? `${ICON.car} <span>${esc(l.parking)}</span>` : null,
    ].filter(Boolean).map((f) => `<span class="feat">${f}</span>`).join('');

    const typeLabel = l.type === 'aluguel' ? 'Aluguel' : 'Venda';
    const detailUrl = `${clientUrl}/${l.id}`;

    return `<article class="card" data-type="${l.type}">
  ${img
    ? `<img class="card-img" src="${esc(img)}" alt="${esc(l.title)}" loading="lazy" decoding="async" width="400" height="300">`
    : `<div class="card-img-placeholder">${ICON.img_ph}</div>`}
  <span class="card-badge">${esc(typeLabel)}</span>
  <div class="card-body">
    <p class="card-title">${esc(l.title)}</p>
    ${l.price ? `<p class="card-price">${esc(l.price)}</p>` : ''}
    ${feats ? `<div class="card-features">${feats}</div>` : ''}
  </div>
  <div class="card-footer">
    <a class="btn-ver" href="${esc(detailUrl)}">Ver detalhes →</a>
  </div>
</article>`;
  }).join('');

  const emptyHtml = `<div class="empty">${ICON.home}<p>Nenhum imóvel disponível no momento.</p></div>`;

  const ogImage = client.logo_url || (listings[0] ? parseListing(listings[0]).images[0] : null) || '';

  const body = `
<header class="hero">
  <div class="wrap" style="position:relative;z-index:1">
    <div class="hero-logo-wrap">${logoHtml}</div>
    <h1>${esc(client.name)}</h1>
    ${location ? `<p class="hero-sub">${ICON.map.replace('currentColor','rgba(255,255,255,.8)')} ${esc(location)}</p>` : '<p class="hero-sub">Imóveis selecionados para você</p>'}
    ${heroLinksHtml ? `<div class="hero-links">${heroLinksHtml}</div>` : ''}
  </div>
</header>

${listings.length > 0 ? `
<nav class="filters" aria-label="Filtrar imóveis">
  <div class="wrap filters-inner">
    <button class="filter-pill active" onclick="filtrar(this,'todos')" type="button">Todos</button>
    ${listings.some((r) => { try { const d = JSON.parse(r.raw_data||'{}'); return !d.rentPrice; } catch { return true; } }) ? `<button class="filter-pill" onclick="filtrar(this,'venda')" type="button">Venda</button>` : ''}
    ${listings.some((r) => { try { const d = JSON.parse(r.raw_data||'{}'); return !!d.rentPrice; } catch { return false; } }) ? `<button class="filter-pill" onclick="filtrar(this,'aluguel')" type="button">Aluguel</button>` : ''}
    <span class="filter-count" id="count">${listings.length} imóve${listings.length === 1 ? 'l' : 'is'}</span>
  </div>
</nav>
` : ''}

<main class="wrap">
  <section class="section">
    <h2 class="section-title">Imóveis disponíveis</h2>
    ${listings.length > 0
      ? `<div class="grid" id="grid">${cardsHtml}</div>`
      : emptyHtml}
  </section>
</main>

<footer class="footer">
  <div class="wrap">
    ${client.logo_url ? `<div class="footer-logo"><img src="${esc(proxyImg(client.logo_url, apiBase))}" alt="${esc(client.name)}" width="48" height="48" loading="lazy"></div>` : ''}
    <p><strong>${esc(client.name)}</strong></p>
    ${client.creci ? `<p>CRECI ${esc(client.creci)}</p>` : ''}
    ${client.phone ? `<p>${esc(client.phone)}</p>` : ''}
    ${client.email ? `<p>${esc(client.email)}</p>` : ''}
  </div>
</footer>

<script>
function filtrar(btn,tipo){
  document.querySelectorAll('.filter-pill').forEach(function(b){b.classList.remove('active')});
  btn.classList.add('active');
  var cards=document.querySelectorAll('#grid .card');
  var n=0;
  cards.forEach(function(c){
    var show=tipo==='todos'||c.dataset.type===tipo;
    c.style.display=show?'':'none';
    if(show)n++;
  });
  document.getElementById('count').textContent=n+' im\u00f3ve'+(n===1?'l':'is');
}
</script>`;

  return htmlShell({
    title: `${client.name} — Imóveis${location ? ' em ' + location : ''}`,
    description: `${listings.length} imóve${listings.length === 1 ? 'l' : 'is'} disponíve${listings.length === 1 ? 'l' : 'is'} com ${client.name}${location ? ' em ' + location : ''}. Confira o catálogo completo.`,
    canonical: clientUrl,
    ogImage: ogImage ? proxyImg(ogImage, apiBase) : '',
    jsonLd,
    css,
    body,
    extraHead: `<link rel="preconnect" href="${apiBase}">`,
  });
}

// ─── Página individual do imóvel ──────────────────────────────────────────────
export function renderListingPage(client, row, baseUrl, apiBase) {
  const colors = buildCssVars(client.design_config);
  const css = buildCss(colors);
  const l = parseListing(row);

  const clientUrl = `${baseUrl}/catalogo/${client.slug}`;
  const listingUrl = `${clientUrl}/${l.id}`;
  const location = [client.city, client.state].filter(Boolean).join(', ');

  // WhatsApp CTA
  const wp = (client.whatsapp || client.phone || '').replace(/\D/g, '');
  const wpMsg = encodeURIComponent(`Olá! Vi o imóvel "${l.title}"${l.price ? ' por ' + l.price : ''} no catálogo de ${client.name} e gostaria de saber mais.`);
  const wpLink = wp ? `https://wa.me/55${wp}?text=${wpMsg}` : null;

  // Galeria de imagens
  const imgs = l.images.slice(0, 5);
  let galleryHtml = '';
  if (imgs.length === 0) {
    galleryHtml = `<div class="gallery-main"><div class="card-img-placeholder" style="height:100%">${ICON.img_ph}</div></div>`;
  } else if (imgs.length === 1) {
    galleryHtml = `<div class="gallery-main"><img src="${esc(proxyImg(imgs[0], apiBase))}" alt="${esc(l.title)}" loading="eager" width="800" height="600"></div>`;
  } else {
    const [main, ...rest] = imgs;
    galleryHtml = `<div class="gallery">
  <div class="gallery-main"><img src="${esc(proxyImg(main, apiBase))}" alt="${esc(l.title)}" loading="eager" width="800" height="600"></div>
  <div class="gallery-side">
    ${rest.map((u, i) => `<img src="${esc(proxyImg(u, apiBase))}" alt="${esc(l.title)} foto ${i + 2}" loading="lazy" decoding="async" width="400" height="300">`).join('')}
  </div>
</div>`;
  }

  // Features principais
  const featBoxes = [
    l.rooms   ? { icon: ICON.bed,  val: l.rooms,   label: 'Quartos' } : null,
    l.suites  ? { icon: ICON.star, val: l.suites,  label: 'Suítes' } : null,
    l.bath    ? { icon: ICON.bath, val: l.bath,    label: 'Banheiros' } : null,
    l.area    ? { icon: ICON.area, val: l.area,    label: 'Área total' } : null,
    l.parking ? { icon: ICON.car,  val: l.parking, label: 'Vagas' } : null,
  ].filter(Boolean);

  const featBoxesHtml = featBoxes.length
    ? `<div class="feats-grid">${featBoxes.map((f) => `<div class="feat-box">${f.icon}<div><div class="feat-box-val">${esc(f.val)}</div><div class="feat-box-label">${f.label}</div></div></div>`).join('')}</div>`
    : '';

  // Tabela de preços
  const pricesEntries = Object.entries(l.prices).filter(([, v]) => v);
  const pricesHtml = pricesEntries.length > 1
    ? `<div class="desc-section"><h2>Valores</h2><table class="prices-table">${pricesEntries.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table></div>`
    : '';

  // Amenidades extras
  const extrasHtml = l.extras.length
    ? `<div class="desc-section"><h2>Características</h2><div class="extras-list">${l.extras.map((e) => `<span class="extra-chip">${esc(e.value || e.name)}</span>`).join('')}</div></div>`
    : '';

  // JSON-LD RealEstateListing
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: l.title,
    description: l.description || undefined,
    url: listingUrl,
    image: l.images.slice(0, 3).map((u) => proxyImg(u, apiBase)).filter(Boolean),
    offers: l.price ? { '@type': 'Offer', price: l.price, priceCurrency: 'BRL', availability: 'https://schema.org/InStock' } : undefined,
    address: l.address ? { '@type': 'PostalAddress', streetAddress: l.address, addressLocality: client.city || '', addressRegion: client.state || '', addressCountry: 'BR' } : undefined,
    numberOfRooms: l.rooms || undefined,
    floorSize: l.area ? { '@type': 'QuantitativeValue', value: l.area } : undefined,
    broker: { '@type': 'RealEstateAgent', name: client.name, url: clientUrl },
  });

  const body = `
<div class="wrap">
  <a class="back-link" href="${esc(clientUrl)}">${ICON.back} Voltar ao catálogo de ${esc(client.name)}</a>
</div>

<main class="wrap">
  ${galleryHtml}

  <div class="listing-wrap">
    <div class="listing-info">
      ${l.price ? `<p class="listing-price">${esc(l.price)}</p>` : ''}
      <h1 class="listing-title">${esc(l.title)}</h1>
      ${l.address ? `<p class="listing-address">${ICON.map} ${esc(l.address)}</p>` : ''}

      ${featBoxesHtml}
      ${pricesHtml}

      ${l.description ? `<div class="desc-section"><h2>Descrição</h2><p class="desc-text">${esc(l.description)}</p></div>` : ''}
      ${extrasHtml}
    </div>

    <aside>
      <div class="cta-box">
        ${client.logo_url ? `<div style="width:52px;height:52px;border-radius:50%;overflow:hidden;margin-bottom:.75rem"><img src="${esc(proxyImg(client.logo_url, apiBase))}" alt="${esc(client.name)}" width="52" height="52" loading="lazy"></div>` : ''}
        <h3>${esc(client.name)}</h3>
        <p>Interessado neste imóvel? Entre em contato agora.</p>
        ${wpLink ? `<a class="btn-whatsapp" href="${esc(wpLink)}" target="_blank" rel="noopener nofollow">${ICON.wp} Falar no WhatsApp</a>` : ''}
        <a class="btn-catalog" href="${esc(clientUrl)}">Ver todos os imóveis</a>
        ${client.creci ? `<p style="text-align:center;font-size:.78rem;color:#9ca3af;margin-top:.75rem">CRECI ${esc(client.creci)}</p>` : ''}
      </div>
    </aside>
  </div>
</main>

<footer class="footer">
  <div class="wrap">
    <p><strong>${esc(client.name)}</strong></p>
    ${location ? `<p>${esc(location)}</p>` : ''}
  </div>
</footer>`;

  return htmlShell({
    title: `${l.title}${l.price ? ' — ' + l.price : ''} | ${client.name}`,
    description: `${l.title}${l.address ? ' em ' + l.address : ''}${l.price ? '. ' + l.price : ''}. Imóvel anunciado por ${client.name}.`,
    canonical: listingUrl,
    ogImage: l.images[0] ? proxyImg(l.images[0], apiBase) : (client.logo_url || ''),
    jsonLd,
    css,
    body,
  });
}

// ─── Sitemap XML ──────────────────────────────────────────────────────────────
export function renderSitemap(client, listings, baseUrl) {
  const clientUrl = `${baseUrl}/catalogo/${client.slug}`;
  const now = new Date().toISOString().split('T')[0];
  const urls = [
    `  <url><loc>${esc(clientUrl)}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    ...listings.map((r) =>
      `  <url><loc>${esc(`${clientUrl}/${r.id}`)}</loc><lastmod>${(r.updated_at || now).split('T')[0]}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`
    ),
  ].join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}
