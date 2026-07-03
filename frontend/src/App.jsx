import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import CocinaLayout from './components/CocinaLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Menu from './pages/Menu';
import Mesas from './pages/Mesas';
import Cocina from './pages/Cocina';
import Pedidos from './pages/Pedidos';
import Reportes from './pages/Reportes';
import Inventario from './pages/Inventario';
import Contaduria from './pages/Contaduria';
import Proximamente from './pages/Proximamente';
import NotFound from './pages/NotFound';

function Inicio() {
  const { estaAutenticado, cargando } = useAuth();

  if (cargando) {
    return null;
  }

  return <Navigate to={estaAutenticado ? '/dashboard' : '/login'} replace />;
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
          style: { background: '#1a1a1a', color: '#fff', border: '1px solid #2a2a2a' },
        }}
      />
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/login" element={<Login />} />
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
              <Proximamente titulo="Configuración" />
            </ConLayout>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
