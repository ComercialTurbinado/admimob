import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Config from './pages/Config';
import ClienteForm from './pages/ClienteForm';
import ClienteArea from './pages/ClienteArea';
import Producao from './pages/Producao';
import Materiais from './pages/Materiais';

export default function App() {
  return (
    <BrowserRouter>
      <nav style={{ borderBottom: '1px solid var(--border)', padding: '1rem 1.5rem', marginBottom: '1rem' }}>
        <Link to="/" style={{ marginRight: '1.5rem', fontWeight: 600 }}>Divulga Imob</Link>
        <Link to="/config">Configurações</Link>
      </nav>
      <div className="container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/config" element={<Config />} />
          <Route path="/cliente/novo" element={<ClienteForm />} />
          <Route path="/cliente/:id/area" element={<ClienteArea />} />
          <Route path="/cliente/:id" element={<ClienteForm />} />
          <Route path="/cliente/:clientId/produto/:id" element={<Producao />} />
          <Route path="/cliente/:clientId/produto/:id/materiais" element={<Materiais />} />
          <Route path="/producao/:id" element={<Producao />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
