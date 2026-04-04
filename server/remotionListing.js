/**
 * Monta o corpo JSON para POST /render do serviço Remotion a partir do listing do app.
 * Contrato alinhado ao guia de integração (animation, input.listing, subtitlesSrt).
 */

const CHAR_ORDER = ['numberOfRooms', 'numberOfSuites', 'numberOfBathroomsTotal', 'numberOfParkingSpaces', 'floorSize'];

const CHARACTERISTIC_ICONS = {
  numberOfRooms: 'bed',
  numberOfSuites: 'bed',
  numberOfBathroomsTotal: 'bathtub',
  numberOfParkingSpaces: 'directions_car',
  floorSize: 'square_foot',
};

const AMENITIES_LABELS = {
  floorSize: 'Área construída',
  numberOfRooms: 'Quartos',
  numberOfBathroomsTotal: 'Banheiros',
  numberOfParkingSpaces: 'Vagas',
  numberOfSuites: 'Suítes',
  FURNISHED: 'Mobiliado',
  PETS_ALLOWED: 'Aceita animais',
  BACKYARD: 'Quintal',
  SERVICE_AREA: 'Área de serviço',
  CABLE_TV: 'TV a cabo',
  KITCHEN: 'Cozinha',
  GARDEN: 'Jardim',
  GYM: 'Academia',
  POOL: 'Piscina',
  PARTY_HALL: 'Salão de festas',
  GRILL: 'Churrasqueira',
  AIR_CONDITIONING: 'Ar condicionado',
  custom: 'Outro',
};

const AMENITY_ICONS = {
  POOL: 'pool',
  GRILL: 'skillet',
  GYM: 'fitness_center',
  PARTY_HALL: 'celebration',
  GARDEN: 'grass',
  BACKYARD: 'yard',
  SERVICE_AREA: 'cleaning_services',
  KITCHEN: 'countertops',
  CABLE_TV: 'tv',
  AIR_CONDITIONING: 'ac_unit',
  PETS_ALLOWED: 'pets',
  FURNISHED: 'chair',
  custom: 'check_circle',
};

function normalizeAmenities(listing) {
  return listing.amenitiesList || listing['amenities-list'] || [];
}

function isImageUrl(u) {
  if (!u || typeof u !== 'string') return false;
  return !/\.(mp4|webm|mov)(\?|$)/i.test(u.trim());
}

/** URLs absolutas via proxy da API (evita 403 em CDNs que bloqueiam servidor headless, ex.: resizedimgs.vivareal.com). */
function toProxiedImageUrl(imageUrl, proxyBase) {
  if (!proxyBase || !imageUrl || typeof imageUrl !== 'string') return imageUrl;
  const u = imageUrl.trim();
  if (!/^https?:\/\//i.test(u)) return imageUrl;
  if (u.includes('/api/proxy-image?')) return imageUrl;
  const base = String(proxyBase).replace(/\/$/, '');
  return `${base}/api/proxy-image?url=${encodeURIComponent(u)}`;
}

function deepMerge(a, b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return a;
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Mescla inputOverride no payload (ex.: ajustar listing ou baseUrl).
 */
export function mergeRemotionPayload(base, patch) {
  if (!patch || typeof patch !== 'object') return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'input' && v && typeof v === 'object' && out.input && typeof out.input === 'object') {
      out.input = deepMerge(out.input, v);
    } else if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function buildRemotionRenderPayload({ listing, animation, subtitlesSrt, baseUrl, imageProxyBase }) {
  const amenities = normalizeAmenities(listing);
  const charKeys = new Set(Object.keys(CHARACTERISTIC_ICONS));

  const infoCards = [];
  for (const key of CHAR_ORDER) {
    const item = amenities.find((a) => a?.name === key);
    if (item && infoCards.length < 4) {
      infoCards.push({
        label: AMENITIES_LABELS[key] || key,
        value: String(item.value ?? ''),
        icon: CHARACTERISTIC_ICONS[key] || 'check_circle',
      });
    }
  }

  const amenitiesList = amenities
    .filter((a) => a?.name && !charKeys.has(a.name))
    .map((a) => ({
      name: AMENITIES_LABELS[a.name] || a.name,
      icon: AMENITY_ICONS[a.name] || 'check_circle',
    }));

  let carousel_images = [];
  if (Array.isArray(listing.carousel_images) && listing.carousel_images.length) {
    carousel_images = listing.carousel_images.filter(isImageUrl);
  } else if (Array.isArray(listing.selected_images) && listing.selected_images.length) {
    carousel_images = listing.selected_images.filter(isImageUrl);
  }

  let prices = listing.prices;
  if ((!prices || typeof prices !== 'object') && listing.salePrice) {
    prices = { Venda: String(listing.salePrice) };
  }

  const design_config = listing.client?.design_config || listing.design_config || null;

  const remotionListing = {
    imobname: listing.imobname || '',
    propertyCodes: listing.propertyCodes || listing.advertiserCode || '',
    prices: prices && typeof prices === 'object' ? prices : {},
    address: listing.address || '',
    city: listing.city || '',
    state: listing.state || '',
    carousel_images,
    amenitiesList,
    infoCards,
    client: {
      logo_url: listing.logoimob || listing.client?.logo_url || '',
      phone: listing.client?.phone || listing.phone || '',
      email: listing.client?.email || '',
      website: listing.client?.website || '',
      instagram: listing.client?.instagram || '',
    },
  };
  if (design_config && typeof design_config === 'object') {
    const primary = design_config['--primary'] || design_config.primaryColor || design_config.primary || null;
    if (primary) {
      remotionListing.design_config = { primaryColor: primary };
    }
  }

  if (imageProxyBase) {
    remotionListing.carousel_images = remotionListing.carousel_images.map((src) => toProxiedImageUrl(src, imageProxyBase));
    if (remotionListing.client?.logo_url) {
      remotionListing.client.logo_url = toProxiedImageUrl(remotionListing.client.logo_url, imageProxyBase);
    }
  }

  const body = {
    animation,
    input: {
      ...(baseUrl ? { baseUrl: String(baseUrl).replace(/\/?$/, '/') } : {}),
      listing: remotionListing,
    },
  };
  if (subtitlesSrt && typeof subtitlesSrt === 'string' && subtitlesSrt.trim()) {
    body.subtitlesSrt = subtitlesSrt.trim();
  }
  return body;
}
