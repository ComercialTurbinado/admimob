import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

import { API } from '../api';

// Dados fictícios para exibir o layout quando não houver banco
const MOCK_CLIENT = {
  id: 'demo',
  name: 'Regina Guerreiro Imoveis',
  logo_url: 'https://resizedimgs.vivareal.com/img/vr-listing/e9cfb78f81731ee3743dc1b24339625a/regina-guerreiro-imoveis.webp',
  contact_name: 'Regina Guerreiro',
};
const MOCK_LISTINGS = [
  { id: 'demo', title: 'Casa com 2 Quartos e 2 banheiros à Venda, 82 m² por R$ 455.000', salePrice: 'R$ 455.000' },
];

// Título para exibição: usa title, ou descrição completa, ou preço (quando n8n envia title null)
function listingDisplayTitle(l) {
  if (l.title && String(l.title).trim()) return l.title;
  if (l.description && String(l.description).trim()) return l.description.trim();
  if (l.salePrice) return l.salePrice;
  return '(Sem título)';
}

export default function ClienteArea() {
  const { id } = useParams();
  const isDemo = id === 'demo';
  const [client, setClient] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(!isDemo);
  const [url, setUrl] = useState('');
  const [json, setJson] = useState('');
  const [importing, setImporting] = useState(false);
  const [importingJson, setImportingJson] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (isDemo) {
      setClient(MOCK_CLIENT);
      setListings(MOCK_LISTINGS);
      setLoading(false);
      return;
    }
    Promise.all([
      fetch(API + '/clients/' + id).then((r) => r.json()),
      fetch(API + '/listings?client_id=' + id).then((r) => r.json()),
    ])
      .then(([c, list]) => {
        setClient(c);
        setListings(Array.isArray(list) ? list : []);
      })
      .catch((e) => setMsg('Erro: ' + e.message))
      .finally(() => setLoading(false));
  }, [id, isDemo]);

  async function refetchListings() {
    const list = await fetch(API + '/listings?client_id=' + id).then((r) => r.json());
    setListings(list);
  }

  async function handleImportLink() {
    if (!url.trim() || isDemo) return;
    setImporting(true);
    setMsg(null);
    try {
      const res = await fetch(API + '/listings/import-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), client_id: Number(id) }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMsg(data.message || 'Importação disparada.');
      setUrl('');
      if (data.id) await refetchListings();
    } catch (e) {
      setMsg('Erro: ' + e.message);
    } finally {
      setImporting(false);
    }
  }

  async function handleImportJson() {
    if (!json.trim() || isDemo) return;
    setImportingJson(true);
    setMsg(null);
    try {
      let data = JSON.parse(json);
      const items = Array.isArray(data) ? data : [data];
      if (items.length === 0) throw new Error('Nenhum anúncio no JSON.');
      const client_id = Number(id);
      if (items.length === 1) {
        const res = await fetch(API + '/listings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw_data: items[0], client_id }),
        });
        const body = await res.json();
        if (body.error) throw new Error(body.error);
        setMsg('1 anúncio cadastrado.');
      } else {
        const res = await fetch(API + '/listings/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items, client_id }),
        });
        const body = await res.json();
        if (body.error) throw new Error(body.error);
        setMsg(body.imported + ' anúncios cadastrados.');
      }
      setJson('');
      await refetchListings();
    } catch (e) {
      setMsg('Erro: ' + (e.message || 'JSON inválido.'));
    } finally {
      setImportingJson(false);
    }
  }

  if (loading) return <p className="muted">Carregando...</p>;
  if (!client) return <p style={{ color: 'var(--danger)' }}>Cliente não encontrado.</p>;

  return (
    <>
      <div style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
        <Link to="/">Dashboard</Link>
        <span style={{ margin: '0 0.5rem', color: 'var(--muted)' }}>→</span>
        <span>{client.name}</span>
      </div>

      {isDemo && (
        <div className="card" style={{ marginBottom: '1rem', borderColor: 'var(--accent)', background: 'rgba(88, 166, 255, 0.08)' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}><strong>Dados fictícios</strong> — layout de exemplo. Cadastre um cliente ou carregue o exemplo no Dashboard para usar dados reais.</p>
        </div>
      )}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="client-card-logo" style={{ width: 56, height: 56 }}>
            {client.logo_url ? (
              <img src={client.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
            ) : (
              <span className="client-card-initial" style={{ fontSize: '1.25rem' }}>{(client.name || '?').charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>{client.name}</h1>
            {client.contact_name && <p style={{ margin: '0.25rem 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>{client.contact_name}</p>}
          </div>
          {!isDemo && <Link to={'/cliente/' + id} className="btn" style={{ marginLeft: 'auto' }}>Editar cadastro do cliente</Link>}
        </div>
      </div>

      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem' }}>Adicionar imóvel</h2>
        <div className="form-group">
          <label>Por link (ZAP, Viva Real, etc.)</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              style={{ flex: 1, minWidth: 200 }}
              readOnly={isDemo}
            />
            <button type="button" className="btn btn-primary" onClick={handleImportLink} disabled={importing || !url.trim() || isDemo}>
              {importing ? 'Importando...' : 'Importar por link'}
            </button>
          </div>
        </div>
        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label>Ou por JSON (cole o anúncio ou array de anúncios)</label>
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            placeholder='{"title": "...", "carousel_images": [...]}'
            rows={5}
            style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
          />
          <button type="button" className="btn btn-primary" onClick={handleImportJson} disabled={importingJson || !json.trim() || isDemo} style={{ marginTop: '0.5rem' }}>
            {importingJson ? 'Importando...' : 'Importar por JSON'}
          </button>
        </div>
        {msg && <p style={{ marginTop: '0.75rem', color: msg.startsWith('Erro') ? 'var(--danger)' : 'var(--success)' }}>{msg}</p>}
      </section>

      <section>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>Imóveis deste cliente</h2>
        {listings.length === 0 ? (
          <div className="card">
            <p className="muted">Nenhum imóvel. Use "Adicionar imóvel" acima para importar por link ou JSON.</p>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {listings.map((l) => {
              const img = (l.carousel_images && l.carousel_images[0]) || (l.images && l.images[0]);
              return (
              <li key={l.id} className="card" style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flex: 1, minWidth: 0 }}>
                    {img && (
                      <img src={img} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <strong>{listingDisplayTitle(l)}</strong>
                      {l.salePrice && <span className="badge" style={{ marginLeft: '0.5rem' }}>{l.salePrice}</span>}
                    </div>
                  </div>
                  <Link to={'/producao/' + l.id} className="btn btn-primary">
                    Editar e enviar para webhook →
                  </Link>
                  {isDemo && l.id === 'demo' && <span className="badge" style={{ marginLeft: '0.5rem' }}>exemplo</span>}
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
