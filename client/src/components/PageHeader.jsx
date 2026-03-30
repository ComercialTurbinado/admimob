import { Link } from 'react-router-dom';

/**
 * PageHeader — cabeçalho padrão de todas as páginas admin
 *
 * Props:
 *   title        string         — título principal
 *   subtitle     string         — linha de apoio abaixo do título (opcional)
 *   breadcrumbs  [{label, to}]  — trilha de navegação (to = rota, omitir no último item)
 *   children                   — botões/ações à direita do cabeçalho
 */
export default function PageHeader({ title, subtitle, breadcrumbs, children }) {
  return (
    <>
      {breadcrumbs?.length > 0 && (
        <nav className="breadcrumb" aria-label="navegação">
          {breadcrumbs.map((b, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              {i > 0 && <span className="breadcrumb-sep">›</span>}
              {b.to
                ? <Link to={b.to} className="breadcrumb-link">{b.label}</Link>
                : <span className="breadcrumb-current">{b.label}</span>}
            </span>
          ))}
        </nav>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {children && (
          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {children}
          </div>
        )}
      </div>
    </>
  );
}
