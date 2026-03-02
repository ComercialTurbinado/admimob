/**
 * Tradução dos nomes técnicos de amenitiesList para exibição.
 * amenitiesList[].name (ex: floorSize) -> label em português.
 * Espaço para ícone ao lado de cada item é reservado no layout.
 */
export const AMENITIES_LABELS = {
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

/** Ícones Material Symbols para características principais (grid tipo "3 Beds", "2 Baths") */
export const CHARACTERISTIC_ICONS = {
  numberOfRooms: 'bed',
  numberOfSuites: 'bed',
  numberOfBathroomsTotal: 'bathtub',
  numberOfParkingSpaces: 'directions_car',
  floorSize: 'square_foot',
};

/** Ícones Material Symbols para lazer/comodidades (seção Leisure & Amenities) */
export const AMENITY_ICONS = {
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

export function getAmenityLabel(name) {
  if (!name || typeof name !== 'string') return name || '';
  return AMENITIES_LABELS[name] || name;
}

export function getAmenityIcon(name) {
  if (!name || typeof name !== 'string') return 'check_circle';
  return AMENITY_ICONS[name] || 'check_circle';
}
