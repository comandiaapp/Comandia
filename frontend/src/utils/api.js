import axios from 'axios';
import toast from 'react-hot-toast';

import { resolverOffline, mirrorRespuestaExitosa, OfflineApiError } from './apiOffline';

const baseURL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Un error de red (backend inalcanzable, sin internet) llega sin
// error.response; un error HTTP normal (400, 404, 500...) sí trae response.
// Solo el primer caso debe intentar resolverse contra la copia local.
function esErrorDeRed(error) {
  return !error.response && Boolean(error.config);
}

api.interceptors.response.use(
  (response) => {
    // Nunca bloquea ni puede tumbar la respuesta real: si el reflejo local
    // falla, mirrorRespuestaExitosa se traga el error internamente.
    mirrorRespuestaExitosa(response.config, response.data);
    return response;
  },
  async (error) => {
    const esLogin = error.config?.url?.includes('/auth/login');

    if (error.response?.status === 401 && !esLogin) {
      localStorage.removeItem('token');
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (esErrorDeRed(error)) {
      try {
        const datos = await resolverOffline(error.config);
        if (datos) {
          const metodo = (error.config.method || 'get').toLowerCase();
          if (metodo !== 'get') {
            toast('Guardado localmente, se sincronizará al volver la conexión', { icon: '💾' });
          }
          return { data: { ok: true, datos }, status: 200, statusText: 'OK (offline)', headers: {}, config: error.config };
        }
      } catch (errorOffline) {
        if (errorOffline instanceof OfflineApiError) {
          return Promise.reject({
            isAxiosError: true,
            message: errorOffline.message,
            config: error.config,
            response: { status: errorOffline.status, data: { error: true, mensaje: errorOffline.message } },
          });
        }
        console.error('Error al resolver la operación en modo offline:', errorOffline);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
