import 'dotenv/config';
import db, { init } from './db.js';

// Cliente simulado com cadastro completo
const client = {
  name: 'Regina Guerreiro Imoveis',
  logo_url: 'https://resizedimgs.vivareal.com/img/vr-listing/e9cfb78f81731ee3743dc1b24339625a/regina-guerreiro-imoveis.webp',
  status: 'active',
  plan: 'R$ 297',
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

const insertCols = [
  'name', 'logo_url', 'status', 'plan',
  'email', 'phone', 'phone_secondary', 'document', 'creci', 'contact_name',
  'address', 'city', 'state', 'zip',
  'website', 'instagram', 'facebook', 'notes',
];
const placeholders = insertCols.map(() => '?').join(', ');
const values = insertCols.map((c) => client[c] ?? null);

async function run() {
  await init();
  const clientResult = await db.prepare(
    `INSERT INTO clients (${insertCols.join(', ')}) VALUES (${placeholders})`
  ).run(...values);
  const clientId = clientResult.lastInsertRowid;

  const listing = {
    carousel_images: [
      "https://resizedimgs.vivareal.com/img/vr-listing/9b66eb450db996a1e721b29ea90aab6e/casa-com-2-quartos-a-venda-82m-no-bal-stella-maris-peruibe.webp",
      "https://resizedimgs.vivareal.com/img/vr-listing/d218dc756eddcb139a84a6160140af4a/casa-com-2-quartos-a-venda-82m-no-bal-stella-maris-peruibe.webp",
      "https://resizedimgs.vivareal.com/img/vr-listing/c413fce3c20a97ae28849c6dba493726/casa-com-2-quartos-a-venda-82m-no-bal-stella-maris-peruibe.webp",
    ],
    description_data: [],
    title: "Casa com 2 Quartos e 2 banheiros à Venda, 82 m² por R$ 455.000",
    description: "Casa nova com piscina a venda em Peruíbe, bairro Flora Rica II. Medindo 150m² de área total, 82m² de área construída.",
    propertyCodes: "(Código do anunciante: CA2598 | Código no Viva Real: 2815108622)",
    imobname: "Regina Guerreiro Imoveis",
    logoimob: "https://resizedimgs.vivareal.com/img/vr-listing/e9cfb78f81731ee3743dc1b24339625a/regina-guerreiro-imoveis.webp",
    advertiserCode: "CA2598",
    vivaRealCode: "2815108622",
    "amenities-list": [
      { name: "floorSize", value: "82 m²" },
      { name: "numberOfRooms", value: "2 quartos" },
      { name: "numberOfBathroomsTotal", value: "2 banheiros" },
      { name: "numberOfParkingSpaces", value: "2 vagas" },
    ],
    salePrice: "R$ 455.000",
    prices: { Venda: "R$ 455.000", Condomínio: "Isento", IPTU: "R$ 160" },
  };

  const listInfo = await db.prepare('PRAGMA table_info(listings)').all();
  const hasClientId = (listInfo || []).some((c) => c.name === 'client_id');
  if (hasClientId) {
    await db.prepare(`
      INSERT INTO listings (client_id, raw_data, selected_images, webhook_payload)
      VALUES (?, ?, ?, ?)
    `).run(clientId, JSON.stringify(listing), null, null);
  } else {
    await db.prepare(`
      INSERT INTO listings (raw_data, selected_images, webhook_payload) VALUES (?, ?, ?)
    `).run(JSON.stringify(listing), null, null);
  }

  console.log('Seed: 1 cliente cadastrado (Regina Guerreiro Imoveis) e 1 imóvel vinculado.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
