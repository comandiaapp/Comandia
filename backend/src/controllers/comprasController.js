const { v4: uuidv4 } = require('uuid');

const comprasModel = require('../models/comprasModel');
const { ok, error } = require('../utils/respuestas');

const ESTADOS_VALIDOS = ['borrador', 'enviada', 'recibida', 'cancelada'];

function validarItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return 'La orden debe tener al menos un item';
  }
  for (const item of items) {
    if (!item.nombre_ingrediente) {
      return 'Cada item debe indicar el nombre del ingrediente';
    }
    if (item.cantidad_solicitada === undefined || item.cantidad_solicitada === null || Number(item.cantidad_solicitada) <= 0) {
      return 'Cada item debe tener una cantidad solicitada mayor a 0';
    }
  }
  return null;
}

async function crearOrden(req, res) {
  const { proveedor, notas, fecha_esperada, items } = req.body;

  const errorItems = validarItems(items);
  if (errorItems) {
    return error(res, errorItems, 400);
  }

  try {
    const orden = await comprasModel.crearOrden({
      id: uuidv4(),
      restaurante_id: req.usuario.restauranteId,
      proveedor,
      notas,
      fecha_esperada,
      usuario_id: req.usuario.userId,
      items,
    });
    return ok(res, { orden }, 201);
  } catch (err) {
    console.error('Error al crear la orden de compra:', err);
    return error(res, 'No se pudo crear la orden de compra', 500);
  }
}

async function listarOrdenes(req, res) {
  const { estado, fecha_inicio, fecha_fin } = req.query;

  if (estado !== undefined && !ESTADOS_VALIDOS.includes(estado)) {
    return error(res, `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}`, 400);
  }

  try {
    const filtros = {};
    if (estado !== undefined) filtros.estado = estado;
    if (fecha_inicio !== undefined) filtros.fecha_inicio = fecha_inicio;
    if (fecha_fin !== undefined) filtros.fecha_fin = fecha_fin;

    const ordenes = await comprasModel.obtenerOrdenes(req.usuario.restauranteId, filtros);
    return ok(res, { ordenes });
  } catch (err) {
    console.error('Error al listar las órdenes de compra:', err);
    return error(res, 'No se pudieron obtener las órdenes de compra', 500);
  }
}

async function obtenerSugeridas(req, res) {
  try {
    const sugeridas = await comprasModel.generarDesdeAlertas(req.usuario.restauranteId);
    return ok(res, { sugeridas });
  } catch (err) {
    console.error('Error al generar la lista sugerida de compra:', err);
    return error(res, 'No se pudo generar la lista sugerida de compra', 500);
  }
}

async function obtenerOrden(req, res) {
  try {
    const orden = await comprasModel.obtenerOrdenPorId(req.params.id, req.usuario.restauranteId);
    if (!orden) {
      return error(res, 'Orden de compra no encontrada', 404);
    }
    return ok(res, { orden });
  } catch (err) {
    console.error('Error al obtener la orden de compra:', err);
    return error(res, 'No se pudo obtener la orden de compra', 500);
  }
}

async function actualizarOrden(req, res) {
  if (req.body.estado !== undefined && !ESTADOS_VALIDOS.includes(req.body.estado)) {
    return error(res, `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}`, 400);
  }

  try {
    const orden = await comprasModel.actualizarOrden(req.params.id, req.usuario.restauranteId, req.body);
    if (!orden) {
      return error(res, 'Orden de compra no encontrada', 404);
    }
    return ok(res, { orden });
  } catch (err) {
    console.error('Error al actualizar la orden de compra:', err);
    return error(res, 'No se pudo actualizar la orden de compra', 500);
  }
}

async function recibirOrden(req, res) {
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return error(res, 'Debes indicar la cantidad recibida de al menos un item', 400);
  }

  try {
    const resultado = await comprasModel.recibirOrden(req.params.id, req.usuario.restauranteId, items, req.usuario.userId);
    if (!resultado) {
      return error(res, 'Orden de compra no encontrada', 404);
    }
    if (resultado.conflicto) {
      return error(res, resultado.conflicto, 400);
    }
    return ok(res, { orden: resultado });
  } catch (err) {
    console.error('Error al recibir la orden de compra:', err);
    return error(res, 'No se pudo registrar la recepción de la orden', 500);
  }
}

async function cancelarOrden(req, res) {
  try {
    const orden = await comprasModel.cancelarOrden(req.params.id, req.usuario.restauranteId);
    if (!orden) {
      return error(res, 'Orden de compra no encontrada o ya no se puede cancelar', 404);
    }
    return ok(res, { orden });
  } catch (err) {
    console.error('Error al cancelar la orden de compra:', err);
    return error(res, 'No se pudo cancelar la orden de compra', 500);
  }
}

module.exports = {
  crearOrden,
  listarOrdenes,
  obtenerSugeridas,
  obtenerOrden,
  actualizarOrden,
  recibirOrden,
  cancelarOrden,
};
