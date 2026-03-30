import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API, API_NOT_RESPONDING_MSG, isLocalhost, proxyImageUrl } from '../api';

async function apiGet(url) {
  const res = await fetch(API + url);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    throw new Error(API_NOT_RESPONDING_MSG);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

const KPI_DEFS = [
  { key: 'leads', label: 'Leads', icon: '◎', desc: 'Novos contatos' },
  { key: 'negociacoes', label: 'Qualificados', icon: '◈', desc: 'Em negociação' },
  { key: 'clientes_ativos', label: 'Ativos', icon: '◉', desc: 'Clientes ativos' },
  { key: 'vendas_mes', label: 'Vendas (Mês)', icon: '✦', desc: 'Este mês' },
];

const STATUS_CLASS = {
  lead: 'status-lead',
  qualified: 'status-qualified',
  negotiation: 'status-qualified',
  onboarding: 'status-onboarding',
  active: 'status-active',
  inactive: 'status-inactive',
};

const STATUS_LABELS = {
  lead: 'Lead',
  qualified: 'Qualificado',
  negotiation: 'Qualificado',
  onboarding: 'Onboarding',
  active: 'Ativo',
  inactive: 'Inativo',
};

function ClientLogo({ client, size = 40 }) {
  if (client.logo_url) {
    return (
      <img
        src={proxyImageUrl(client.logo_url)}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: 6,
          objectFit: 'contain',
          background: 'var(--surface-hi)',
          display: 'block',
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        background: 'var(--surface-hi)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Noto Serif', serif",
        fontWeight: 900,
        color: 'var(--gold)',
        fontSize: size * 0.44,
        flexShrink: 0,
      }}
    >
      {(client.name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return null;
  }
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [loadingSeed, setLoadingSeed] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importingUrl, setImportingUrl] = useState(false);
  const [importMsg, setImportMsg] = useState(null);
  const [lastImportedClientId, setLastImportedClientId] = useState(null);

  function loadData() {
    setApiError(null);
    Promise.all([apiGet('/dashboard'), apiGet('/clients')])
      .then(([d, c]) => {
        setDashboard(d);
        setClients(Array.isArray(c) ? c : []);
      })
      .catch((e) => {
        const msg = e.message || 'Não foi possível conectar à API.';
        setApiError(
          msg.includes('<!DOCTYPE') || msg.includes('Unexpected token')
            ? API_NOT_RESPONDING_MSG
            : msg
        );
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
      setApiError(
        msg.includes('<!DOCTYPE') || msg.includes('Unexpected token')
          ? API_NOT_RESPONDING_MSG
          : msg
      );
    } finally {
      setLoadingSeed(false);
    }
  }

  async function handleImportByLink() {
    if (!importUrl.trim()) return;
    setImportingUrl(true);
    setImportMsg(null);
    try {
      const res = await fetch(API + '/listings/import-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setImportMsg(data.message || 'Imóvel importado com sucesso.');
      setImportUrl('');
      if (data.client_id) {
        setLastImportedClientId(data.client_id);
        loadData();
      } else {
        setLastImportedClientId(null);
      }
    } catch (e) {
      setImportMsg('Erro: ' + (e.message || 'Falha na importação'));
    } finally {
      setImportingUrl(false);
    }
  }

  const kpis = dashboard?.kpis || {};
  const recentClients = clients.slice(0, 6);

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  if (loading) {
    return (
      <>
        <p style={{ color: 'var(--muted)', paddingTop: '2rem' }}>Carregando...</p>
      </>
    );
  }

  return (
    <>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle" style={{ textTransform: 'capitalize' }}>{today}</p>
        </div>
        <Link to="/cliente/novo" className="btn btn-primary">
          + Novo Cliente
        </Link>
      </div>

      {/* API Error */}
      {apiError && (
        <div
          className="card"
          style={{ borderColor: 'var(--danger)', marginBottom: '1.5rem' }}
        >
          <p style={{ color: 'var(--danger)', margin: 0, fontWeight: 600 }}>{apiError}</p>
          {apiError === API_NOT_RESPONDING_MSG && (
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.5rem', marginBottom: 0 }}>
              {isLocalhost
                ? 'No terminal, na pasta do projeto: npm run dev'
                : 'Veja no README a seção "Deploy no Amplify".'}
            </p>
          )}
        </div>
      )}

      {/* KPI cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '0.85rem',
          marginBottom: '2rem',
        }}
      >
        {KPI_DEFS.map(({ key, label, icon, desc }) => (
          <div key={key} className="kpi-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span
                style={{
                  fontSize: '1.1rem',
                  color: 'var(--gold)',
                  opacity: 0.8,
                  lineHeight: 1,
                }}
              >
                {icon}
              </span>
            </div>
            <div className="kpi-value">
              {dashboard ? (kpis[key] ?? 0) : '—'}
            </div>
            <div className="kpi-label">{label}</div>
          </div>
        ))}
        {/* MRR Estimado — calculado dos clientes ativos */}
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.1rem', color: 'var(--gold)', opacity: 0.8, lineHeight: 1 }}>
              ◆
            </span>
          </div>
          <div className="kpi-value">
            {clients.length > 0
              ? clients.filter((c) => c.status === 'active').length
              : '—'}
          </div>
          <div className="kpi-label">MRR Est.</div>
        </div>
      </div>

      {/* Ação Rápida — Importar imóvel */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--subtle)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Ação Rápida — Importar Imóvel
          </h2>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.83rem', marginBottom: '0.85rem', marginTop: 0, lineHeight: 1.55 }}>
          Cole o link do anúncio (ZAP, Viva Real, etc.). O sistema importa as informações e cria o cliente se necessário.
        </p>
        <div className="import-box">
          <input
            type="url"
            className="import-input"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            placeholder="https://www.zapimoveis.com.br/..."
            onKeyDown={(e) => e.key === 'Enter' && handleImportByLink()}
            aria-label="Link do imóvel"
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleImportByLink}
            disabled={importingUrl || !importUrl.trim() || !!apiError}
          >
            {importingUrl ? 'Importando...' : 'Importar'}
          </button>
        </div>
        {importMsg && (
          <p
            style={{
              marginTop: '0.6rem',
              marginBottom: 0,
              fontSize: '0.85rem',
              color: importMsg.startsWith('Erro') ? 'var(--danger)' : 'var(--success)',
            }}
          >
            {importMsg}
            {lastImportedClientId && (
              <>
                {' '}
                <Link to={'/cliente/' + lastImportedClientId + '/area'}>
                  Ver área do cliente →
                </Link>
              </>
            )}
          </p>
        )}
      </div>

      {/* Clientes Recentes */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--subtle)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Clientes Recentes
          </h2>
          {clients.length > 6 && (
            <Link to="/clientes" style={{ fontSize: '0.82rem', color: 'var(--gold)' }}>
              Ver todos ({clients.length}) →
            </Link>
          )}
        </div>

        {clients.length === 0 ? (
          <div
            className="card"
            style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}
          >
            <p style={{ color: 'var(--muted)', margin: '0 0 1rem', fontSize: '0.9rem' }}>
              Nenhum cliente no banco ainda.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/cliente/novo" className="btn btn-primary">
                Cadastrar cliente
              </Link>
              <button
                type="button"
                className="btn"
                onClick={loadExampleClient}
                disabled={loadingSeed || !!apiError}
              >
                {loadingSeed ? 'Carregando...' : 'Carregar exemplo'}
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="td-logo" aria-label="Logo"></th>
                    <th>Nome</th>
                    <th>Status</th>
                    <th>Plano</th>
                    <th>Cadastro</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {recentClients.map((c) => {
                    const statusClass =
                      STATUS_CLASS[c.status] || 'status-lead';
                    const statusLabel =
                      STATUS_LABELS[c.status] || STATUS_LABELS['lead'];
                    return (
                      <tr key={c.id}>
                        <td className="td-logo">
                          <ClientLogo client={c} size={36} />
                        </td>
                        <td>
                          <span
                            style={{
                              fontWeight: 600,
                              color: 'var(--text)',
                              cursor: 'pointer',
                            }}
                            onClick={() => navigate('/cliente/' + c.id + '/hub')}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                navigate('/cliente/' + c.id + '/hub');
                              }
                            }}
                          >
                            {c.name || 'Sem nome'}
                          </span>
                        </td>
                        <td>
                          <span className={'badge ' + statusClass}>
                            {statusLabel}
                          </span>
                        </td>
                        <td>
                          {c.plan ? (
                            <span className="badge">{c.plan}</span>
                          ) : (
                            <span style={{ color: 'var(--muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                          {formatDate(c.created_at) || '—'}
                        </td>
                        <td>
                          <Link
                            to={'/cliente/' + c.id + '/hub'}
                            className="btn"
                            style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                          >
                            Hub →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
