import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

import { API } from '../api';

export default function WebhookSend() {
  const { id } = useParams();
  const [listing, setListing] = useState(null);
  const [webhookUrl, setWebhookUrl] = useState(() => localStorage.getItem('divulgaimob_webhook_url') || '');
  const [payload, setPayload] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [savedPayload, setSavedPayload] = useState(false);

  useEffect(() => {
    fetch(API + '/listings/' + id)
      .then((r) => r.json())
      .then((data) => {
        setListing(data);
        if (data.webhook_payload && typeof data.webhook_payload === 'object') {
          setPayload(JSON.stringify(data.webhook_payload, null, 2));
        } else {
          const selected = data.selected_images || data.carousel_images || [];
          const built = {
            title: data.title,
            description: data.description,
            salePrice: data.salePrice,
            prices: data.prices,
            imobname: data.imobname,
            logoimob: data.logoimob,
            advertiserCode: data.advertiserCode,
            vivaRealCode: data.vivaRealCode,
            propertyCodes: data.propertyCodes,
            amenities: data['amenities-list'] ?? data.amenitiesList,
            images: selected,
          };
          setPayload(JSON.stringify(built, null, 2));
        }
      })
      .catch((e) => setError(e.message));
  }, [id]);

  function savePayload() {
    let pl;
    try {
      pl = JSON.parse(payload);
    } catch {
      setError('Payload JSON inválido.');
      setSavedPayload(false);
      return;
    }
    setError(null);
    setSavedPayload(false);
    fetch(API + '/listings/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhook_payload: pl }),
    })
      .then((r) => r.json())
      .then((body) => {
        if (body.error) throw new Error(body.error);
        setSavedPayload(true);
      })
      .catch((e) => {
        setError(e.message);
        setSavedPayload(false);
      });
  }

  function saveUrl() {
    localStorage.setItem('divulgaimob_webhook_url', webhookUrl);
  }

  function send() {
    setSending(true);
    setResult(null);
    setError(null);
    saveUrl();
    let pl;
    try {
      pl = JSON.parse(payload);
    } catch {
      setError('Payload JSON inválido.');
      setSending(false);
      return;
    }
    fetch(API + '/webhook/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, payload: pl }),
    })
      .then((r) => r.json())
      .then((body) => {
        setResult(body);
        setSending(false);
      })
      .catch((e) => {
        setError(e.message);
        setSending(false);
      });
  }

  if (!listing) return <p className="muted">Carregando...</p>;

  return (
    <>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/">← Anúncios</Link>
        <span style={{ margin: '0 0.5rem', color: 'var(--muted)' }}>|</span>
        <Link to={'/listing/' + id}>Editar anúncio</Link>
      </div>
      <h1>Formatar e enviar para webhook</h1>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>URL do webhook</h3>
        <div className="form-group">
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            onBlur={saveUrl}
            placeholder="https://..."
          />
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
          A URL é salva no navegador para próxima vez.
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Payload (edite se precisar)</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Objeto que será enviado no POST. Você pode alterar textos, remover ou incluir campos.
        </p>
        <div className="form-group">
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            rows={22}
            style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
          />
        </div>
        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
        {savedPayload && <p style={{ color: 'var(--success)' }}>Payload salvo neste anúncio.</p>}
        {result && (
          <div className="card" style={{ marginTop: '1rem', background: 'var(--bg)' }}>
            <strong>Resposta do webhook:</strong>
            <pre style={{ margin: '0.5rem 0', fontSize: '0.85rem', overflow: 'auto' }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          <button
            type="button"
            className="btn"
            onClick={savePayload}
          >
            Salvar payload neste anúncio
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={send}
            disabled={sending || !webhookUrl.trim()}
          >
            {sending ? 'Enviando...' : 'Enviar para webhook'}
          </button>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
          Salvar payload guarda o JSON atual no anúncio; na próxima vez que abrir esta tela, ele será carregado.
        </p>
      </div>
    </>
  );
}
