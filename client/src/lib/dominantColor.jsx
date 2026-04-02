/**
 * Extrai a cor predominante de uma imagem (ex.: logo do cliente) e gera uma paleta
 * para fundo, fontes e ícones do poster.
 */

/** Converte RGB 0-255 para hex #rrggbb */
function rgbToHex(r, g, b) {
  const toHex = (n) => {
    const h = Math.round(Math.max(0, Math.min(255, n))).toString(16);
    return h.length === 1 ? '0' + h : h;
  };
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

/** Converte hex #rrggbb ou #rgb para objeto r, g, b 0-255 */
function hexToRgb(hex) {
  const s = hex.replace(/^#/, '');
  const re = s.length <= 4
    ? /([0-9a-f])([0-9a-f])([0-9a-f])/i
    : new RegExp('([0-9a-f][0-9a-f])([0-9a-f][0-9a-f])([0-9a-f][0-9a-f])', 'i');
  const m = s.match(re);
  if (!m) return null;
  const f = m[1].length === 1 ? (c) => parseInt(c + c, 16) : (c) => parseInt(c, 16);
  return ({ r: f(m[1]), g: f(m[2]), b: f(m[3]) });
}

/** RGB 0-255 -> HSL H 0-360, S 0-1, L 0-1 */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      default: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return ({ h: h * 360, s, l });
}

/** Luminância relativa (WCAG) para hex; retorna 0–1 */
function relativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [rs, gs, bs] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** Contraste entre duas cores (ratio >= 1). Branco ≈ 1, preto ≈ 0. */
function contrastRatio(hex1, hex2) {
  const L1 = relativeLuminance(hex1);
  const L2 = relativeLuminance(hex2);
  const [lo, hi] = L1 <= L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

/** HSL -> RGB 0-255 */
function hslToRgb(h, s, l) {
  h /= 360;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return ({ r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) });
}

/** Quantiza canal 0-255 para n níveis (para agrupar cores semelhantes) */
function quantize(v, levels = 16) {
  const step = 256 / levels;
  return Math.min(levels - 1, Math.floor(v / step)) * step + step / 2;
}

/**
 * Extrai cor predominante, mais escura e mais clara do logo em um único passe.
 * dominant: mais saturada entre as top por frequência (cor de marca).
 * darkest: mais escura entre os grupos com presença significativa (fundos e texto em fundo claro).
 * lightest: mais clara com presença significativa (detalhes, se tiver contraste com branco).
 * @returns {{ dominant: string, darkest: string | null, lightest: string | null } | null}
 */
function extractPaletteFromImageData(data, skipLight = 0.95, skipDark = 0.08) {
  const levels = 12;
  const buckets = {};
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue;
    const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    if (lum > skipLight || lum < skipDark) continue;
    const qr = quantize(r, levels);
    const qg = quantize(g, levels);
    const qb = quantize(b, levels);
    const key = `${qr},${qg},${qb}`;
    if (!buckets[key]) buckets[key] = { count: 0, sumR: 0, sumG: 0, sumB: 0 };
    const bkt = buckets[key];
    bkt.count += 1;
    bkt.sumR += r;
    bkt.sumG += g;
    bkt.sumB += b;
  }
  const entries = Object.entries(buckets)
    .map(([key, b]) => ({
      key,
      count: b.count,
      r: Math.round(b.sumR / b.count),
      g: Math.round(b.sumG / b.count),
      b: Math.round(b.sumB / b.count),
    }))
    .sort((a, b) => b.count - a.count);
  if (entries.length === 0) return null;
  const total = entries.reduce((acc, e) => acc + e.count, 0);
  const minCount = Math.max(1, total * 0.005);

  const top = entries.slice(0, 8);
  let best = top[0];
  let bestSat = 0;
  for (const e of top) {
    const { s } = rgbToHsl(e.r, e.g, e.b);
    if (s > bestSat) { bestSat = s; best = e; }
  }
  const dominant = rgbToHex(best.r, best.g, best.b);

  const withL = entries
    .filter((e) => e.count >= minCount)
    .map((e) => ({ ...e, l: rgbToHsl(e.r, e.g, e.b).l }));
  const byLuminanceAsc = [...withL].sort((a, b) => a.l - b.l);
  const byLuminanceDesc = [...withL].sort((a, b) => b.l - a.l);
  const darkestEntry = byLuminanceAsc[0];
  const lightestEntry = byLuminanceDesc[0];
  const darkest = darkestEntry ? rgbToHex(darkestEntry.r, darkestEntry.g, darkestEntry.b) : null;
  const lightest = lightestEntry ? rgbToHex(lightestEntry.r, lightestEntry.g, lightestEntry.b) : null;

  return { dominant, darkest, lightest };
}

/**
 * Extrai cor predominante, mais escura e mais clara do logo.
 * @returns {Promise<{ dominant: string, darkest: string | null, lightest: string | null } | null>}
 */
export function getDominantColorFromImageUrl(url) {
  if (!url || typeof url !== 'string') return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 64;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        let result = extractPaletteFromImageData(data, 0.95, 0.08);
        if (!result) result = extractPaletteFromImageData(data, 0.99, 0.01);
        resolve(result || null);
      } catch (e) {
        if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
          console.warn('[dominantColor] Extração falhou (CORS/taint?):', e?.message || e);
        }
        resolve(null);
      }
    };
    img.onerror = () => {
      if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
        console.warn('[dominantColor] Imagem não carregou:', url.slice(0, 60) + '...');
      }
      resolve(null);
    };
    img.src = url;
  });
}

/** Contraste mínimo com branco para usar a cor mais clara em detalhes (WCAG AA para texto grande) */
const MIN_CONTRAST_DETAIL_ON_WHITE = 3;

// ─── SISTEMA DE 2 CORES ───────────────────────────────────────────────────────
//
//  brandHex  = Cor de marca  (viva/quente, ex.: dourado)  → salvo como --primary
//  accentHex = Cor de destaque (escura/fria, ex.: navy)   → salvo como --contact-bg
//
//  Tudo mais é derivado automaticamente: sem configuração manual de textos ou
//  backgrounds — texto sempre contrastado via WCAG.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gera a paleta completa de tokens CSS a partir de apenas 2 cores.
 *
 * @param {string} brandHex   Cor de marca viva (preço, badge, botão, cards de lazer)
 * @param {string} accentHex  Cor de destaque escura (header, tela final do vídeo, ícones das stats)
 * @returns {Object} Todos os tokens CSS prontos para salvar no design_config
 */
export function buildPalette(brandHex, accentHex) {
  const b = hexToRgb(brandHex);
  const a = hexToRgb(accentHex);
  if (!b || !a) return DEFAULT_PALETTE;

  const { h: hb, s: sb, l: lb } = rgbToHsl(b.r, b.g, b.b);
  const { h: ha, s: sa }        = rgbToHsl(a.r, a.g, a.b);

  // ── Garante que accentHex seja escuro (L ≤ 0.20) ─────────────────────────
  const darkL   = Math.min(0.18, Math.max(0.05, relativeLuminance(accentHex) > 0.05 ? 0.14 : 0.10));
  const darkBg  = rgbToHex(...Object.values(hslToRgb(ha, Math.max(0.55, sa), darkL)));

  // ── Badge: versão mais escura/saturada da cor de marca ───────────────────
  const badgeL  = Math.max(0.18, Math.min(0.32, lb - 0.10));
  const badgeBg = rgbToHex(...Object.values(hslToRgb(hb, Math.min(1, sb * 0.90), badgeL)));

  // ── Cor de marca: garante luminosidade vibrante (nem muito clara nem escura)
  const brandL    = Math.max(0.36, Math.min(0.62, lb));
  const brandVib  = rgbToHex(...Object.values(hslToRgb(hb, Math.min(1, sb), brandL)));

  // ── Texto WCAG automático ─────────────────────────────────────────────────
  const onBrand  = relativeLuminance(brandVib) > 0.30 ? '#191c1e' : '#ffffff';
  const onDark   = '#ffffff'; // header sempre escuro → texto sempre branco

  // ── Tokens do vídeo derivados da cor de marca ─────────────────────────────
  const linePoster = rgbToHex(...Object.values(hslToRgb(hb, sb * 0.18, 0.90)));
  const amenBg     = rgbToHex(...Object.values(hslToRgb(hb, sb * 0.12, 0.95)));
  const amenBd     = rgbToHex(...Object.values(hslToRgb(hb, sb * 0.22, 0.88)));
  const primTint   = rgbToHex(...Object.values(hslToRgb(hb, sb * 0.08, 0.97)));

  return {
    // ── 2 inputs (salvos pelo usuário) ────────────────────────────────────
    '--primary':        brandVib,    // cor de marca viva
    '--contact-bg':     darkBg,      // cor de destaque escura
    // ── Derivados automáticos (web + vídeo) ───────────────────────────────
    '--contact-text':   onDark,      // sempre branco no cabeçalho escuro
    '--btn-bg':         brandVib,    // botão = cor de marca
    '--btn-text':       onBrand,     // contraste WCAG automático
    '--bg-poster':      badgeBg,     // badge "À Venda" = marca escurecida
    // ── Tokens do poster de vídeo ─────────────────────────────────────────
    '--text-poster':    brandVib,    // preço e destaques = cor de marca
    '--detail-poster':  darkBg,      // ícones de stats e labels = cor de destaque
    '--muted-poster':   '#6b7280',   // texto muted = cinza neutro
    '--line-poster':    linePoster,  // divisores = tint claro da marca
    '--amen-bg':        amenBg,      // fundo dos cards de lazer = tint muito claro
    '--amen-bd':        amenBd,      // borda dos cards = tint claro
    '--primary-tint':   primTint,    // tint quase branco para overlays
  };
}

/** Valores padrão — 2 cores base da marca padrão */
const DEFAULT_PALETTE = buildPalette('#1152d4', '#0a1e4a');

/**
 * Gera paleta completa de variáveis CSS a partir da cor dominante do logo.
 * Extrai a cor de marca (dominante) e a cor de destaque escura (mais escura no logo),
 * depois delega para buildPalette().
 *
 * @param {string} primaryHex  Cor dominante #rrggbb extraída do logo
 * @param {string|null} darkestHex  Cor mais escura significativa do logo
 * @param {string|null} lightestHex  (não usado — mantido para compatibilidade de assinatura)
 */
export function getPaletteFromPrimary(primaryHex, darkestHex = null, lightestHex = null) {
  const rgb = hexToRgb(primaryHex);
  if (!rgb) return DEFAULT_PALETTE;

  // Se o logo tem uma cor escura significativa, usa como destaque.
  // Caso contrário, gera uma cor escura derivada da mesma matiz.
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const sV = Math.max(0.60, Math.min(1.0, s + 0.10));
  const derivedDark = rgbToHex(
    ...Object.values(hslToRgb(h, Math.min(1.0, sV * 1.05), Math.min(0.16, l * 0.30 + 0.06)))
  );
  const accentHex = darkestHex || derivedDark;

  return buildPalette(primaryHex, accentHex);
}

export { DEFAULT_PALETTE };
