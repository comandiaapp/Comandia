import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import CocinaLayout from './components/CocinaLayout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Registro from './pages/Registro';
import VerificarEmail from './pages/VerificarEmail';
import OlvideMiPassword from './pages/OlvideMiPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Menu from './pages/Menu';
import Mesas from './pages/Mesas';
import Cocina from './pages/Cocina';
import Pedidos from './pages/Pedidos';
import Reportes from './pages/Reportes';
import Inventario from './pages/Inventario';
import Compras from './pages/Compras';
import Contaduria from './pages/Contaduria';
import Configuracion from './pages/Configuracion';
import NotFound from './pages/NotFound';

function Inicio() {
  const { estaAutenticado, cargando } = useAuth();

  if (cargando) {
    return null;
  }

  if (estaAutenticado) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Landing />;
}

function ConLayout({ children }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
          },
          success: { iconTheme: { primary: 'var(--success)', secondary: 'var(--bg-card)' } },
          error: { iconTheme: { primary: 'var(--error)', secondary: 'var(--bg-card)' } },
        }}
      />
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/verificar-email" element={<VerificarEmail />} />
        <Route path="/olvide-mi-password" element={<OlvideMiPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/dashboard"
          element={
            <ConLayout>
              <Dashboard />
            </ConLayout>
          }
        />
        <Route
          path="/menu"
          element={
            <ConLayout>
              <Menu />
            </ConLayout>
          }
        />
        <Route
          path="/mesas"
          element={
            <ConLayout>
              <Mesas />
            </ConLayout>
          }
        />
        <Route
          path="/pedidos"
          element={
            <ConLayout>
              <Pedidos />
            </ConLayout>
          }
        />
        <Route
          path="/cocina"
          element={
            <ProtectedRoute>
              <CocinaLayout>
                <Cocina />
              </CocinaLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventario"
          element={
            <ConLayout>
              <Inventario />
            </ConLayout>
          }
        />
        <Route
          path="/compras"
          element={
            <ConLayout>
              <Compras />
            </ConLayout>
          }
        />
        <Route
          path="/reportes"
          element={
            <ConLayout>
              <Reportes />
            </ConLayout>
          }
        />
        <Route
          path="/contaduria"
          element={
            <ConLayout>
              <Contaduria />
            </ConLayout>
          }
        />
        <Route
          path="/configuracion"
          element={
            <ConLayout>
              <Configuracion />
            </ConLayout>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
