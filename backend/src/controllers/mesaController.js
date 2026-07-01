const { v4: uuidv4 } = require('uuid');

const mesaModel = require('../models/mesaModel');
const areaModel = require('../models/areaModel');
const { ok, error } = require('../utils/respuestas');

const ESTADOS_VALIDOS = ['libre', 'ocupada', 'cuenta_pedida', 'reservada', 'bloqueada'];

// --- Mesas ---

async function crearMesa(req, res) {
  const { area_id, numero, nombre, capacidad, estado, posicion_x, posicion_y } = req.body;

  if (!numero) {
    return error(res, 'El número de la mesa es obligatorio', 400);
  }

  if (estado !== undefined && !ESTADOS_VALIDOS.includes(estado)) {
    return error(res, `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}`, 400);
  }

  try {
    const mesa = await mesaModel.crear({
      id: uuidv4(),
      restaurante_id: req.usuario.restauranteId,
      area_id,
      numero,
      nombre,
      capacidad,
      estado,
      posicion_x,
      posicion_y,
    });

    return ok(res, { mesa }, 201);
  } catch (err) {
    if (err.code === '23505') {
      return error(res, 'Ya existe una mesa con ese número', 409);
    }
    console.error('Error al crear mesa:', err);
    return error(res, 'No se pudo crear la mesa', 500);
  }
}

async function listarMesas(req, res) {
  try {
    const { area_id } = req.query;
    const mesas = await mesaModel.obtenerTodas(req.usuario.restauranteId, area_id);
    return ok(res, { mesas });
  } catch (err) {
    console.error('Error al listar mesas:', err);
    return error(res, 'No se pudieron obtener las mesas', 500);
  }
}

async function obtenerMesa(req, res) {
  try {
    const mesa = await mesaModel.obtenerPorId(req.params.id, req.usuario.restauranteId);
    if (!mesa) {
      return error(res, 'Mesa no encontrada', 404);
    }
    return ok(res, { mesa });
  } catch (err) {
    console.error('Error al obtener mesa:', err);
    return error(res, 'No se pudo obtener la mesa', 500);
  }
}

async function actualizarMesa(req, res) {
  if (req.body.estado !== undefined && !ESTADOS_VALIDOS.includes(req.body.estado)) {
    return error(res, `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}`, 400);
  }

  try {
    const mesa = await mesaModel.actualizar(req.params.id, req.usuario.restauranteId, req.body);
    if (!mesa) {
      return error(res, 'Mesa no encontrada', 404);
    }
    return ok(res, { mesa });
  } catch (err) {
    if (err.code === '23505') {
      return error(res, 'Ya existe una mesa con ese número', 409);
    }
    console.error('Error al actualizar mesa:', err);
    return error(res, 'No se pudo actualizar la mesa', 500);
  }
}

async function cambiarEstadoMesa(req, res) {
  const { estado } = req.body;

  if (!estado || !ESTADOS_VALIDOS.includes(estado)) {
    return error(res, `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}`, 400);
  }

  try {
    const mesa = await mesaModel.cambiarEstado(req.params.id, req.usuario.restauranteId, estado);
    if (!mesa) {
      return error(res, 'Mesa no encontrada', 404);
    }
    return ok(res, { mesa });
  } catch (err) {
    console.error('Error al cambiar el estado de la mesa:', err);
    return error(res, 'No se pudo cambiar el estado de la mesa', 500);
  }
}

async function actualizarPosicion(req, res) {
  const { posicion_x, posicion_y } = req.body;

  if (posicion_x === undefined || posicion_y === undefined || Number.isNaN(Number(posicion_x)) || Number.isNaN(Number(posicion_y))) {
    return error(res, 'posicion_x y posicion_y son obligatorios y deben ser numéricos', 400);
  }

  try {
    const mesa = await mesaModel.actualizar(req.params.id, req.usuario.restauranteId, {
      posicion_x,
      posicion_y,
    });
    if (!mesa) {
      return error(res, 'Mesa no encontrada', 404);
    }
    return ok(res, { mesa });
  } catch (err) {
    console.error('Error al actualizar la posición de la mesa:', err);
    return error(res, 'No se pudo actualizar la posición de la mesa', 500);
  }
}

async function resetearPosiciones(req, res) {
  try {
    const mesas = await mesaModel.resetearPosiciones(req.usuario.restauranteId);
    return ok(res, { mesas });
  } catch (err) {
    console.error('Error al restablecer las posiciones de las mesas:', err);
    return error(res, 'No se pudieron restablecer las posiciones de las mesas', 500);
  }
}

async function eliminarMesa(req, res) {
  try {
    const mesa = await mesaModel.eliminar(req.params.id, req.usuario.restauranteId);
    if (!mesa) {
      return error(res, 'Mesa no encontrada', 404);
    }
    return ok(res, { mesa });
  } catch (err) {
    console.error('Error al eliminar mesa:', err);
    return error(res, 'No se pudo eliminar la mesa', 500);
  }
}

async function obtenerPlano(req, res) {
  try {
    const areas = await areaModel.obtenerTodas(req.usuario.restauranteId);
    const mesas = await mesaModel.obtenerTodas(req.usuario.restauranteId);

    const plano = areas.map((area) => ({
      ...area,
      mesas: mesas.filter((mesa) => mesa.area_id === area.id),
    }));

    const sinArea = mesas.filter((mesa) => !mesa.area_id);
    if (sinArea.length > 0) {
      plano.push({ id: null, nombre: 'Sin área', mesas: sinArea });
    }

    return ok(res, { plano });
  } catch (err) {
    console.error('Error al obtener el plano de mesas:', err);
    return error(res, 'No se pudo obtener el plano de mesas', 500);
  }
}

// --- Áreas ---

async function crearArea(req, res) {
  const { nombre, descripcion, orden } = req.body;

  if (!nombre) {
    return error(res, 'El nombre del área es obligatorio', 400);
  }

  try {
    const area = await areaModel.crear({
      id: uuidv4(),
      restaurante_id: req.usuario.restauranteId,
      nombre,
      descripcion,
      orden,
    });

    return ok(res, { area }, 201);
  } catch (err) {
    console.error('Error al crear área:', err);
    return error(res, 'No se pudo crear el área', 500);
  }
}

async function listarAreas(req, res) {
  try {
    const areas = await areaModel.obtenerTodas(req.usuario.restauranteId);
    return ok(res, { areas });
  } catch (err) {
    console.error('Error al listar áreas:', err);
    return error(res, 'No se pudieron obtener las áreas', 500);
  }
}

async function actualizarArea(req, res) {
  try {
    const area = await areaModel.actualizar(req.params.id, req.usuario.restauranteId, req.body);
    if (!area) {
      return error(res, 'Área no encontrada', 404);
    }
    return ok(res, { area });
  } catch (err) {
    console.error('Error al actualizar área:', err);
    return error(res, 'No se pudo actualizar el área', 500);
  }
}

async function eliminarArea(req, res) {
  try {
    const area = await areaModel.eliminar(req.params.id, req.usuario.restauranteId);
    if (!area) {
      return error(res, 'Área no encontrada', 404);
    }
    return ok(res, { area });
  } catch (err) {
    console.error('Error al eliminar área:', err);
    return error(res, 'No se pudo eliminar el área', 500);
  }
}

module.exports = {
  crearMesa,
  listarMesas,
  obtenerMesa,
  actualizarMesa,
  cambiarEstadoMesa,
  actualizarPosicion,
  resetearPosiciones,
  eliminarMesa,
  obtenerPlano,
  crearArea,
  listarAreas,
  actualizarArea,
  eliminarArea,
};
