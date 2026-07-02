import api from './api';

export async function getJornadaActual() {
  const { data } = await api.get('/api/jornadas/actual');
  return data.datos;
}

export async function abrirJornada(montoApertura) {
  const { data } = await api.post('/api/jornadas/abrir', { monto_apertura: montoApertura });
  return data.datos.jornada;
}

export async function cerrarJornada({ montoCierreReal, notas }) {
  const { data } = await api.post('/api/jornadas/cerrar', { monto_cierre_real: montoCierreReal, notas });
  return data.datos;
}

export async function reabrirJornada(jornadaId) {
  const { data } = await api.post('/api/jornadas/reabrir', { jornada_id: jornadaId });
  return data.datos.jornada;
}

export async function getHistorialJornadas() {
  const { data } = await api.get('/api/jornadas/historial');
  return data.datos.jornadas;
}
