/**
 * layouts/layout1.js — Azure Horizon
 *
 * Layout claro/editorial inspirado em revistas de arquitetura.
 * Usa Tailwind CDN com Material Design 3 color tokens.
 *
 * Regra de cor de texto: NUNCA hardcodada — sempre derivada do fundo via
 * Tailwind token on-* (ex.: text-on-surface, text-on-primary, text-primary).
 * Os tokens são recalculados a partir das cores do cliente na função buildTokens().
 */

// ─── Utilitários de cor ───────────────────────────────────────────────────────

function hexLum(hex) {
  try {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const lin = c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  } catch { return 0; }
}

/** Cor de texto auto-contrastante (nunca hardcoda, sempre computa). */
function onColor(bgHex) {
  return hexLum(bgHex) > 0.30 ? '#191c1e' : '#ffffff';
}

function hexToHsl(hex) {
  try {
    let r = parseInt(hex.slice(1, 3), 16) / 255;
    let g = parseInt(hex.slice(3, 5), 16) / 255;
    let b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        default: h = ((r - g) / d + 4) / 6;
      }
    }
    return { h: h * 360, s, l };
  } catch { return { h: 210, s: 0.7, l: 0.15 }; }
}

function hslToHex(h, s, l) {
  try {
    h /= 360;
    let r, g, b;
    if (s === 0) { r = g = b = l; } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const f = (p, q, t) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      r = f(p, q, h + 1/3); g = f(p, q, h); b = f(p, q, h - 1/3);
    }
    const toH = c => Math.round(Math.max(0, Math.min(255, c * 255))).toString(16).padStart(2, '0');
    return '#' + toH(r) + toH(g) + toH(b);
  } catch { return '#002045'; }
}

/**
 * Gera os tokens de cor MD3 para o Tailwind config a partir das cores do cliente.
 * primary     → --contact-bg (cor de marca escura)
 * cta (btn)   → --btn-bg (split-complementar)
 * badge       → --bg-poster (chip escuro)
 * Superfícies → sempre claras (este layout é sempre light-mode)
 */
function buildTokens(designConfig) {
  let d = {};
  try { d = typeof designConfig === 'string' ? JSON.parse(designConfig) : (designConfig || {}); } catch {}

  const brandHex  = d['--contact-bg']  || '#002045';
  const accentHex = d['--primary']     || brandHex;
  const btnHex    = d['--btn-bg']      || accentHex;
  const badgeHex  = d['--bg-poster']   || brandHex;

  const { h, s } = hexToHsl(brandHex);
  const sN = Math.max(0.55, Math.min(1.0, s + 0.05));

  // primary-container: slightly lighter/different shade of brand
  const primContH = hslToHex(h, Math.min(1, sN * 0.95), Math.min(0.28, hexToHsl(brandHex).l + 0.10));
  // on-primary-container: muted light blue readable on dark container
  const onPrimContH = hslToHex(h, Math.min(0.65, sN * 0.55), 0.72);
  // primary-fixed: very light tint (for quote backgrounds etc.)
  const primFixedH = hslToHex(h, Math.min(0.65, sN * 0.35), 0.94);
  // secondary-container: lighter version for small chips
  const secContH = hslToHex(h, Math.min(0.55, sN * 0.35), 0.90);
  const onSecContH = hslToHex(h, Math.min(0.75, sN * 0.65), 0.32);

  return {
    // ── Brand / primary ──
    'primary':                brandHex,
    'on-primary':             '#ffffff',           // always white — brand is always dark
    'primary-container':      primContH,
    'on-primary-container':   onPrimContH,
    'primary-fixed':          primFixedH,
    'primary-fixed-dim':      hslToHex(h, Math.min(0.55, sN * 0.45), 0.76),
    // ── CTA button ──
    'cta-btn':                btnHex,
    'on-cta-btn':             onColor(btnHex),
    // ── Badge / chip (tertiary) ──
    'tertiary-container':     badgeHex,
    'on-tertiary-container':  onColor(badgeHex),    // auto-contrast
    // ── Secondary chips ──
    'secondary-container':    secContH,
    'on-secondary-container': onSecContH,
    // ── Light surfaces (este layout é sempre claro) ──
    'background':             '#f7f9fb',
    'surface':                '#f7f9fb',
    'surface-bright':         '#f7f9fb',
    'surface-container-lowest':  '#ffffff',
    'surface-container-low':     '#f2f4f6',
    'surface-container':         '#eceef0',
    'surface-container-high':    '#e6e8ea',
    'surface-container-highest': '#e0e3e5',
    // ── Text (auto via on-* — nunca hardcodados) ──
    'on-surface':             '#191c1e',
    'on-background':          '#191c1e',
    'on-surface-variant':     '#43474e',
    // ── Borders ──
    'outline':                '#74777f',
    'outline-variant':        '#c4c6cf',
    // ── Inverse ──
    'inverse-surface':        '#2d3133',
    'inverse-on-surface':     '#eff1f3',
    'inverse-primary':        hslToHex(h, Math.min(0.65, sN * 0.60), 0.78),
  };
}

/** Serializa tokens para o script tailwind.config. */
function tokensToJs(tokens) {
  return Object.entries(tokens)
    .map(([k, v]) => `"${k}":"${v}"`)
    .join(',');
}

// ─── Shell HTML compartilhado ─────────────────────────────────────────────────

function l1Shell({ title, description, canonical, ogImage, jsonLd, tokens, body, clientName = '' }) {
  const tc = tokensToJs(tokens);
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
<link rel="canonical" href="${esc(canonical)}">
<script type="application/ld+json">${jsonLd}</script>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" rel="stylesheet">
<script id="tailwind-config">
  tailwind.config = {
    theme: {
      extend: {
        colors: {${tc}},
        fontFamily: { headline:["Manrope"], body:["Manrope"], label:["Inter"] },
        borderRadius: { DEFAULT:"0.125rem", lg:"0.25rem", xl:"0.5rem", full:"0.75rem" }
      }
    }
  }
</script>
<style>
  .material-symbols-outlined { font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; }
  body { min-height:max(884px,100dvh); -webkit-font-smoothing:antialiased; }
  .glass-nav { background:rgba(247,249,251,0.65); backdrop-filter:blur(20px); }
  .hide-scrollbar::-webkit-scrollbar { display:none; }
  .hide-scrollbar { -ms-overflow-style:none; scrollbar-width:none; }
</style>
</head>
<body class="bg-background font-body text-on-surface antialiased">
${body}
</body>
</html>`;
}

// ─── Utilitários compartilhados ───────────────────────────────────────────────

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/** Cabeçalho fixo com glassmorphism */
function glassHeader(client, proxyImg, apiBase) {
  const logoHtml = client.logo_url
    ? `<img src="${esc(proxyImg(client.logo_url, apiBase))}" alt="${esc(client.name)}" class="h-8 w-auto max-w-[120px] object-contain">`
    : `<span class="text-xl font-extrabold tracking-tight text-primary font-headline">${esc((client.name || '').slice(0, 12))}</span>`;
  return `<header class="glass-nav fixed top-0 w-full z-50 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
  <div class="flex justify-between items-center w-full px-5 h-16 max-w-2xl mx-auto">
    <a href="#" class="flex items-center gap-2">${logoHtml}</a>
    <span class="text-sm font-semibold text-on-surface-variant font-label hidden sm:block">${esc(client.name)}</span>
    <div class="flex items-center gap-3">
      ${client.phone ? `<a href="https://wa.me/55${(client.whatsapp || client.phone).replace(/\D/g,'')}" class="flex items-center gap-1 bg-primary text-on-primary text-xs font-bold px-3 py-1.5 rounded-full font-label" target="_blank" rel="noopener nofollow"><span class="material-symbols-outlined !text-sm">chat</span>Contato</a>` : ''}
    </div>
  </div>
</header>`;
}

/** Card de imóvel — estilo Azure Horizon (imagem 4:5 com content block sobreposto) */
function propertyCard(listing, detailUrl, proxyImg, apiBase, ICON, badge, badgeLabel = '') {
  const l = listing;
  const img = l.images[0] ? proxyImg(l.images[0], apiBase) : null;
  const typeLabel = badgeLabel || (l.type === 'aluguel' ? 'Aluguel' : 'À Venda');

  const featsHtml = [
    l.rooms   ? `<div class="flex items-center gap-1.5"><span class="material-symbols-outlined !text-sm text-on-primary-container">bed</span><span class="font-label text-xs font-semibold text-primary">${esc(l.rooms)}</span></div>` : '',
    l.bath    ? `<div class="flex items-center gap-1.5"><span class="material-symbols-outlined !text-sm text-on-primary-container">bathtub</span><span class="font-label text-xs font-semibold text-primary">${esc(l.bath)}</span></div>` : '',
    l.area    ? `<div class="flex items-center gap-1.5"><span class="material-symbols-outlined !text-sm text-on-primary-container">square_foot</span><span class="font-label text-xs font-semibold text-primary">${esc(l.area)}</span></div>` : '',
    l.parking ? `<div class="flex items-center gap-1.5"><span class="material-symbols-outlined !text-sm text-on-primary-container">directions_car</span><span class="font-label text-xs font-semibold text-primary">${esc(l.parking)}</span></div>` : '',
  ].filter(Boolean).join('');

  return `<article class="group relative">
  <div class="aspect-[4/5] overflow-hidden rounded-xl bg-surface-container shadow-sm">
    ${img
      ? `<img src="${esc(img)}" alt="${esc(l.title)}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy">`
      : `<div class="w-full h-full flex items-center justify-center bg-surface-container-high"><span class="material-symbols-outlined text-on-surface-variant opacity-30 !text-6xl">apartment</span></div>`}
  </div>
  <div class="absolute top-4 left-4">
    <span class="bg-tertiary-container text-on-tertiary-container text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg shadow-sm">${esc(typeLabel)}</span>
  </div>
  <div class="relative -mt-20 mx-4 bg-surface-container-lowest p-5 rounded-xl shadow-[0_20px_40px_rgba(0,32,69,0.06)] border border-outline-variant/5">
    <div class="flex justify-between items-start mb-2">
      <h3 class="text-lg font-bold text-primary font-headline tracking-tight leading-tight flex-1 pr-2 line-clamp-2">${esc(l.title || l.address || 'Imóvel')}</h3>
      ${l.price ? `<p class="text-lg font-extrabold text-primary font-label whitespace-nowrap">${esc(l.price)}</p>` : ''}
    </div>
    ${l.address ? `<p class="flex items-center text-on-surface-variant font-label text-xs mb-4">
      <span class="material-symbols-outlined !text-xs mr-1">location_on</span>${esc(l.address)}
    </p>` : ''}
    ${featsHtml ? `<div class="flex items-center gap-5 border-t border-outline-variant/10 pt-3">${featsHtml}</div>` : ''}
    <a href="${esc(detailUrl)}" class="mt-4 flex items-center justify-center gap-2 w-full bg-primary text-on-primary font-label font-bold text-sm py-3 rounded-lg hover:opacity-90 transition-opacity">
      Ver detalhes
      <span class="material-symbols-outlined !text-sm">arrow_forward</span>
    </a>
  </div>
</article>`;
}

/** Rodapé simples */
function footer(client, proxyImg, apiBase) {
  return `<footer class="mt-16 pb-10 text-center px-6">
  <div class="max-w-2xl mx-auto">
    ${client.logo_url ? `<img src="${esc(proxyImg(client.logo_url, apiBase))}" alt="${esc(client.name)}" class="h-10 w-auto object-contain mx-auto mb-3 opacity-60">` : ''}
    <p class="text-on-surface-variant font-label text-xs">${esc(client.name)}${client.creci ? ` · CRECI ${esc(client.creci)}` : ''}</p>
    ${client.phone ? `<p class="text-on-surface-variant font-label text-xs">${esc(client.phone)}</p>` : ''}
  </div>
</footer>`;
}

// ─── Catálogo (lista de imóveis) ──────────────────────────────────────────────

export function renderCatalogPage({ client, listings, baseUrl, apiBase, parseListing, proxyImg }) {
  const tokens   = buildTokens(client.design_config);
  const catalogUrl = `${baseUrl}/${client.slug}/catalogo`;
  const location = [client.city, client.state].filter(Boolean).join(', ');

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'RealEstateAgent',
    name: client.name, url: catalogUrl,
    image: client.logo_url || undefined,
    telephone: client.phone || undefined,
    numberOfItems: listings.length,
  });

  const cardsHtml = listings.length
    ? listings.map((row) => {
        const l = parseListing(row);
        return propertyCard(l, `${catalogUrl}/${l.id}`, proxyImg, apiBase, null);
      }).join('')
    : `<div class="col-span-full py-16 text-center text-on-surface-variant">
        <span class="material-symbols-outlined !text-6xl opacity-30 block mb-4">apartment</span>
        <p class="font-label text-sm">Nenhum imóvel disponível no momento.</p>
      </div>`;

  const hasVenda   = listings.some(r => { try { return !JSON.parse(r.raw_data||'{}').rentPrice; } catch { return true; } });
  const hasAluguel = listings.some(r => { try { return !!JSON.parse(r.raw_data||'{}').rentPrice; } catch { return false; } });

  const body = `
${glassHeader(client, proxyImg, apiBase)}
<main class="pt-20 pb-32 px-5 max-w-2xl mx-auto">
  <!-- Editorial headline -->
  <section class="mb-8 pt-6">
    <p class="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant mb-2">Coleção de Imóveis</p>
    <h1 class="text-3xl font-extrabold tracking-tight text-primary font-headline leading-tight">
      ${esc(client.name)}${location ? `<br><span class="text-primary-container font-light italic text-xl">${esc(location)}</span>` : ''}
    </h1>
  </section>

  <!-- Filtros -->
  ${listings.length > 1 ? `<section class="mb-8 sticky top-20 z-40 bg-surface/80 backdrop-blur-md -mx-5 px-5 py-2">
    <div class="flex gap-2 overflow-x-auto hide-scrollbar">
      <button onclick="filtrar(this,'todos')" class="filter-btn active shrink-0 px-4 py-2 rounded-full text-xs font-label font-bold transition-colors bg-primary text-on-primary">Todos <span class="ml-1 opacity-70" id="count">${listings.length}</span></button>
      ${hasVenda   ? `<button onclick="filtrar(this,'venda')"   class="filter-btn shrink-0 px-4 py-2 rounded-full text-xs font-label font-bold transition-colors bg-surface-container-high text-on-surface-variant">Venda</button>` : ''}
      ${hasAluguel ? `<button onclick="filtrar(this,'aluguel')" class="filter-btn shrink-0 px-4 py-2 rounded-full text-xs font-label font-bold transition-colors bg-surface-container-high text-on-surface-variant">Aluguel</button>` : ''}
    </div>
  </section>` : ''}

  <!-- Grid de imóveis -->
  <section id="grid" class="space-y-10">${cardsHtml}</section>
</main>

${footer(client, proxyImg, apiBase)}

<script>
function filtrar(btn,tipo){
  document.querySelectorAll('.filter-btn').forEach(function(b){
    b.classList.remove('bg-primary','text-on-primary');
    b.classList.add('bg-surface-container-high','text-on-surface-variant');
  });
  btn.classList.add('bg-primary','text-on-primary');
  btn.classList.remove('bg-surface-container-high','text-on-surface-variant');
  var cards=document.querySelectorAll('#grid article');
  var n=0;
  cards.forEach(function(c){
    var show=tipo==='todos'||c.dataset.type===tipo;
    c.style.display=show?'':'none';
    if(show)n++;
  });
  var el=document.getElementById('count');
  if(el)el.textContent=n;
}
// set data-type on cards from badge text
document.querySelectorAll('#grid article').forEach(function(c){
  var badge=c.querySelector('.bg-tertiary-container');
  if(badge){
    var t=badge.textContent.trim().toLowerCase();
    c.dataset.type=t.includes('aluguel')?'aluguel':'venda';
  }
});
</script>`;

  return l1Shell({
    title: `${client.name} — Imóveis${location ? ' em ' + location : ''}`,
    description: `${listings.length} imóve${listings.length===1?'l':'is'} com ${client.name}${location?' em '+location:''}.`,
    canonical: catalogUrl,
    ogImage: client.logo_url ? proxyImg(client.logo_url, apiBase) : '',
    jsonLd,
    tokens,
    body,
  });
}

// ─── Página de detalhe do imóvel ──────────────────────────────────────────────

export function renderListingPage({ client, row, baseUrl, apiBase, parseListing, proxyImg }) {
  const tokens     = buildTokens(client.design_config);
  const catalogUrl = `${baseUrl}/${client.slug}/catalogo`;
  const l          = parseListing(row);
  const listingUrl = `${catalogUrl}/${l.id}`;
  const wp         = (client.whatsapp || client.phone || '').replace(/\D/g, '');
  const wpLink     = wp ? `https://wa.me/55${wp}?text=${encodeURIComponent('Olá! Tenho interesse no imóvel: '+l.title)}` : null;
  const mainImg    = l.images[0] ? proxyImg(l.images[0], apiBase) : null;
  const thumbs     = l.images.slice(1, 5).map(u => proxyImg(u, apiBase));

  const priceEntries = l.prices && typeof l.prices === 'object'
    ? Object.entries(l.prices).filter(([,v]) => v)
    : (l.price ? [['Valor', l.price]] : []);

  const feats = [
    { icon: 'bed',          val: l.rooms,   label: 'Quartos' },
    { icon: 'bathtub',      val: l.bath,    label: 'Banheiros' },
    { icon: 'square_foot',  val: l.area,    label: 'Área' },
    { icon: 'directions_car', val: l.parking, label: 'Vagas' },
  ].filter(f => f.val);

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'RealEstateListing',
    name: l.title, url: listingUrl,
    description: l.description,
    image: l.images[0] || undefined,
    offers: l.price ? { '@type': 'Offer', price: l.price, priceCurrency: 'BRL' } : undefined,
  });

  const body = `
${glassHeader(client, proxyImg, apiBase)}
<main class="pb-36 max-w-2xl mx-auto">
  <!-- Hero Gallery -->
  <section class="relative pt-16 ${mainImg ? 'h-[420px]' : 'h-40'} overflow-hidden">
    ${mainImg
      ? `<img src="${esc(mainImg)}" alt="${esc(l.title)}" class="w-full h-full object-cover">`
      : `<div class="w-full h-full bg-surface-container-high flex items-center justify-center"><span class="material-symbols-outlined !text-8xl opacity-20 text-on-surface-variant">apartment</span></div>`}
    <a href="${esc(catalogUrl)}" class="absolute top-20 left-5 bg-surface/80 backdrop-blur-md p-2 rounded-xl text-primary shadow-sm">
      <span class="material-symbols-outlined">arrow_back</span>
    </a>
    ${l.type ? `<div class="absolute bottom-5 left-5"><span class="bg-tertiary-container text-on-tertiary-container px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider">${esc(l.type === 'aluguel' ? 'Aluguel' : 'À Venda')}</span></div>` : ''}
  </section>

  <!-- Content Card -->
  <section class="px-5 -mt-12 relative z-10">
    <div class="bg-surface-container-lowest rounded-xl p-6 shadow-[0_20px_40px_rgba(0,32,69,0.07)]">
      <div class="flex justify-between items-start mb-4 gap-3">
        <h1 class="font-headline text-2xl font-extrabold text-primary tracking-tight leading-tight flex-1">${esc(l.title || 'Imóvel')}</h1>
        ${l.price ? `<div class="text-right shrink-0"><p class="font-headline text-xl font-bold text-primary">${esc(l.price)}</p></div>` : ''}
      </div>
      ${l.address ? `<p class="text-on-surface-variant font-label text-sm mb-5 flex items-center gap-1"><span class="material-symbols-outlined !text-sm">location_on</span>${esc(l.address)}</p>` : ''}
      ${feats.length ? `<div class="flex justify-around py-5 border-y border-outline-variant/15 mt-2">
        ${feats.map(f => `<div class="flex flex-col items-center gap-1">
          <span class="material-symbols-outlined text-primary !text-2xl">${f.icon}</span>
          <span class="font-label text-sm font-bold text-primary">${esc(f.val)}</span>
          <span class="font-label text-[10px] text-on-surface-variant uppercase tracking-wider">${f.label}</span>
        </div>`).join('')}
      </div>` : ''}
    </div>
  </section>

  <!-- Gallery Thumbs -->
  ${thumbs.length ? `<section class="px-5 mt-6">
    <div class="grid grid-cols-4 gap-2">
      ${thumbs.map(u => `<img src="${esc(u)}" alt="" class="w-full aspect-square object-cover rounded-lg" loading="lazy">`).join('')}
    </div>
  </section>` : ''}

  <!-- Description -->
  ${l.description ? `<section class="px-5 mt-8">
    <h2 class="font-headline text-lg font-bold text-primary mb-3">Descrição</h2>
    <p class="text-on-surface-variant leading-relaxed font-body text-sm whitespace-pre-line">${esc(l.description)}</p>
  </section>` : ''}

  <!-- Prices Table -->
  ${priceEntries.length > 1 ? `<section class="px-5 mt-8">
    <h2 class="font-headline text-lg font-bold text-primary mb-3">Preços</h2>
    <div class="bg-surface-container-lowest rounded-xl overflow-hidden">
      ${priceEntries.map(([k, v]) => `<div class="flex justify-between items-center px-5 py-3 border-b border-outline-variant/10 last:border-0">
        <span class="font-label text-sm text-on-surface-variant">${esc(k)}</span>
        <span class="font-label text-sm font-bold text-primary">${esc(v)}</span>
      </div>`).join('')}
    </div>
  </section>` : ''}

  <!-- Amenities -->
  ${l.extras && l.extras.length ? `<section class="px-5 mt-8">
    <h2 class="font-headline text-lg font-bold text-primary mb-3">Comodidades</h2>
    <div class="flex flex-wrap gap-2">
      ${l.extras.map(e => `<span class="bg-secondary-container text-on-secondary-container text-xs font-label font-semibold px-3 py-1.5 rounded-full">${esc(e)}</span>`).join('')}
    </div>
  </section>` : ''}
</main>

<!-- CTA Fixed Bottom -->
<div class="fixed bottom-0 left-0 w-full z-50 px-5 pb-8 pt-4 bg-surface/95 backdrop-blur-sm border-t border-outline-variant/10 max-w-2xl mx-auto left-1/2 -translate-x-1/2">
  <div class="flex gap-3">
    ${wpLink ? `<a href="${esc(wpLink)}" target="_blank" rel="noopener nofollow"
      class="flex-1 flex items-center justify-center gap-2 bg-[#25d366] text-white font-label font-bold text-sm py-4 rounded-xl shadow-lg">
      <span class="material-symbols-outlined !text-lg">chat</span>WhatsApp
    </a>` : ''}
    <a href="${esc(catalogUrl)}"
      class="flex-1 flex items-center justify-center gap-2 bg-primary text-on-primary font-label font-bold text-sm py-4 rounded-xl shadow-lg">
      <span class="material-symbols-outlined !text-lg">arrow_back</span>Ver mais
    </a>
  </div>
</div>`;

  return l1Shell({
    title: `${l.title || 'Imóvel'} — ${client.name}`,
    description: l.description ? l.description.slice(0, 160) : `Imóvel com ${client.name}.`,
    canonical: listingUrl,
    ogImage: mainImg || '',
    jsonLd,
    tokens,
    body,
  });
}

// ─── Perfil da imobiliária (home) ─────────────────────────────────────────────

export function renderProfilePage({ client, baseUrl, apiBase, corretores, listings, parseListing, proxyImg }) {
  const tokens     = buildTokens(client.design_config);
  const profileUrl = `${baseUrl}/${client.slug}`;
  const catalogUrl = `${profileUrl}/catalogo`;
  const wp         = (client.whatsapp || client.phone || '').replace(/\D/g, '');
  const wpLink     = wp ? `https://wa.me/55${wp}` : null;

  let pc = {};
  try { pc = typeof client.profile_config === 'string' ? JSON.parse(client.profile_config) : (client.profile_config || {}); } catch {}

  const aboutBio = pc.about_bio || '';
  const heroBgImage = pc.hero_bg_image
    ? (pc.hero_bg_image.startsWith('data:') ? pc.hero_bg_image : proxyImg(pc.hero_bg_image, apiBase))
    : null;

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'RealEstateAgent',
    name: client.name, url: profileUrl,
    image: client.logo_url || undefined,
    telephone: client.phone || undefined,
    email: client.email || undefined,
  });

  const corretoresHtml = Array.isArray(corretores) && corretores.length
    ? corretores.filter(c => c.active !== 0).map(c => {
        const photoUrl = c.photo_url ? proxyImg(c.photo_url, apiBase) : null;
        const slug = c.slug || c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-');
        return `<a href="${esc(profileUrl)}/${esc(slug)}" class="flex flex-col items-center gap-2 text-center">
          ${photoUrl
            ? `<img src="${esc(photoUrl)}" alt="${esc(c.name)}" class="w-16 h-16 rounded-full object-cover border-2 border-surface-container-lowest shadow-sm">`
            : `<div class="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-on-primary font-headline font-bold text-xl">${esc((c.name||'?').charAt(0).toUpperCase())}</div>`}
          <p class="font-label text-xs font-semibold text-on-surface">${esc(c.name)}</p>
          ${c.specialty ? `<p class="font-label text-[10px] text-primary">${esc(c.specialty)}</p>` : ''}
        </a>`;
      }).join('')
    : '';

  const links = Array.isArray(pc.links) ? pc.links.filter(l => l.url && l.url !== 'auto') : [];

  const body = `
${glassHeader(client, proxyImg, apiBase)}
<main class="pt-20 pb-24 max-w-2xl mx-auto">

  <!-- Hero Profile -->
  <section class="relative px-5 pt-10 pb-10 text-center overflow-hidden bg-primary">
    ${heroBgImage ? `<div class="absolute inset-0" style="background-image:url('${esc(heroBgImage)}');background-size:cover;background-position:center;opacity:0.25"></div>` : ''}
    <div class="relative z-10">
    <div class="mb-5">
      ${client.logo_url
        ? `<div class="inline-flex p-1 rounded-2xl bg-surface-container-lowest shadow-md">
            <img src="${esc(proxyImg(client.logo_url, apiBase))}" alt="${esc(client.name)}" class="h-20 w-auto max-w-[160px] object-contain rounded-xl">`
        : `<div class="w-20 h-20 rounded-2xl bg-surface-container-lowest shadow-md flex items-center justify-center mx-auto">
            <span class="font-headline font-bold text-3xl text-primary">${esc((client.name||'?').charAt(0))}</span>
          </div>`}
      ${client.logo_url ? '</div>' : ''}
    </div>
    <h1 class="font-headline text-2xl font-extrabold text-on-primary tracking-tight mb-1">${esc(client.name)}</h1>
    ${pc.specialty ? `<p class="font-label text-sm text-on-primary/70 mb-6">${esc(pc.specialty)}</p>` : '<div class="mb-6"></div>'}
    <div class="flex gap-3 justify-center">
      ${wpLink ? `<a href="${esc(wpLink)}" target="_blank" rel="noopener nofollow"
        class="flex items-center gap-2 bg-surface-container-lowest text-on-surface font-label font-bold text-sm px-5 py-3 rounded-xl shadow-sm">
        <span class="material-symbols-outlined !text-lg">chat</span>WhatsApp
      </a>` : ''}
      <a href="${esc(catalogUrl)}"
        class="flex items-center gap-2 bg-cta-btn text-on-cta-btn font-label font-bold text-sm px-5 py-3 rounded-xl shadow-sm">
        <span class="material-symbols-outlined !text-lg">search</span>Ver Imóveis
      </a>
    </div>
    </div>
  </section>

  <!-- Sobre -->
  ${aboutBio ? `<section class="px-5 mt-10">
    <h2 class="font-headline text-xl font-bold text-primary mb-4">Sobre</h2>
    <div class="bg-primary-fixed/20 p-6 rounded-xl relative overflow-hidden">
      <span class="material-symbols-outlined absolute -right-4 -bottom-4 text-primary opacity-5 !text-8xl">format_quote</span>
      <p class="text-on-surface-variant leading-relaxed font-body text-sm">${esc(aboutBio)}</p>
    </div>
  </section>` : ''}

  <!-- Links adicionais -->
  ${links.length ? `<section class="px-5 mt-10 space-y-3">
    ${links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener"
      class="flex items-center justify-between px-5 py-4 bg-surface-container-lowest rounded-xl border border-outline-variant/10 shadow-sm hover:shadow-md transition-shadow">
      <span class="font-label text-sm font-semibold text-on-surface">${esc(l.label || l.url)}</span>
      <span class="material-symbols-outlined !text-sm text-on-surface-variant">open_in_new</span>
    </a>`).join('')}
  </section>` : ''}

  <!-- Equipe -->
  ${corretoresHtml ? `<section class="px-5 mt-12">
    <h2 class="font-headline text-xl font-bold text-primary mb-6">Nossa Equipe</h2>
    <div class="grid grid-cols-3 gap-4">${corretoresHtml}</div>
  </section>` : ''}

  <!-- Imóveis em destaque -->
  ${Array.isArray(listings) && listings.length ? `<section class="mt-12">
    <div class="flex items-center justify-between px-5 mb-6">
      <h2 class="font-headline text-xl font-bold text-primary">Imóveis em Destaque</h2>
      <a href="${esc(catalogUrl)}" class="font-label text-xs font-bold text-primary">Ver todos</a>
    </div>
    <div class="px-5 space-y-10">
      ${listings.map(row => {
        const l = parseListing(row);
        return propertyCard(l, `${catalogUrl}/${l.id}`, proxyImg, apiBase, null);
      }).join('')}
    </div>
  </section>` : ''}

  <!-- CTA catálogo -->
  <section class="px-5 mt-12">
    <a href="${esc(catalogUrl)}"
      class="flex items-center justify-center gap-2 w-full bg-primary text-on-primary font-label font-bold text-sm py-4 rounded-xl hover:opacity-90 transition-opacity">
      <span class="material-symbols-outlined">apartment</span>
      Ver Catálogo de Imóveis
    </a>
  </section>
</main>

${footer(client, proxyImg, apiBase)}`;

  return l1Shell({
    title: `${client.name} — Imobiliária`,
    description: aboutBio ? aboutBio.slice(0, 160) : `${client.name} — imóveis selecionados para você.`,
    canonical: profileUrl,
    ogImage: client.logo_url ? proxyImg(client.logo_url, apiBase) : '',
    jsonLd,
    tokens,
    body,
  });
}

// ─── Perfil do corretor ───────────────────────────────────────────────────────

export function renderCorretorPage({ client, corretor, baseUrl, apiBase, proxyImg }) {
  const tokens     = buildTokens(client.design_config);
  const profileUrl = `${baseUrl}/${client.slug}`;
  const catalogUrl = `${profileUrl}/catalogo`;
  const wp         = (corretor.whatsapp || corretor.phone || '').replace(/\D/g, '');
  const wpLink     = wp ? `https://wa.me/55${wp}` : null;
  const photoUrl   = corretor.photo_url ? proxyImg(corretor.photo_url, apiBase) : null;

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Person',
    name: corretor.name, url: `${profileUrl}/${corretor.slug || ''}`,
    image: corretor.photo_url || undefined,
    telephone: corretor.phone || undefined,
    email: corretor.email || undefined,
    worksFor: { '@type': 'Organization', name: client.name },
  });

  const body = `
${glassHeader(client, proxyImg, apiBase)}
<main class="pt-20 pb-24 max-w-2xl mx-auto">

  <header class="glass-nav sticky top-0 z-40 flex items-center justify-between px-5 py-4">
    <a href="${esc(profileUrl)}" class="flex items-center text-primary">
      <span class="material-symbols-outlined">arrow_back</span>
    </a>
    <h2 class="font-headline font-bold text-base tracking-tight text-on-surface">Corretor</h2>
    <div class="w-6"></div>
  </header>

  <!-- Profile Intro -->
  <section class="px-5 pt-8 flex flex-col items-center text-center">
    <div class="relative mb-6">
      ${photoUrl
        ? `<img src="${esc(photoUrl)}" alt="${esc(corretor.name)}" class="w-28 h-28 rounded-full object-cover border-4 border-surface-container-lowest shadow-md">`
        : `<div class="w-28 h-28 rounded-full bg-primary flex items-center justify-center border-4 border-surface-container-lowest shadow-md">
            <span class="font-headline font-bold text-4xl text-on-primary">${esc((corretor.name||'?').charAt(0).toUpperCase())}</span>
          </div>`}
      ${corretor.creci ? `<div class="absolute -bottom-1 -right-1 bg-tertiary-container text-on-tertiary-container px-2 py-1 rounded-lg text-[10px] font-label font-bold shadow-sm">CRECI</div>` : ''}
    </div>
    <h1 class="font-headline text-3xl font-bold text-primary mb-1 tracking-tighter">${esc(corretor.name)}</h1>
    ${corretor.specialty ? `<p class="text-on-surface-variant font-label text-sm uppercase tracking-widest mb-1">${esc(corretor.specialty)}</p>` : ''}
    ${corretor.creci ? `<p class="text-primary font-label text-xs font-semibold mb-6">CRECI ${esc(corretor.creci)}</p>` : '<div class="mb-6"></div>'}

    <!-- CTAs -->
    <div class="flex flex-col w-full gap-3 mb-8">
      ${wpLink ? `<a href="${esc(wpLink)}" target="_blank" rel="noopener nofollow"
        class="bg-surface-container-lowest text-on-surface border border-outline-variant/20 h-14 rounded-xl font-label font-bold flex items-center justify-center gap-2 hover:bg-surface-container-low transition-colors w-full shadow-sm">
        <span class="material-symbols-outlined">chat</span>Chamar no WhatsApp
      </a>` : ''}
      ${corretor.email ? `<a href="mailto:${esc(corretor.email)}"
        class="bg-surface-container-lowest text-on-surface border border-outline-variant/20 h-14 rounded-xl font-label font-bold flex items-center justify-center gap-2 hover:bg-surface-container-low transition-colors w-full shadow-sm">
        <span class="material-symbols-outlined">mail</span>${esc(corretor.email)}
      </a>` : ''}
      <a href="${esc(catalogUrl)}"
        class="bg-primary text-on-primary h-14 rounded-xl font-label font-bold flex items-center justify-center gap-2 w-full hover:opacity-90 transition-opacity">
        <span class="material-symbols-outlined">search</span>Ver Imóveis
      </a>
    </div>
  </section>

  <!-- Bio -->
  ${corretor.bio ? `<section class="px-5 mb-10">
    <h3 class="font-headline text-xl font-bold text-primary mb-4">Sobre</h3>
    <div class="bg-primary-fixed/20 p-6 rounded-xl relative overflow-hidden">
      <span class="material-symbols-outlined absolute -right-4 -bottom-4 text-primary opacity-5 !text-8xl">format_quote</span>
      <p class="text-on-surface-variant leading-relaxed font-body text-sm">${esc(corretor.bio)}</p>
    </div>
  </section>` : ''}
</main>

${footer(client, proxyImg, apiBase)}`;

  return l1Shell({
    title: `${corretor.name} — ${client.name}`,
    description: corretor.bio ? corretor.bio.slice(0, 160) : `${corretor.name}, corretor em ${client.name}.`,
    canonical: `${profileUrl}/${corretor.slug || ''}`,
    ogImage: photoUrl || (client.logo_url ? proxyImg(client.logo_url, apiBase) : ''),
    jsonLd,
    tokens,
    body,
  });
}

// Escapa string para uso em CSS inline (não usa esc() para evitar &amp; em hex)
function escCss(s) { return String(s || '').replace(/['"<>]/g, ''); }
