import api from './api';

export async function getCategoriasContables() {
  const { data } = await api.get('/api/contaduria/categorias');
  return data.datos.categorias;
}

export async function getResumenFinanciero({ fechaInicio, fechaFin } = {}) {
  const { data } = await api.get('/api/contaduria/resumen', {
    params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin },
  });
  return data.datos.resumen;
}

export async function getFlujoEfectivo({ fechaInicio, fechaFin } = {}) {
  const { data } = await api.get('/api/contaduria/flujo-efectivo', {
    params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin },
  });
  return data.datos.flujo;
}

export async function getTransacciones(filtros = {}) {
  const { data } = await api.get('/api/contaduria/transacciones', { params: filtros });
  return data.datos.transacciones;
}

export async function crearTransaccion(datos) {
  const { data } = await api.post('/api/contaduria/transacciones', datos);
  return data.datos.transaccion;
}

export async function actualizarTransaccion(id, datos) {
  const { data } = await api.put(`/api/contaduria/transacciones/${id}`, datos);
  return data.datos.transaccion;
}

export async function eliminarTransaccion(id) {
  const { data } = await api.delete(`/api/contaduria/transacciones/${id}`);
  return data.datos.transaccion;
}

export async function getEmpleadosJornada() {
  const { data } = await api.get('/api/contaduria/empleados-jornada');
  return data.datos;
}

export async function getHistorialEmpleados() {
  const { data } = await api.get('/api/contaduria/empleados-jornada/historial');
  return data.datos.empleados;
}

export async function agregarEmpleadoJornada(datos) {
  const { data } = await api.post('/api/contaduria/empleados-jornada', datos);
  return data.datos.empleado;
}

export async function actualizarEmpleadoJornada(id, datos) {
  const { data } = await api.put(`/api/contaduria/empleados-jornada/${id}`, datos);
  return data.datos.empleado;
}

export async function marcarSalidaEmpleado(id) {
  const { data } = await api.patch(`/api/contaduria/empleados-jornada/${id}/salida`);
  return data.datos.empleado;
}

export async function eliminarEmpleadoJornada(id) {
  const { data } = await api.delete(`/api/contaduria/empleados-jornada/${id}`);
  return data.datos.empleado;
}
