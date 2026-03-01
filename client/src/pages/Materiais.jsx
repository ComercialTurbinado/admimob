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
  const [videoUrl, setVideoUrl] = useState(null);
  const [animacaoKey, setAnimacaoKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetch(API + '/listings/' + id + '/materiais')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setListing(data.listing);
        setBaseUrl(data.baseUrl || '');
        setFiles(data.files || { videos: [], narration: [], music: [] });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
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
        <p className="muted">Carregando...</p>
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
          <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Materiais (S3)</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Base: <code style={{ wordBreak: 'break-all' }}>{urlBase || '(sem advertiserCode)'}</code>
          </p>
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
                      <button
                        type="button"
                        className="btn"
                        style={{ marginLeft: 8, padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                        onClick={() => setVideoUrl(url)}
                      >
                        Ver no visor
                      </button>
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

        {/* Coluna 2: Características do imóvel + animação (moldura 1080×1920, arte 1080×1450) */}
        <div className="card materiais-col-phone">
          <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Características do imóvel</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Animação 5s — tela 1080×1920, arte 1080×1450
          </p>
          {/* Moldura celular 9:16 (1080×1920) com arte 1080×1450 no topo */}
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
                borderRadius: 14,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
              }}
            >
              {/* Área da arte 1080×1450 = proporção 1080/1450 */}
              <div
                style={{
                  width: '100%',
                  flex: '0 0 auto',
                  aspectRatio: '1080 / 1450',
                  overflow: 'hidden',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  background: 'var(--surface)',
                }}
              >
                <div style={{ transform: 'scale(0.333)', transformOrigin: 'top center' }}>
                  <AnimacaoCaracteristicas key={animacaoKey} listing={listing} onEnd={() => {}} />
                </div>
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

        {/* Coluna 3: Visor celular (9:16) - mesmo tamanho da coluna 2 */}
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
              {videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <p className="muted" style={{ textAlign: 'center', padding: 16, fontSize: '0.9rem' }}>
                  Clique em &quot;Ver no visor&quot; em um vídeo para exibir aqui.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <p style={{ marginTop: '1rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
        Para listar arquivos automaticamente, coloque um <code>manifest.json</code> na pasta do S3 com a estrutura:{' '}
        <code>{'{"videos":["a.mp4","b.mp4"],"narration":["narracao.mp3"],"music":["fundo.mp3"]}'}</code>
      </p>
    </>
  );
}
