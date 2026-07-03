import api from './api';

export async function getConfiguracion() {
  const { data } = await api.get('/api/configuracion');
  return data.datos.restaurante;
}

export async function actualizarConfiguracion(datos) {
  const { data } = await api.put('/api/configuracion', datos);
  return data.datos.restaurante;
}

export async function getUsuarios() {
  const { data } = await api.get('/api/configuracion/usuarios');
  return data.datos.usuarios;
}

export async function invitarUsuario(datos) {
  const { data } = await api.post('/api/configuracion/usuarios', datos);
  return data.datos;
}

export async function actualizarRolUsuario(id, rol) {
  const { data } = await api.put(`/api/configuracion/usuarios/${id}/rol`, { rol });
  return data.datos.usuario;
}

export async function cambiarEstadoUsuario(id, activo) {
  const { data } = await api.put(`/api/configuracion/usuarios/${id}/estado`, { activo });
  return data.datos.usuario;
}
