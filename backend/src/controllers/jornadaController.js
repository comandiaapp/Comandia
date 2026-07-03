const { v4: uuidv4 } = require('uuid');

const jornadaModel = require('../models/jornadaModel');
const mesaModel = require('../models/mesaModel');
const { ok, error } = require('../utils/respuestas');

async function abrirJornada(req, res) {
  const { monto_apertura } = req.body;

  try {
    const existente = await jornadaModel.obtenerAbierta(req.usuario.restauranteId, req.usuario.sucursalId);
    if (existente) {
      return error(res, 'Ya hay una jornada abierta para esta sucursal', 400);
    }

    const jornada = await jornadaModel.abrir({
      id: uuidv4(),
      restaurante_id: req.usuario.restauranteId,
      sucursal_id: req.usuario.sucursalId,
      usuario_apertura_id: req.usuario.userId,
      monto_apertura,
    });

    // Reinicia los domicilios de la jornada anterior que quedaron libres
    // (sin pedido activo); los que siguen ocupados no se tocan. No debe
    // bloquear la apertura de la jornada si falla.
    try {
      await mesaModel.eliminarRemotasLibres(req.usuario.restauranteId);
    } catch (err) {
      console.error('Error al reiniciar las mesas remotas libres:', err);
    }

    return ok(res, { jornada }, 201);
  } catch (err) {
    console.error('Error al abrir la jornada:', err);
    return error(res, 'No se pudo abrir la jornada', 500);
  }
}

async function obtenerJornadaActual(req, res) {
  try {
    const jornada = await jornadaModel.obtenerAbierta(req.usuario.restauranteId, req.usuario.sucursalId);
    if (!jornada) {
      return ok(res, { jornada: null });
    }

    const ventas = await jornadaModel.calcularVentas(jornada);
    return ok(res, { jornada, ventas });
  } catch (err) {
    console.error('Error al obtener la jornada actual:', err);
    return error(res, 'No se pudo obtener la jornada actual', 500);
  }
}

async function cerrarJornada(req, res) {
  const { monto_cierre_real, notas } = req.body;

  if (monto_cierre_real === undefined || monto_cierre_real === null) {
    return error(res, 'monto_cierre_real es obligatorio', 400);
  }

  try {
    const jornada = await jornadaModel.obtenerAbierta(req.usuario.restauranteId, req.usuario.sucursalId);
    if (!jornada) {
      return error(res, 'No hay una jornada abierta para cerrar', 404);
    }

    const resultado = await jornadaModel.cerrar(
      jornada.id,
      req.usuario.restauranteId,
      { monto_cierre_real, notas },
      req.usuario.userId
    );

    return ok(res, resultado);
  } catch (err) {
    console.error('Error al cerrar la jornada:', err);
    return error(res, 'No se pudo cerrar la jornada', 500);
  }
}

async function reabrirJornada(req, res) {
  const { jornada_id } = req.body;

  if (!jornada_id) {
    return error(res, 'jornada_id es obligatorio', 400);
  }

  try {
    const jornada = await jornadaModel.reabrir(jornada_id, req.usuario.restauranteId, req.usuario.userId);
    if (!jornada) {
      return error(res, 'Jornada no encontrada o no está cerrada', 404);
    }
    return ok(res, { jornada });
  } catch (err) {
    console.error('Error al reabrir la jornada:', err);
    return error(res, 'No se pudo reabrir la jornada', 500);
  }
}

async function historialJornadas(req, res) {
  try {
    const jornadas = await jornadaModel.historial(req.usuario.restauranteId, 30);
    return ok(res, { jornadas });
  } catch (err) {
    console.error('Error al obtener el historial de jornadas:', err);
    return error(res, 'No se pudo obtener el historial de jornadas', 500);
  }
}

module.exports = { abrirJornada, obtenerJornadaActual, cerrarJornada, reabrirJornada, historialJornadas };
