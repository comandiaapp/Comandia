const { v4: uuidv4 } = require('uuid');

const categoriaModel = require('../models/categoriaModel');
const { ok, error } = require('../utils/respuestas');

async function crear(req, res) {
  const { nombre, descripcion, imagen_url, color, orden } = req.body;

  if (!nombre) {
    return error(res, 'El nombre de la categoría es obligatorio', 400);
  }

  try {
    const categoria = await categoriaModel.crear({
      id: uuidv4(),
      restaurante_id: req.usuario.restauranteId,
      nombre,
      descripcion,
      imagen_url,
      color,
      orden,
    });

    return ok(res, { categoria }, 201);
  } catch (err) {
    console.error('Error al crear categoría:', err);
    return error(res, 'No se pudo crear la categoría', 500);
  }
}

async function listar(req, res) {
  try {
    const categorias = await categoriaModel.obtenerTodas(req.usuario.restauranteId);
    return ok(res, { categorias });
  } catch (err) {
    console.error('Error al listar categorías:', err);
    return error(res, 'No se pudieron obtener las categorías', 500);
  }
}

async function obtener(req, res) {
  try {
    const categoria = await categoriaModel.obtenerPorId(req.params.id, req.usuario.restauranteId);
    if (!categoria) {
      return error(res, 'Categoría no encontrada', 404);
    }
    return ok(res, { categoria });
  } catch (err) {
    console.error('Error al obtener categoría:', err);
    return error(res, 'No se pudo obtener la categoría', 500);
  }
}

async function actualizar(req, res) {
  try {
    const categoria = await categoriaModel.actualizar(req.params.id, req.usuario.restauranteId, req.body);
    if (!categoria) {
      return error(res, 'Categoría no encontrada', 404);
    }
    return ok(res, { categoria });
  } catch (err) {
    console.error('Error al actualizar categoría:', err);
    return error(res, 'No se pudo actualizar la categoría', 500);
  }
}

async function eliminar(req, res) {
  try {
    const categoria = await categoriaModel.eliminar(req.params.id, req.usuario.restauranteId);
    if (!categoria) {
      return error(res, 'Categoría no encontrada', 404);
    }
    return ok(res, { categoria });
  } catch (err) {
    console.error('Error al eliminar categoría:', err);
    return error(res, 'No se pudo eliminar la categoría', 500);
  }
}

module.exports = { crear, listar, obtener, actualizar, eliminar };
