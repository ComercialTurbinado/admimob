import { Outlet, NavLink, useLocation } from 'react-router-dom';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '◈', exact: true },
  { to: '/clientes', label: 'Clientes', icon: '◉' },
];

const NAV_SOON = [
  { label: 'Imóveis', icon: '⬡' },
  { label: 'Produções', icon: '▶' },
];

export default function AppLayout() {
  const location = useLocation();

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span style={{ fontSize: '1.2rem' }}>✦</span>
          <span className="sidebar-brand-name">admimob</span>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(({ to, label, icon, exact }) => {
            const isActive = exact ? location.pathname === to : location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                className={'sidebar-link' + (isActive ? ' active' : '')}
                style={{ textDecoration: 'none' }}
              >
                <span style={{ fontSize: '1rem', lineHeight: 1 }}>{icon}</span>
                <span>{label}</span>
              </NavLink>
            );
          })}

          <div className="sidebar-section" style={{ marginTop: '0.75rem' }}>Em breve</div>
          {NAV_SOON.map(({ label, icon }) => (
            <div key={label} className="sidebar-link" style={{ opacity: 0.4, cursor: 'default' }}>
              <span style={{ fontSize: '1rem', lineHeight: 1 }}>{icon}</span>
              <span>{label}</span>
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <NavLink
            to="/config"
            className={'sidebar-link' + (location.pathname === '/config' ? ' active' : '')}
            style={{ textDecoration: 'none' }}
          >
            <span style={{ fontSize: '0.95rem' }}>⚙</span>
            <span>Configurações</span>
          </NavLink>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        <div className="page-wrap">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
