import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

const API = '/api';

function buildPayload(listing, title, description, amenities, selectedImages) {
  return {
    title: title || listing?.title,
    description: description ?? listing?.description,
    salePrice: listing?.salePrice,
    prices: listing?.prices,
    imobname: listing?.imobname,
    logoimob: listing?.logoimob,
    advertiserCode: listing?.advertiserCode,
    vivaRealCode: listing?.vivaRealCode,
    propertyCodes: listing?.propertyCodes,
    amenities: amenities ?? listing?.['amenities-list'],
    images: selectedImages ?? listing?.carousel_images ?? [],
  };
}

const MOCK_LISTING = {
  id: 'demo',
  client_id: 'demo',
  title: 'Casa com 2 Quartos e 2 banheiros à Venda, 82 m² por R$ 455.000',
  description: 'Casa nova com piscina a venda em Peruíbe, bairro Flora Rica II. Medindo 150m² de área total, 82m² de área construída.',
  salePrice: 'R$ 455.000',
  prices: { Venda: 'R$ 455.000', Condomínio: 'Isento', IPTU: 'R$ 160' },
  imobname: 'Regina Guerreiro Imoveis',
  logoimob: 'https://resizedimgs.vivareal.com/img/vr-listing/e9cfb78f81731ee3743dc1b24339625a/regina-guerreiro-imoveis.webp',
  advertiserCode: 'CA2598',
  vivaRealCode: '2815108622',
  propertyCodes: '(Código do anunciante: CA2598)',
  'amenities-list': [
    { name: 'floorSize', value: '82 m²' },
    { name: 'numberOfRooms', value: '2 quartos' },
    { name: 'numberOfBathroomsTotal', value: '2 banheiros' },
    { name: 'numberOfParkingSpaces', value: '2 vagas' },
  ],
  carousel_images: [
    'https://resizedimgs.vivareal.com/img/vr-listing/9b66eb450db996a1e721b29ea90aab6e/casa-com-2-quartos-a-venda-82m-no-bal-stella-maris-peruibe.webp',
    'https://resizedimgs.vivareal.com/img/vr-listing/d218dc756eddcb139a84a6160140af4a/casa-com-2-quartos-a-venda-82m-no-bal-stella-maris-peruibe.webp',
    'https://resizedimgs.vivareal.com/img/vr-listing/c413fce3c20a97ae28849c6dba493726/casa-com-2-quartos-a-venda-82m-no-bal-stella-maris-peruibe.webp',
  ],
};

export default function Producao() {
  const { id } = useParams();
  const isDemo = id === 'demo';
  const [listing, setListing] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amenities, setAmenities] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [payloadJson, setPayloadJson] = useState('');
  const [saving, setSaving] = useState(false);
  const [firing, setFiring] = useState(false);
  const [error, setError] = useState(null);
  const [fireResult, setFireResult] = useState(null);

  useEffect(() => {
    if (isDemo) {
      const data = MOCK_LISTING;
      setListing(data);
      setTitle(data.title || '');
      setDescription(data.description || '');
      setAmenities(Array.isArray(data['amenities-list']) ? data['amenities-list'] : []);
      setSelectedImages(data.carousel_images || []);
      setPayloadJson(JSON.stringify(buildPayload(data, data.title, data.description, data['amenities-list'], data.carousel_images), null, 2));
      return;
    }
    fetch(API + '/listings/' + id)
      .then((r) => r.json())
      .then((data) => {
        setListing(data);
        setTitle(data.title || '');
        setDescription(data.description || '');
        setAmenities(Array.isArray(data['amenities-list']) ? data['amenities-list'] : []);
        setSelectedImages(data.selected_images || (data.carousel_images || []).slice(0, 12));
        const payload = data.webhook_payload && typeof data.webhook_payload === 'object'
          ? data.webhook_payload
          : buildPayload(data, data.title, data.description, data['amenities-list'], data.selected_images || data.carousel_images);
        setPayloadJson(JSON.stringify(payload, null, 2));
      })
      .catch((e) => setError(e.message));
  }, [id, isDemo]);

  function refreshPayloadFromForm() {
    if (!listing) return;
    const payload = buildPayload(listing, title, description, amenities, selectedImages);
    setPayloadJson(JSON.stringify(payload, null, 2));
  }

  function toggleImage(url) {
    setSelectedImages((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    );
  }

  function moveImage(url, dir) {
    const i = selectedImages.indexOf(url);
    if (i === -1) return;
    const next = [...selectedImages];
    const j = dir === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setSelectedImages(next);
  }

  function addAmenity() {
    setAmenities((prev) => [...prev, { name: 'custom', value: '' }]);
  }

  function updateAmenity(i, field, val) {
    setAmenities((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: val };
      return next;
    });
  }

  function removeAmenity(i) {
    setAmenities((prev) => prev.filter((_, idx) => idx !== i));
  }

  function savePreview() {
    if (!listing || isDemo) return;
    setSaving(true);
    setError(null);
    let payloadObj;
    try {
      payloadObj = JSON.parse(payloadJson);
    } catch {
      setError('Payload JSON inválido.');
      setSaving(false);
      return;
    }
    const omit = ['id', 'client_id', 'source_url', 'selected_images', 'webhook_payload', 'created_at', 'updated_at'];
    const raw = { ...listing };
    omit.forEach((k) => delete raw[k]);
    raw.title = title;
    raw.description = description;
    raw['amenities-list'] = amenities;
    fetch(API + '/listings/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        raw_data: raw,
        selected_images: selectedImages,
        webhook_payload: payloadObj,
      }),
    })
      .then((r) => r.json())
      .then((body) => {
        if (body.error) throw new Error(body.error);
        setListing((prev) => (prev ? { ...prev, ...raw } : prev));
      })
      .catch((e) => setError(e.message))
      .finally(() => setSaving(false));
  }

  async function fireMode() {
    if (isDemo) return;
    setFiring(true);
    setError(null);
    setFireResult(null);
    try {
      let payloadObj;
      try {
        payloadObj = JSON.parse(payloadJson);
      } catch {
        setError('Payload JSON inválido. Corrija o JSON antes de enviar.');
        setFiring(false);
        return;
      }
      const res = await fetch(API + '/listings/' + id + '/firemode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: payloadObj }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFireResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setFiring(false);
    }
  }

  if (!listing) return <p className="muted">Carregando...</p>;

  const images = listing.carousel_images || [];

  return (
    <>
      <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
        <Link to="/">Dashboard</Link>
        <span style={{ margin: '0 0.5rem', color: 'var(--muted)' }}>→</span>
        {listing.client_id && <Link to={'/cliente/' + listing.client_id + '/area'}>Área do cliente</Link>}
        {listing.client_id && <span style={{ margin: '0 0.5rem', color: 'var(--muted)' }}>→</span>}
        <span>Central de Produção</span>
      </div>
      {isDemo && (
        <div className="card" style={{ marginBottom: '1rem', borderColor: 'var(--accent)', background: 'rgba(88, 166, 255, 0.08)' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}><strong>Dados fictícios</strong> — layout de exemplo. Salvar e enviar webhook estão desativados.</p>
        </div>
      )}
      <h1>Central de Produção</h1>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Dados do anúncio (título, descrição, características)</h3>
        <div className="form-group">
          <label>Título</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Descrição</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
        </div>
        <div className="form-group">
          <label>Características (ex: churrasqueira, ar-condicionado)</label>
          {amenities.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                value={a.value}
                onChange={(e) => updateAmenity(i, 'value', e.target.value)}
                placeholder="Nome"
                style={{ flex: 1 }}
              />
              <button type="button" className="btn btn-danger" onClick={() => removeAmenity(i)}>Remover</button>
            </div>
          ))}
          <button type="button" className="btn" onClick={addAmenity}>+ Característica</button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Fotos para o vídeo (marque e reordene)</h3>
        <div className="grid-images">
          {images.map((url) => (
            <div key={url} className="img-thumb" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, position: 'relative' }} onClick={() => toggleImage(url)}>
                <img src={url} alt="" />
                <input
                  type="checkbox"
                  checked={selectedImages.includes(url)}
                  onChange={() => toggleImage(url)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 2, padding: 4 }}>
                <button type="button" className="btn" style={{ padding: '2px 6px', fontSize: '0.8rem' }} onClick={() => moveImage(url, 'up')}>↑</button>
                <button type="button" className="btn" style={{ padding: '2px 6px', fontSize: '0.8rem' }} onClick={() => moveImage(url, 'down')}>↓</button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="btn" onClick={refreshPayloadFromForm} style={{ marginTop: '0.5rem' }}>
          Atualizar payload abaixo com estes dados
        </button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Payload que será enviado ao webhook (edite o JSON)</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          Este é o objeto que será enviado no POST. Edite se precisar antes de salvar ou disparar.
        </p>
        <textarea
          value={payloadJson}
          onChange={(e) => setPayloadJson(e.target.value)}
          rows={16}
          style={{ fontFamily: 'monospace', fontSize: '0.85rem', width: '100%', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)' }}
        />
      </div>

      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
        <button type="button" className="btn btn-primary" onClick={savePreview} disabled={saving || isDemo}>
          {saving ? 'Salvando...' : 'Salvar alterações e payload'}
        </button>
        <button type="button" className="btn firemode-btn" onClick={fireMode} disabled={firing || isDemo}>
          {firing ? 'Enviando...' : 'Enviar para webhook (FireMode Now)'}
        </button>
      </div>

      {fireResult && (
        <div className="card" style={{ marginTop: '1.5rem', borderColor: fireResult.ok ? 'var(--success)' : 'var(--danger)' }}>
          <h3 style={{ marginTop: 0 }}>Resposta recebida do webhook</h3>
          <p style={{ marginBottom: '0.5rem' }}>
            <strong>Status HTTP:</strong> {fireResult.status} {fireResult.ok ? '✓' : '✗'}
          </p>
          <p style={{ marginBottom: '0.5rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
            Corpo da resposta:
          </p>
          <pre style={{ fontSize: '0.85rem', overflow: 'auto', maxHeight: 300, padding: '1rem', background: 'var(--bg)', borderRadius: 6 }}>
            {typeof fireResult.body === 'string' ? fireResult.body : JSON.stringify(fireResult.body, null, 2)}
          </pre>
        </div>
      )}
    </>
  );
}
