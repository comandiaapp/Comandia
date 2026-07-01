export const formatearPrecio = (valor) => {
  return (
    '$' +
    Number(valor).toLocaleString('es-CO', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  );
};
