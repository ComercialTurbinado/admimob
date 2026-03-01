import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

import { API } from '../api';

const OMIT_KEYS = ['id', 'client_id', 'source_url', 'selected_images', 'webhook_payload', 'created_at', 'updated_at'];

const FIELD_LABELS = {
  title: 'Título',
  description: 'Descrição',
  description_data: 'Descrição (dados extras)',
  carousel_images: 'Fotos',
  salePrice: 'Preço de venda',
  prices: 'Preços (Venda, Condomínio, IPTU)',
  imobname: 'Nome da imobiliária',
  logoimob: 'Logo (URL)',
  advertiserCode: 'Código do anunciante',
  vivaRealCode: 'Código Viva Real',
  propertyCodes: 'Códigos do imóvel',
  amenitiesList: 'Características (lista)',
  'amenities-list': 'Características (lista)',
  images: 'Imagens (URLs)',
};

function getPayloadKeys(listing) {
  if (!listing || typeof listing !== 'object') return [];
  return Object.keys(listing).filter((k) => !OMIT_KEYS.includes(k));
}

function getFieldLabel(key) {
  return FIELD_LABELS[key] || key;
}

function isLongString(val) {
  return typeof val === 'string' && val.length > 80;
}

function isPrimitive(val) {
  return val === null || typeof val !== 'object';
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
  const { id, clientId: clientIdParam } = useParams();
  const navigate = useNavigate();
  const isDemo = id === 'demo';
  const [listing, setListing] = useState(null);
  const [fieldIncluded, setFieldIncluded] = useState({});
  const [fieldValues, setFieldValues] = useState({});
  const [selectedImages, setSelectedImages] = useState([]);
  const [payloadJson, setPayloadJson] = useState('');
  const [saving, setSaving] = useState(false);
  const [firing, setFiring] = useState(false);
  const [error, setError] = useState(null);
  const [fireResult, setFireResult] = useState(null);

  const payloadKeys = useMemo(() => getPayloadKeys(listing), [listing]);

  // Form pronto só quando listing carregou e os campos foram preenchidos
  const formReady = listing && payloadKeys.length > 0 && Object.keys(fieldValues).length > 0;
  // Loading: buscando listing OU já temos listing mas os campos ainda não foram preenchidos
  const loadingData = !listing || (payloadKeys.length > 0 && Object.keys(fieldValues).length === 0);

  // Demo: carrega listing mock para não depender de API
  useEffect(() => {
    if (isDemo && !listing) setListing(MOCK_LISTING);
  }, [isDemo, listing]);

  // Busca o listing na API quando não é demo
  useEffect(() => {
    if (isDemo || !id) return;
    setError(null);
    fetch(API + '/listings/' + id)
      .then((r) => r.json())
      .then((data) => {
        setListing(data);
        // Se veio de /producao/:id, redireciona para /cliente/X/produto/Y
        if (!clientIdParam && data.client_id != null) {
          navigate('/cliente/' + data.client_id + '/produto/' + id, { replace: true });
        }
      })
      .catch((e) => setError(e.message));
  }, [id, isDemo]);

  // Inicializa fieldIncluded e fieldValues quando o listing carrega
  useEffect(() => {
    if (!listing) return;
    const keys = getPayloadKeys(listing);
    const included = {};
    const values = {};
    keys.forEach((k) => {
      included[k] = true;
      values[k] = listing[k];
    });
    setFieldIncluded(included);
    setFieldValues(values);
    if (Array.isArray(listing.carousel_images)) {
      setSelectedImages(listing.selected_images || listing.carousel_images.slice(0, 12));
    }
  }, [listing?.id]);

  // Monta o payload a partir dos campos marcados
  function buildPayloadFromFields() {
    const out = {};
    payloadKeys.forEach((key) => {
      if (!fieldIncluded[key]) return;
      if (key === 'carousel_images') {
        out.images = selectedImages;
      } else {
        out[key] = fieldValues[key];
      }
    });
    return out;
  }

  // JSON que deve aparecer no textarea: sempre derivado do formulário (campos + checkboxes)
  const builtPayloadString = useMemo(() => {
    if (payloadKeys.length === 0 || Object.keys(fieldValues).length === 0) return '';
    return JSON.stringify(buildPayloadFromFields(), null, 2);
  }, [payloadKeys, fieldIncluded, fieldValues, selectedImages]);

  // Mantém o textarea sempre com o JSON ajustado (quando o formulário muda, atualiza o texto)
  useEffect(() => {
    if (!builtPayloadString) return;
    setPayloadJson((prev) => (prev === builtPayloadString ? prev : builtPayloadString));
  }, [builtPayloadString]);

  function setIncluded(key, value) {
    setFieldIncluded((prev) => ({ ...prev, [key]: value }));
  }

  function setFieldValue(key, value) {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  }

  function setAllIncluded(value) {
    const next = {};
    payloadKeys.forEach((k) => { next[k] = value; });
    setFieldIncluded(next);
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

  // Edição de itens em arrays de objetos (amenitiesList, description_data)
  function setArrayItem(key, index, field, val) {
    const arr = Array.isArray(fieldValues[key]) ? [...fieldValues[key]] : [];
    if (!arr[index]) return;
    arr[index] = typeof arr[index] === 'object' && arr[index] !== null
      ? { ...arr[index], [field]: val }
      : val;
    setFieldValue(key, arr);
  }

  function removeArrayItem(key, index) {
    const arr = Array.isArray(fieldValues[key]) ? fieldValues[key].filter((_, i) => i !== index) : [];
    setFieldValue(key, arr);
  }

  function addArrayItem(key, item = { name: '', value: '' }) {
    const arr = Array.isArray(fieldValues[key]) ? [...fieldValues[key], item] : [item];
    setFieldValue(key, arr);
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
    payloadKeys.forEach((k) => {
      if (k !== 'carousel_images') raw[k] = fieldValues[k];
    });
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
  const textKeys = payloadKeys.filter((k) => k !== 'carousel_images');

  // Loading: dados ainda não carregaram / campos não preenchidos
  if (loadingData) {
    return (
      <>
        <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
          <Link to="/">Dashboard</Link>
          <span style={{ margin: '0 0.5rem', color: 'var(--muted)' }}>→</span>
          <span>Central de Produção</span>
        </div>
        <h1>Central de Produção</h1>
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', margin: '0 auto 1rem' }} className="loading-spinner" />
          <p className="muted" style={{ margin: 0 }}>Carregando dados do anúncio...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
        <Link to="/">Dashboard</Link>
        <span style={{ margin: '0 0.5rem', color: 'var(--muted)' }}>→</span>
        {(clientIdParam || listing.client_id) && (
          <>
            <Link to={'/cliente/' + (clientIdParam || listing.client_id) + '/area'}>Cliente</Link>
            <span style={{ margin: '0 0.5rem', color: 'var(--muted)' }}>→</span>
          </>
        )}
        <span>Produto</span>
        {(clientIdParam || listing.client_id) && (
          <>
            <span style={{ margin: '0 0.5rem', color: 'var(--muted)' }}>|</span>
            <Link to={'/cliente/' + (clientIdParam || listing.client_id) + '/produto/' + id + '/materiais'}>Materiais</Link>
          </>
        )}
      </div>
      {isDemo && (
        <div className="card" style={{ marginBottom: '1rem', borderColor: 'var(--accent)', background: 'rgba(88, 166, 255, 0.08)' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}><strong>Dados fictícios</strong> — layout de exemplo. Salvar e enviar webhook estão desativados.</p>
        </div>
      )}
      <h1>Central de Produção</h1>

      {/* Campos do anúncio: cada um com checkbox "Incluir no webhook" e valor editável */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Campos do anúncio (marque os que deseja enviar no webhook)</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          <button type="button" className="btn" style={{ marginRight: '0.5rem' }} onClick={() => setAllIncluded(true)}>Marcar todos</button>
          <button type="button" className="btn" onClick={() => setAllIncluded(false)}>Desmarcar todos</button>
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {textKeys.map((key) => {
            const val = fieldValues[key];
            const included = fieldIncluded[key] !== false;
            const label = getFieldLabel(key);

            return (
              <div key={key} className="card" style={{ padding: '1rem', background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 180, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={included}
                      onChange={(e) => setIncluded(key, e.target.checked)}
                    />
                    <strong>{label}</strong>
                  </label>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    {key === 'carousel_images' ? (
                      <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Seleção e ordem nas fotos abaixo</span>
                    ) : Array.isArray(val) && val.length > 0 && typeof val[0] === 'object' && val[0] !== null && !Array.isArray(val[0]) ? (
                      <div>
                        {val.map((item, i) => (
                          <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            {typeof item === 'object' && item !== null && 'name' in item && 'value' in item ? (
                              <>
                                <input
                                  value={item.name}
                                  onChange={(e) => setArrayItem(key, i, 'name', e.target.value)}
                                  placeholder="Nome"
                                  style={{ width: 140 }}
                                />
                                <input
                                  value={item.value}
                                  onChange={(e) => setArrayItem(key, i, 'value', e.target.value)}
                                  placeholder="Valor"
                                  style={{ flex: 1, minWidth: 120 }}
                                />
                              </>
                            ) : (
                              <input
                                value={typeof item === 'string' ? item : JSON.stringify(item)}
                                onChange={(e) => {
                                  let v = e.target.value;
                                  try { v = JSON.parse(v); } catch {}
                                  const arr = [...(fieldValues[key] || [])];
                                  arr[i] = v;
                                  setFieldValue(key, arr);
                                }}
                                style={{ flex: 1 }}
                              />
                            )}
                            <button type="button" className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => removeArrayItem(key, i)}>Remover</button>
                          </div>
                        ))}
                        <button type="button" className="btn" style={{ fontSize: '0.85rem' }} onClick={() => addArrayItem(key)}>+ Item</button>
                      </div>
                    ) : Array.isArray(val) ? (
                      <textarea
                        value={JSON.stringify(val)}
                        onChange={(e) => {
                          try { setFieldValue(key, JSON.parse(e.target.value)); } catch {} 
                        }}
                        rows={3}
                        style={{ fontFamily: 'monospace', fontSize: '0.85rem', width: '100%' }}
                      />
                    ) : typeof val === 'object' && val !== null ? (
                      <textarea
                        value={JSON.stringify(val, null, 2)}
                        onChange={(e) => {
                          try { setFieldValue(key, JSON.parse(e.target.value)); } catch {}
                        }}
                        rows={4}
                        style={{ fontFamily: 'monospace', fontSize: '0.85rem', width: '100%' }}
                      />
                    ) : isLongString(val) ? (
                      <textarea
                        value={val == null ? '' : String(val)}
                        onChange={(e) => setFieldValue(key, e.target.value)}
                        rows={4}
                        style={{ width: '100%' }}
                      />
                    ) : (
                      <input
                        type={typeof val === 'number' ? 'number' : 'text'}
                        value={val == null ? '' : String(val)}
                        onChange={(e) => setFieldValue(key, typeof val === 'number' ? Number(e.target.value) : e.target.value)}
                        style={{ width: '100%', maxWidth: 400 }}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fotos: grid com checkbox em cada uma + checkbox "Incluir no payload" */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Fotos (marque as que entram no webhook e reordene)</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={fieldIncluded.carousel_images !== false}
            onChange={(e) => setIncluded('carousel_images', e.target.checked)}
          />
          <strong>Incluir fotos no payload (como &quot;images&quot;)</strong>
        </label>
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
        <p style={{ marginTop: '0.75rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
          {selectedImages.length} foto(s) selecionada(s) — ordem = ordem no payload
        </p>
      </div>

      {/* JSON final que será enviado */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginTop: 0 }}>JSON que será enviado ao webhook (FireMode)</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          Montado a partir dos campos marcados acima. Você pode editar manualmente se precisar.
        </p>
        <textarea
          value={payloadJson}
          onChange={(e) => setPayloadJson(e.target.value)}
          rows={16}
          style={{ fontFamily: 'monospace', fontSize: '0.85rem', width: '100%', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text)' }}
        />
      </div>

      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      {saving && (
        <div className="card" style={{ marginBottom: '1rem', padding: '1rem', textAlign: 'center' }}>
          <div style={{ width: 28, height: 28, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', margin: '0 auto 0.5rem' }} className="loading-spinner" />
          <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>Salvando alterações...</p>
        </div>
      )}

      {firing && (
        <div className="card" style={{ marginBottom: '1rem', padding: '1.5rem', textAlign: 'center', borderColor: 'var(--accent)' }}>
          <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', margin: '0 auto 0.75rem' }} className="loading-spinner" />
          <p style={{ margin: 0, fontWeight: 600 }}>Enviando para webhook...</p>
          <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>Aguarde a resposta.</p>
        </div>
      )}

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
          <p style={{ marginBottom: '0.5rem', color: 'var(--muted)', fontSize: '0.9rem' }}>Corpo da resposta:</p>
          <pre style={{ fontSize: '0.85rem', overflow: 'auto', maxHeight: 300, padding: '1rem', background: 'var(--bg)', borderRadius: 6 }}>
            {typeof fireResult.body === 'string' ? fireResult.body : JSON.stringify(fireResult.body, null, 2)}
          </pre>
        </div>
      )}
    </>
  );
}
