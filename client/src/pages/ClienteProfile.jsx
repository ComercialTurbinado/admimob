import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API } from '../api';

// ─── Dark Luxury theme tokens ──────────────────────────────────────────────────
const T = {
  bg: '#131313',
  surfaceLow: '#1c1b1b',
  surface: '#201f1f',
  surfaceHigh: '#2a2a2a',
  surfaceHighest: '#353534',
  primary: '#f2ca50',
  primaryCt: '#d4af37',
  onSurface: '#e5e2e1',
  onSurfaceVariant: '#d0c5af',
  outlineVariant: '#4d4635',
  danger: '#ffb4ab',
  success: '#b5ccb8',
};

const s = {
  page: {
    background: T.bg,
    minHeight: '100vh',
    color: T.onSurface,
    fontFamily: 'Manrope, sans-serif',
    paddingBottom: '6rem',
  },
  card: {
    background: T.surfaceLow,
    border: `1px solid ${T.outlineVariant}`,
    borderRadius: 4,
    padding: '1.5rem',
    marginBottom: '1.25rem',
  },
  label: {
    display: 'block',
    fontSize: '0.72rem',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color: T.onSurfaceVariant,
    marginBottom: '0.4rem',
    fontFamily: 'Manrope, sans-serif',
  },
  input: {
    width: '100%',
    background: T.surfaceHigh,
    border: `1px solid ${T.outlineVariant}`,
    borderRadius: 3,
    color: T.onSurface,
    padding: '0.6rem 0.85rem',
    fontSize: '0.9rem',
    fontFamily: 'Manrope, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
  },
  inputReadonly: {
    background: T.surfaceHighest,
    color: T.onSurfaceVariant,
    cursor: 'default',
  },
  textarea: {
    width: '100%',
    background: T.surfaceHigh,
    border: `1px solid ${T.outlineVariant}`,
    borderRadius: 3,
    color: T.onSurface,
    padding: '0.6rem 0.85rem',
    fontSize: '0.9rem',
    fontFamily: 'Manrope, sans-serif',
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'vertical',
    minHeight: 100,
  },
  btnPrimary: {
    background: T.primaryCt,
    color: '#3c2f00',
    border: 'none',
    borderRadius: 3,
    padding: '0.65rem 1.4rem',
    fontFamily: 'Manrope, sans-serif',
    fontWeight: 700,
    fontSize: '0.85rem',
    letterSpacing: '0.05em',
    cursor: 'pointer',
  },
  btnSecondary: {
    background: 'transparent',
    color: T.onSurfaceVariant,
    border: `1px solid ${T.outlineVariant}`,
    borderRadius: 3,
    padding: '0.5rem 1rem',
    fontFamily: 'Manrope, sans-serif',
    fontWeight: 500,
    fontSize: '0.82rem',
    cursor: 'pointer',
  },
  btnDanger: {
    background: 'transparent',
    color: T.danger,
    border: `1px solid rgba(255,180,171,0.35)`,
    borderRadius: 3,
    padding: '0.45rem 0.75rem',
    fontFamily: 'Manrope, sans-serif',
    fontWeight: 500,
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  sectionTitle: {
    fontFamily: 'Noto Serif, serif',
    fontSize: '1.1rem',
    fontWeight: 700,
    color: T.onSurface,
    margin: '0 0 1rem',
    paddingBottom: '0.5rem',
    borderBottom: `1px solid ${T.outlineVariant}`,
  },
  formGroup: {
    marginBottom: '1rem',
  },
  bottomBar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    background: `${T.bg}e8`,
    backdropFilter: 'blur(16px)',
    borderTop: `1px solid ${T.outlineVariant}`,
    padding: '0.85rem 1.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '1rem',
    zIndex: 100,
  },
  badge: {
    display: 'inline-block',
    background: T.surfaceHighest,
    color: T.onSurfaceVariant,
    borderRadius: 2,
    padding: '0.2rem 0.55rem',
    fontSize: '0.72rem',
    letterSpacing: '0.08em',
    fontFamily: 'Manrope, sans-serif',
  },
  toggle: {
    width: 40,
    height: 22,
    borderRadius: 11,
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    transition: 'background 0.2s',
    flexShrink: 0,
  },
};

function buildCatalogUrl(client) {
  if (!client?.slug) return null;
  const base = (import.meta.env.VITE_CATALOG_URL || '').replace(/\/$/, '');
  if (base) return `${base}/${client.slug}/catalogo`;
  const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:3333').replace(/\/api$/, '').replace(/\/$/, '');
  return `${apiBase}/${client.slug}/catalogo`;
}

function parseProfileConfig(raw) {
  if (!raw) return {};
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return {}; }
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function iconForLabel(label = '') {
  const l = label.toLowerCase();
  if (l.includes('whatsapp') || l.includes('zap')) return 'chat';
  if (l.includes('instagram') || l.includes('insta')) return 'camera_alt';
  if (l.includes('youtube') || l.includes('video')) return 'play_circle';
  if (l.includes('catalogo') || l.includes('catálogo') || l.includes('imóveis') || l.includes('imoveis')) return 'apartment';
  if (l.includes('site') || l.includes('web')) return 'language';
  return 'link';
}

export default function ClienteProfile() {
  const { id } = useParams();

  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error
  const [errorMsg, setErrorMsg] = useState('');

  // Section 1: Perfil e Identidade
  const [logoUrl, setLogoUrl] = useState('');
  const [name, setName] = useState('');
  const [creci, setCreci] = useState('');
  const [specialty, setSpecialty] = useState('');

  // Section 2: Links
  const [links, setLinks] = useState([]);

  // Section 3: Quem Somos
  const [aboutEnabled, setAboutEnabled] = useState(true);
  const [aboutBio, setAboutBio] = useState('');
  const [aboutVideo, setAboutVideo] = useState('');
  const [aboutImages, setAboutImages] = useState(['', '', '']);

  useEffect(() => {
    // Load Google Fonts
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;0,900;1,400&family=Manrope:wght@300;400;500;600;700;800&display=swap';
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch {} };
  }, []);

  useEffect(() => {
    fetch(`${API}/clients/${id}`)
      .then((r) => r.json())
      .then((c) => {
        setClient(c);
        setLogoUrl(c.logo_url || '');
        setName(c.name || '');
        setCreci(c.creci || '');

        const pc = parseProfileConfig(c.profile_config);
        setSpecialty(pc.specialty || c.contact_name || '');

        // Build initial links: always start with catalog auto-link
        const catalogLink = { id: 'catalog', label: 'Ver Catálogo', url: 'auto' };
        const savedLinks = Array.isArray(pc.links) ? pc.links : [];
        // Ensure catalog link is first and cannot be duplicated
        const otherLinks = savedLinks.filter((l) => l.url !== 'auto' || l.id === 'catalog');
        const hasAutoLink = otherLinks.some((l) => l.id === 'catalog' || l.url === 'auto');
        setLinks(hasAutoLink ? otherLinks : [catalogLink, ...otherLinks]);

        setAboutEnabled(pc.about_enabled !== false);
        setAboutBio(pc.about_bio || c.notes || '');
        setAboutVideo(pc.about_video || '');
        const imgs = Array.isArray(pc.about_images) ? pc.about_images : [];
        setAboutImages([imgs[0] || '', imgs[1] || '', imgs[2] || '']);
      })
      .catch((e) => setErrorMsg('Erro ao carregar: ' + e.message))
      .finally(() => setLoading(false));
  }, [id]);

  function updateLink(linkId, field, value) {
    setLinks((prev) => prev.map((l) => l.id === linkId ? { ...l, [field]: value } : l));
  }

  function addLink() {
    if (links.length >= 5) return;
    setLinks((prev) => [...prev, { id: generateId(), label: 'Novo link', url: '' }]);
  }

  function removeLink(linkId) {
    if (linkId === 'catalog') return; // catalog link is not removable
    setLinks((prev) => prev.filter((l) => l.id !== linkId));
  }

  async function handleSave() {
    setSaveStatus('saving');
    setErrorMsg('');
    try {
      const profile_config = {
        specialty,
        links,
        about_enabled: aboutEnabled,
        about_bio: aboutBio,
        about_video: aboutVideo,
        about_images: aboutImages.filter(Boolean),
      };

      const body = {
        name,
        logo_url: logoUrl,
        creci,
        contact_name: client.contact_name,
        phone: client.phone,
        whatsapp: client.whatsapp,
        instagram: client.instagram,
        website: client.website,
        notes: client.notes,
        design_config: client.design_config,
        profile_config,
      };

      const res = await fetch(`${API}/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (e) {
      setSaveStatus('error');
      setErrorMsg(e.message);
    }
  }

  const catalogUrl = client ? buildCatalogUrl(client) : null;

  if (loading) {
    return (
      <div style={{ ...s.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: T.onSurfaceVariant }}>Carregando...</p>
      </div>
    );
  }

  if (!client && errorMsg) {
    return (
      <div style={s.page}>
        <p style={{ color: T.danger, padding: '2rem' }}>{errorMsg}</p>
      </div>
    );
  }

  return (
    <div style={s.page}>
      {/* Breadcrumb */}
      <div style={{ padding: '1rem 1.5rem 0', fontSize: '0.82rem', color: T.onSurfaceVariant }}>
        <Link to="/" style={{ color: T.onSurfaceVariant, textDecoration: 'none' }}>Dashboard</Link>
        <span style={{ margin: '0 0.4rem' }}>→</span>
        <Link to={`/cliente/${id}/area`} style={{ color: T.onSurfaceVariant, textDecoration: 'none' }}>{client?.name}</Link>
        <span style={{ margin: '0 0.4rem' }}>→</span>
        <span style={{ color: T.primary }}>Curadoria de Identidade</span>
      </div>

      {/* Page header */}
      <div style={{ padding: '1.25rem 1.5rem 1.5rem' }}>
        <h1 style={{ fontFamily: 'Noto Serif, serif', fontSize: '1.6rem', fontWeight: 700, margin: '0 0 0.25rem', color: T.onSurface }}>
          Curadoria de Identidade
        </h1>
        <p style={{ margin: 0, color: T.onSurfaceVariant, fontSize: '0.875rem' }}>
          Gerencie o perfil público do cliente — como ele aparece no link de bio.
        </p>
      </div>

      {/* Main grid */}
      <div style={{ padding: '0 1.5rem', display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '1.25rem', alignItems: 'start' }}>

        {/* ── Section 1: Perfil e Identidade ── */}
        <div>
          <div style={s.card}>
            <h2 style={s.sectionTitle}>Perfil e Identidade</h2>

            {/* Logo */}
            <div style={s.formGroup}>
              <label style={s.label}>Logo / Foto de Perfil</label>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 4,
                  background: T.surfaceHighest,
                  border: `1px solid ${T.outlineVariant}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', flexShrink: 0,
                }}>
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ color: T.outlineVariant, fontSize: '1.5rem', fontFamily: 'Noto Serif, serif', fontWeight: 900 }}>
                      {(name || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://..."
                    style={s.input}
                  />
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.72rem', color: T.onSurfaceVariant }}>
                    URL da imagem (PNG, JPG ou WebP recomendado)
                  </p>
                </div>
              </div>
            </div>

            {/* Nome */}
            <div style={s.formGroup}>
              <label style={s.label}>Nome Profissional</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome completo ou da imobiliária"
                style={s.input}
              />
            </div>

            {/* CRECI */}
            <div style={s.formGroup}>
              <label style={s.label}>Registro CRECI</label>
              <input
                type="text"
                value={creci}
                onChange={(e) => setCreci(e.target.value)}
                placeholder="ex: 12345-F"
                style={s.input}
              />
            </div>

            {/* Specialty */}
            <div style={s.formGroup}>
              <label style={s.label}>Especialidade / Tagline</label>
              <input
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="ex: Especialista em Alto Padrão"
                style={s.input}
              />
              <p style={{ margin: '0.3rem 0 0', fontSize: '0.72rem', color: T.onSurfaceVariant }}>
                Aparece abaixo do nome no perfil público
              </p>
            </div>
          </div>
        </div>

        {/* ── Section 2: Links Estratégicos ── */}
        <div>
          <div style={s.card}>
            <h2 style={s.sectionTitle}>Links Estratégicos</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {links.map((link, idx) => {
                const isAuto = link.url === 'auto';
                const isCatalog = link.id === 'catalog';
                return (
                  <div key={link.id} style={{
                    background: T.surfaceHigh,
                    border: `1px solid ${T.outlineVariant}`,
                    borderRadius: 3,
                    padding: '0.75rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.7rem', color: T.onSurfaceVariant, fontFamily: 'Manrope, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase', flex: 1 }}>
                        Link {idx + 1} {isCatalog && <span style={{ ...s.badge, marginLeft: 4 }}>auto</span>}
                      </span>
                      {!isCatalog && (
                        <button type="button" onClick={() => removeLink(link.id)} style={s.btnDanger} title="Remover link">
                          ✕
                        </button>
                      )}
                    </div>
                    <div style={{ marginBottom: '0.4rem' }}>
                      <label style={{ ...s.label, marginBottom: '0.25rem' }}>Rótulo</label>
                      <input
                        type="text"
                        value={link.label}
                        onChange={(e) => updateLink(link.id, 'label', e.target.value)}
                        placeholder="ex: Falar no WhatsApp"
                        style={s.input}
                        readOnly={isCatalog}
                      />
                    </div>
                    <div>
                      <label style={{ ...s.label, marginBottom: '0.25rem' }}>URL</label>
                      {isAuto ? (
                        <div style={{ ...s.input, ...s.inputReadonly, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Gerado automaticamente →</span>
                          <span style={{ fontSize: '0.8rem', color: T.primary }}>
                            {catalogUrl ? `/${client.slug}/catalogo` : '/:slug/catalogo'}
                          </span>
                        </div>
                      ) : (
                        <input
                          type="url"
                          value={link.url}
                          onChange={(e) => updateLink(link.id, 'url', e.target.value)}
                          placeholder="https://..."
                          style={s.input}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {links.length < 5 && (
              <button
                type="button"
                onClick={addLink}
                style={{ ...s.btnSecondary, marginTop: '0.75rem', width: '100%' }}
              >
                + Adicionar novo link ({links.length}/5)
              </button>
            )}
            {links.length >= 5 && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: T.onSurfaceVariant }}>
                Máximo de 5 links atingido.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 3: Módulo Quem Somos ── */}
      <div style={{ padding: '0 1.5rem' }}>
        <div style={s.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: `1px solid ${T.outlineVariant}` }}>
            <h2 style={{ fontFamily: 'Noto Serif, serif', fontSize: '1.1rem', fontWeight: 700, margin: 0, color: T.onSurface, flex: 1 }}>
              Módulo "Quem Somos"
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '0.8rem', color: T.onSurfaceVariant }}>
                {aboutEnabled ? 'Ativo' : 'Inativo'}
              </span>
              <button
                type="button"
                onClick={() => setAboutEnabled((v) => !v)}
                style={{
                  ...s.toggle,
                  background: aboutEnabled ? T.primaryCt : T.surfaceHighest,
                }}
                aria-label="Ativar/desativar módulo Quem Somos"
              >
                <span style={{
                  position: 'absolute',
                  top: 3,
                  left: aboutEnabled ? 20 : 3,
                  width: 16,
                  height: 16,
                  background: aboutEnabled ? '#3c2f00' : T.onSurfaceVariant,
                  borderRadius: '50%',
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>
          </div>

          {aboutEnabled && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              {/* Bio */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={s.label}>Bio / Texto sobre o cliente</label>
                <textarea
                  value={aboutBio}
                  onChange={(e) => setAboutBio(e.target.value)}
                  placeholder="Descreva o cliente, sua história, diferenciais..."
                  style={{ ...s.textarea, minHeight: 120 }}
                />
              </div>

              {/* Video URL */}
              <div>
                <label style={s.label}>URL do Vídeo (YouTube)</label>
                <input
                  type="url"
                  value={aboutVideo}
                  onChange={(e) => setAboutVideo(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  style={s.input}
                />
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.72rem', color: T.onSurfaceVariant }}>
                  Opcional — será incorporado como player no perfil
                </p>
              </div>

              {/* Gallery images */}
              <div>
                <label style={s.label}>Galeria de imagens (até 3)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {aboutImages.map((img, idx) => (
                    <input
                      key={idx}
                      type="url"
                      value={img}
                      onChange={(e) => {
                        const next = [...aboutImages];
                        next[idx] = e.target.value;
                        setAboutImages(next);
                      }}
                      placeholder={`Imagem ${idx + 1} — https://...`}
                      style={s.input}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {!aboutEnabled && (
            <p style={{ color: T.onSurfaceVariant, fontSize: '0.85rem', margin: 0 }}>
              Este módulo está oculto no perfil público. Ative para configurá-lo.
            </p>
          )}
        </div>
      </div>

      {/* Error message */}
      {errorMsg && saveStatus === 'error' && (
        <div style={{ padding: '0 1.5rem' }}>
          <p style={{ color: T.danger, fontSize: '0.85rem' }}>{errorMsg}</p>
        </div>
      )}

      {/* ── Bottom bar ── */}
      <div style={s.bottomBar}>
        {saveStatus === 'saved' && (
          <span style={{ color: T.success, fontSize: '0.85rem' }}>Alterações publicadas.</span>
        )}
        {saveStatus === 'error' && (
          <span style={{ color: T.danger, fontSize: '0.85rem' }}>Erro ao salvar.</span>
        )}
        {saveStatus === 'saving' && (
          <span style={{ color: T.onSurfaceVariant, fontSize: '0.85rem' }}>Salvando...</span>
        )}
        <Link
          to={`/cliente/${id}/area`}
          style={{ ...s.btnSecondary, textDecoration: 'none', display: 'inline-block' }}
        >
          Voltar
        </Link>
        <button
          type="button"
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          style={{
            ...s.btnPrimary,
            opacity: saveStatus === 'saving' ? 0.6 : 1,
          }}
        >
          {saveStatus === 'saving' ? 'Publicando...' : 'Publicar Alterações'}
        </button>
      </div>
    </div>
  );
}
