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

export function getAmenityLabel(name) {
  if (!name || typeof name !== 'string') return name || '';
  return AMENITIES_LABELS[name] || name;
}
