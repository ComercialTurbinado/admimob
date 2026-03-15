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
 * Extrai a cor predominante da imagem em url (evita branco/preto puro).
 * Usa canvas; requer CORS ou mesma origem (ex.: proxy).
 * @param {string} url - URL da imagem (logo)
 * @returns {Promise<string|null>} - Cor em hex #rrggbb ou null se falhar
 */
function extractDominant(data, skipLight, skipDark) {
  const count = {};
  const levels = 8;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue;
    const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    if (lum > skipLight || lum < skipDark) continue;
    const qr = quantize(r, levels);
    const qg = quantize(g, levels);
    const qb = quantize(b, levels);
    const key = `${qr},${qg},${qb}`;
    count[key] = (count[key] || 0) + 1;
  }
  let max = 0;
  let bestKey = null;
  for (const k of Object.keys(count)) {
    if (count[k] > max) { max = count[k]; bestKey = k; }
  }
  if (!bestKey) return null;
  const [r, g, b] = bestKey.split(',').map(Number);
  return rgbToHex(r, g, b);
}

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
        let hex = extractDominant(data, 0.95, 0.08);
        if (!hex) hex = extractDominant(data, 0.99, 0.01);
        resolve(hex || null);
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

/** Valores padrão das variáveis do poster (quando não há logo ou extração falha) */
const DEFAULT_PALETTE = {
  '--primary': '#1152d4',
  '--text-poster': '#0b1220',
  '--muted-poster': '#64748b',
  '--line-poster': '#e6e8ee',
  '--amen-bg': '#f1f5fb',
  '--amen-bd': '#e7edf8',
};

/**
 * Gera objeto de variáveis CSS para o poster a partir da cor primária (hex).
 * Ajusta contraste e tons para fundo, texto e ícones.
 * @param {string} primaryHex - Cor em #rrggbb
 * @returns {Record<string, string>} - Variáveis CSS (--primary, --text-poster, etc.)
 */
export function getPaletteFromPrimary(primaryHex) {
  const rgb = hexToRgb(primaryHex);
  if (!rgb) return DEFAULT_PALETTE;
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const primary = rgbToHex(rgb.r, rgb.g, rgb.b);
  const textRgb = hslToRgb(h, Math.min(1, s * 0.8), 0.12);
  const text = rgbToHex(textRgb.r, textRgb.g, textRgb.b);
  const mutedRgb = hslToRgb(h, s * 0.5, 0.45);
  const muted = rgbToHex(mutedRgb.r, mutedRgb.g, mutedRgb.b);
  const lineRgb = hslToRgb(h, s * 0.2, 0.92);
  const line = rgbToHex(lineRgb.r, lineRgb.g, lineRgb.b);
  const amenBgRgb = hslToRgb(h, s * 0.25, 0.97);
  const amenBg = rgbToHex(amenBgRgb.r, amenBgRgb.g, amenBgRgb.b);
  const amenBdRgb = hslToRgb(h, s * 0.35, 0.91);
  const amenBd = rgbToHex(amenBdRgb.r, amenBdRgb.g, amenBdRgb.b);
  const tintR = Math.round(rgb.r * 0.1 + 255 * 0.9);
  const tintG = Math.round(rgb.g * 0.1 + 255 * 0.9);
  const tintB = Math.round(rgb.b * 0.1 + 255 * 0.9);
  const primaryTint = rgbToHex(tintR, tintG, tintB);

  return ({
    '--primary': primary,
    '--primary-tint': primaryTint,
    '--text-poster': text,
    '--muted-poster': muted,
    '--line-poster': line,
    '--amen-bg': amenBg,
    '--amen-bd': amenBd,
  });
}

export { DEFAULT_PALETTE };
