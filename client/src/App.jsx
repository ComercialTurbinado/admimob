import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Config from './pages/Config';
import ClienteForm from './pages/ClienteForm';
import ClienteArea from './pages/ClienteArea';
import ClienteDesign from './pages/ClienteDesign';
import Producao from './pages/Producao';
import Materiais from './pages/Materiais';
import PosterVideo from './pages/PosterVideo';
import SimulacaoLayouts from './pages/SimulacaoLayouts';
import AppLayout from './components/AppLayout';

const ClienteProfile = lazy(() => import('./pages/ClienteProfile'));
const ClienteHub = lazy(() => import('./pages/ClienteHub'));
const Clientes = lazy(() => import('./pages/Clientes'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<p style={{ padding: '2rem', color: 'var(--muted)' }}>Carregando...</p>}>
        <Routes>
          {/* Layout routes — with sidebar */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/config" element={<Config />} />
            <Route path="/cliente/novo" element={<ClienteForm />} />
            <Route path="/cliente/:id/area" element={<ClienteArea />} />
            <Route path="/cliente/:id/design" element={<ClienteDesign />} />
            <Route path="/cliente/:id/perfil" element={<ClienteProfile />} />
            <Route path="/cliente/:id/hub" element={<ClienteHub />} />
            <Route path="/cliente/:id" element={<ClienteForm />} />
            <Route path="/cliente/:clientId/produto/:id" element={<Producao />} />
            <Route path="/cliente/:clientId/produto/:id/materiais" element={<Materiais />} />
            <Route path="/producao/:id" element={<Producao />} />
          </Route>
          {/* No layout — full-screen pages */}
          <Route path="/cliente/:clientId/produto/:id/poster-video" element={<PosterVideo />} />
          <Route path="/poster-video/:id" element={<PosterVideo />} />
          <Route path="/simulacao-layouts" element={<SimulacaoLayouts />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
