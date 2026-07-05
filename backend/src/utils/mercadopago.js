const env = require('../config/env');

const BASE_URL = 'https://api.mercadopago.com';

async function solicitar(path) {
  const respuesta = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${env.mpAccessToken}` },
  });

  if (!respuesta.ok) {
    throw new Error(`Mercado Pago respondió ${respuesta.status} en ${path}`);
  }

  return respuesta.json();
}

function obtenerPago(paymentId) {
  return solicitar(`/v1/payments/${paymentId}`);
}

function obtenerPreapproval(preapprovalId) {
  return solicitar(`/v1/preapproval/${preapprovalId}`);
}

module.exports = { obtenerPago, obtenerPreapproval };
