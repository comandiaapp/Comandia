import api from './api';

export async function getVentasDia(fecha) {
  const { data } = await api.get('/api/reportes/ventas-dia', { params: fecha ? { fecha } : {} });
  return data.datos.reporte;
}

export async function getVentasPeriodo(fechaInicio, fechaFin) {
  const { data } = await api.get('/api/reportes/ventas-periodo', {
    params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin },
  });
  return data.datos.reporte;
}

export async function getProductosMasVendidos({ fechaInicio, fechaFin, limite } = {}) {
  const { data } = await api.get('/api/reportes/productos-vendidos', {
    params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin, limite },
  });
  return data.datos.productos;
}

export async function getResumenDashboard() {
  const { data } = await api.get('/api/reportes/dashboard');
  return data.datos.resumen;
}
