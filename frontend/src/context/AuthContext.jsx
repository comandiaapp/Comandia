import { createContext, useContext, useEffect, useState } from 'react';

import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [restaurante, setRestaurante] = useState(null);
  const [token, setToken] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    async function validarToken() {
      const tokenGuardado = localStorage.getItem('token');

      if (!tokenGuardado) {
        setCargando(false);
        return;
      }

      try {
        const { data } = await api.get('/api/auth/me');
        setUsuario(data.datos.usuario);
        setRestaurante(data.datos.restaurante);
        setToken(tokenGuardado);
      } catch {
        localStorage.removeItem('token');
      } finally {
        setCargando(false);
      }
    }

    validarToken();
  }, []);

  async function login(email, password) {
    const { data } = await api.post('/api/auth/login', { email, password });
    localStorage.setItem('token', data.datos.token);
    setToken(data.datos.token);
    setUsuario(data.datos.usuario);
    setRestaurante(data.datos.restaurante);
    return data.datos;
  }

  async function registro(datos) {
    const { data } = await api.post('/api/auth/registro', datos);
    localStorage.setItem('token', data.datos.token);
    setToken(data.datos.token);
    setUsuario(data.datos.usuario);
    setRestaurante(data.datos.restaurante);
    return data.datos;
  }

  async function reenviarVerificacion() {
    const { data } = await api.post('/api/auth/reenviar-verificacion');
    return data.datos;
  }

  async function refrescarUsuario() {
    const { data } = await api.get('/api/auth/me');
    setUsuario(data.datos.usuario);
    setRestaurante(data.datos.restaurante);
    return data.datos;
  }

  function logout() {
    localStorage.removeItem('token');
    setToken(null);
    setUsuario(null);
    setRestaurante(null);
  }

  const estaAutenticado = Boolean(token && usuario);

  return (
    <AuthContext.Provider
      value={{
        usuario,
        restaurante,
        token,
        cargando,
        login,
        registro,
        reenviarVerificacion,
        refrescarUsuario,
        logout,
        estaAutenticado,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}
