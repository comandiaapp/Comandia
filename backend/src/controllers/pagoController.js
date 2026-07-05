const pagoModel = require('../models/pagoModel');
const restauranteModel = require('../models/restauranteModel');
const usuarioModel = require('../models/usuarioModel');
const env = require('../config/env');
const { ok, error } = require('../utils/respuestas');
const { enviarConfirmacionPago } = require('../utils/email');

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
  const { collection_status, external_reference, payment_type } = req.query;

  if (!external_reference) {
    return error(res, 'Falta external_reference', 400);
  }

  try {
    const pago = await pagoModel.obtenerPorId(external_reference);
    if (!pago || pago.restaurante_id !== req.usuario.restauranteId) {
      return error(res, 'Pago no encontrado', 404);
    }

    // Si ya se procesó (reintento de la redirección, doble llamada del
    // frontend) se devuelve el resultado ya guardado sin repetir efectos
    // secundarios (activar el plan de nuevo, reenviar el email).
    if (pago.estado !== 'pendiente') {
      const restaurante = await restauranteModel.buscarPorId(pago.restaurante_id);
      return ok(res, { pago, restaurante });
    }

    if (collection_status === 'approved') {
      const pagoActualizado = await pagoModel.marcarAprobado(pago.id, {
        referenciaExterna: external_reference,
        metodoPago: payment_type,
      });
      const restaurante = await restauranteModel.activarPlan(pago.restaurante_id, pago.plan);
      const usuario = await usuarioModel.buscarPorId(req.usuario.userId);

      enviarConfirmacionPago(usuario.email, usuario.nombre, pago.plan, pagoActualizado.periodo_fin).catch((err) => {
        console.error('Error enviando email de confirmación de pago:', err.message || err);
      });

      return ok(res, { pago: pagoActualizado, restaurante });
    }

    const nuevoEstado = collection_status === 'pending' ? 'pendiente' : 'rechazado';
    const pagoActualizado = await pagoModel.marcarEstado(pago.id, nuevoEstado);

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

module.exports = { iniciarPago, verificarPago, historialPagos, estadoSuscripcion };
