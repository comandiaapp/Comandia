const crypto = require('crypto');

const pagoModel = require('../models/pagoModel');
const restauranteModel = require('../models/restauranteModel');
const usuarioModel = require('../models/usuarioModel');
const env = require('../config/env');
const mercadopago = require('../utils/mercadopago');
const { ok, error } = require('../utils/respuestas');
const { enviarConfirmacionPago, enviarAvisoSuscripcionInactiva } = require('../utils/email');

const PLANES_VALIDOS = ['basico', 'profesional', 'empresarial'];

const LINKS_MERCADOPAGO = {
  basico: 'https://mpago.la/1uwEH6w',
  profesional: 'https://mpago.la/2ZT3D7d',
  empresarial: 'https://mpago.la/2gePGXX',
};

async function iniciarPago(req, res) {
  const { plan } = req.body;

  if (!plan || !PLANES_VALIDOS.includes(plan)) {
    return error(res, `Plan inválido. Valores permitidos: ${PLANES_VALIDOS.join(', ')}`, 400);
  }

  try {
    const pago = await pagoModel.crear(req.usuario.restauranteId, plan);

    const backUrl = `${env.appUrl}/pago-exitoso`;
    const url = `${LINKS_MERCADOPAGO[plan]}?external_reference=${pago.id}&back_url=${encodeURIComponent(backUrl)}`;

    return ok(res, { pago, url }, 201);
  } catch (err) {
    console.error('Error al iniciar el pago:', err);
    return error(res, 'No se pudo iniciar el pago', 500);
  }
}

async function verificarPago(req, res) {
  const { collection_id, external_reference } = req.query;

  if (!external_reference) {
    return error(res, 'Falta external_reference', 400);
  }

  try {
    const pago = await pagoModel.obtenerPorId(external_reference);
    if (!pago || pago.restaurante_id !== req.usuario.restauranteId) {
      return error(res, 'Pago no encontrado', 404);
    }

    // Si ya se procesó (reintento de la redirección, doble llamada del
    // frontend, o ya lo activó el webhook) se devuelve el resultado ya
    // guardado sin repetir efectos secundarios.
    if (pago.estado !== 'pendiente') {
      const restaurante = await restauranteModel.buscarPorId(pago.restaurante_id);
      return ok(res, { pago, restaurante });
    }

    // Sin collection_id todavía no hay nada que consultar en Mercado Pago;
    // el webhook lo terminará de confirmar más adelante.
    if (!collection_id) {
      return ok(res, { pago });
    }

    // El estado real del pago se confirma contra la API de Mercado Pago en
    // vez de confiar en collection_status, que llega como query param y
    // podría manipularse en la URL de redirección.
    const payment = await mercadopago.obtenerPago(collection_id);

    if (payment.status === 'approved') {
      const resultado = await pagoModel.aprobarYActivarPlan(pago.id, {
        referenciaExterna: String(payment.id),
        metodoPago: payment.payment_type_id,
      });

      if (!resultado.yaProcesado) {
        const usuario = await usuarioModel.buscarPorId(req.usuario.userId);
        enviarConfirmacionPago(usuario.email, usuario.nombre, resultado.pago.plan, resultado.pago.periodo_fin).catch(
          (err) => console.error('Error enviando email de confirmación de pago:', err.message || err)
        );
      }

      const restaurante = resultado.restaurante || (await restauranteModel.buscarPorId(pago.restaurante_id));
      return ok(res, { pago: resultado.pago, restaurante });
    }

    const nuevoEstado = payment.status === 'pending' || payment.status === 'in_process' ? 'pendiente' : 'rechazado';
    const pagoActualizado = nuevoEstado === pago.estado ? pago : await pagoModel.marcarEstado(pago.id, nuevoEstado);

    return ok(res, { pago: pagoActualizado });
  } catch (err) {
    console.error('Error al verificar el pago:', err);
    return error(res, 'No se pudo verificar el pago', 500);
  }
}

async function historialPagos(req, res) {
  try {
    const pagos = await pagoModel.listarPorRestaurante(req.usuario.restauranteId);
    return ok(res, { pagos });
  } catch (err) {
    console.error('Error al obtener el historial de pagos:', err);
    return error(res, 'No se pudo obtener el historial de pagos', 500);
  }
}

async function estadoSuscripcion(req, res) {
  try {
    const restaurante = await restauranteModel.buscarPorId(req.usuario.restauranteId);
    if (!restaurante) {
      return error(res, 'Restaurante no encontrado', 404);
    }

    const pagos = await pagoModel.listarPorRestaurante(req.usuario.restauranteId);
    const ultimoAprobado = pagos.find((pago) => pago.estado === 'aprobado');

    return ok(res, {
      plan: restaurante.suscripcion_plan,
      suscripcion_activa: restaurante.suscripcion_activa,
      trial_expira: restaurante.trial_expira,
      fecha_vencimiento: ultimoAprobado ? ultimoAprobado.periodo_fin : null,
      historial: pagos,
    });
  } catch (err) {
    console.error('Error al obtener el estado de la suscripción:', err);
    return error(res, 'No se pudo obtener el estado de la suscripción', 500);
  }
}

async function procesarNotificacionPago(paymentId) {
  const payment = await mercadopago.obtenerPago(paymentId);

  if (!payment || payment.status !== 'approved') return;

  const pagoId = payment.external_reference;
  if (!pagoId) return;

  const resultado = await pagoModel.aprobarYActivarPlan(pagoId, {
    referenciaExterna: String(payment.id),
    metodoPago: payment.payment_type_id,
  });

  // yaProcesado: el pago ya no estaba 'pendiente' (lo activó verificarPago
  // o una notificación anterior del propio webhook) — no repetir el email.
  if (resultado.yaProcesado || !resultado.restaurante) return;

  await enviarConfirmacionPago(
    resultado.restaurante.email,
    resultado.restaurante.nombre,
    resultado.pago.plan,
    resultado.pago.periodo_fin
  );
}

async function procesarNotificacionSuscripcion(preapprovalId) {
  const preapproval = await mercadopago.obtenerPreapproval(preapprovalId);
  const restauranteId = preapproval?.external_reference;
  if (!restauranteId) return;

  const restaurante = await restauranteModel.buscarPorId(restauranteId);
  if (!restaurante) return;

  if (preapproval.status === 'authorized') {
    if (restaurante.suscripcion_activa) return;

    const planDetectado = PLANES_VALIDOS.find((plan) => (preapproval.reason || '').toLowerCase().includes(plan));
    const plan = planDetectado || restaurante.suscripcion_plan;
    const restauranteActualizado = await restauranteModel.activarPlan(restauranteId, plan);
    const periodoFin = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await enviarConfirmacionPago(restauranteActualizado.email, restauranteActualizado.nombre, plan, periodoFin);
    return;
  }

  if (preapproval.status === 'cancelled' || preapproval.status === 'paused') {
    if (!restaurante.suscripcion_activa) return;

    await restauranteModel.actualizarEstadoSuscripcion(restauranteId, false);
    await enviarAvisoSuscripcionInactiva(restaurante.email, restaurante.nombre, preapproval.status);
  }
}

// Valida el header x-signature ("ts=...,v1=...") contra el manifest que
// Mercado Pago firma con la clave secreta del webhook. El id va en minúsculas
// y se toma del query param data.id (el que va en la URL de la notificación),
// no del body, porque así lo firma Mercado Pago del lado del servidor.
function verificarFirmaWebhook(req, dataId) {
  if (!env.mpWebhookSecret) {
    console.error('MP_WEBHOOK_SECRET no configurado: se rechaza el webhook de Mercado Pago');
    return false;
  }

  const encabezadoFirma = req.headers['x-signature'];
  const requestId = req.headers['x-request-id'];

  if (!encabezadoFirma) return false;

  const partes = Object.fromEntries(
    encabezadoFirma
      .split(',')
      .map((parte) => parte.split('='))
      .map(([clave, valor]) => [clave?.trim(), valor?.trim()])
  );

  const { ts, v1: hashRecibido } = partes;
  if (!ts || !hashRecibido) return false;

  const idParaManifest = String(req.query['data.id'] ?? dataId ?? '').toLowerCase();
  const manifest = `id:${idParaManifest};request-id:${requestId || ''};ts:${ts};`;

  const hashCalculado = crypto.createHmac('sha256', env.mpWebhookSecret).update(manifest).digest('hex');

  const bufferRecibido = Buffer.from(hashRecibido, 'hex');
  const bufferCalculado = Buffer.from(hashCalculado, 'hex');

  if (bufferRecibido.length !== bufferCalculado.length) return false;

  return crypto.timingSafeEqual(bufferRecibido, bufferCalculado);
}

// Mercado Pago espera un 200 inmediato; si tarda o responde error, reintenta
// la notificación. Por eso se responde antes de procesar y nunca se
// propaga un error al cliente HTTP.
async function webhook(req, res) {
  res.sendStatus(200);

  const tipo = req.body?.type || req.query.type || req.query.topic;
  const id = req.body?.data?.id || req.query.id || req.query['data.id'];

  if (!id) return;

  // Firma inválida: no se revela el motivo al llamador (ya recibió 200),
  // simplemente no se procesa la notificación.
  if (!verificarFirmaWebhook(req, id)) return;

  try {
    if (tipo === 'payment') {
      await procesarNotificacionPago(id);
    } else if (tipo === 'subscription_preapproval') {
      await procesarNotificacionSuscripcion(id);
    }
  } catch (err) {
    console.error('Error procesando webhook de Mercado Pago:', err.message || err);
  }
}

module.exports = { iniciarPago, verificarPago, historialPagos, estadoSuscripcion, webhook };
