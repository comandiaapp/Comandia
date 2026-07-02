import api from './api';

export async function crearPedido(datos) {
  const { data } = await api.post('/api/pedidos', datos);
  return data.datos.pedido;
}

export async function getPedidoPorMesa(mesaId) {
  const { data } = await api.get(`/api/pedidos/mesa/${mesaId}`);
  return data.datos.pedido;
}

export async function getPedido(id) {
  const { data } = await api.get(`/api/pedidos/${id}`);
  return data.datos.pedido;
}

export async function getPedidos(filtros = {}) {
  const { data } = await api.get('/api/pedidos', { params: filtros });
  return data.datos.pedidos;
}

export async function agregarItemPedido(pedidoId, item) {
  const { data } = await api.post(`/api/pedidos/${pedidoId}/items`, item);
  return data.datos;
}

export async function actualizarItemPedido(pedidoId, itemId, datos) {
  const { data } = await api.put(`/api/pedidos/${pedidoId}/items/${itemId}`, datos);
  return data.datos;
}

export async function eliminarItemPedido(pedidoId, itemId) {
  const { data } = await api.delete(`/api/pedidos/${pedidoId}/items/${itemId}`);
  return data.datos;
}

export async function enviarCocinaPedido(pedidoId) {
  const { data } = await api.post(`/api/pedidos/${pedidoId}/enviar-cocina`);
  return data.datos.pedido;
}

export async function pedirCuentaPedido(pedidoId) {
  const { data } = await api.post(`/api/pedidos/${pedidoId}/pedir-cuenta`);
  return data.datos.pedido;
}

export async function cobrarPedido(pedidoId, datos) {
  const { data } = await api.post(`/api/pedidos/${pedidoId}/cobrar`, datos);
  return data.datos.pedido;
}

export async function cancelarPedido(pedidoId) {
  const { data } = await api.post(`/api/pedidos/${pedidoId}/cancelar`);
  return data.datos.pedido;
}

export async function getCocina() {
  const { data } = await api.get('/api/cocina');
  return data.datos.pedidos;
}

export async function marcarItemEnPreparacion(pedidoId, itemId) {
  const { data } = await api.patch(`/api/pedidos/${pedidoId}/items/${itemId}/en-preparacion`);
  return data.datos;
}

export async function marcarItemListo(pedidoId, itemId) {
  const { data } = await api.patch(`/api/pedidos/${pedidoId}/items/${itemId}/listo`);
  return data.datos;
}

export async function marcarPedidoEntregado(pedidoId) {
  const { data } = await api.patch(`/api/pedidos/${pedidoId}/entregado`);
  return data.datos.pedido;
}
