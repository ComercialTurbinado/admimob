import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API, proxyImageUrl } from '../api';

const KANBAN_COLS = [
  { key: 'lead', label: 'Lead', color: '#f2ca50', textColor: '#1a1200' },
  { key: 'qualified', label: 'Qualificado', color: '#60a5fa', textColor: '#0a1a2e' },
  { key: 'onboarding', label: 'Onboarding', color: '#c084fc', textColor: '#1a0a2e' },
  { key: 'active', label: 'Ativo', color: '#4ade80', textColor: '#0a1a0e' },
  { key: 'inactive', label: 'Inativo', color: '#9ca3af', textColor: '#1a1a1a' },
];

const STATUS_LABELS = {
  lead: 'Novo Lead',
  qualified: 'Qualificado',
  negotiation: 'Qualificado',
  onboarding: 'Onboarding',
  active: 'Ativo',
  inactive: 'Inativo',
};

const STATUS_CLASS = {
  lead: 'status-lead',
  qualified: 'status-qualified',
  negotiation: 'status-qualified',
  onboarding: 'status-onboarding',
  active: 'status-active',
  inactive: 'status-inactive',
};

function normalizeStatus(status) {
  if (!status) return 'lead';
  if (status === 'negotiation') return 'qualified';
  return status;
}

function ClientLogo({ client, size = 36 }) {
  if (client.logo_url) {
    return (
      <img
        src={proxyImageUrl(client.logo_url)}
        alt=""
        className="logo-sm"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="logo-initial"
      style={{ width: size, height: size, fontSize: size * 0.44 }}
    >
      {(client.name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

export default function Clientes() {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState('list');
  const [search, setSearch] = useState('');
  const [sortAsc, setSortAsc] = useState(true);

  const loadClients = useCallback(() => {
    setError(null);
    fetch(API + '/clients')
      .then((res) => {
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) throw new Error('API não está respondendo.');
        return res.json();
      })
      .then((data) => {
        if (data && data.error) throw new Error(data.error);
        setClients(Array.isArray(data) ? data : []);
      })
      .catch((e) => setError(e.message || 'Erro ao carregar clientes.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  async function updateStatus(clientId, newStatus) {
    // Optimistic update
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, status: newStatus } : c))
    );
    try {
      const res = await fetch(API + '/clients/' + clientId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) throw new Error('API não está respondendo.');
      const data = await res.json();
      if (data && data.error) throw new Error(data.error);
    } catch (e) {
      // Revert on error
      loadClients();
    }
  }

  function moveLeft(client) {
    const currentStatus = normalizeStatus(client.status);
    const idx = KANBAN_COLS.findIndex((c) => c.key === currentStatus);
    if (idx <= 0) return;
    updateStatus(client.id, KANBAN_COLS[idx - 1].key);
  }

  function moveRight(client) {
    const currentStatus = normalizeStatus(client.status);
    const idx = KANBAN_COLS.findIndex((c) => c.key === currentStatus);
    if (idx < 0 || idx >= KANBAN_COLS.length - 1) return;
    updateStatus(client.id, KANBAN_COLS[idx + 1].key);
  }

  const searchLower = search.trim().toLowerCase();
  const filtered = searchLower
    ? clients.filter((c) => {
        const name = (c.name || '').toLowerCase();
        const contact = (c.contact_name || '').toLowerCase();
        return name.includes(searchLower) || contact.includes(searchLower);
      })
    : clients;

  const sorted = [...filtered].sort((a, b) => {
    const na = (a.name || '').toLowerCase();
    const nb = (b.name || '').toLowerCase();
    return sortAsc ? na.localeCompare(nb) : nb.localeCompare(na);
  });

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      });
    } catch {
      return '—';
    }
  }

  if (loading) {
    return (
      <div className="page-wrap">
        <p style={{ color: 'var(--muted)', paddingTop: '2rem' }}>Carregando clientes...</p>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Clientes</h1>
          <p className="page-subtitle">{clients.length} cliente{clients.length !== 1 ? 's' : ''} cadastrado{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="view-toggle">
            <button
              className={view === 'list' ? 'active' : ''}
              onClick={() => setView('list')}
              title="Visualização em lista"
            >
              ☰ Lista
            </button>
            <button
              className={view === 'kanban' ? 'active' : ''}
              onClick={() => setView('kanban')}
              title="Visualização em kanban"
            >
              ⊞ Kanban
            </button>
          </div>
          <input
            type="search"
            className="search-input"
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar clientes"
          />
          <Link to="/cliente/novo" className="btn btn-primary">
            + Novo Cliente
          </Link>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          className="card"
          style={{ borderColor: 'var(--danger)', marginBottom: '1rem' }}
        >
          <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!error && clients.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <p style={{ color: 'var(--muted)', marginBottom: '1rem', fontSize: '0.95rem' }}>
            Nenhum cliente cadastrado ainda.
          </p>
          <Link to="/cliente/novo" className="btn btn-primary">
            + Cadastrar primeiro cliente
          </Link>
        </div>
      )}

      {/* List view */}
      {!error && clients.length > 0 && view === 'list' && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          {sorted.length === 0 && searchLower ? (
            <p style={{ padding: '2rem', color: 'var(--muted)', textAlign: 'center' }}>
              Nenhum resultado para &quot;{search}&quot;.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="td-logo" aria-label="Logo"></th>
                    <th
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => setSortAsc((v) => !v)}
                      title="Ordenar por nome"
                    >
                      Nome {sortAsc ? '↑' : '↓'}
                    </th>
                    <th>Plano</th>
                    <th>Status</th>
                    <th>Qtd Imóveis</th>
                    <th>Última atualização</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c) => {
                    const status = normalizeStatus(c.status);
                    const statusLabel = STATUS_LABELS[c.status] || STATUS_LABELS[status] || status;
                    const statusClass = STATUS_CLASS[c.status] || STATUS_CLASS[status] || '';
                    return (
                      <tr key={c.id}>
                        <td className="td-logo">
                          <ClientLogo client={c} size={36} />
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: 'var(--text)' }}>
                            {c.name || 'Sem nome'}
                          </span>
                          {c.contact_name && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>
                              {c.contact_name}
                            </div>
                          )}
                        </td>
                        <td>
                          {c.plan ? (
                            <span className="badge">{c.plan}</span>
                          ) : (
                            <span style={{ color: 'var(--muted)' }}>—</span>
                          )}
                        </td>
                        <td>
                          <span className={'badge ' + statusClass}>{statusLabel}</span>
                        </td>
                        <td style={{ color: 'var(--muted)' }}>—</td>
                        <td style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                          {formatDate(c.updated_at || c.created_at)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <Link
                              to={'/cliente/' + c.id + '/hub'}
                              className="btn"
                              style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                              title="Abrir Hub do cliente"
                            >
                              Hub
                            </Link>
                            <Link
                              to={'/cliente/' + c.id}
                              className="btn"
                              style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                              title="Editar cliente"
                            >
                              Editar
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Kanban view */}
      {!error && clients.length > 0 && view === 'kanban' && (
        <>
          {searchLower && filtered.length === 0 && (
            <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>
              Nenhum resultado para &quot;{search}&quot;.
            </p>
          )}
          <div className="kanban-board">
            {KANBAN_COLS.map((col) => {
              const colClients = filtered.filter(
                (c) => normalizeStatus(c.status) === col.key
              );
              return (
                <div key={col.key} className="kanban-col">
                  <div
                    className="kanban-col-header"
                    style={{
                      background: col.color + '22',
                      color: col.color,
                      borderTop: '2px solid ' + col.color,
                    }}
                  >
                    <span>{col.label}</span>
                    <span
                      style={{
                        background: col.color + '33',
                        color: col.color,
                        borderRadius: '50px',
                        padding: '1px 8px',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                      }}
                    >
                      {colClients.length}
                    </span>
                  </div>
                  <div className="kanban-col-body">
                    {colClients.length === 0 ? (
                      <p
                        style={{
                          color: 'var(--muted)',
                          fontSize: '0.75rem',
                          textAlign: 'center',
                          padding: '0.75rem 0',
                          margin: 0,
                        }}
                      >
                        Nenhum cliente
                      </p>
                    ) : (
                      colClients.map((c) => {
                        const currentIdx = KANBAN_COLS.findIndex(
                          (k) => k.key === normalizeStatus(c.status)
                        );
                        const canMoveLeft = currentIdx > 0;
                        const canMoveRight = currentIdx < KANBAN_COLS.length - 1;
                        return (
                          <div key={c.id} className="kanban-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <ClientLogo client={c} size={28} />
                              <span className="kanban-card-name">{c.name || 'Sem nome'}</span>
                            </div>
                            {c.plan && (
                              <div>
                                <span className="badge" style={{ fontSize: '0.68rem' }}>
                                  {c.plan}
                                </span>
                              </div>
                            )}
                            <div className="kanban-card-actions">
                              <button
                                className="kanban-move-btn"
                                onClick={() => moveLeft(c)}
                                disabled={!canMoveLeft}
                                title="Mover para estágio anterior"
                                style={{ opacity: canMoveLeft ? 1 : 0.3 }}
                              >
                                ◀
                              </button>
                              <button
                                className="kanban-move-btn"
                                onClick={() => moveRight(c)}
                                disabled={!canMoveRight}
                                title="Mover para próximo estágio"
                                style={{ opacity: canMoveRight ? 1 : 0.3 }}
                              >
                                ▶
                              </button>
                              <Link
                                to={'/cliente/' + c.id + '/hub'}
                                className="kanban-move-btn"
                                style={{
                                  textDecoration: 'none',
                                  color: 'var(--gold)',
                                  borderColor: 'rgba(242,202,80,0.3)',
                                  marginLeft: 'auto',
                                }}
                                title="Abrir Hub"
                              >
                                Hub →
                              </Link>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
