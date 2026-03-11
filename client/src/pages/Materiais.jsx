import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API } from '../api';
import AnimacaoCaracteristicas from '../components/AnimacaoCaracteristicas';

const MATERIAIS_BASE = 'https://firemode.s3.us-east-1.amazonaws.com/firemode/imob';

function formatSize(bytes) {
  if (bytes == null || bytes === 0) return '—';
  const n = Number(bytes);
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
}

function formatMtime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

/** Agrupa items por pasta: "frames" | "videos" | "" (raiz). */
function groupItemsByFolder(items) {
  const groups = { frames: [], videos: [], _root: [] };
  (items || []).forEach((item) => {
    const path = (item.path || item.name || '').trim();
    const parts = path.split('/').filter(Boolean);
    const name = parts[parts.length - 1] || item.name || '';
    const parent = parts.length >= 2 ? parts[parts.length - 2] : '';
    const key = parent === 'frames' ? 'frames' : parent === 'videos' ? 'videos' : '_root';
    groups[key].push({ ...item, _displayName: name });
  });
  return groups;
}

function ElementosList({ folderListing, folderBaseUrl, baseUrl }) {
  const fileBase = folderBaseUrl || baseUrl || '';
  const allItems = (folderListing || []).flatMap((entry) => entry.items || []);
  const { frames, videos, _root } = groupItemsByFolder(allItems);

  const [open, setOpen] = useState({ frames: false, videos: false, arquivos: false });
  const toggle = (key) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const renderSection = (sectionKey, title, items) => {
    const fileItems = items.filter((i) => i.type === 'file');
    const dirItems = items.filter((i) => i.type === 'dir');
    if (fileItems.length === 0 && dirItems.length === 0) return null;
    const isOpen = open[sectionKey];
    const count = fileItems.length + dirItems.length;
    return (
      <section key={sectionKey} style={{ marginBottom: '0.5rem', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => toggle(sectionKey)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            padding: '0.5rem 0.75rem',
            border: 'none',
            background: 'var(--bg)',
            cursor: 'pointer',
            fontSize: '0.95rem',
            textAlign: 'left',
          }}
        >
          <span>{title}</span>
          <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>({count})</span>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 20, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
          >
            expand_more
          </span>
        </button>
        {isOpen && (
          <div style={{ padding: '0 0.75rem 0.75rem', borderTop: '1px solid var(--border)' }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0' }}>
              {dirItems.map((item) => (
                <li key={item.path || item.name} style={{ padding: '0.25rem 0', fontSize: '0.9rem', color: 'var(--muted)' }}>
                  <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 4, fontSize: 18 }}>folder</span>
                  {item.name}
                </li>
              ))}
              {fileItems.map((item) => {
                const displayName = item._displayName || item.name;
                const path = (item.path || item.name || '').trim();
                const href = fileBase && path ? (fileBase.replace(/\/?$/, '/') + path.replace(/^\//, '')) : null;
                return (
                  <li key={item.path || item.name} style={{ padding: '0.35rem 0', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className="material-symbols-outlined" style={{ flexShrink: 0, fontSize: 18, color: 'var(--muted)' }}>description</span>
                    <span style={{ minWidth: 0 }} title={path}>{displayName}</span>
                    <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{formatSize(item.size)}</span>
                    <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{formatMtime(item.mtime)}</span>
                    {href && (
                      <a href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.85rem' }}>Abrir</a>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {renderSection('frames', 'Frames', frames)}
      {renderSection('videos', 'Vídeos', videos)}
      {renderSection('arquivos', 'Arquivos', _root)}
    </div>
  );
}

function getAvailableMedia(folderListing) {
  const allItems = (folderListing || []).flatMap((entry) => entry.items || []).filter((i) => i.type === 'file');
  const videos = allItems.filter((i) => (i.name || '').toLowerCase().endsWith('.mp4')).map((i) => (i.path || i.name || '').trim()).filter(Boolean);
  const audios = allItems.filter((i) => (i.name || '').toLowerCase().endsWith('.mp3')).map((i) => (i.path || i.name || '').trim()).filter(Boolean);
  return { videos, audios };
}

function TimelineEditor({ listingId, listing, folderListing, folderBaseUrl }) {
  const { videos: availableVideos, audios: availableAudios } = getAvailableMedia(folderListing);
  const defaultOutputPath = listing
    ? `imob/${(listing.imobname || '').replace(/\//g, '-')}/${listing.advertiserCode || 'out'}/videos/merged.mp4`
    : 'imob/out/videos/merged.mp4';

  const [videoTrack, setVideoTrack] = useState([]);
  const [audioTrack, setAudioTrack] = useState([]);
  const [outputPath, setOutputPath] = useState(defaultOutputPath);
  const [renderStatus, setRenderStatus] = useState(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const videoRef = useRef(null);
  const audioRef = useRef(null);

  const base = (folderBaseUrl || '').replace(/\/?$/, '/');
  const videoUrls = videoTrack.map((p) => base + p.replace(/^\//, ''));
  const audioUrls = audioTrack.map((p) => base + p.replace(/^\//, ''));
  const hasPreview = videoUrls.length > 0;

  useEffect(() => {
    if (hasPreview && videoRef.current) {
      videoRef.current.play().catch(function () {});
    }
  }, [currentVideoIndex, hasPreview]);

  const addToTrack = (track, path) => {
    if (track === 'video') setVideoTrack((prev) => [...prev, path]);
    else setAudioTrack((prev) => [...prev, path]);
  };
  const removeFromTrack = (track, index) => {
    if (track === 'video') setVideoTrack((prev) => prev.filter((_, i) => i !== index));
    else setAudioTrack((prev) => prev.filter((_, i) => i !== index));
  };
  const moveTrackItem = (track, index, dir) => {
    const setter = track === 'video' ? setVideoTrack : setAudioTrack;
    setter((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const handleRender = async () => {
    if (videoTrack.length === 0) {
      setRenderStatus({ error: 'Adicione pelo menos um vídeo na timeline.' });
      return;
    }
    setRenderStatus({ loading: true });
    try {
      const res = await fetch(`${API}/listings/${listingId}/render-merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: videoTrack, outputPath }),
      });
      const text = await res.text();
      if (!res.ok) {
        setRenderStatus({ error: text || `Erro ${res.status}` });
        return;
      }
      setRenderStatus({ success: true, message: text || 'Enviado para renderizar.' });
    } catch (e) {
      setRenderStatus({ error: e.message });
    }
  };

  const renderTrack = (title, track, trackKey, available, icon) => (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <strong style={{ fontSize: '0.9rem' }}>{title}</strong>
        {available.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              const path = e.target.value;
              if (path) addToTrack(trackKey, path), (e.target.value = '');
            }}
            style={{ fontSize: '0.85rem', padding: '0.25rem 0.5rem' }}
          >
            <option value="">+ Adicionar</option>
            {available.map((path) => (
              <option key={path} value={path}>{path.split('/').pop()}</option>
            ))}
          </select>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', minHeight: 36, padding: '0.5rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
        {track.length === 0 ? (
          <span className="muted" style={{ fontSize: '0.85rem' }}>Nenhum item. Adicione acima.</span>
        ) : (
          track.map((path, i) => (
            <span
              key={`${path}-${i}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '0.25rem 0.5rem',
                background: 'var(--card-bg)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: '0.85rem',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--muted)' }}>{icon}</span>
              <span title={path} style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{path.split('/').pop()}</span>
              <button type="button" onClick={() => moveTrackItem(trackKey, i, -1)} disabled={i === 0} style={{ padding: 2, border: 'none', background: 'none', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.4 : 1 }} aria-label="Subir">↑</button>
              <button type="button" onClick={() => moveTrackItem(trackKey, i, 1)} disabled={i === track.length - 1} style={{ padding: 2, border: 'none', background: 'none', cursor: i === track.length - 1 ? 'default' : 'pointer', opacity: i === track.length - 1 ? 0.4 : 1 }} aria-label="Descer">↓</button>
              <button type="button" onClick={() => removeFromTrack(trackKey, i)} style={{ padding: 2, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)' }} aria-label="Remover">×</button>
            </span>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Timeline / Editor</h3>
      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
        Ordene vídeos e áudios e envie para renderizar (FFmpeg).
      </p>
      {renderTrack('Vídeos (ordem de concatenação)', videoTrack, 'video', availableVideos, 'movie')}
      {renderTrack('Áudios', audioTrack, 'audio', availableAudios, 'graphic_eq')}
      {hasPreview && (
        <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <strong style={{ fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem' }}>Preview</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 280px', maxWidth: 360 }}>
              <video
                ref={videoRef}
                key={currentVideoIndex}
                src={videoUrls[currentVideoIndex]}
                controls
                style={{ width: '100%', borderRadius: 8, background: '#000' }}
                onEnded={() => {
                  if (currentVideoIndex + 1 < videoUrls.length) setCurrentVideoIndex((i) => i + 1);
                }}
              />
              <p className="muted" style={{ marginTop: '0.35rem', fontSize: '0.8rem' }}>
                Vídeo {currentVideoIndex + 1} de {videoUrls.length}
              </p>
            </div>
            {audioUrls.length > 0 && (
              <div style={{ flex: '0 1 200px' }}>
                <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>Narração / áudio</label>
                <audio ref={audioRef} controls src={audioUrls[0]} style={{ width: '100%', maxWidth: 280 }} />
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn"
            style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}
            onClick={() => {
              setCurrentVideoIndex(0);
              setTimeout(() => {
                videoRef.current?.play();
                if (audioUrls.length > 0) audioRef.current?.play();
              }, 100);
            }}
          >
            Reproduzir do início
          </button>
        </div>
      )}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Caminho de saída (outputPath)</label>
        <input
          type="text"
          value={outputPath}
          onChange={(e) => setOutputPath(e.target.value)}
          placeholder="imob/Imob/REF/videos/merged.mp4"
          style={{ width: '100%', maxWidth: 480, padding: '0.5rem', fontSize: '0.9rem' }}
        />
      </div>
      <button type="button" className="btn" onClick={handleRender} disabled={renderStatus?.loading}>
        {renderStatus?.loading ? 'Enviando…' : 'Renderizar no FFmpeg'}
      </button>
      {renderStatus?.error && <p style={{ color: 'var(--danger)', marginTop: '0.5rem', fontSize: '0.9rem' }}>{renderStatus.error}</p>}
      {renderStatus?.success && <p style={{ color: 'var(--success)', marginTop: '0.5rem', fontSize: '0.9rem' }}>{renderStatus.message}</p>}
    </div>
  );
}

export default function Materiais() {
  const { id, clientId } = useParams();
  const [listing, setListing] = useState(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [files, setFiles] = useState({ videos: [], narration: [], music: [] });
  const [folderListing, setFolderListing] = useState(null);
  const [folderBaseUrl, setFolderBaseUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [animacaoKey, setAnimacaoKey] = useState(0);
  const [posterLayout, setPosterLayout] = useState('classic');
  const [animBg, setAnimBg] = useState('#f5f5f5');
  const [animItemsPerRow, setAnimItemsPerRow] = useState(3);
  const [animIconSize, setAnimIconSize] = useState(28);
  const [refreshing, setRefreshing] = useState(false);

  const loadMateriais = (refresh = false) => {
    if (!id) return;
    if (!refresh) {
      setLoading(true);
      setError(null);
      setListing(null);
      setBaseUrl('');
      setFiles({ videos: [], narration: [], music: [] });
      setFolderListing(null);
      setFolderBaseUrl('');
    } else {
      setRefreshing(true);
    }
    const url = API + '/listings/' + id + '/materiais?t=' + Date.now() + (refresh ? '&refresh=1' : '');
    fetch(url, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setListing(data.listing);
        setBaseUrl(data.baseUrl || '');
        setFiles(data.files || { videos: [], narration: [], music: [] });
        setFolderListing(data.folderListing ?? null);
        setFolderBaseUrl(data.folderBaseUrl || '');
      })
      .catch((e) => setError(e.message))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    if (!id) return;
    loadMateriais(false);
  }, [id]);

  const advertiserCode = listing?.advertiserCode;
  const fallbackBaseUrl = advertiserCode ? `${MATERIAIS_BASE}/${encodeURIComponent(advertiserCode)}/` : '';

  if (loading) {
    return (
      <>
        <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
          <Link to="/">Dashboard</Link>
          <span style={{ margin: '0 0.5rem', color: 'var(--muted)' }}>→</span>
          {clientId && <Link to={'/cliente/' + clientId + '/area'}>Cliente</Link>}
          {clientId && <span style={{ margin: '0 0.5rem', color: 'var(--muted)' }}>→</span>}
          <span>Materiais</span>
        </div>
        <div className="card" style={{ padding: '2rem', textAlign: 'center', maxWidth: 420, margin: '2rem auto' }}>
          <div
            className="loading-spinner"
            style={{
              width: 40,
              height: 40,
              border: '3px solid var(--border)',
              borderTopColor: 'var(--accent)',
              borderRadius: '50%',
              margin: '0 auto 1rem',
            }}
          />
          <p className="muted" style={{ margin: 0 }}>Carregando materiais…</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: 'var(--muted)' }}>
            Na primeira vez o webhook pode ser consultado; depois os dados ficam em cache até você clicar em &quot;Atualizar listagem&quot;.
          </p>
        </div>
      </>
    );
  }

  if (error || !listing) {
    return (
      <>
        <div style={{ marginBottom: '1rem' }}>
          <Link to="/">Dashboard</Link>
          <span style={{ margin: '0 0.5rem', color: 'var(--muted)' }}>→</span>
          <span>Materiais</span>
        </div>
        <p style={{ color: 'var(--danger)' }}>{error || 'Anúncio não encontrado.'}</p>
      </>
    );
  }

  const urlBase = baseUrl || fallbackBaseUrl;
  const videoUrls = (files.videos || []).map((f) => (f.startsWith('http') ? f : urlBase + f));
  const narrationUrls = (files.narration || []).map((f) => (f.startsWith('http') ? f : urlBase + f));
  const musicUrls = (files.music || []).map((f) => (f.startsWith('http') ? f : urlBase + f));

  return (
    <>
      <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
        <Link to="/">Dashboard</Link>
        <span style={{ margin: '0 0.5rem', color: 'var(--muted)' }}>→</span>
        {clientId && (
          <>
            <Link to={'/cliente/' + clientId + '/area'}>Cliente</Link>
            <span style={{ margin: '0 0.5rem', color: 'var(--muted)' }}>→</span>
            <Link to={'/cliente/' + clientId + '/produto/' + id}>Produto</Link>
            <span style={{ margin: '0 0.5rem', color: 'var(--muted)' }}>→</span>
          </>
        )}
        <span>Materiais</span>
      </div>

      <h1 style={{ marginBottom: '1.5rem' }}>Materiais gerados</h1>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(320px, 2fr) 380px 380px',
          gap: '1.5rem',
          alignItems: 'start',
        }}
        className="materiais-layout"
      >
        {/* Coluna 1: Materiais (lista de pastas/arquivos ou S3) */}
        <div className="card">
          <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            Elementos disponíveis
            <button
              type="button"
              className="btn"
              style={{ fontSize: '0.85rem' }}
              disabled={refreshing}
              onClick={() => loadMateriais(true)}
            >
              {refreshing ? 'Atualizando…' : 'Atualizar listagem'}
            </button>
          </h3>
          {folderListing && folderListing.length > 0 ? (
            <ElementosList folderListing={folderListing} folderBaseUrl={folderBaseUrl} baseUrl={urlBase} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <section>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Vídeos (sequência)</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {videoUrls.length === 0 ? (
                    <li className="muted" style={{ fontSize: '0.9rem' }}>Nenhum vídeo listado. Adicione manifest.json na pasta do S3.</li>
                  ) : (
                    videoUrls.map((url, i) => (
                      <li key={i} style={{ marginBottom: '0.5rem' }}>
                        <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.9rem' }}>Vídeo {i + 1}</a>
                      </li>
                    ))
                  )}
                </ul>
              </section>
              <section>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Narração (MP3)</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {narrationUrls.length === 0 ? (
                    <li className="muted" style={{ fontSize: '0.9rem' }}>Nenhum arquivo de narração.</li>
                  ) : (
                    narrationUrls.map((url, i) => (
                      <li key={i}>
                        <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.9rem' }}>Narração {i + 1}</a>
                      </li>
                    ))
                  )}
                </ul>
              </section>
              <section>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Música de fundo (MP3)</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {musicUrls.length === 0 ? (
                    <li className="muted" style={{ fontSize: '0.9rem' }}>Nenhum arquivo de música.</li>
                  ) : (
                    musicUrls.map((url, i) => (
                      <li key={i}>
                        <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.9rem' }}>Música {i + 1}</a>
                      </li>
                    ))
                  )}
                </ul>
              </section>
            </div>
          )}
        </div>

        {/* Coluna 2: Características do imóvel + animação + editor */}
        <div className="card materiais-col-phone">
          <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Características do imóvel</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            Animação 5s — poster 1080×1920.
          </p>
          <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 600 }}>Disposição das informações</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {[
              { id: 'classic', label: 'Clássico' },
              { id: 'compact', label: 'Compacto' },
              { id: 'destaque', label: 'Destaque preço' },
              { id: 'minimal', label: 'Minimal' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="btn"
                style={{
                  fontSize: '0.8rem',
                  padding: '0.4rem 0.75rem',
                  background: posterLayout === opt.id ? 'var(--primary)' : 'var(--bg)',
                  color: posterLayout === opt.id ? '#fff' : 'var(--text)',
                  border: '1px solid var(--border)',
                }}
                onClick={() => setPosterLayout(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Link
              to={clientId ? `/cliente/${clientId}/produto/${id}/poster-video` : `/poster-video/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '0.85rem' }}
            >
              Abrir tela para gravar vídeo (MP4)
            </Link>
            <span style={{ color: 'var(--muted)' }}>·</span>
            <button
              type="button"
              className="btn"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
              onClick={() => {
                const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
                const path = `${base}/poster-video/${id}?capture=1`;
                const url = path.startsWith('http') ? path : `${window.location.origin}${path}`;
                window.open(url, 'poster-capture', 'width=1100,height=1940,scrollbars=yes,resizable=yes');
              }}
            >
              Enviar frames ao webhook
            </button>
          </div>

          {/* Moldura celular 9:16 (1080×1920) — poster completo */}
          <div
            className="materiais-phone-frame"
            style={{
              width: '100%',
              maxWidth: 360,
              margin: '0 auto',
              aspectRatio: '9 / 16',
              background: '#111',
              borderRadius: 24,
              padding: 10,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 14,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                background: animBg,
              }}
            >
              {/* Área do poster: max 1080px, preenche a largura do visor */}
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  overflow: 'hidden',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  background: animBg,
                }}
              >
                <AnimacaoCaracteristicas
                  key={animacaoKey}
                  listing={listing}
                  onEnd={() => {}}
                  backgroundColor={animBg}
                  itemsPerRow={animItemsPerRow}
                  iconSize={animIconSize}
                  layout={posterLayout}
                />
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn"
            style={{ marginTop: '1rem', width: '100%' }}
            onClick={() => setAnimacaoKey((k) => k + 1)}
          >
            Reproduzir novamente
          </button>
        </div>

        {/* Coluna 3: Visor celular (9:16) - vídeos em sequência */}
        <div className="card materiais-col-phone" style={{ position: 'sticky', top: '1rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Visor (celular)</h3>
          <div
            className="materiais-phone-frame"
            style={{
              width: '100%',
              maxWidth: 360,
              margin: '0 auto',
              aspectRatio: '9 / 16',
              background: '#111',
              borderRadius: 24,
              padding: 10,
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                background: 'var(--bg)',
                borderRadius: 16,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {videoUrls.length > 0 ? (
                <video
                  key={currentVideoIndex}
                  src={videoUrls[currentVideoIndex]}
                  controls
                  autoPlay
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  onEnded={() => setCurrentVideoIndex((i) => (i + 1) % videoUrls.length)}
                />
              ) : (
                <p className="muted" style={{ textAlign: 'center', padding: 16, fontSize: '0.9rem' }}>
                  Nenhum vídeo para exibir em sequência.
                </p>
              )}
            </div>
          </div>
          {videoUrls.length > 1 && (
            <p className="muted" style={{ marginTop: '0.5rem', fontSize: '0.85rem', textAlign: 'center' }}>
              Vídeo {currentVideoIndex + 1} de {videoUrls.length} — reprodução em sequência
            </p>
          )}
        </div>
      </div>

      {folderListing && folderListing.length > 0 && (
        <TimelineEditor listingId={id} listing={listing} folderListing={folderListing} folderBaseUrl={folderBaseUrl} />
      )}

      <p style={{ marginTop: '1rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
        Para listar arquivos automaticamente, coloque um <code>manifest.json</code> na pasta do S3 com a estrutura:{' '}
        <code>{'{"videos":["a.mp4","b.mp4"],"narration":["narracao.mp3"],"music":["fundo.mp3"]}'}</code>
      </p>
    </>
  );
}
