const { v4: uuidv4 } = require('uuid');

const productoModel = require('../models/productoModel');
const { ok, error } = require('../utils/respuestas');
const { guardarImagenProducto, eliminarImagenProducto } = require('../utils/imagenProducto');

// El costo (para calcular margen) nunca se devuelve a meseros ni cajeros.
const ROLES_VEN_COSTO = ['admin', 'gerente'];

function serializar(producto, rol) {
  if (ROLES_VEN_COSTO.includes(rol)) {
    return producto;
  }
  const { costo, ...resto } = producto;
  return resto;
}

async function crear(req, res) {
  const {
    categoria_id,
    nombre,
    descripcion,
    imagen_url,
    imagen_base64,
    precio,
    costo,
    tipo,
    disponible,
    disponible_para,
    tiempo_preparacion,
    orden,
  } = req.body;

  if (!nombre || precio === undefined || precio === null) {
    return error(res, 'El nombre y el precio del producto son obligatorios', 400);
  }

  const id = uuidv4();

  try {
    const urlImagen = imagen_base64 ? await guardarImagenProducto(id, imagen_base64, req) : imagen_url;

    const producto = await productoModel.crear({
      id,
      restaurante_id: req.usuario.restauranteId,
      categoria_id,
      nombre,
      descripcion,
      imagen_url: urlImagen,
      precio,
      costo,
      tipo,
      disponible,
      disponible_para,
      tiempo_preparacion,
      orden,
    });

    return ok(res, { producto: serializar(producto, req.usuario.rol) }, 201);
  } catch (err) {
    if (err.imagenInvalida) {
      return error(res, err.message, 400);
    }
    if (imagen_base64) {
      eliminarImagenProducto(id);
    }
    console.error('Error al crear producto:', err);
    return error(res, 'No se pudo crear el producto', 500);
  }
}

async function listar(req, res) {
  try {
    const { categoria_id, disponible, tipo, disponible_para } = req.query;

    const filtros = {};
    if (categoria_id !== undefined) filtros.categoria_id = categoria_id;
    if (disponible !== undefined) filtros.disponible = disponible === 'true';
    if (tipo !== undefined) filtros.tipo = tipo;
    if (disponible_para !== undefined) filtros.disponible_para = disponible_para;

    const productos = await productoModel.obtenerTodos(req.usuario.restauranteId, filtros);

    return ok(res, {
      productos: productos.map((producto) => serializar(producto, req.usuario.rol)),
    });
  } catch (err) {
    console.error('Error al listar productos:', err);
    return error(res, 'No se pudieron obtener los productos', 500);
  }
}

async function obtener(req, res) {
  try {
    const producto = await productoModel.obtenerPorId(req.params.id, req.usuario.restauranteId);
    if (!producto) {
      return error(res, 'Producto no encontrado', 404);
    }
    return ok(res, { producto: serializar(producto, req.usuario.rol) });
  } catch (err) {
    console.error('Error al obtener producto:', err);
    return error(res, 'No se pudo obtener el producto', 500);
  }
}

async function actualizar(req, res) {
  try {
    const existente = await productoModel.obtenerPorId(req.params.id, req.usuario.restauranteId);
    if (!existente) {
      return error(res, 'Producto no encontrado', 404);
    }

    const { imagen_base64, ...datos } = req.body;

    if (imagen_base64) {
      datos.imagen_url = await guardarImagenProducto(req.params.id, imagen_base64, req);
    } else if (imagen_base64 === '') {
      datos.imagen_url = null;
      eliminarImagenProducto(req.params.id);
    }

    const producto = await productoModel.actualizar(req.params.id, req.usuario.restauranteId, datos);
    return ok(res, { producto: serializar(producto, req.usuario.rol) });
  } catch (err) {
    if (err.imagenInvalida) {
      return error(res, err.message, 400);
    }
    console.error('Error al actualizar producto:', err);
    return error(res, 'No se pudo actualizar el producto', 500);
  }
}

async function eliminar(req, res) {
  try {
    const producto = await productoModel.eliminar(req.params.id, req.usuario.restauranteId);
    if (!producto) {
      return error(res, 'Producto no encontrado', 404);
    }
    return ok(res, { producto: serializar(producto, req.usuario.rol) });
  } catch (err) {
    console.error('Error al eliminar producto:', err);
    return error(res, 'No se pudo eliminar el producto', 500);
  }
}

async function obtenerMenu(req, res) {
  try {
    const menu = await productoModel.obtenerMenu(req.params.restauranteId);
    return ok(res, { menu });
  } catch (err) {
    console.error('Error al obtener el menú:', err);
    return error(res, 'No se pudo obtener el menú', 500);
  }
}

module.exports = { crear, listar, obtener, actualizar, eliminar, obtenerMenu };
