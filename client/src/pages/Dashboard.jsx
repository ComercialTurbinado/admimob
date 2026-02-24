import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API = '/api';

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
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [loadingSeed, setLoadingSeed] = useState(false);

  function loadData() {
    setApiError(null);
    return Promise.all([
      fetch(API + '/dashboard').then((r) => r.json()),
      fetch(API + '/clients').then((r) => r.json()),
    ])
      .then(([d, c]) => {
        setDashboard(d);
        setClients(Array.isArray(c) ? c : []);
      })
      .catch((e) => {
        setApiError(e.message || 'Não foi possível conectar à API.');
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
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await loadData();
    } catch (e) {
      setApiError(e.message || 'Erro ao carregar exemplo.');
    } finally {
      setLoadingSeed(false);
    }
  }

  if (loading) return <p className="muted">Carregando...</p>;
  const kpis = dashboard?.kpis || {};
  const links = dashboard?.payment_links || {};

  return (
    <>
      <h1 style={{ marginBottom: '1.5rem' }}>Dashboard Executivo</h1>

      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.1rem', color: 'var(--muted)' }}>Indicadores</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
          {Object.entries(KPI_LABELS).map(([key, label]) => (
            <div key={key} className="kpi-card">
              <div className="kpi-value">{Number(kpis[key]) ?? 0}</div>
              <div className="kpi-label">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.1rem', color: 'var(--muted)' }}>Links de Pagamento</h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {(dashboard?.plans || []).filter((p) => p.payment_url).map((p) => (
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
          {(!dashboard?.plans || dashboard.plans.filter((p) => p.payment_url).length === 0) && (
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
          Configure os links em <Link to="/config">Configurações</Link> (planos com URL ou links legado).
        </p>
      </section>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--muted)' }}>Clientes cadastrados</h2>
          <Link to="/cliente/novo" className="btn btn-primary">Novo cliente</Link>
        </div>
        {apiError && (
          <div className="card" style={{ borderColor: 'var(--danger)', marginBottom: '1rem' }}>
            <p style={{ color: 'var(--danger)', margin: 0 }}>{apiError}</p>
            <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
              Certifique-se de que o servidor está rodando: no terminal, execute <code style={{ background: 'var(--border)', padding: '0.2rem 0.4rem', borderRadius: 4 }}>npm run dev</code> na pasta do projeto.
            </p>
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
        <div className="client-grid">
          {(clients.length > 0 ? clients : [MOCK_CLIENT]).map((c) => (
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
              {c.id === 'demo' && <span className="badge" style={{ marginTop: 4 }}>exemplo</span>}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
