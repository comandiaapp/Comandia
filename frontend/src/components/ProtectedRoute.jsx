import { Navigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import Spinner from './Spinner';

function ProtectedRoute({ children }) {
  const { estaAutenticado, cargando } = useAuth();

  if (cargando) {
    return <Spinner />;
  }

  if (!estaAutenticado) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
