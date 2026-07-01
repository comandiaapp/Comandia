import api from './api';

export async function getCategorias() {
  const { data } = await api.get('/api/categorias');
  return data.datos.categorias;
}

export async function crearCategoria(datos) {
  const { data } = await api.post('/api/categorias', datos);
  return data.datos.categoria;
}

export async function actualizarCategoria(id, datos) {
  const { data } = await api.put(`/api/categorias/${id}`, datos);
  return data.datos.categoria;
}

export async function eliminarCategoria(id) {
  const { data } = await api.delete(`/api/categorias/${id}`);
  return data.datos.categoria;
}
