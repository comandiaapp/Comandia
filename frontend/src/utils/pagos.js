import api from './api';

export async function iniciarPago(plan) {
  const { data } = await api.post('/api/pagos/iniciar', { plan });
  return data.datos;
}

export async function verificarPago(params) {
  const { data } = await api.get('/api/pagos/verificar', { params });
  return data.datos;
}

export async function getHistorialPagos() {
  const { data } = await api.get('/api/pagos/historial');
  return data.datos.pagos;
}

export async function getEstadoSuscripcion() {
  const { data } = await api.get('/api/pagos/estado');
  return data.datos;
}
