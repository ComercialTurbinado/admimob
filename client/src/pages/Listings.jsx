import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import { API } from '../api';

// Título para exibição: usa title, ou descrição completa, ou preço, quando title vem null do n8n
function listingDisplayTitle(l) {
  if (l.title && String(l.title).trim()) return l.title;
  if (l.description && String(l.description).trim()) return l.description.trim();
  if (l.salePrice) return l.salePrice;
  return '(Sem título)';
}

export default function Listings() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(API + '/listings')
      .then((r) => r.json())
      .then(setListings)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function remove(id) {
    if (!confirm('Excluir este anúncio?')) return;
    const res = await fetch(API + '/listings/' + id, { method: 'DELETE' });
    if (res.ok) setListings((prev) => prev.filter((l) => l.id !== id));
    else setError((await res.json()).error);
  }

  if (loading) return <p className="muted">Carregando...</p>;
  if (error) return <p style={{ color: 'var(--danger)' }}>Erro: {error}</p>;

  return (
    <>
      <h1>Anúncios</h1>
      {listings.length === 0 ? (
        <div className="card">
          <p className="muted">Nenhum anúncio. <Link to="/novo">Criar o primeiro</Link>.</p>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {listings.map((l) => {
            const img = (l.carousel_images && l.carousel_images[0]) || (l.images && l.images[0]);
            return (
            <li key={l.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
                  {img && (
                    <img src={img} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <strong>{listingDisplayTitle(l)}</strong>
                    <div style={{ marginTop: '0.5rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
                      {l.salePrice && <span className="badge">{l.salePrice}</span>}
                      {l.imobname && <span className="badge" style={{ marginLeft: '0.5rem' }}>{l.imobname}</span>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Link to={'/listing/' + l.id} className="btn">Editar</Link>
                  <Link to={'/listing/' + l.id + '/webhook'} className="btn btn-primary">Formatar e enviar webhook</Link>
                  <button type="button" className="btn btn-danger" onClick={() => remove(l.id)}>Excluir</button>
                </div>
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
