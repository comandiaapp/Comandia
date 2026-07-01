import api from './api';

export async function getProductos(filtros = {}) {
  const { data } = await api.get('/api/productos', { params: filtros });
  return data.datos.productos;
}

export async function crearProducto(datos) {
  const { data } = await api.post('/api/productos', datos);
  return data.datos.producto;
}

export async function actualizarProducto(id, datos) {
  const { data } = await api.put(`/api/productos/${id}`, datos);
  return data.datos.producto;
}

export async function eliminarProducto(id) {
  const { data } = await api.delete(`/api/productos/${id}`);
  return data.datos.producto;
}
