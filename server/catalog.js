/**
 * catalog.js — Catálogo público SSR (Server-Side Rendering)
 *
 * Gera HTML puro e otimizado para PageSpeed A e SEO.
 * Não usa frameworks no cliente — apenas HTML + CSS + JS mínimo inline.
 *
 * Rotas:
 *   GET /:slug                   → página de perfil do cliente (home)
 *   GET /:slug/catalogo          → catálogo de imóveis
 *   GET /:slug/catalogo/:id      → página individual do imóvel
 *   GET /:slug/sitemap.xml       → sitemap XML
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
  const clientUrl = `${baseUrl}/${client.slug}/catalogo`;

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

  const clientUrl = `${baseUrl}/${client.slug}/catalogo`;
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

// ─── Página de Perfil (home do cliente) ──────────────────────────────────────

/** Parse seguro do profile_config do cliente */
function parseProfileConfig(raw) {
  if (!raw) return {};
  try { return typeof raw === 'string' ? JSON.parse(raw) : (raw || {}); } catch { return {}; }
}

/** Detecta ícone Material Symbol a partir do rótulo do link */
function iconForLinkLabel(label = '') {
  const l = label.toLowerCase();
  if (l.includes('whatsapp') || l.includes('zap')) return 'chat';
  if (l.includes('instagram') || l.includes('insta')) return 'camera_alt';
  if (l.includes('youtube') || l.includes('video')) return 'play_circle';
  if (l.includes('catalogo') || l.includes('catálogo') || l.includes('imóveis') || l.includes('imoveis')) return 'apartment';
  if (l.includes('site') || l.includes('web')) return 'language';
  return 'link';
}

/** Converte URL de YouTube (watch, shorts, youtu.be) para embed */
function youtubeEmbedUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    let vid = null;
    if (u.hostname === 'youtu.be') { vid = u.pathname.slice(1); }
    else if (u.hostname.includes('youtube.com')) {
      vid = u.searchParams.get('v') || (u.pathname.startsWith('/shorts/') ? u.pathname.split('/shorts/')[1] : null);
    }
    return vid ? `https://www.youtube.com/embed/${vid}` : null;
  } catch { return null; }
}

export function renderProfilePage(client, baseUrl, apiBase) {
  const d = parseDesignConfig(client.design_config);
  const primary    = d['--primary'] || '#f2ca50';
  const primaryCt  = d['--contact-bg'] || darkenHex(primary, 0.12);

  const pc = parseProfileConfig(client.profile_config);

  const profileUrl  = `${baseUrl}/${client.slug}`;
  const catalogUrl  = `${baseUrl}/${client.slug}/catalogo`;

  const logoUrl = client.logo_url ? proxyImg(client.logo_url, apiBase) : null;
  const specialty = pc.specialty || client.contact_name || '';
  const aboutText = (pc.about_enabled !== false) ? (pc.about_bio || client.notes || '') : '';
  const aboutVideo = (pc.about_enabled !== false) ? (pc.about_video || '') : '';
  const aboutImages = (pc.about_enabled !== false && Array.isArray(pc.about_images)) ? pc.about_images.slice(0, 3).filter(Boolean) : [];
  const embedUrl = youtubeEmbedUrl(aboutVideo);

  // Build links from profile_config.links; fall back to legacy WhatsApp/Instagram/website
  let profileLinks = [];
  if (Array.isArray(pc.links) && pc.links.length > 0) {
    profileLinks = pc.links.map((l) => ({
      label: l.label || 'Link',
      href: l.url === 'auto' ? catalogUrl : (l.url || '#'),
      icon: iconForLinkLabel(l.label || ''),
      isPrimary: l.url === 'auto',
    }));
  } else {
    // Legacy fallback
    profileLinks.push({ label: 'Ver Catálogo de Imóveis', href: catalogUrl, icon: 'apartment', isPrimary: true });
    const wp = (client.whatsapp || client.phone || '').replace(/\D/g, '');
    if (wp) profileLinks.push({ label: 'Falar no WhatsApp', href: `https://wa.me/55${wp}`, icon: 'chat', isPrimary: false });
    const instaHandle = client.instagram ? client.instagram.replace(/^@/, '') : null;
    if (instaHandle) profileLinks.push({ label: 'Meu Instagram', href: `https://instagram.com/${instaHandle}`, icon: 'camera_alt', isPrimary: false });
    if (client.website) profileLinks.push({ label: 'Meu Site', href: client.website, icon: 'language', isPrimary: false });
  }

  const instaHandleForLd = client.instagram ? client.instagram.replace(/^@/, '') : null;
  const instaLinkForLd   = instaHandleForLd ? `https://instagram.com/${instaHandleForLd}` : null;

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: client.name,
    url: profileUrl,
    image: client.logo_url || undefined,
    telephone: client.phone || undefined,
    email: client.email || undefined,
    sameAs: [client.website, instaLinkForLd].filter(Boolean),
  });

  const html = `<!DOCTYPE html>
<html class="dark" lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>${esc(client.name)}${specialty ? ' | ' + esc(specialty) : ''}</title>
<meta name="description" content="${esc(client.name)}${specialty ? ' — ' + esc(specialty) : ''}${aboutText ? '. ' + esc(aboutText.substring(0, 120)) : ''}"/>
<meta property="og:title" content="${esc(client.name)}"/>
<meta property="og:description" content="${specialty ? esc(specialty) : 'Catálogo de imóveis'}"/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="${esc(profileUrl)}"/>
${logoUrl ? `<meta property="og:image" content="${esc(logoUrl)}"/>` : ''}
<link rel="canonical" href="${esc(profileUrl)}"/>
<script type="application/ld+json">${jsonLd}</script>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;700;900&family=Manrope:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
<style>
:root {
  --client-primary: ${esc(primary)};
  --client-primary-ct: ${esc(primaryCt)};
}
</style>
<script id="tailwind-config">
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "background": "#131313",
        "on-surface": "#e5e2e1",
        "surface": "#131313",
        "surface-dim": "#131313",
        "surface-container-lowest": "#0e0e0e",
        "surface-container-low": "#1c1b1b",
        "surface-container": "#201f1f",
        "surface-container-high": "#2a2a2a",
        "surface-container-highest": "#353534",
        "surface-bright": "#393939",
        "on-surface-variant": "#d0c5af",
        "outline": "#99907c",
        "outline-variant": "#4d4635",
        "primary": "${esc(primary)}",
        "primary-container": "${esc(primaryCt)}",
        "primary-fixed": "#ffe088",
        "primary-fixed-dim": "#e9c349",
        "on-primary": "#3c2f00",
        "on-primary-container": "#554300",
        "secondary": "#c8c6c5",
        "secondary-container": "#474747",
        "secondary-fixed": "#e4e2e1",
        "secondary-fixed-dim": "#c8c6c5",
        "on-secondary": "#303030",
        "on-secondary-container": "#b6b5b4",
        "on-secondary-fixed": "#1b1c1c",
        "on-secondary-fixed-variant": "#474747",
        "tertiary": "#d0cdcd",
        "tertiary-container": "#b4b2b2",
        "tertiary-fixed": "#e5e2e1",
        "tertiary-fixed-dim": "#c8c6c5",
        "on-tertiary": "#313030",
        "on-tertiary-container": "#454544",
        "on-tertiary-fixed": "#1c1b1b",
        "on-tertiary-fixed-variant": "#474746",
        "error": "#ffb4ab",
        "error-container": "#93000a",
        "on-error": "#690005",
        "on-error-container": "#ffdad6",
        "inverse-primary": "#735c00",
        "inverse-on-surface": "#313030",
        "inverse-surface": "#e5e2e1",
        "surface-tint": "#e9c349",
      },
      fontFamily: {
        "headline": ["Noto Serif"],
        "body": ["Manrope"],
        "label": ["Manrope"],
      },
      borderRadius: { "DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem" },
    },
  },
}
</script>
<style>
.material-symbols-outlined { font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
.pulsing-aura { box-shadow: 0 0 0 0 rgba(212,175,55,.4); animation: pulse 2s infinite; }
@keyframes pulse {
  0%   { transform: scale(1);    box-shadow: 0 0 0  0px rgba(212,175,55,.4); }
  70%  { transform: scale(1.02); box-shadow: 0 0 0 10px rgba(212,175,55,0);  }
  100% { transform: scale(1);    box-shadow: 0 0 0  0px rgba(212,175,55,.4); }
}
body { min-height: max(884px, 100dvh); }
</style>
</head>
<body class="bg-background text-on-surface font-body selection:bg-primary/30">

<!-- Header / Profile -->
<header class="relative pt-16 pb-8 px-6 flex flex-col items-center text-center">
  <div class="relative mb-6">
    <div class="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-primary-container to-primary">
      ${logoUrl
        ? `<img alt="${esc(client.name)}" class="w-full h-full rounded-full object-cover border-4 border-background" src="${esc(logoUrl)}"/>`
        : `<div class="w-full h-full rounded-full border-4 border-background bg-surface-container-high flex items-center justify-center font-headline font-black text-4xl text-primary">${esc((client.name || '?').charAt(0).toUpperCase())}</div>`
      }
    </div>
  </div>
  <h1 class="font-headline text-3xl font-bold tracking-tight text-on-surface mb-1 uppercase">${esc(client.name)}</h1>
  ${client.creci ? `<p class="text-primary font-label text-xs tracking-[0.2em] mb-3">CRECI ${esc(client.creci)}</p>` : ''}
  ${specialty ? `<p class="font-headline italic text-lg text-on-surface-variant opacity-80">${esc(specialty)}</p>` : ''}
</header>

<!-- Main -->
<main class="max-w-xl mx-auto px-6 pb-24 space-y-12">

  <!-- Links (primary CTA first, then secondary) -->
  <section class="flex flex-col gap-4">
    ${profileLinks.filter((l) => l.isPrimary).map((l) => `
    <a class="pulsing-aura text-on-primary-container py-5 px-8 flex items-center justify-center gap-3 group transition-all duration-300 hover:brightness-110" href="${esc(l.href)}" style="background-color:var(--client-primary-ct)">
      <span class="material-symbols-outlined text-2xl">${esc(l.icon)}</span>
      <span class="font-headline font-bold text-lg tracking-wide">${esc(l.label)}</span>
    </a>`).join('')}
  </section>

  <!-- Links secundários -->
  <nav class="flex flex-col gap-4">
    ${profileLinks.filter((l) => !l.isPrimary).map((l) => `
    <a class="border border-outline-variant hover:bg-surface-container-high transition-colors py-4 px-6 flex items-center justify-between group" href="${esc(l.href)}" target="_blank" rel="noopener nofollow">
      <div class="flex items-center gap-4">
        <span class="material-symbols-outlined text-primary-fixed-dim">${esc(l.icon)}</span>
        <span class="font-body font-semibold tracking-wide">${esc(l.label)}</span>
      </div>
      <span class="material-symbols-outlined text-sm opacity-40 group-hover:translate-x-1 transition-transform">arrow_forward_ios</span>
    </a>`).join('')}
  </nav>

  ${aboutText || embedUrl || aboutImages.length ? `
  <!-- Sobre -->
  <section id="about" class="space-y-6 pt-8">
    <h2 class="font-headline text-2xl font-bold border-l-2 pl-4" style="border-color:${esc(primaryCt)}">Sobre</h2>
    ${aboutText ? `<p class="text-on-surface-variant leading-relaxed font-light">${esc(aboutText)}</p>` : ''}
    ${embedUrl ? `
    <div class="relative w-full" style="padding-bottom:56.25%">
      <iframe allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="absolute inset-0 w-full h-full rounded-lg" src="${esc(embedUrl)}" title="Vídeo"></iframe>
    </div>` : ''}
    ${aboutImages.length ? `
    <div class="grid gap-2" style="grid-template-columns:repeat(${aboutImages.length},1fr)">
      ${aboutImages.map((img) => `<img alt="" class="w-full aspect-square object-cover rounded" src="${esc(img)}" loading="lazy"/>`).join('')}
    </div>` : ''}
  </section>` : ''}

</main>

<!-- Footer -->
<footer class="py-12 px-6 flex flex-col items-center gap-4 bg-surface-container-lowest border-t border-outline-variant/10">
  <div class="flex items-center gap-2">
    <span class="font-headline font-black text-primary text-xl tracking-widest uppercase">${esc(client.name)}</span>
  </div>
  ${client.creci ? `<p class="text-on-surface-variant/60 text-xs tracking-widest">CRECI ${esc(client.creci)}</p>` : ''}
  <p class="text-on-surface-variant/40 text-[10px] tracking-widest">© ${new Date().getFullYear()} ${esc(client.name).toUpperCase()}. TODOS OS DIREITOS RESERVADOS.</p>
</footer>

<!-- Bottom Nav (mobile) -->
<nav class="md:hidden fixed bottom-0 left-0 w-full bg-background/90 backdrop-blur-xl flex justify-around items-center py-3 z-50 border-t border-outline-variant/15 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
  <a class="flex flex-col items-center justify-center text-primary scale-110" href="${esc(profileUrl)}">
    <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1">badge</span>
    <span class="font-label text-[10px] uppercase tracking-tighter mt-1">Perfil</span>
  </a>
  <a class="flex flex-col items-center justify-center text-secondary-fixed-dim opacity-50" href="${esc(catalogUrl)}">
    <span class="material-symbols-outlined">apartment</span>
    <span class="font-label text-[10px] uppercase tracking-tighter mt-1">Imóveis</span>
  </a>
  ${(aboutText || embedUrl || aboutImages.length) ? `
  <a class="flex flex-col items-center justify-center text-secondary-fixed-dim opacity-50" href="#about">
    <span class="material-symbols-outlined">article</span>
    <span class="font-label text-[10px] uppercase tracking-tighter mt-1">Sobre</span>
  </a>` : ''}
</nav>

</body>
</html>`;

  return html;
}

// ─── Sitemap XML ──────────────────────────────────────────────────────────────
export function renderSitemap(client, listings, baseUrl) {
  const profileUrl = `${baseUrl}/${client.slug}`;
  const clientUrl = `${baseUrl}/${client.slug}/catalogo`;
  const now = new Date().toISOString().split('T')[0];
  const urls = [
    `  <url><loc>${esc(profileUrl)}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `  <url><loc>${esc(clientUrl)}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>`,
    ...listings.map((r) =>
      `  <url><loc>${esc(`${clientUrl}/${r.id}`)}</loc><lastmod>${(r.updated_at || now).split('T')[0]}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`
    ),
  ].join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}
