import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API, proxyImageUrl } from '../api';
import { DEFAULT_PALETTE, getDominantColorFromImageUrl, getPaletteFromPrimary } from '../lib/dominantColor';

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

// ─── Color fields ──────────────────────────────────────────────────────────────
const COLOR_FIELDS = [
  { key: '--primary',       label: 'Cor Principal',       hint: 'Botões, preços, destaques' },
  { key: '--btn-bg',        label: 'Botão CTA — Fundo',   hint: 'Fundo do botão principal no perfil (padrão: cor principal)' },
  { key: '--btn-text',      label: 'Botão CTA — Texto',   hint: 'Texto dentro do botão principal' },
  { key: '--contact-bg',    label: 'Fundo das Páginas',   hint: 'Cor do cabeçalho do perfil, catálogo e vídeo poster — use a cor principal da marca' },
  { key: '--contact-text',  label: 'Texto do Cabeçalho',  hint: 'Cor do texto no cabeçalho — use branco (#ffffff) se o fundo for escuro' },
  { key: '--bg-poster',     label: 'Badges',              hint: 'Chips e pills no catálogo e poster' },
  { key: '--text-poster',   label: 'Texto Geral',         hint: 'Preço, localização, site no rodapé' },
  { key: '--detail-poster', label: 'Texto Secundário',    hint: 'Referências, textos menores' },
  { key: '--line-poster',   label: 'Linhas e Bordas',     hint: 'Separadores no poster' },
  { key: '--amen-bg',       label: 'Lazer — Fundo',       hint: 'Background dos cards de amenidades' },
  { key: '--amen-bd',       label: 'Lazer — Borda',       hint: 'Borda dos cards de amenidades' },
];

const SECTION_LABELS = {
  cta:   { icon: 'apartment', label: 'Botão Catálogo',      hint: 'CTA principal para ver imóveis' },
  links: { icon: 'link',      label: 'Links Estratégicos',  hint: 'WhatsApp, Instagram, site, etc.' },
  about: { icon: 'article',   label: 'Quem Somos',          hint: 'Bio, vídeo e galeria de imagens' },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function parseJson(raw) {
  if (!raw) return {};
  try { return typeof raw === 'string' ? JSON.parse(raw) : (raw || {}); } catch { return {}; }
}

function generateId() {
  return Date.now().toString() + Math.random().toString(36).slice(2);
}

function buildCatalogUrl(client) {
  if (!client?.slug) return null;
  const base = (import.meta.env.VITE_CATALOG_URL || '').replace(/\/$/, '');
  if (base) return `${base}/${client.slug}/catalogo`;
  const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:3333').replace(/\/api$/, '').replace(/\/$/, '');
  return `${apiBase}/${client.slug}/catalogo`;
}

// ─── Shared style primitives ───────────────────────────────────────────────────
const inputStyle = {
  width: '100%',
  background: T.surfaceHighest,
  border: 'none',
  borderRadius: 3,
  color: T.onSurface,
  padding: '0.6rem 0.85rem',
  fontSize: '0.9rem',
  fontFamily: 'Manrope, sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.72rem',
  letterSpacing: '0.15em',
  textTransform: 'uppercase',
  color: T.onSurfaceVariant,
  marginBottom: '0.4rem',
  fontFamily: 'Manrope, sans-serif',
};

const formGroupStyle = { marginBottom: '1rem' };

const cardStyle = {
  background: T.surfaceLow,
  border: `1px solid ${T.outlineVariant}`,
  borderRadius: 6,
  padding: '1.5rem',
  marginBottom: '1.25rem',
};

const sectionTitleStyle = {
  fontFamily: 'Noto Serif, serif',
  fontSize: '1.05rem',
  fontWeight: 700,
  color: T.onSurface,
  margin: '0 0 0.35rem',
};

const sectionSubtitleStyle = {
  fontSize: '0.8rem',
  color: T.onSurfaceVariant,
  margin: '0 0 1.25rem',
  fontFamily: 'Manrope, sans-serif',
};

// ─── Toggle component ──────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', userSelect: 'none' }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          background: checked ? T.primaryCt : T.surfaceHighest,
          border: `1px solid ${checked ? T.primaryCt : T.outlineVariant}`,
          position: 'relative',
          cursor: 'pointer',
          transition: 'background 0.2s',
          flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute',
          top: 3,
          left: checked ? 22 : 3,
          width: 16,
          height: 16,
          background: checked ? '#3c2f00' : T.onSurfaceVariant,
          borderRadius: '50%',
          transition: 'left 0.2s',
        }} />
      </div>
      {label && (
        <span style={{ fontSize: '0.88rem', color: T.onSurface, fontFamily: 'Manrope, sans-serif' }}>
          {label}
        </span>
      )}
    </label>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function ClienteHub() {
  const { id } = useParams();

  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('identity');
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);

  // Identidade
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [creci, setCreci] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [logoStyle, setLogoStyle] = useState('contain');
  const [logoUploadMsg, setLogoUploadMsg] = useState(null);
  const logoFileRef = useRef(null);

  function handleLogoFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 800 * 1024) {
      setLogoUploadMsg('⚠ Imagem muito grande. Use menos de 800 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoUrl(ev.target.result);
      setLogoUploadMsg(`✓ "${file.name}" carregado`);
    };
    reader.onerror = () => setLogoUploadMsg('Erro ao ler arquivo.');
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  // Links
  const [links, setLinks] = useState([]);

  // Quem Somos
  const [aboutEnabled, setAboutEnabled] = useState(true);
  const [aboutBio, setAboutBio] = useState('');
  const [aboutVideo, setAboutVideo] = useState('');
  const [aboutImages, setAboutImages] = useState(['', '', '']);

  // Visual
  const [colors, setColors] = useState({});
  const [extractingFromLogo, setExtractingFromLogo] = useState(false);
  const [colorMsg, setColorMsg] = useState(null);

  // Layout
  const [sectionsOrder, setSectionsOrder] = useState(['cta', 'links', 'about']);

  // Load Google Fonts
  useEffect(() => {
    const id_ = 'hub-google-fonts';
    if (document.getElementById(id_)) return;
    const link = document.createElement('link');
    link.id = id_;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;0,900;1,400&family=Manrope:wght@300;400;500;600;700;800&display=swap';
    document.head.appendChild(link);

    const icons = document.getElementById('hub-material-symbols');
    if (!icons) {
      const iconLink = document.createElement('link');
      iconLink.id = 'hub-material-symbols';
      iconLink.rel = 'stylesheet';
      iconLink.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200';
      document.head.appendChild(iconLink);
    }
  }, []);

  // Load client data
  useEffect(() => {
    fetch(`${API}/clients/${id}`)
      .then((r) => r.json())
      .then((c) => {
        setClient(c);
        setName(c.name || '');
        setLogoUrl(c.logo_url || '');
        setCreci(c.creci || '');

        const pc = parseJson(c.profile_config);
        setSpecialty(pc.specialty || '');
        setLogoStyle(pc.logo_style || 'contain');
        setAboutEnabled(pc.about_enabled !== false);
        setAboutBio(pc.about_bio || '');
        setAboutVideo(pc.about_video || '');
        const imgs = Array.isArray(pc.about_images) ? pc.about_images : [];
        setAboutImages([imgs[0] || '', imgs[1] || '', imgs[2] || '']);
        setSectionsOrder(Array.isArray(pc.sections_order) ? pc.sections_order : ['cta', 'links', 'about']);

        // Links: always start with auto catalog link
        const catalogLink = { id: 'catalog', label: 'Ver Catálogo de Imóveis', url: 'auto' };
        const savedLinks = Array.isArray(pc.links) ? pc.links : [];
        const hasAutoLink = savedLinks.some((l) => l.url === 'auto' || l.id === 'catalog');
        const otherLinks = savedLinks.filter((l) => l.id !== 'catalog' && l.url !== 'auto');
        setLinks(hasAutoLink ? [catalogLink, ...otherLinks] : [catalogLink, ...savedLinks]);

        // Colors
        const dc = parseJson(c.design_config);
        const colorObj = {};
        COLOR_FIELDS.forEach(({ key }) => {
          colorObj[key] = dc[key] ?? DEFAULT_PALETTE[key] ?? '';
        });
        setColors(colorObj);
      })
      .catch((e) => setError('Erro ao carregar: ' + e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Save ──────────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const profile_config = {
        specialty,
        logo_style: logoStyle,
        links: links.filter((l) => l.label || l.url),
        about_enabled: aboutEnabled,
        about_bio: aboutBio,
        about_video: aboutVideo,
        about_images: aboutImages.filter(Boolean),
        sections_order: sectionsOrder,
      };

      // Build design_config — only include keys with values
      const design_config = {};
      COLOR_FIELDS.forEach(({ key }) => {
        const v = colors[key];
        if (v && String(v).trim()) design_config[key] = String(v).trim();
      });

      const body = {
        name,
        logo_url: logoUrl,
        creci,
        design_config: Object.keys(design_config).length ? design_config : null,
        profile_config,
      };

      const res = await fetch(`${API}/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Links helpers ─────────────────────────────────────────────────────────────
  function updateLink(linkId, field, value) {
    setLinks((prev) => prev.map((l) => l.id === linkId ? { ...l, [field]: value } : l));
  }

  function addLink() {
    if (links.length >= 5) return;
    setLinks((prev) => [...prev, { id: generateId(), label: '', url: '' }]);
  }

  function removeLink(linkId) {
    if (linkId === 'catalog') return;
    setLinks((prev) => prev.filter((l) => l.id !== linkId));
  }

  // ── Sections reorder ──────────────────────────────────────────────────────────
  function moveSection(idx, dir) {
    const arr = [...sectionsOrder];
    const swap = idx + dir;
    if (swap < 0 || swap >= arr.length) return;
    [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    setSectionsOrder(arr);
  }

  // ── Color helpers ─────────────────────────────────────────────────────────────
  function handleColorChange(key, value) {
    setColors((prev) => ({ ...prev, [key]: value }));
  }

  async function handleGenerateFromPrimary() {
    const primary = colors['--primary'];
    if (!primary) {
      setColorMsg('Defina primeiro a Cor Principal.');
      return;
    }
    const palette = getPaletteFromPrimary(primary, null, null);
    const next = { ...colors };
    COLOR_FIELDS.forEach(({ key }) => {
      if (palette[key]) next[key] = palette[key];
    });
    setColors(next);
    setColorMsg('Paleta gerada a partir da cor principal. Revise e salve.');
  }

  async function handleExtractFromLogo() {
    if (!logoUrl?.trim()) {
      setColorMsg('Defina o Logo URL na aba Identidade primeiro.');
      return;
    }
    setExtractingFromLogo(true);
    setColorMsg(null);
    try {
      const url = logoUrl.startsWith('data:') ? logoUrl : proxyImageUrl(logoUrl);
      const result = await getDominantColorFromImageUrl(url);
      if (result?.dominant) {
        const palette = getPaletteFromPrimary(result.dominant, result.darkest ?? null, result.lightest ?? null);
        const next = { ...colors };
        COLOR_FIELDS.forEach(({ key }) => {
          if (palette[key]) next[key] = palette[key];
        });
        setColors(next);
        setColorMsg('Cores extraídas do logo. Revise e salve.');
      } else {
        setColorMsg('Não foi possível extrair cores do logo. Tente ajustar manualmente.');
      }
    } catch (e) {
      setColorMsg('Erro ao extrair cores: ' + (e?.message || 'tente de novo'));
    } finally {
      setExtractingFromLogo(false);
    }
  }

  const catalogUrl = client ? buildCatalogUrl(client) : null;

  // ── Loading / error states ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ background: T.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: T.onSurfaceVariant, fontFamily: 'Manrope, sans-serif' }}>Carregando...</p>
      </div>
    );
  }

  if (error && !client) {
    return (
      <div style={{ background: T.bg, minHeight: '100vh', padding: '2rem' }}>
        <p style={{ color: T.danger, fontFamily: 'Manrope, sans-serif' }}>{error}</p>
      </div>
    );
  }

  // ── Tabs config ───────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'identity', icon: 'badge',    label: 'Identidade' },
    { id: 'links',    icon: 'link',     label: 'Links' },
    { id: 'about',    icon: 'article',  label: 'Quem Somos' },
    { id: 'visual',   icon: 'palette',  label: 'Visual' },
    { id: 'layout',   icon: 'reorder',  label: 'Layout' },
  ];

  // ── Save button shared component ──────────────────────────────────────────────
  const SaveButton = ({ compact = false }) => (
    <button
      type="button"
      onClick={handleSave}
      disabled={saving}
      style={{
        background: saving ? T.surfaceHigh : T.primaryCt,
        color: '#3c2f00',
        border: 'none',
        borderRadius: 3,
        padding: compact ? '0.6rem 1.2rem' : '0.65rem 1.6rem',
        fontFamily: 'Manrope, sans-serif',
        fontWeight: 700,
        fontSize: compact ? '0.82rem' : '0.88rem',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        cursor: saving ? 'not-allowed' : 'pointer',
        opacity: saving ? 0.7 : 1,
        transition: 'opacity 0.2s',
        whiteSpace: 'nowrap',
      }}
    >
      {saving ? 'Publicando...' : 'Publicar Alterações'}
    </button>
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: T.bg,
      minHeight: '100vh',
      color: T.onSurface,
      fontFamily: 'Manrope, sans-serif',
      paddingBottom: '5rem',
    }}>

      {/* ── TopBar ── */}
      <div style={{
        background: T.surfaceLow,
        borderBottom: `1px solid ${T.outlineVariant}`,
        padding: '0.85rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        flexWrap: 'wrap',
      }}>
        {/* Breadcrumb */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link
            to={`/cliente/${id}/area`}
            style={{
              color: T.onSurfaceVariant,
              textDecoration: 'none',
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span style={{ fontSize: '1rem' }}>←</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
              {client?.name || 'Cliente'}
            </span>
          </Link>
          <h1 style={{
            fontFamily: 'Noto Serif, serif',
            fontSize: '1.25rem',
            fontWeight: 700,
            color: T.onSurface,
            margin: '0.15rem 0 0',
            lineHeight: 1.2,
          }}>
            Hub do Cliente
          </h1>
        </div>

        {/* Status + save button (desktop) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }} className="hub-topbar-actions">
          {saved && (
            <span style={{ color: T.success, fontSize: '0.82rem' }}>Alterações publicadas.</span>
          )}
          {saveError && (
            <span style={{ color: T.danger, fontSize: '0.82rem' }}>{saveError}</span>
          )}
          <SaveButton />
        </div>
      </div>

      {/* ── TabBar (sticky) ── */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: T.surface,
        borderBottom: `1px solid ${T.outlineVariant}`,
        display: 'flex',
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid ${T.primary}` : '2px solid transparent',
                color: isActive ? T.primary : T.onSurfaceVariant,
                padding: '0.85rem 1.1rem',
                fontFamily: 'Manrope, sans-serif',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.82rem',
                letterSpacing: '0.04em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                flexShrink: 0,
                transition: 'color 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', fontVariationSettings: "'FILL' 0, 'wght' 400" }}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <div style={{ padding: '1.5rem', maxWidth: 900, margin: '0 auto' }}>

        {/* ══ Tab 1: Identidade ══ */}
        {activeTab === 'identity' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={sectionTitleStyle}>Identidade</h2>
              <p style={sectionSubtitleStyle}>Logo, nome, CRECI e especialidade do cliente.</p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.5fr)',
              gap: '1.25rem',
              alignItems: 'start',
            }}>
              {/* Left: Logo preview + style toggle */}
              <div style={cardStyle}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={labelStyle}>Preview do Logo</label>
                  <div style={{
                    background: T.surfaceHigh,
                    borderRadius: 6,
                    border: `1px solid ${T.outlineVariant}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 120,
                    overflow: 'hidden',
                  }}>
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Logo preview"
                        style={{
                          maxHeight: 100,
                          maxWidth: '100%',
                          objectFit: 'contain',
                          borderRadius: logoStyle === 'circle' ? '50%' : 0,
                        }}
                      />
                    ) : (
                      <span style={{
                        fontFamily: 'Noto Serif, serif',
                        fontWeight: 900,
                        fontSize: '2.5rem',
                        color: T.outlineVariant,
                      }}>
                        {(name || '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Formato do Logo</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {[
                      { value: 'contain', label: 'Conter (recomendado)' },
                      { value: 'circle', label: 'Circular (avatar)' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setLogoStyle(opt.value)}
                        style={{
                          padding: '0.5rem 0.85rem',
                          borderRadius: 3,
                          border: `1px solid ${logoStyle === opt.value ? T.primaryCt : T.outlineVariant}`,
                          fontFamily: 'Manrope, sans-serif',
                          fontSize: '0.82rem',
                          fontWeight: logoStyle === opt.value ? 700 : 400,
                          cursor: 'pointer',
                          background: logoStyle === opt.value ? `${T.primaryCt}22` : 'transparent',
                          color: logoStyle === opt.value ? T.primary : T.onSurfaceVariant,
                          textAlign: 'left',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: inputs */}
              <div style={cardStyle}>
                <div style={formGroupStyle}>
                  <label style={labelStyle}>Logo</label>
                  {/* Upload de arquivo */}
                  <input
                    ref={logoFileRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleLogoFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => logoFileRef.current?.click()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      width: '100%',
                      padding: '0.6rem 0.85rem',
                      marginBottom: '0.5rem',
                      background: `${T.primaryCt}22`,
                      border: `1px solid ${T.primaryCt}`,
                      borderRadius: 3,
                      color: T.primary,
                      fontFamily: 'Manrope, sans-serif',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: '1rem' }}>↑</span> Fazer upload da imagem
                  </button>
                  {logoUploadMsg && (
                    <p style={{ fontSize: '0.78rem', color: T.success, margin: '0 0 0.4rem' }}>
                      {logoUploadMsg}
                    </p>
                  )}
                  {/* Ou colar URL */}
                  <p style={{ fontSize: '0.72rem', color: T.onSurfaceVariant, margin: '0 0 0.35rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    ou cole uma URL
                  </p>
                  <input
                    type="url"
                    value={logoUrl.startsWith('data:') ? '' : logoUrl}
                    onChange={(e) => { setLogoUrl(e.target.value); setLogoUploadMsg(null); }}
                    placeholder="https://..."
                    style={inputStyle}
                  />
                  {logoUrl.startsWith('data:') && (
                    <p style={{ fontSize: '0.78rem', color: T.onSurfaceVariant, marginTop: '0.3rem' }}>
                      Imagem local carregada · <button
                        type="button"
                        onClick={() => { setLogoUrl(''); setLogoUploadMsg(null); }}
                        style={{ background: 'none', border: 'none', color: T.danger, cursor: 'pointer', fontSize: '0.78rem', padding: 0 }}
                      >remover</button>
                    </p>
                  )}
                </div>

                <div style={formGroupStyle}>
                  <label style={labelStyle}>Nome Profissional</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome completo ou da imobiliária"
                    style={inputStyle}
                  />
                </div>

                <div style={formGroupStyle}>
                  <label style={labelStyle}>Registro CRECI</label>
                  <input
                    type="text"
                    value={creci}
                    onChange={(e) => setCreci(e.target.value)}
                    placeholder="ex: 12345-F"
                    style={inputStyle}
                  />
                </div>

                <div style={formGroupStyle}>
                  <label style={labelStyle}>Especialidade / Tagline</label>
                  <input
                    type="text"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="Ex: Especialista em Alto Padrão"
                    style={inputStyle}
                  />
                  <p style={{ margin: '0.3rem 0 0', fontSize: '0.72rem', color: T.onSurfaceVariant }}>
                    Aparece abaixo do nome no perfil público
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ Tab 2: Links ══ */}
        {activeTab === 'links' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={sectionTitleStyle}>Links Estratégicos</h2>
              <p style={sectionSubtitleStyle}>
                O primeiro link (catálogo) é gerado automaticamente. Adicione até 4 links extras.
              </p>
            </div>

            <div style={cardStyle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {links.map((link, idx) => {
                  const isAuto = link.url === 'auto';
                  const isCatalog = link.id === 'catalog';
                  return (
                    <div key={link.id} style={{
                      background: T.surfaceHigh,
                      border: `1px solid ${isCatalog ? T.outlineVariant + '88' : T.outlineVariant}`,
                      borderRadius: 4,
                      padding: '0.85rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.7rem', color: T.onSurfaceVariant, fontFamily: 'Manrope, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase', flex: 1 }}>
                          Link {idx + 1}
                          {isCatalog && (
                            <span style={{
                              display: 'inline-block',
                              background: T.surfaceHighest,
                              color: T.primary,
                              borderRadius: 2,
                              padding: '0.1rem 0.45rem',
                              fontSize: '0.68rem',
                              letterSpacing: '0.08em',
                              fontFamily: 'Manrope, sans-serif',
                              marginLeft: 6,
                            }}>auto</span>
                          )}
                        </span>
                        {!isCatalog && (
                          <button
                            type="button"
                            onClick={() => removeLink(link.id)}
                            style={{
                              background: 'transparent',
                              color: T.danger,
                              border: `1px solid rgba(255,180,171,0.35)`,
                              borderRadius: 3,
                              padding: '0.25rem 0.5rem',
                              fontFamily: 'Manrope, sans-serif',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div>
                          <label style={{ ...labelStyle, marginBottom: '0.25rem' }}>Rótulo</label>
                          <input
                            type="text"
                            value={link.label}
                            onChange={(e) => updateLink(link.id, 'label', e.target.value)}
                            placeholder="ex: Falar no WhatsApp"
                            style={inputStyle}
                            readOnly={isCatalog}
                          />
                        </div>
                        <div>
                          <label style={{ ...labelStyle, marginBottom: '0.25rem' }}>URL</label>
                          {isAuto ? (
                            <div style={{
                              ...inputStyle,
                              background: T.surfaceHigh,
                              color: T.onSurfaceVariant,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              cursor: 'default',
                            }}>
                              <span style={{ fontSize: '0.78rem', opacity: 0.7 }}>→</span>
                              <span style={{ fontSize: '0.78rem', color: T.primary }}>
                                {catalogUrl ? `/${client.slug}/catalogo` : '/:slug/catalogo'}
                              </span>
                            </div>
                          ) : (
                            <input
                              type="url"
                              value={link.url}
                              onChange={(e) => updateLink(link.id, 'url', e.target.value)}
                              placeholder="https://..."
                              style={inputStyle}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={addLink}
                disabled={links.length >= 5}
                style={{
                  marginTop: '0.85rem',
                  width: '100%',
                  background: 'transparent',
                  border: `1px dashed ${links.length >= 5 ? T.outlineVariant + '55' : T.outlineVariant}`,
                  borderRadius: 4,
                  color: links.length >= 5 ? T.onSurfaceVariant + '55' : T.onSurfaceVariant,
                  padding: '0.65rem',
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '0.85rem',
                  cursor: links.length >= 5 ? 'not-allowed' : 'pointer',
                  textAlign: 'center',
                }}
              >
                ＋ Adicionar link ({links.length}/5)
              </button>
            </div>
          </div>
        )}

        {/* ══ Tab 3: Quem Somos ══ */}
        {activeTab === 'about' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={sectionTitleStyle}>Quem Somos</h2>
              <p style={sectionSubtitleStyle}>Bio, vídeo e galeria de imagens exibidos no perfil público.</p>
            </div>

            <div style={cardStyle}>
              {/* Toggle */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.25rem',
                paddingBottom: '1rem',
                borderBottom: `1px solid ${T.outlineVariant}`,
              }}>
                <div>
                  <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600, color: T.onSurface, fontSize: '0.92rem' }}>
                    Exibir seção Quem Somos
                  </div>
                  <div style={{ fontSize: '0.78rem', color: T.onSurfaceVariant, marginTop: 2 }}>
                    {aboutEnabled ? 'Visível no perfil público' : 'Oculto no perfil público'}
                  </div>
                </div>
                <Toggle checked={aboutEnabled} onChange={setAboutEnabled} />
              </div>

              {aboutEnabled && (
                <div>
                  {/* Bio */}
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Narrativa / Bio</label>
                    <textarea
                      value={aboutBio}
                      onChange={(e) => setAboutBio(e.target.value)}
                      placeholder="Escreva sobre sua trajetória..."
                      style={{
                        ...inputStyle,
                        minHeight: 140,
                        resize: 'vertical',
                        lineHeight: 1.55,
                      }}
                    />
                  </div>

                  {/* Video */}
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Vídeo (YouTube)</label>
                    <input
                      type="url"
                      value={aboutVideo}
                      onChange={(e) => setAboutVideo(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                      style={inputStyle}
                    />
                    <p style={{ margin: '0.3rem 0 0', fontSize: '0.72rem', color: T.onSurfaceVariant }}>
                      Opcional — será incorporado como player no perfil público
                    </p>
                  </div>

                  {/* Gallery */}
                  <div style={formGroupStyle}>
                    <label style={labelStyle}>Galeria de Imagens — Máx 3</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {aboutImages.map((img, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {img && (
                            <img
                              src={img}
                              alt={`Galeria ${idx + 1}`}
                              style={{
                                height: 30,
                                width: 50,
                                objectFit: 'contain',
                                borderRadius: 3,
                                background: T.surfaceHigh,
                                flexShrink: 0,
                                border: `1px solid ${T.outlineVariant}`,
                              }}
                            />
                          )}
                          <input
                            type="url"
                            value={img}
                            onChange={(e) => {
                              const next = [...aboutImages];
                              next[idx] = e.target.value;
                              setAboutImages(next);
                            }}
                            placeholder={`Imagem ${idx + 1} — https://...`}
                            style={{ ...inputStyle, flex: 1 }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {!aboutEnabled && (
                <p style={{ color: T.onSurfaceVariant, fontSize: '0.85rem', margin: 0 }}>
                  Este módulo está oculto no perfil público. Ative o toggle acima para configurá-lo.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ══ Tab 4: Visual ══ */}
        {activeTab === 'visual' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={sectionTitleStyle}>Paleta de Cores</h2>
              <p style={sectionSubtitleStyle}>
                Essas cores são aplicadas no catálogo, perfil público e no poster de vídeo do cliente.
              </p>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              <button
                type="button"
                onClick={handleGenerateFromPrimary}
                style={{
                  background: 'transparent',
                  color: T.primary,
                  border: `1px solid ${T.outlineVariant}`,
                  borderRadius: 3,
                  padding: '0.5rem 1rem',
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                ✦ Gerar paleta automática
              </button>
              {logoUrl && (
                <button
                  type="button"
                  onClick={handleExtractFromLogo}
                  disabled={extractingFromLogo}
                  style={{
                    background: 'transparent',
                    color: T.onSurfaceVariant,
                    border: `1px solid ${T.outlineVariant}`,
                    borderRadius: 3,
                    padding: '0.5rem 1rem',
                    fontFamily: 'Manrope, sans-serif',
                    fontSize: '0.82rem',
                    cursor: extractingFromLogo ? 'not-allowed' : 'pointer',
                    opacity: extractingFromLogo ? 0.6 : 1,
                  }}
                >
                  {extractingFromLogo ? 'Detectando...' : 'Detectar da logo'}
                </button>
              )}
            </div>

            {colorMsg && (
              <div style={{
                background: colorMsg.startsWith('Erro') || colorMsg.startsWith('Não') ? `${T.danger}18` : `${T.success}18`,
                border: `1px solid ${colorMsg.startsWith('Erro') || colorMsg.startsWith('Não') ? T.danger + '44' : T.success + '44'}`,
                borderRadius: 4,
                padding: '0.65rem 0.85rem',
                fontSize: '0.82rem',
                color: colorMsg.startsWith('Erro') || colorMsg.startsWith('Não') ? T.danger : T.success,
                marginBottom: '1rem',
                fontFamily: 'Manrope, sans-serif',
              }}>
                {colorMsg}
              </div>
            )}

            {/* Color grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '0.65rem',
            }}>
              {COLOR_FIELDS.map((field) => (
                <div key={field.key} style={{
                  background: T.surface,
                  border: `1px solid ${T.outlineVariant}`,
                  borderRadius: 8,
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}>
                  {/* Color swatch */}
                  <div style={{
                    position: 'relative',
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: colors[field.key] || '#444',
                    cursor: 'pointer',
                    flexShrink: 0,
                    border: `2px solid ${T.outlineVariant}`,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                  }}>
                    <input
                      type="color"
                      value={(colors[field.key] && colors[field.key].startsWith('#') && colors[field.key].length >= 4) ? colors[field.key] : '#000000'}
                      onChange={(e) => handleColorChange(field.key, e.target.value)}
                      style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', borderRadius: '50%' }}
                    />
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: T.onSurface, marginBottom: 2 }}>{field.label}</div>
                    <div style={{ fontSize: '0.72rem', color: T.onSurfaceVariant, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{field.hint}</div>
                  </div>
                  {/* Hex input */}
                  <input
                    type="text"
                    value={colors[field.key] || ''}
                    onChange={(e) => handleColorChange(field.key, e.target.value)}
                    placeholder="#hex"
                    style={{
                      width: 82,
                      background: T.surfaceHighest,
                      border: 'none',
                      borderRadius: 3,
                      color: T.onSurface,
                      padding: '4px 8px',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      flexShrink: 0,
                      outline: 'none',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ Tab 5: Layout ══ */}
        {activeTab === 'layout' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={sectionTitleStyle}>Ordem das Seções</h2>
              <p style={sectionSubtitleStyle}>Use as setas para definir a ordem de exibição no perfil público.</p>
            </div>

            <div style={cardStyle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {sectionsOrder.map((key, idx) => {
                  const section = SECTION_LABELS[key] || { icon: 'widgets', label: key, hint: '' };
                  return (
                    <div key={key} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.85rem',
                      background: T.surfaceHigh,
                      border: `1px solid ${T.outlineVariant}`,
                      borderLeft: `3px solid ${T.primaryCt}`,
                      borderRadius: 4,
                      padding: '0.75rem 0.85rem',
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: T.primaryCt, flexShrink: 0, fontVariationSettings: "'FILL' 0, 'wght' 400" }}>
                        {section.icon}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600, color: T.onSurface, fontSize: '0.88rem' }}>
                          {section.label}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: T.onSurfaceVariant }}>
                          {section.hint}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveSection(idx, -1)}
                          style={{
                            background: 'transparent',
                            color: T.onSurfaceVariant,
                            border: `1px solid ${T.outlineVariant}`,
                            borderRadius: 3,
                            padding: '0.3rem 0.55rem',
                            fontFamily: 'Manrope, sans-serif',
                            fontSize: '0.75rem',
                            cursor: idx === 0 ? 'not-allowed' : 'pointer',
                            opacity: idx === 0 ? 0.3 : 1,
                          }}
                          aria-label="Mover para cima"
                        >▲</button>
                        <button
                          type="button"
                          disabled={idx === sectionsOrder.length - 1}
                          onClick={() => moveSection(idx, 1)}
                          style={{
                            background: 'transparent',
                            color: T.onSurfaceVariant,
                            border: `1px solid ${T.outlineVariant}`,
                            borderRadius: 3,
                            padding: '0.3rem 0.55rem',
                            fontFamily: 'Manrope, sans-serif',
                            fontSize: '0.75rem',
                            cursor: idx === sectionsOrder.length - 1 ? 'not-allowed' : 'pointer',
                            opacity: idx === sectionsOrder.length - 1 ? 0.3 : 1,
                          }}
                          aria-label="Mover para baixo"
                        >▼</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Fixed bottom bar (mobile save button) ── */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: `${T.bg}ee`,
        backdropFilter: 'blur(16px)',
        borderTop: `1px solid ${T.outlineVariant}`,
        padding: '0.75rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        zIndex: 100,
      }}>
        <div style={{ fontSize: '0.8rem' }}>
          {saved && <span style={{ color: T.success }}>Alterações publicadas.</span>}
          {saveError && <span style={{ color: T.danger }}>{saveError}</span>}
          {saving && <span style={{ color: T.onSurfaceVariant }}>Publicando...</span>}
        </div>
        <SaveButton compact />
      </div>

      {/* Inline style to hide desktop save button on mobile and vice versa */}
      <style>{`
        @media (max-width: 600px) {
          .hub-topbar-actions { display: none !important; }
        }
      `}</style>
    </div>
  );
}
