export const formatearFecha = (fecha) => {
  return new Date(fecha).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatearHora = (fecha) => {
  return new Date(fecha).toLocaleTimeString('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const diasRestantes = (fecha) => {
  if (!fecha) return null;
  const diferenciaMs = new Date(fecha).getTime() - Date.now();
  return Math.max(0, Math.ceil(diferenciaMs / (24 * 60 * 60 * 1000)));
};

export const fechaHoyBogota = () => {
  return new Date()
    .toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    .split('/')
    .reverse()
    .join('-');
};
