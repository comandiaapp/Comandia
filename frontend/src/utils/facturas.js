import api from './api';

export async function generarFactura(pedidoId, datosCliente = {}) {
  const { data } = await api.post(`/api/facturas/generar/${pedidoId}`, datosCliente);
  return data.datos;
}

export async function obtenerFacturaPorPedido(pedidoId) {
  const { data } = await api.get(`/api/facturas/pedido/${pedidoId}`);
  return data.datos;
}

export async function obtenerPrecuentaHTML(pedidoId, totales = {}) {
  const { data } = await api.post(`/api/facturas/precuenta/${pedidoId}`, totales);
  return data.datos.html;
}
