import { useState } from 'react';
import { Link } from 'react-router-dom';
import AnimacaoCaracteristicas from '../components/AnimacaoCaracteristicas';

/** Listing de exemplo para visualizar os dois layouts (Opção 1 e Opção 2) antes de subir. */
const MOCK_LISTING = {
  carousel_images: [
    'https://resizedimgs.vivareal.com/img/vr-listing/9b66eb450db996a1e721b29ea90aab6e/casa-com-2-quartos-a-venda-82m-no-bal-stella-maris-peruibe.webp',
  ],
  imobname: 'Central Imóveis Peruíbe',
  logoimob: 'https://resizedimgs.vivareal.com/img/vr-listing/e9cfb78f81731ee3743dc1b24339625a/regina-guerreiro-imoveis.webp',
  propertyCodes: 'REF-12345',
  website: 'www.centralimoveis.com.br',
  salePrice: 'R$ 400.000',
  prices: { Venda: 'R$ 400.000' },
  address: 'Peruíbe, SP',
  'amenities-list': [
    { name: 'numberOfRooms', value: '2 quartos' },
    { name: 'numberOfSuites', value: '1 suíte' },
    { name: 'numberOfBathroomsTotal', value: '2 banheiros' },
    { name: 'numberOfParkingSpaces', value: '2 vagas' },
    { name: 'floorSize', value: '80 m²' },
    { name: 'BACKYARD', value: 'Quintal' },
    { name: 'GRILL', value: 'Varanda gourmet' },
    { name: 'KITCHEN', value: 'Armário na cozinha' },
    { name: 'POOL', value: 'Piscina' },
    { name: 'GARDEN', value: 'Jardim' },
  ],
};

export default function SimulacaoLayouts() {
  const [key, setKey] = useState(0);

  return (
    <div style={{ padding: '1rem', maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Simulação dos layouts do poster</h1>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        Dados de exemplo: 5 características (stats) e 5 itens de lazer (amen-grid). Compare Opção 1 e Opção 2 antes de publicar.
      </p>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start' }}>
        {/* Opção 1 - Classic */}
        <div
          style={{
            flex: '1 1 400px',
            minWidth: 280,
            background: 'var(--bg)',
            borderRadius: 12,
            padding: 16,
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem', color: 'var(--primary)' }}>Opção 1 (classic)</h2>
          <div
            style={{
              width: '100%',
              aspectRatio: '1080 / 1920',
              maxHeight: '70vh',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              overflow: 'hidden',
              background: '#f1f5f9',
              borderRadius: 8,
            }}
          >
            <AnimacaoCaracteristicas
              key={`classic-${key}`}
              listing={MOCK_LISTING}
              layout="classic"
              onEnd={() => {}}
            />
          </div>
        </div>
        {/* Opção 2 - Cards */}
        <div
          style={{
            flex: '1 1 400px',
            minWidth: 280,
            background: 'var(--bg)',
            borderRadius: 12,
            padding: 16,
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem', color: 'var(--primary)' }}>Opção 2 (cards)</h2>
          <div
            style={{
              width: '100%',
              aspectRatio: '1080 / 1920',
              maxHeight: '70vh',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              overflow: 'hidden',
              background: '#f1f5f9',
              borderRadius: 8,
            }}
          >
            <AnimacaoCaracteristicas
              key={`cards-${key}`}
              listing={MOCK_LISTING}
              layout="cards"
              onEnd={() => {}}
            />
          </div>
        </div>
      </div>
      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn" onClick={() => setKey((k) => k + 1)}>
          Reproduzir animação
        </button>
        <Link to="/" className="btn" style={{ textDecoration: 'none' }}>
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
