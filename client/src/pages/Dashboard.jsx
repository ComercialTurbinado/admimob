import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API, API_NOT_RESPONDING_MSG, isLocalhost } from '../api';

async function apiGet(url) {
  const res = await fetch(API + url);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    throw new Error('A API não está respondendo. Execute no terminal: npm run dev');
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

const KPI_LABELS = {
  leads: 'Leads',
  clientes_ativos: 'Clientes Ativos',
  negociacoes: 'Negociações',
  vendas_mes: 'Vendas (Mês)',
};

// Cliente fictício para exibir o layout quando não houver dados do banco
const MOCK_CLIENT = {
  id: 'demo',
  name: 'Regina Guerreiro Imoveis',
  logo_url: 'https://resizedimgs.vivareal.com/img/vr-listing/e9cfb78f81731ee3743dc1b24339625a/regina-guerreiro-imoveis.webp',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [loadingSeed, setLoadingSeed] = useState(false);

  const searchLower = (search || '').trim().toLowerCase();
  const filtered = searchLower
    ? clients.filter((c) => {
        const name = (c.name || '').toLowerCase();
        const contact = (c.contact_name || '').toLowerCase();
        return name.includes(searchLower) || contact.includes(searchLower);
      })
    : clients;
  const leads = filtered.filter((c) => (c.status || 'lead') === 'lead');
  const clientes = filtered.filter((c) => (c.status || '') !== 'lead');

  function loadData() {
    setApiError(null);
    Promise.all([apiGet('/dashboard'), apiGet('/clients')])
      .then(([d, c]) => {
        setDashboard(d);
        setClients(Array.isArray(c) ? c : []);
      })
      .catch((e) => {
        const msg = e.message || 'Não foi possível conectar à API.';
        setApiError(msg.includes('<!DOCTYPE') || msg.includes('Unexpected token') ? API_NOT_RESPONDING_MSG : msg);
        setDashboard(null);
        setClients([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadData();
  }, []);

  async function loadExampleClient() {
    setLoadingSeed(true);
    setApiError(null);
    try {
      const res = await fetch(API + '/seed', { method: 'POST' });
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) throw new Error(API_NOT_RESPONDING_MSG);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await loadData();
    } catch (e) {
      const msg = e.message || 'Erro ao carregar exemplo.';
      setApiError(msg.includes('<!DOCTYPE') || msg.includes('Unexpected token') ? API_NOT_RESPONDING_MSG : msg);
    } finally {
      setLoadingSeed(false);
    }
  }

  if (loading) return <p className="muted">Carregando...</p>;
  const kpis = dashboard?.kpis || {};
  const links = dashboard?.payment_links || {};
  const plans = dashboard?.plans || [];

  return (
    <>
      <h1 style={{ marginBottom: '1.5rem' }}>Dashboard Executivo</h1>

      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.1rem', color: 'var(--muted)' }}>Indicadores</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
          {Object.entries(KPI_LABELS).map(([key, label]) => (
            <div key={key} className="kpi-card">
              <div className="kpi-value">{dashboard ? (Number(kpis[key]) ?? 0) : '—'}</div>
              <div className="kpi-label">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.1rem', color: 'var(--muted)' }}>Links de Pagamento</h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {plans.filter((p) => p.payment_url).map((p) => (
            <a
              key={p.id}
              href={p.payment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              {p.label}
            </a>
          ))}
          {plans.filter((p) => p.payment_url).length === 0 && (
            <>
              {[
                { key: 'plan_65', label: 'R$ 65', url: links.plan_65 },
                { key: 'plan_297', label: 'R$ 297', url: links.plan_297 },
                { key: 'plan_497', label: 'R$ 497', url: links.plan_497 },
              ].map(({ key, label, url }) => (
                <a
                  key={key}
                  href={url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ opacity: url ? 1 : 0.6 }}
                >
                  {label}
                </a>
              ))}
            </>
          )}
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
          Configure os links em <Link to="/config">Configurações</Link> (planos com URL).
        </p>
      </section>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--muted)' }}>Clientes cadastrados</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="search"
              placeholder="Buscar por nome ou contato..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ minWidth: 220, padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid var(--border)' }}
              aria-label="Buscar clientes"
            />
            <Link to="/cliente/novo" className="btn btn-primary">Novo cliente</Link>
          </div>
        </div>
        {apiError && (
          <div className="card" style={{ borderColor: 'var(--danger)', marginBottom: '1rem' }}>
            <p style={{ color: 'var(--danger)', margin: 0 }}>{apiError}</p>
            {apiError === API_NOT_RESPONDING_MSG && (
              <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                {isLocalhost ? 'No terminal, na pasta do projeto: npm run dev' : 'Veja no README a seção "Deploy no Amplify".'}
              </p>
            )}
          </div>
        )}
        {clients.length === 0 && (
          <div className="card" style={{ marginBottom: '1rem' }}>
            <p className="muted" style={{ marginBottom: '0.5rem' }}>Nenhum cliente no banco. Abaixo: cliente fictício para você ver o layout.</p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Link to="/cliente/novo" className="btn btn-primary">Cadastrar cliente</Link>
              <button type="button" className="btn" onClick={loadExampleClient} disabled={loadingSeed || !!apiError}>
                {loadingSeed ? 'Carregando...' : 'Carregar cliente de exemplo no banco'}
              </button>
            </div>
          </div>
        )}

        {searchLower && filtered.length === 0 && clients.length > 0 && (
          <p className="muted" style={{ marginBottom: '1rem' }}>Nenhum resultado para &quot;{search}&quot;.</p>
        )}

        {filtered.length > 0 && (
          <>
            {leads.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>Leads</h3>
                <div className="client-grid">
                  {leads.map((c) => (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      className="client-card"
                      onClick={() => navigate('/cliente/' + c.id + '/area')}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/cliente/' + c.id + '/area'); } }}
                    >
                      <div className="client-card-logo">
                        {c.logo_url ? (
                          <img src={c.logo_url} alt="" />
                        ) : (
                          <span className="client-card-initial">{(c.name || '?').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <span className="client-card-name">{c.name || 'Sem nome'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {clientes.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>Clientes</h3>
                <div className="client-grid">
                  {clientes.map((c) => (
                    <div
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      className="client-card"
                      onClick={() => navigate('/cliente/' + c.id + '/area')}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/cliente/' + c.id + '/area'); } }}
                    >
                      <div className="client-card-logo">
                        {c.logo_url ? (
                          <img src={c.logo_url} alt="" />
                        ) : (
                          <span className="client-card-initial">{(c.name || '?').charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <span className="client-card-name">{c.name || 'Sem nome'}</span>
                      {(c.status === 'negotiation') && <span className="badge" style={{ marginTop: 4 }}>negociação</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {clients.length === 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>Exemplo</h3>
                <div className="client-grid">
                  <div
                    role="button"
                    tabIndex={0}
                    className="client-card"
                    onClick={() => navigate('/cliente/demo/area')}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/cliente/demo/area'); } }}
                  >
                    <div className="client-card-logo">
                      <img src={MOCK_CLIENT.logo_url} alt="" />
                    </div>
                    <span className="client-card-name">{MOCK_CLIENT.name}</span>
                    <span className="badge" style={{ marginTop: 4 }}>exemplo</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {clients.length === 0 && filtered.length === 0 && (
          <div style={{ marginTop: '1rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--muted)', marginBottom: '0.75rem' }}>Exemplo</h3>
            <div className="client-grid">
              <div
                role="button"
                tabIndex={0}
                className="client-card"
                onClick={() => navigate('/cliente/demo/area')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/cliente/demo/area'); } }}
              >
                <div className="client-card-logo">
                  <img src={MOCK_CLIENT.logo_url} alt="" />
                </div>
                <span className="client-card-name">{MOCK_CLIENT.name}</span>
                <span className="badge" style={{ marginTop: 4 }}>exemplo</span>
              </div>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
