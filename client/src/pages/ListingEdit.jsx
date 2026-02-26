import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

import { API } from '../api';

function omitKeys(obj, keys) {
  const o = { ...obj };
  keys.forEach((k) => delete o[k]);
  return o;
}

export default function ListingEdit() {
  const { id } = useParams();
  const [listing, setListing] = useState(null);
  const [selectedImages, setSelectedImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(API + '/listings/' + id)
      .then((r) => r.json())
      .then((data) => {
        setListing(data);
        setSelectedImages(data.selected_images || (data.carousel_images || []).slice(0, 10));
      })
      .catch((e) => setError(e.message));
  }, [id]);

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

  function save() {
    setSaving(true);
    setError(null);
    fetch(API + '/listings/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selected_images: selectedImages }),
    })
      .then((r) => r.json())
      .then((body) => {
        if (body.error) throw new Error(body.error);
        setSaving(false);
      })
      .catch((e) => {
        setError(e.message);
        setSaving(false);
      });
  }

  if (!listing) return <p className="muted">Carregando...</p>;
  if (error && !listing) return <p style={{ color: 'var(--danger)' }}>{error}</p>;

  const images = listing.carousel_images || [];
  const meta = omitKeys(listing, [
    'id', 'carousel_images', 'selected_images', 'webhook_payload',
    'created_at', 'updated_at',
  ]);

  return (
    <>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/">← Anúncios</Link>
        <span style={{ margin: '0 0.5rem', color: 'var(--muted)' }}>|</span>
        <Link to={'/listing/' + id + '/webhook'}>Formatar e enviar webhook</Link>
      </div>
      <h1>Editar anúncio</h1>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Informações do anúncio</h3>
        <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.25rem 1.5rem' }}>
          {Object.entries(meta).map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}>
              <dt style={{ color: 'var(--muted)' }}>{k}</dt>
              <dd style={{ margin: 0 }}>
                {typeof v === 'object' ? JSON.stringify(v) : String(v)}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Selecionar imagens para o webhook</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Marque as imagens que deseja enviar (e reordene se quiser). A ordem será usada no payload.
        </p>
        <div className="grid-images">
          {images.map((url) => (
            <div key={url} className="img-thumb" style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{ flex: 1, position: 'relative' }}
                onClick={() => toggleImage(url)}
              >
                <img src={url} alt="" />
                <input
                  type="checkbox"
                  checked={selectedImages.includes(url)}
                  onChange={() => toggleImage(url)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 2, padding: 4 }}>
                <button
                  type="button"
                  className="btn"
                  style={{ padding: '2px 6px', fontSize: '0.8rem' }}
                  onClick={() => moveImage(url, 'up')}
                  title="Subir"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ padding: '2px 6px', fontSize: '0.8rem' }}
                  onClick={() => moveImage(url, 'down')}
                  title="Descer"
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
        </div>
        <p style={{ marginTop: '1rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
          {selectedImages.length} imagem(ns) selecionada(s).
        </p>
        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar seleção de imagens'}
        </button>
      </div>
    </>
  );
}
