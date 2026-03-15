import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API, proxyImageUrl } from '../api';
import { DEFAULT_PALETTE, getDominantColorFromImageUrl, getPaletteFromPrimary } from '../lib/dominantColor';
import AnimacaoCaracteristicas from '../components/AnimacaoCaracteristicas';

const DESIGN_KEYS = [
  { key: '--primary', shortLabel: 'Principal', label: 'Cor principal (badge, preço, ícones)', hint: 'Cor de destaque do layout' },
  { key: '--contact-bg', shortLabel: 'Fundo contato', label: 'Fundo da tela de contato (encerramento)', hint: 'Fundo da tela final com WhatsApp, e-mail, etc.' },
  { key: '--contact-text', shortLabel: 'Texto contato', label: 'Texto e ícones na tela de contato', hint: 'Deve ter bom contraste com o fundo da tela de contato' },
  { key: '--bg-poster', shortLabel: 'Badges/pills', label: 'Fundo de badges e pills', hint: 'Ex.: badge "À venda", fundo dos ícones no layout cards' },
  { key: '--text-poster', shortLabel: 'Texto geral', label: 'Texto geral do poster', hint: 'Preço, localização, site no rodapé' },
  { key: '--detail-poster', shortLabel: 'Detalhes', label: 'Texto secundário / detalhes', hint: 'Ref, textos menores' },
  { key: '--line-poster', shortLabel: 'Linhas', label: 'Linhas e bordas', hint: 'Separadores' },
  { key: '--amen-bg', shortLabel: 'Lazer fundo', label: 'Fundo dos itens de lazer', hint: 'Background dos cards de amenities' },
  { key: '--amen-bd', shortLabel: 'Lazer borda', label: 'Borda dos itens de lazer', hint: 'Borda dos cards de amenities' },
];

function parseDesignConfig(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw || {};
}

export default function ClienteDesign() {
  const { id } = useParams();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [values, setValues] = useState({});
  const [previewPhase, setPreviewPhase] = useState('info');
  const [extractingFromLogo, setExtractingFromLogo] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setMsg(null);
    fetch(API + '/clients/' + id)
      .then((r) => r.json())
      .then((c) => {
        setClient(c);
        const config = parseDesignConfig(c.design_config);
        const next = {};
        DESIGN_KEYS.forEach(({ key }) => {
          next[key] = config[key] ?? DEFAULT_PALETTE[key] ?? '';
        });
        setValues(next);
      })
      .catch((e) => setMsg('Erro: ' + e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleChange = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value || '' }));
  };

  const handleReset = () => {
    const next = {};
    DESIGN_KEYS.forEach(({ key }) => {
      next[key] = DEFAULT_PALETTE[key] ?? '';
    });
    setValues(next);
  };

  const handleClearOverrides = async () => {
    const logoUrl = client?.logo_url;
    if (!logoUrl || typeof logoUrl !== 'string' || !logoUrl.trim()) {
      const next = {};
      DESIGN_KEYS.forEach(({ key }) => { next[key] = ''; });
      setValues(next);
      setMsg('Sem logo do cliente. Campos limpos. Cadastre um logo e clique novamente para extrair cores.');
      return;
    }
    setExtractingFromLogo(true);
    setMsg(null);
    try {
      const url = proxyImageUrl(logoUrl);
      const result = await getDominantColorFromImageUrl(url);
      if (result?.dominant) {
        const palette = getPaletteFromPrimary(
          result.dominant,
          result.darkest ?? null,
          result.lightest ?? null
        );
        const next = {};
        DESIGN_KEYS.forEach(({ key }) => {
          next[key] = palette[key] ?? DEFAULT_PALETTE[key] ?? '';
        });
        setValues(next);
        setMsg('Cores extraídas do logo e preenchidas (ciclo cromático). Revise e salve se quiser fixar.');
      } else {
        const next = {};
        DESIGN_KEYS.forEach(({ key }) => { next[key] = ''; });
        setValues(next);
        setMsg('Não foi possível extrair cores do logo. Campos limpos.');
      }
    } catch (e) {
      const next = {};
      DESIGN_KEYS.forEach(({ key }) => { next[key] = ''; });
      setValues(next);
      setMsg('Erro ao extrair cores: ' + (e?.message || 'tente de novo'));
    } finally {
      setExtractingFromLogo(false);
    }
  };

  const handleSave = async () => {
    if (!id || !client) return;
    setSaving(true);
    setMsg(null);
    const config = {};
    DESIGN_KEYS.forEach(({ key }) => {
      const v = values[key];
      if (v && String(v).trim()) config[key] = String(v).trim();
    });
    try {
      const res = await fetch(API + '/clients/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design_config: Object.keys(config).length ? config : null }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMsg('Design salvo. As cores personalizadas serão usadas nos posters e materiais deste cliente.');
    } catch (e) {
      setMsg('Erro: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const designConfigFromValues = useMemo(() => {
    const config = {};
    DESIGN_KEYS.forEach(({ key }) => {
      const v = values[key];
      if (v && String(v).trim()) config[key] = String(v).trim();
    });
    return Object.keys(config).length ? config : null;
  }, [values]);

  const mockListing = useMemo(() => {
    const savedConfig = client ? parseDesignConfig(client.design_config) : null;
    const effectiveConfig = designConfigFromValues || (Object.keys(savedConfig || {}).length ? savedConfig : null);
    return {
      carousel_images: [
        'https://resizedimgs.vivareal.com/img/vr-listing/9b66eb450db996a1e721b29ea90aab6e/casa-com-2-quartos-a-venda-82m-no-bal-stella-maris-peruibe.webp',
      ],
      imobname: client?.name || 'Cliente',
      logoimob: client?.logo_url || '',
      propertyCodes: 'REF-12345',
      website: client?.website || 'www.exemplo.com.br',
      salePrice: 'R$ 400.000',
      prices: { Venda: 'R$ 400.000' },
      address: 'Peruíbe, SP',
      client: client ? { ...client, design_config: effectiveConfig } : undefined,
      'amenities-list': [
      { name: 'numberOfRooms', value: '2 quartos' },
      { name: 'numberOfSuites', value: '1 suíte' },
      { name: 'numberOfBathroomsTotal', value: '2 banheiros' },
      { name: 'numberOfParkingSpaces', value: '2 vagas' },
      { name: 'floorSize', value: '80 m²' },
      { name: 'BACKYARD', value: 'Quintal' },
      { name: 'GRILL', value: 'Varanda gourmet' },
      { name: 'POOL', value: 'Piscina' },
      { name: 'GARDEN', value: 'Jardim' },
    ],
    };
  }, [client, designConfigFromValues]);

  const LAYOUTS = [
    { id: 'classic', name: 'Classic' },
    { id: 'cards', name: 'Cards' },
  ];

  if (loading) return <p className="muted">Carregando...</p>;
  if (!client) return <p style={{ color: 'var(--danger)' }}>Cliente não encontrado.</p>;

  return (
    <>
      <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
        <Link to="/">Dashboard</Link>
        <span style={{ margin: '0 0.5rem', color: 'var(--muted)' }}>→</span>
        <Link to={'/cliente/' + id + '/area'}>{client.name}</Link>
        <span style={{ margin: '0 0.5rem', color: 'var(--muted)' }}>→</span>
        <span>Design do poster</span>
      </div>

      <div className="card" style={{ maxWidth: '100%', marginBottom: '1.5rem' }}>
        <h1 style={{ marginTop: 0, marginBottom: '0.25rem', fontSize: '1.35rem' }}>Design do poster</h1>
        <p className="muted" style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}>
          Personalize as cores. Deixe em branco para usar as cores automáticas do logo.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', alignItems: 'center' }}>
          {DESIGN_KEYS.map(({ key, shortLabel, label, hint }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
              <label title={hint || label} style={{ width: 82, fontSize: '0.8rem', color: 'var(--muted)', flexShrink: 0 }}>
                {shortLabel}
              </label>
              <input
                type="color"
                value={values[key]?.startsWith('#') ? values[key] : '#1152d4'}
                onChange={(e) => handleChange(key, e.target.value)}
                style={{ width: 22, height: 22, padding: 0, border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}
              />
              <input
                type="text"
                value={values[key] || ''}
                onChange={(e) => handleChange(key, e.target.value)}
                placeholder={DEFAULT_PALETTE[key] || '#hex'}
                title={hint || label}
                style={{ width: 72, height: 26, padding: '0 6px', fontFamily: 'monospace', fontSize: '0.8rem', border: '1px solid var(--border)', borderRadius: 6, boxSizing: 'border-box' }}
              />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar design'}
          </button>
          <button type="button" className="btn" onClick={handleReset}>
            Preencher com padrão
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleClearOverrides}
            disabled={extractingFromLogo || !client?.logo_url}
            title={client?.logo_url ? 'Extrair cores do logo e preencher com paleta harmônica' : 'Cadastre um logo no cliente para usar esta opção'}
          >
            {extractingFromLogo ? 'Extraindo cores do logo...' : 'Limpar (extrair cores do logo)'}
          </button>
        </div>

        {msg && (
          <p style={{ marginTop: '1rem', color: msg.startsWith('Erro') ? 'var(--danger)' : 'var(--success)', fontSize: '0.9rem' }}>
            {msg}
          </p>
        )}
      </div>

      <p className="muted" style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>
        As cores definidas aqui sobrescrevem as extraídas do logo. Use quando o automático não gerar bom contraste (ex.: logo branco com texto azul escuro).
      </p>

      <section style={{ marginTop: '2rem' }}>
        <h2 style={{ marginBottom: '0.5rem', fontSize: '1.15rem' }}>Preview dos layouts</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          Visualize como as cores ficam em cada layout. O preview usa o logo do cliente quando disponível.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
          <span className="muted" style={{ fontSize: '0.9rem' }}>Ver:</span>
          <button
            type="button"
            className={'btn ' + (previewPhase === 'info' ? 'btn-primary' : '')}
            onClick={() => setPreviewPhase('info')}
          >
            Parte 1 – Infos do imóvel
          </button>
          <button
            type="button"
            className={'btn ' + (previewPhase === 'contact' ? 'btn-primary' : '')}
            onClick={() => setPreviewPhase('contact')}
          >
            Parte 2 – Contatos
          </button>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start' }}>
          {LAYOUTS.map((layout) => (
            <div
              key={layout.id}
              style={{
                flex: '1 1 320px',
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
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '1.1rem', color: 'var(--primary)' }}>
                {layout.name}
              </h3>
              <div
                style={{
                  width: '100%',
                  aspectRatio: '1080 / 1920',
                  maxHeight: '65vh',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  overflow: 'hidden',
                  background: '#f1f5f9',
                  borderRadius: 8,
                }}
              >
                <AnimacaoCaracteristicas
                  listing={mockListing}
                  layout={layout.id}
                  onEnd={() => {}}
                  previewPhase={previewPhase}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
