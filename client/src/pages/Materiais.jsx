import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API } from '../api';
import AnimacaoCaracteristicas from '../components/AnimacaoCaracteristicas';
import PageHeader from '../components/PageHeader';
import { buildPalette } from '../lib/dominantColor';

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

const REMOTION_ANIMATIONS = [
  { id: 'op1', label: 'Op. 1', hint: 'Boxes + carrossel + infos (sem legenda na tela)' },
  { id: 'op2', label: 'Op. 2', hint: 'Slideshow + infos + legenda SRT' },
  { id: 'op3', label: 'Op. 3', hint: 'Barra superior + vidro + legenda SRT' },
  { id: 'op4', label: 'Op. 4', hint: 'Abertura + slideshow + legenda SRT' },
  { id: 'op5', label: 'Op. 5', hint: 'Painel vidro compacto (sem legenda na tela)' },
  { id: 'op6', label: 'Op. 6', hint: 'Card flyer + cores design_config (sem legenda na tela)' },
];

function RemotionRenderPanel({ listingId, listing }) {
  const [animation, setAnimation] = useState('op3');
  const [subtitlesSrt, setSubtitlesSrt] = useState('');
  const [openSrt, setOpenSrt] = useState(false);
  const [status, setStatus] = useState(null);

  const handleRender = async () => {
    setStatus({ loading: true });
    try {
      const res = await fetch(`${API}/listings/${listingId}/remotion-render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          animation,
          subtitlesSrt: subtitlesSrt.trim() || undefined,
        }),
      });
      const ct = res.headers.get('content-type') || '';
      if (!res.ok) {
        let errMsg = `Erro ${res.status}`;
        try {
          if (ct.includes('application/json')) {
            const j = await res.json();
            if (j && typeof j.error === 'string') errMsg = j.error;
          } else {
            const t = await res.text();
            if (t) errMsg = t;
          }
        } catch (_) {}
        setStatus({ error: errMsg });
        return;
      }

      // Se retornou JSON (webhook configurado) → exibe confirmação
      if (ct.includes('application/json')) {
        const j = await res.json();
        if (j?.queued) {
          setStatus({ success: true, queued: true, message: `✓ Vídeo "${j.filename || 'remotion.mp4'}" enviado para o n8n. Ele será salvo na pasta de vídeos do imóvel.` });
          return;
        }
      }

      // Fallback: download direto (sem webhook)
      const blob = await res.blob();
      const code = listing?.advertiserCode || listingId;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `remotion-${code}-${animation}.mp4`;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
      setStatus({ success: true, message: 'Download do MP4 iniciado.' });
    } catch (e) {
      setStatus({ error: e.message || 'Falha na requisição' });
    }
  };

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Vídeo Remotion (templates)</h3>
      <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
        Gera MP4 no servidor Remotion com os dados deste imóvel (fotos, preço, cards, comodidades, logo/contatos do cliente).
        O render pode levar vários minutos — aguarde sem fechar a página.
      </p>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.35rem' }}>Animação</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {REMOTION_ANIMATIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="btn"
              title={opt.hint}
              style={{
                fontSize: '0.8rem',
                padding: '0.4rem 0.65rem',
                background: animation === opt.id ? 'var(--primary)' : 'var(--bg)',
                color: animation === opt.id ? '#fff' : 'var(--text)',
                border: '1px solid var(--border)',
              }}
              onClick={() => setAnimation(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.8rem' }}>
          {REMOTION_ANIMATIONS.find((o) => o.id === animation)?.hint}
        </p>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className="btn"
          style={{ fontSize: '0.85rem', padding: '0.35rem 0.6rem' }}
          onClick={() => setOpenSrt((v) => !v)}
        >
          {openSrt ? 'Ocultar' : 'Opcional:'} legenda SRT (op2–op4 exibem na tela)
        </button>
        {openSrt && (
          <textarea
            value={subtitlesSrt}
            onChange={(e) => setSubtitlesSrt(e.target.value)}
            placeholder={'1\n00:00:00,000 --> 00:00:03,000\nTexto da legenda.\n'}
            rows={8}
            style={{
              display: 'block',
              width: '100%',
              maxWidth: 560,
              marginTop: '0.5rem',
              padding: '0.5rem',
              fontSize: '0.85rem',
              fontFamily: 'monospace',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
            }}
          />
        )}
      </div>
      <button type="button" className="btn btn-primary" onClick={handleRender} disabled={status?.loading}
        style={{ fontSize: '0.88rem' }}>
        {status?.loading ? '⏳ Renderizando… aguarde sem fechar' : '▶ Gerar vídeo Remotion'}
      </button>
      {status?.loading && (
        <p style={{ color: 'var(--muted)', marginTop: '0.5rem', fontSize: '0.82rem' }}>
          O render pode levar de 2 a 10 minutos dependendo da animação. Não feche essa aba.
        </p>
      )}
      {status?.error && (
        <p style={{ color: 'var(--danger)', marginTop: '0.5rem', fontSize: '0.88rem' }}>{status.error}</p>
      )}
      {status?.success && (
        <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(39,103,73,0.08)', border: '1px solid rgba(39,103,73,0.3)', borderRadius: 6, fontSize: '0.88rem', color: 'var(--success)' }}>
          {status.message}
        </div>
      )}
    </div>
  );
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
  const [sendingFrames, setSendingFrames] = useState(false);
  const [framesMessage, setFramesMessage] = useState(null);
  const [videoColors, setVideoColors] = useState({});
  const [savingColors, setSavingColors] = useState(false);
  const [colorsMsg, setColorsMsg] = useState(null);

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
        const dc = data.listing?.client?.design_config || {};
        // Inicializa com as 2 cores base; o restante é derivado por buildPalette
        const brand  = dc['--primary']    || '#1152d4';
        const accent = dc['--contact-bg'] || '#0a1e4a';
        setVideoColors(buildPalette(brand, accent));
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

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const d = event.data;
      if (d?.type !== 'poster-frames-done') return;
      setSendingFrames(false);
      if (d.error) setFramesMessage('Erro: ' + d.error);
      else setFramesMessage(`Pronto. ${d.frames_sent ?? 0} frames enviados (layout: ${d.layout ?? posterLayout}).`);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [posterLayout]);

  const advertiserCode = listing?.advertiserCode;
  const fallbackBaseUrl = advertiserCode ? `${MATERIAIS_BASE}/${encodeURIComponent(advertiserCode)}/` : '';

  const breadcrumbs = [
    { label: 'Dashboard', to: '/' },
    ...(clientId ? [{ label: 'Cliente', to: '/cliente/' + clientId + '/hub' }] : []),
    ...(clientId && id ? [{ label: 'Produção', to: '/cliente/' + clientId + '/produto/' + id }] : []),
    { label: 'Materiais gerados' },
  ];

  if (loading) {
    return (
      <>
        <PageHeader title="Materiais gerados" breadcrumbs={breadcrumbs} />
        <div className="card" style={{ padding: '2rem', textAlign: 'center', maxWidth: 420 }}>
          <div className="loading-spinner" style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--gold)', borderRadius: '50%', margin: '0 auto 1rem' }} />
          <p className="muted" style={{ margin: 0 }}>Carregando materiais…</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: 'var(--muted)' }}>
            Na primeira vez o webhook pode ser consultado; depois os dados ficam em cache.
          </p>
        </div>
      </>
    );
  }

  if (error || !listing) {
    return (
      <>
        <PageHeader title="Materiais gerados" breadcrumbs={breadcrumbs} />
        <div className="card" style={{ borderColor: 'var(--danger)', padding: '1.25rem' }}>
          <p style={{ color: 'var(--danger)', margin: 0, fontSize: '0.9rem' }}>{error || 'Anúncio não encontrado.'}</p>
        </div>
      </>
    );
  }

  const urlBase = baseUrl || fallbackBaseUrl;

  // Listing com cores locais aplicadas (para o preview refletir mudanças antes de salvar)
  const effectiveListing = listing && Object.keys(videoColors).some(k => videoColors[k])
    ? { ...listing, client: { ...listing.client, design_config: { ...(listing.client?.design_config || {}), ...videoColors } } }
    : listing;

  const handleSaveVideoColors = async () => {
    if (!clientId) return;
    setSavingColors(true);
    setColorsMsg(null);
    try {
      const existing = listing?.client?.design_config || {};
      const merged = { ...existing };
      Object.entries(videoColors).forEach(([k, v]) => { if (v) merged[k] = v; });
      const res = await fetch(API + '/clients/' + clientId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design_config: merged }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setColorsMsg('Cores salvas!');
    } catch (e) {
      setColorsMsg('Erro: ' + e.message);
    } finally {
      setSavingColors(false);
    }
  };

  const videoUrls = (files.videos || []).map((f) => (f.startsWith('http') ? f : urlBase + f));
  const narrationUrls = (files.narration || []).map((f) => (f.startsWith('http') ? f : urlBase + f));
  const musicUrls = (files.music || []).map((f) => (f.startsWith('http') ? f : urlBase + f));

  return (
    <>
      <PageHeader
        title="Materiais gerados"
        subtitle={listing?.title ? listing.title.slice(0, 70) + (listing.title.length > 70 ? '…' : '') : undefined}
        breadcrumbs={breadcrumbs}
      />

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
              { id: 'classic', label: 'Opção 1' },
              { id: 'cards', label: 'Opção 2' },
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
          {/* Cores do vídeo — 2 cores, resto automático */}
          <details style={{ marginBottom: '0.75rem', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            <summary style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, background: 'var(--bg)', userSelect: 'none' }}>
              Cores do vídeo
            </summary>
            <div style={{ padding: '0.75rem' }}>
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', color: 'var(--muted)' }}>
                Defina 2 cores — tudo mais é gerado automaticamente.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                {[
                  { key: '--primary',    label: 'Cor de Marca',    hint: 'Preço, badge, botão, cards de lazer' },
                  { key: '--contact-bg', label: 'Cor de Destaque', hint: 'Header, tela final, ícones das stats' },
                ].map(({ key, label, hint }) => (
                  <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.75rem' }}>
                    <span style={{ color: 'var(--text)', fontWeight: 600 }}>{label}</span>
                    <span style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>{hint}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <input
                        type="color"
                        value={videoColors[key] || '#000000'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setVideoColors((prev) => {
                            const brand  = key === '--primary'    ? val : (prev['--primary']    || '#1152d4');
                            const accent = key === '--contact-bg' ? val : (prev['--contact-bg'] || '#0a1e4a');
                            return buildPalette(brand, accent);
                          });
                          setAnimacaoKey((k) => k + 1);
                        }}
                        style={{ width: 32, height: 32, padding: 0, border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
                      />
                      <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--muted)' }}>{videoColors[key] || '—'}</span>
                    </div>
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn"
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                  disabled={savingColors}
                  onClick={handleSaveVideoColors}
                >
                  {savingColors ? 'Salvando…' : 'Salvar cores'}
                </button>
                {colorsMsg && (
                  <span style={{ fontSize: '0.8rem', color: colorsMsg.startsWith('Erro') ? 'var(--danger)' : 'var(--success)' }}>
                    {colorsMsg}
                  </span>
                )}
              </div>
            </div>
          </details>

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
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              disabled={sendingFrames}
              onClick={async () => {
                setFramesMessage(null);
                setSendingFrames(true);
                try {
                  const dashRes = await fetch(API + '/dashboard', { cache: 'no-store' });
                  const dash = await dashRes.json().catch(() => ({}));
                  const captureServiceUrl = (dash.browserless_ws_url || '').trim();
                  const hasCaptureService = captureServiceUrl.length > 0;

                  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
                  const publicAppUrl = typeof window !== 'undefined' ? (window.location.origin + (base || '')).replace(/\/$/, '') : '';
                  const res = await fetch(API + '/poster-frames-to-webhook', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ listing_id: id, layout: posterLayout, public_app_url: publicAppUrl }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (res.ok) {
                    const viaService = data.via === 'capture_service';
                    setFramesMessage(viaService
                      ? `Pronto. Página enviada ao serviço de captura (layout: ${posterLayout}). Solicitação de montar MP4 disparada se configurada.`
                      : `Pronto. ${data.frames_sent ?? 0} frames enviados no servidor (layout: ${posterLayout}). Solicitação de montar MP4 disparada se configurada.`);
                    setSendingFrames(false);
                    return;
                  }
                  setFramesMessage('Erro: ' + (data.error || res.status));
                  setSendingFrames(false);
                  if (!hasCaptureService && res.status === 503) {
                    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
                    const path = `${base}/poster-video/${id}?capture=1&layout=${encodeURIComponent(posterLayout)}`;
                    const url = path.startsWith('http') ? path : `${window.location.origin}${path}`;
                    window.open(url, 'poster-frames-capture', 'width=2,height=2,left=-9999,top=-9999,scrollbars=no,resizable=no');
                  }
                } catch (e) {
                  setFramesMessage('Erro: ' + (e.message || 'Falha ao enviar'));
                  setSendingFrames(false);
                  const dashRes = await fetch(API + '/dashboard', { cache: 'no-store' }).catch(() => null);
                  const dash = dashRes ? await dashRes.json().catch(() => ({})) : {};
                  const hasCaptureService = ((dash.browserless_ws_url || '').trim()).length > 0;
                  if (!hasCaptureService) {
                    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
                    const path = `${base}/poster-video/${id}?capture=1&layout=${encodeURIComponent(posterLayout)}`;
                    const url = path.startsWith('http') ? path : `${window.location.origin}${path}`;
                    window.open(url, 'poster-frames-capture', 'width=2,height=2,left=-9999,top=-9999,scrollbars=no,resizable=no');
                  }
                }
              }}
            >
              {sendingFrames && (
                <span
                  className="loading-spinner"
                  style={{
                    width: 14,
                    height: 14,
                    border: '2px solid transparent',
                    borderTopColor: 'currentColor',
                    borderRadius: '50%',
                    flexShrink: 0,
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
              )}
              {sendingFrames ? 'Enviando frames…' : 'Enviar frames ao webhook'}
            </button>
            {framesMessage && (
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: framesMessage.startsWith('Erro') ? 'var(--danger)' : 'var(--success)', width: '100%' }}>
                {framesMessage}
              </p>
            )}
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
                  listing={effectiveListing}
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

      <RemotionRenderPanel listingId={id} listing={listing} />

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
