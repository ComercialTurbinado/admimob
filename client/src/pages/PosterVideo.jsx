import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { API } from '../api';
import AnimacaoCaracteristicas, { DURATION_MS } from '../components/AnimacaoCaracteristicas';

/**
 * Página fullscreen só da animação do poster (1080×1920).
 * Gravar: abra a URL e use Chrome "Gravar guia" ou OBS.
 * Capturar frames: ?capture=1 (usa webhook das Configurações) ou ?capture=1&webhook_url=...
 */
const FPS = 25;
const INTERVAL_MS = 1000 / FPS;
const TOTAL_FRAMES = Math.ceil((DURATION_MS / 1000) * FPS);

export default function PosterVideo() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fitScale, setFitScale] = useState(1);
  const [captureStatus, setCaptureStatus] = useState(null);
  const [effectiveWebhookUrl, setEffectiveWebhookUrl] = useState(null);
  const containerRef = useRef(null);
  const posterRef = useRef(null);

  const captureParam = searchParams.get('capture') === '1';
  const webhookFromQuery = searchParams.get('webhook_url') || '';
  const scale = captureParam ? 1 : fitScale;

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const s = Math.min(w / 1080, h / 1920, 1);
      setFitScale(s);
    };
    update();
    const t = setTimeout(update, 100);
    window.addEventListener('resize', update);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', update);
    };
  }, [listing, captureParam]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setListing(null);
    const url = API + '/listings/' + id + '/materiais?t=' + Date.now();
    fetch(url, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setListing(data.listing);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!captureParam) {
      setEffectiveWebhookUrl(null);
      return;
    }
    if (webhookFromQuery) {
      setEffectiveWebhookUrl(webhookFromQuery);
      return;
    }
    fetch(API + '/dashboard', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setEffectiveWebhookUrl(d.webhook_frames_save || ''))
      .catch(() => setEffectiveWebhookUrl(''));
  }, [captureParam, webhookFromQuery]);

  const shouldCapture = captureParam && effectiveWebhookUrl && listing && id;
  const captureDoneRef = useRef(false);

  useEffect(() => {
    if (!shouldCapture || !listing || !id) return;
    const start = () => {
      if (!posterRef.current || captureDoneRef.current) return;
      captureDoneRef.current = true;
      setCaptureStatus({ current: 0, total: TOTAL_FRAMES, sending: true });
      let frameIndex = 0;
      const startTime = Date.now();

      const sendFrame = async () => {
        if (!posterRef.current) return;
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(posterRef.current, {
          useCORS: true,
          allowTaint: true,
          scale: 1,
          width: 1080,
          height: 1920,
          windowWidth: 1080,
          windowHeight: 1920,
        });
        const imageBase64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
        const frameNumber = frameIndex + 1;
        const frameName = `frame_${String(frameNumber).padStart(4, '0')}.jpg`;
        const res = await fetch(effectiveWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            frame_number: frameNumber,
            total_frames: TOTAL_FRAMES,
            frame_name: frameName,
            image_base64: imageBase64,
            listing_id: Number(id),
            imobname: listing?.imobname ?? '',
            advertiserCode: listing?.advertiserCode ?? '',
            mime_type: 'image/jpeg',
            timestamp_ms: Math.round(frameIndex * INTERVAL_MS),
          }),
        });
        if (!res.ok) throw new Error(`Webhook ${res.status}`);
        frameIndex++;
        setCaptureStatus((s) => (s ? { ...s, current: frameIndex } : null));
      };

      const next = () => {
        if (frameIndex >= TOTAL_FRAMES) {
          setCaptureStatus((s) => (s ? { ...s, sending: false, done: true } : null));
          return;
        }
        const elapsed = Date.now() - startTime;
        const target = frameIndex * INTERVAL_MS;
        const wait = Math.max(0, target - elapsed);
        setTimeout(() => {
          sendFrame()
            .then(() => next())
            .catch((e) => setCaptureStatus((s) => (s ? { ...s, sending: false, error: e.message } : null)));
        }, wait);
      };
      next();
    };
    const t = setTimeout(start, 400);
    return () => clearTimeout(t);
  }, [shouldCapture, listing, id, effectiveWebhookUrl]);

  if (loading) {
    return (
      <div style={styles.fullscreen}>
        <div className="loading-spinner" style={styles.spinner} />
        <p style={{ color: '#888', marginTop: 16 }}>Carregando...</p>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div style={styles.fullscreen}>
        <p style={{ color: 'var(--danger)' }}>{error || 'Anúncio não encontrado.'}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={styles.fullscreen}>
      <div style={{ ...styles.scaleWrapper, transform: `scale(${scale})` }}>
        <div ref={posterRef} style={styles.posterWrap}>
          <AnimacaoCaracteristicas
            listing={listing}
            onEnd={() => {}}
            backgroundColor="#f5f5f5"
            itemsPerRow={3}
            iconSize={28}
            videoMode
          />
        </div>
      </div>
      {captureParam && effectiveWebhookUrl === '' && !webhookFromQuery && (
        <div style={styles.captureOverlay}>
          <p style={{ margin: 0, color: '#fa0' }}>Configure o webhook de captura em Configurações ou informe <code style={{ fontSize: 12 }}>?webhook_url=...</code> na URL.</p>
        </div>
      )}
      {captureStatus && (
        <div style={styles.captureOverlay}>
          {captureStatus.error ? (
            <p style={{ color: '#f88', margin: 0 }}>Erro: {captureStatus.error}</p>
          ) : captureStatus.done ? (
            <p style={{ color: '#8f8', margin: 0 }}>Frames enviados: {captureStatus.current}/{captureStatus.total}</p>
          ) : (
            <p style={{ margin: 0 }}>Capturando frames... {captureStatus.current}/{captureStatus.total}</p>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  fullscreen: {
    position: 'fixed',
    inset: 0,
    background: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 0,
    padding: 0,
  },
  scaleWrapper: {
    width: 1080,
    height: 1920,
    maxWidth: '100vw',
    maxHeight: '100vh',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterWrap: {
    width: 1080,
    height: 1920,
    flexShrink: 0,
    boxShadow: '0 0 0 1px rgba(255,255,255,0.1)',
  },
  captureOverlay: {
    position: 'fixed',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.8)',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: 14,
  },
  spinner: {
    width: 40,
    height: 40,
    border: '3px solid #333',
    borderTopColor: '#fff',
    borderRadius: '50%',
    margin: '0 auto',
    animation: 'spin 0.8s linear infinite',
  },
};

export { DURATION_MS };
