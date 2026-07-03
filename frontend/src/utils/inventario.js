import api from './api';

export async function getIngredientes(filtros = {}) {
  const { data } = await api.get('/api/inventario/ingredientes', { params: filtros });
  return data.datos.ingredientes;
}

export async function crearIngrediente(datos) {
  const { data } = await api.post('/api/inventario/ingredientes', datos);
  return data.datos.ingrediente;
}

export async function actualizarIngrediente(id, datos) {
  const { data } = await api.put(`/api/inventario/ingredientes/${id}`, datos);
  return data.datos.ingrediente;
}

export async function eliminarIngrediente(id) {
  const { data } = await api.delete(`/api/inventario/ingredientes/${id}`);
  return data.datos.ingrediente;
}

export async function getAlertas() {
  const { data } = await api.get('/api/inventario/alertas');
  return data.datos.alertas;
}

export async function registrarEntrada(datos) {
  const { data } = await api.post('/api/inventario/entrada', datos);
  return data.datos;
}

export async function registrarMerma(datos) {
  const { data } = await api.post('/api/inventario/merma', datos);
  return data.datos;
}

export async function ajustarStock(datos) {
  const { data } = await api.post('/api/inventario/ajuste', datos);
  return data.datos;
}

export async function getMovimientos(filtros = {}) {
  const { data } = await api.get('/api/inventario/movimientos', { params: filtros });
  return data.datos.movimientos;
}

export async function getRecetaPorProducto(productoId) {
  const { data } = await api.get(`/api/inventario/recetas/${productoId}`);
  return data.datos.recetas;
}

export async function crearReceta(datos) {
  const { data } = await api.post('/api/inventario/recetas', datos);
  return data.datos.receta;
}

export async function eliminarReceta(id) {
  const { data } = await api.delete(`/api/inventario/recetas/${id}`);
  return data.datos.receta;
}
