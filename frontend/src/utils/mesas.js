import api from './api';

export async function getMesas(areaId) {
  const { data } = await api.get('/api/mesas', { params: areaId ? { area_id: areaId } : {} });
  return data.datos.mesas;
}

export async function getPlano() {
  const { data } = await api.get('/api/mesas/plano');
  return data.datos.plano;
}

export async function getMesa(id) {
  const { data } = await api.get(`/api/mesas/${id}`);
  return data.datos.mesa;
}

export async function crearMesa(datos) {
  const { data } = await api.post('/api/mesas', datos);
  return data.datos.mesa;
}

export async function actualizarMesa(id, datos) {
  const { data } = await api.put(`/api/mesas/${id}`, datos);
  return data.datos.mesa;
}

export async function cambiarEstadoMesa(id, estado) {
  const { data } = await api.patch(`/api/mesas/${id}/estado`, { estado });
  return data.datos.mesa;
}

export async function actualizarPosicionMesa(id, posicion_x, posicion_y) {
  const { data } = await api.patch(`/api/mesas/${id}/posicion`, { posicion_x, posicion_y });
  return data.datos.mesa;
}

export async function resetearPosicionesMesas() {
  const { data } = await api.patch('/api/mesas/resetear-posiciones');
  return data.datos.mesas;
}

export async function eliminarMesa(id) {
  const { data } = await api.delete(`/api/mesas/${id}`);
  return data.datos.mesa;
}

export async function getAreas() {
  const { data } = await api.get('/api/areas');
  return data.datos.areas;
}

export async function crearArea(datos) {
  const { data } = await api.post('/api/areas', datos);
  return data.datos.area;
}

export async function actualizarArea(id, datos) {
  const { data } = await api.put(`/api/areas/${id}`, datos);
  return data.datos.area;
}
