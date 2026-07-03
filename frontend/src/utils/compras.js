import api from './api';

export async function getOrdenes(filtros = {}) {
  const { data } = await api.get('/api/compras', { params: filtros });
  return data.datos.ordenes;
}

export async function getSugeridas() {
  const { data } = await api.get('/api/compras/sugeridas');
  return data.datos.sugeridas;
}

export async function getOrden(id) {
  const { data } = await api.get(`/api/compras/${id}`);
  return data.datos.orden;
}

export async function crearOrden(datos) {
  const { data } = await api.post('/api/compras', datos);
  return data.datos.orden;
}

export async function actualizarOrden(id, datos) {
  const { data } = await api.put(`/api/compras/${id}`, datos);
  return data.datos.orden;
}

export async function recibirOrden(id, items) {
  const { data } = await api.post(`/api/compras/${id}/recibir`, { items });
  return data.datos.orden;
}

export async function cancelarOrden(id) {
  const { data } = await api.post(`/api/compras/${id}/cancelar`);
  return data.datos.orden;
}
