import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API } from '../api';
import AnimacaoCaracteristicas from '../components/AnimacaoCaracteristicas';

const MATERIAIS_BASE = 'https://firemode.s3.us-east-1.amazonaws.com/firemode/imob';

export default function Materiais() {
  const { id, clientId } = useParams();
  const [listing, setListing] = useState(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [files, setFiles] = useState({ videos: [], narration: [], music: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [animacaoKey, setAnimacaoKey] = useState(0);
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
        {/* Coluna 1: Materiais (vídeos, narração, música) - maior */}
        <div className="card">
          <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            Materiais (S3)
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
        </div>

        {/* Coluna 2: Características do imóvel + animação + editor */}
        <div className="card materiais-col-phone">
          <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Características do imóvel</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            Animação 5s — poster 1080×1920.{' '}
            <Link
              to={clientId ? `/cliente/${clientId}/produto/${id}/poster-video` : `/poster-video/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '0.85rem' }}
            >
              Abrir tela para gravar vídeo (MP4)
            </Link>
          </p>

          {/* Editor: cor de fundo, itens por linha, tamanho do ícone */}
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg)', borderRadius: 8 }}>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>Ajustes</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                <span style={{ minWidth: 100 }}>Cor de fundo</span>
                <input
                  type="color"
                  value={animBg}
                  onChange={(e) => setAnimBg(e.target.value)}
                  style={{ width: 36, height: 28, padding: 0, border: '1px solid var(--border)', borderRadius: 6 }}
                />
                <input
                  type="text"
                  value={animBg}
                  onChange={(e) => setAnimBg(e.target.value)}
                  style={{ width: 90, padding: '4px 8px', fontSize: '0.85rem' }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                <span style={{ minWidth: 100 }}>Itens por linha</span>
                <select
                  value={animItemsPerRow}
                  onChange={(e) => setAnimItemsPerRow(Number(e.target.value))}
                  style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                >
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                <span style={{ minWidth: 100 }}>Tamanho ícone (px)</span>
                <input
                  type="range"
                  min={16}
                  max={48}
                  value={animIconSize}
                  onChange={(e) => setAnimIconSize(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ minWidth: 28 }}>{animIconSize}</span>
              </label>
            </div>
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

      <p style={{ marginTop: '1rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
        Para listar arquivos automaticamente, coloque um <code>manifest.json</code> na pasta do S3 com a estrutura:{' '}
        <code>{'{"videos":["a.mp4","b.mp4"],"narration":["narracao.mp3"],"music":["fundo.mp3"]}'}</code>
      </p>
    </>
  );
}
