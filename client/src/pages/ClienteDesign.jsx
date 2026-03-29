import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API, proxyImageUrl } from '../api';
import { DEFAULT_PALETTE, getDominantColorFromImageUrl, getPaletteFromPrimary } from '../lib/dominantColor';
import AnimacaoCaracteristicas from '../components/AnimacaoCaracteristicas';

const DESIGN_KEYS = [
  { key: '--primary',      shortLabel: 'Principal',     label: 'Cor principal',         hint: 'Botões, preço, destaques (catálogo e poster)' },
  { key: '--contact-bg',   shortLabel: 'Hero fundo',    label: 'Fundo do hero',          hint: 'Gradiente do cabeçalho do catálogo público' },
  { key: '--contact-text', shortLabel: 'Hero texto',    label: 'Texto no hero',          hint: 'Deve ter bom contraste com o fundo do hero' },
  { key: '--bg-poster',    shortLabel: 'Badges',        label: 'Fundo de badges',        hint: 'Chips e pills no catálogo e poster' },
  { key: '--text-poster',  shortLabel: 'Texto geral',   label: 'Texto geral do poster',  hint: 'Preço, localização, site no rodapé' },
  { key: '--detail-poster',shortLabel: 'Detalhes',      label: 'Texto secundário',       hint: 'Ref, textos menores' },
  { key: '--line-poster',  shortLabel: 'Linhas',        label: 'Linhas e bordas',        hint: 'Separadores do poster' },
  { key: '--amen-bg',      shortLabel: 'Lazer fundo',   label: 'Fundo de lazer',         hint: 'Background dos cards de amenities' },
  { key: '--amen-bd',      shortLabel: 'Lazer borda',   label: 'Borda de lazer',         hint: 'Borda dos cards de amenities' },
  { key: '--btn-bg',       shortLabel: 'Botão fundo',   label: 'Fundo do botão CTA',     hint: 'Cor do botão principal no perfil público (padrão: mesma cor principal)' },
  { key: '--btn-text',     shortLabel: 'Botão texto',   label: 'Texto do botão CTA',     hint: 'Cor do texto dentro do botão principal do perfil público' },
];

function parseDesignConfig(raw) {
  if (!raw) return {};
  try { return typeof raw === 'string' ? JSON.parse(raw) : (raw || {}); } catch { return {}; }
}

// Mini-preview do catálogo público usando as cores definidas
function CatalogPreview({ client, values }) {
  const primary  = values['--primary']      || DEFAULT_PALETTE['--primary']      || '#2563eb';
  const heroBg   = values['--contact-bg']   || DEFAULT_PALETTE['--contact-bg']   || '#0f2b5b';
  const heroText = values['--contact-text'] || DEFAULT_PALETTE['--contact-text'] || '#ffffff';
  const badge    = values['--bg-poster']    || DEFAULT_PALETTE['--bg-poster']    || '#eff6ff';
  const badgeTxt = primary;

  const logoUrl = client?.logo_url ? proxyImageUrl(client.logo_url) : null;
  const initial = (client?.name || '?').charAt(0).toUpperCase();

  // Cards simulados
  const mockCards = [
    { title: 'Casa com piscina à venda', price: 'R$ 680.000', type: 'Venda', feat: '3 quartos · 120 m²' },
    { title: 'Apartamento 2 quartos',    price: 'R$ 1.800/mês', type: 'Aluguel', feat: '2 quartos · 70 m²' },
    { title: 'Terreno em condomínio',    price: 'R$ 280.000', type: 'Venda', feat: '360 m²' },
  ];

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#f4f6f9', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', fontSize: '0.7rem' }}>
      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${heroBg} 0%, ${primary} 100%)`, color: heroText, padding: '1.25rem 1rem', textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff', margin: '0 auto 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px solid rgba(255,255,255,.3)' }}>
          {logoUrl
            ? <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontWeight: 700, color: primary, fontSize: '1rem' }}>{initial}</span>}
        </div>
        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{client?.name || 'Nome do cliente'}</div>
        <div style={{ opacity: 0.8, fontSize: '0.7rem', marginTop: 2 }}>{[client?.city, client?.state].filter(Boolean).join(', ') || 'Cidade, UF'}</div>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          {['WhatsApp', 'Instagram', 'Site'].map((l) => (
            <span key={l} style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.25)', padding: '2px 8px', borderRadius: 50, fontSize: '0.65rem', color: heroText }}>{l}</span>
          ))}
        </div>
      </div>
      {/* Filter bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0.4rem 0.75rem', display: 'flex', gap: 4 }}>
        {['Todos', 'Venda', 'Aluguel'].map((f, i) => (
          <span key={f} style={{ padding: '2px 8px', borderRadius: 50, fontSize: '0.65rem', fontWeight: 600, background: i === 0 ? primary : 'transparent', color: i === 0 ? '#fff' : '#6b7280', border: `1px solid ${i === 0 ? primary : '#d1d5db'}` }}>{f}</span>
        ))}
      </div>
      {/* Grid */}
      <div style={{ padding: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem' }}>
        {mockCards.map((c) => (
          <div key={c.title} style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.07)' }}>
            <div style={{ background: 'linear-gradient(135deg,#e2e8f0,#cbd5e1)', aspectRatio: '4/3', position: 'relative' }}>
              <span style={{ position: 'absolute', top: 4, left: 4, background: badge, color: badgeTxt, fontSize: '0.55rem', fontWeight: 700, padding: '1px 5px', borderRadius: 50 }}>{c.type}</span>
            </div>
            <div style={{ padding: '0.35rem 0.4rem' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 600, lineHeight: 1.3, marginBottom: 2 }}>{c.title}</div>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: primary }}>{c.price}</div>
              <div style={{ fontSize: '0.55rem', color: '#6b7280', marginTop: 2 }}>{c.feat}</div>
              <div style={{ marginTop: 4, background: primary, color: '#fff', borderRadius: 4, textAlign: 'center', padding: '2px 0', fontSize: '0.55rem', fontWeight: 600 }}>Ver detalhes</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
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
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'poster'

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

  const handleChange = (key, value) => setValues((prev) => ({ ...prev, [key]: value || '' }));

  const handleReset = () => {
    const next = {};
    DESIGN_KEYS.forEach(({ key }) => { next[key] = DEFAULT_PALETTE[key] ?? ''; });
    setValues(next);
  };

  const handleExtractFromLogo = async () => {
    const logoUrl = client?.logo_url;
    if (!logoUrl?.trim()) {
      setMsg('Cadastre um logo no cliente para usar esta opção.');
      return;
    }
    setExtractingFromLogo(true);
    setMsg(null);
    try {
      const url = proxyImageUrl(logoUrl);
      const result = await getDominantColorFromImageUrl(url);
      if (result?.dominant) {
        const palette = getPaletteFromPrimary(result.dominant, result.darkest ?? null, result.lightest ?? null);
        const next = {};
        DESIGN_KEYS.forEach(({ key }) => { next[key] = palette[key] ?? DEFAULT_PALETTE[key] ?? ''; });
        setValues(next);
        setMsg('Cores extraídas do logo e preenchidas. Revise e salve.');
      } else {
        setMsg('Não foi possível extrair cores do logo. Tente ajustar manualmente.');
      }
    } catch (e) {
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
      setMsg('Design salvo! As cores serão aplicadas no catálogo e nos posters.');
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
      carousel_images: ['https://resizedimgs.vivareal.com/img/vr-listing/9b66eb450db996a1e721b29ea90aab6e/casa-com-2-quartos-a-venda-82m-no-bal-stella-maris-peruibe.webp'],
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
      ],
    };
  }, [client, designConfigFromValues]);

  if (loading) return <p className="muted">Carregando...</p>;
  if (!client) return <p style={{ color: 'var(--danger)' }}>Cliente não encontrado.</p>;

  return (
    <>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
        <Link to="/">Dashboard</Link>
        <span style={{ margin: '0 0.5rem', color: 'var(--muted)' }}>→</span>
        <Link to={'/cliente/' + id + '/area'}>{client.name}</Link>
        <span style={{ margin: '0 0.5rem', color: 'var(--muted)' }}>→</span>
        <span>Design</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>

        {/* ── Painel de controle ── */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {client.logo_url && (
              <img src={proxyImageUrl(client.logo_url)} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div>
              <h1 style={{ margin: 0, fontSize: '1.2rem' }}>Design — {client.name}</h1>
              <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>As cores se aplicam ao catálogo público e aos posters de vídeo.</p>
            </div>
          </div>

          {/* Cores em grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.65rem', marginBottom: '1rem' }}>
            {DESIGN_KEYS.map(({ key, shortLabel, label, hint }) => {
              const val = values[key] || '';
              const isValid = val.startsWith('#') && val.length >= 4;
              return (
                <div key={key} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <input
                    type="color"
                    value={isValid ? val : '#1152d4'}
                    onChange={(e) => handleChange(key, e.target.value)}
                    title={hint}
                    style={{ width: 28, height: 28, padding: 0, border: 'none', borderRadius: 6, cursor: 'pointer', flexShrink: 0, background: 'none' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{shortLabel}</div>
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => handleChange(key, e.target.value)}
                      placeholder={DEFAULT_PALETTE[key] || '#hex'}
                      title={label}
                      style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.75rem', padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ações */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando…' : '💾 Salvar design'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={handleExtractFromLogo}
              disabled={extractingFromLogo || !client?.logo_url}
              title={client?.logo_url ? 'Gera paleta harmônica a partir das cores do logo' : 'Cadastre um logo no cliente'}
            >
              {extractingFromLogo ? 'Extraindo…' : '🎨 Gerar do logo'}
            </button>
            <button type="button" className="btn" onClick={handleReset}>
              Restaurar padrão
            </button>
          </div>

          {msg && (
            <p style={{ marginTop: '0.75rem', color: msg.startsWith('Erro') ? 'var(--danger)' : 'var(--success)', fontSize: '0.875rem' }}>
              {msg}
            </p>
          )}
        </div>

        {/* ── Tabs de preview ── */}
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              type="button"
              className={'btn ' + (activeTab === 'catalog' ? 'btn-primary' : '')}
              onClick={() => setActiveTab('catalog')}
            >
              🌐 Preview catálogo
            </button>
            <button
              type="button"
              className={'btn ' + (activeTab === 'poster' ? 'btn-primary' : '')}
              onClick={() => setActiveTab('poster')}
            >
              🎬 Preview poster
            </button>
          </div>

          {/* Preview catálogo */}
          {activeTab === 'catalog' && (
            <div>
              <p className="muted" style={{ fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                Prévia do catálogo público que seus clientes verão ao acessar o link.
              </p>
              <CatalogPreview client={client} values={values} />
            </div>
          )}

          {/* Preview poster (layouts de vídeo) */}
          {activeTab === 'poster' && (
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
                <span className="muted" style={{ fontSize: '0.85rem' }}>Fase:</span>
                <button type="button" className={'btn ' + (previewPhase === 'info' ? 'btn-primary' : '')} onClick={() => setPreviewPhase('info')}>
                  Parte 1 – Infos
                </button>
                <button type="button" className={'btn ' + (previewPhase === 'contact' ? 'btn-primary' : '')} onClick={() => setPreviewPhase('contact')}>
                  Parte 2 – Contatos
                </button>
              </div>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                {[{ id: 'classic', name: 'Classic' }, { id: 'cards', name: 'Cards' }].map((layout) => (
                  <div
                    key={layout.id}
                    style={{ flex: '1 1 300px', minWidth: 260, background: 'var(--bg)', borderRadius: 12, padding: 14, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                  >
                    <h3 style={{ margin: '0 0 0.6rem', fontSize: '0.95rem', color: 'var(--primary)' }}>{layout.name}</h3>
                    <div style={{ width: '100%', aspectRatio: '1080/1920', maxHeight: '60vh', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflow: 'hidden', background: '#f1f5f9', borderRadius: 8 }}>
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
            </div>
          )}
        </div>
      </div>
    </>
  );
}
