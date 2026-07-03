const { v4: uuidv4 } = require('uuid');

const inventarioModel = require('../models/inventarioModel');
const { ok, error } = require('../utils/respuestas');

const UNIDADES_VALIDAS = ['unidad', 'kg', 'g', 'l', 'ml', 'porcion'];
const TIPOS_MOVIMIENTO_VALIDOS = ['entrada', 'salida', 'merma', 'ajuste', 'venta'];

// --- Ingredientes ---

async function crearIngrediente(req, res) {
  const { nombre, descripcion, unidad_medida, stock_actual, stock_minimo, stock_maximo, costo_unitario } = req.body;

  if (!nombre) {
    return error(res, 'El nombre del ingrediente es obligatorio', 400);
  }
  if (!unidad_medida || !UNIDADES_VALIDAS.includes(unidad_medida)) {
    return error(res, `Unidad de medida inválida. Valores permitidos: ${UNIDADES_VALIDAS.join(', ')}`, 400);
  }

  try {
    const ingrediente = await inventarioModel.crearIngrediente({
      id: uuidv4(),
      restaurante_id: req.usuario.restauranteId,
      nombre,
      descripcion,
      unidad_medida,
      stock_actual,
      stock_minimo,
      stock_maximo,
      costo_unitario,
    });
    return ok(res, { ingrediente }, 201);
  } catch (err) {
    console.error('Error al crear ingrediente:', err);
    return error(res, 'No se pudo crear el ingrediente', 500);
  }
}

async function listarIngredientes(req, res) {
  try {
    const { activo, stock_bajo } = req.query;
    const filtros = {};
    filtros.activo = activo === undefined ? true : activo === 'true';
    if (stock_bajo === 'true') {
      filtros.stock_bajo = true;
    }

    const ingredientes = await inventarioModel.obtenerIngredientes(req.usuario.restauranteId, filtros);
    return ok(res, { ingredientes });
  } catch (err) {
    console.error('Error al listar ingredientes:', err);
    return error(res, 'No se pudieron obtener los ingredientes', 500);
  }
}

async function obtenerIngrediente(req, res) {
  try {
    const ingrediente = await inventarioModel.obtenerIngredientePorId(req.params.id, req.usuario.restauranteId);
    if (!ingrediente) {
      return error(res, 'Ingrediente no encontrado', 404);
    }
    return ok(res, { ingrediente });
  } catch (err) {
    console.error('Error al obtener ingrediente:', err);
    return error(res, 'No se pudo obtener el ingrediente', 500);
  }
}

async function actualizarIngrediente(req, res) {
  if (req.body.unidad_medida !== undefined && !UNIDADES_VALIDAS.includes(req.body.unidad_medida)) {
    return error(res, `Unidad de medida inválida. Valores permitidos: ${UNIDADES_VALIDAS.join(', ')}`, 400);
  }

  try {
    const ingrediente = await inventarioModel.actualizarIngrediente(
      req.params.id,
      req.usuario.restauranteId,
      req.body
    );
    if (!ingrediente) {
      return error(res, 'Ingrediente no encontrado', 404);
    }
    return ok(res, { ingrediente });
  } catch (err) {
    console.error('Error al actualizar ingrediente:', err);
    return error(res, 'No se pudo actualizar el ingrediente', 500);
  }
}

async function eliminarIngrediente(req, res) {
  try {
    const ingrediente = await inventarioModel.eliminarIngrediente(req.params.id, req.usuario.restauranteId);
    if (!ingrediente) {
      return error(res, 'Ingrediente no encontrado', 404);
    }
    return ok(res, { ingrediente });
  } catch (err) {
    console.error('Error al eliminar ingrediente:', err);
    return error(res, 'No se pudo eliminar el ingrediente', 500);
  }
}

// --- Recetas ---

async function crearReceta(req, res) {
  const { producto_id, ingrediente_id, cantidad } = req.body;

  if (!producto_id || !ingrediente_id || cantidad === undefined || cantidad === null) {
    return error(res, 'El producto, el ingrediente y la cantidad son obligatorios', 400);
  }
  if (Number(cantidad) <= 0) {
    return error(res, 'La cantidad debe ser mayor a 0', 400);
  }

  try {
    const receta = await inventarioModel.crearReceta({
      id: uuidv4(),
      restaurante_id: req.usuario.restauranteId,
      producto_id,
      ingrediente_id,
      cantidad,
    });
    return ok(res, { receta }, 201);
  } catch (err) {
    if (err.code === '23503') {
      return error(res, 'El producto o el ingrediente especificado no existe', 400);
    }
    console.error('Error al crear receta:', err);
    return error(res, 'No se pudo crear la receta', 500);
  }
}

async function obtenerRecetasPorProducto(req, res) {
  try {
    const recetas = await inventarioModel.obtenerRecetasPorProducto(req.params.productoId, req.usuario.restauranteId);
    return ok(res, { recetas });
  } catch (err) {
    console.error('Error al obtener la receta del producto:', err);
    return error(res, 'No se pudo obtener la receta del producto', 500);
  }
}

async function eliminarReceta(req, res) {
  try {
    const receta = await inventarioModel.eliminarReceta(req.params.id, req.usuario.restauranteId);
    if (!receta) {
      return error(res, 'Receta no encontrada', 404);
    }
    return ok(res, { receta });
  } catch (err) {
    console.error('Error al eliminar receta:', err);
    return error(res, 'No se pudo eliminar la receta', 500);
  }
}

// --- Movimientos ---

async function registrarEntrada(req, res) {
  const { ingrediente_id, cantidad, costo_unitario, motivo } = req.body;

  if (!ingrediente_id || cantidad === undefined || cantidad === null || Number(cantidad) <= 0) {
    return error(res, 'El ingrediente y una cantidad mayor a 0 son obligatorios', 400);
  }

  try {
    const resultado = await inventarioModel.registrarMovimiento({
      id: uuidv4(),
      restaurante_id: req.usuario.restauranteId,
      ingrediente_id,
      tipo: 'entrada',
      cantidad: Math.abs(Number(cantidad)),
      costo_unitario,
      motivo,
      usuario_id: req.usuario.userId,
    });
    if (!resultado) {
      return error(res, 'Ingrediente no encontrado', 404);
    }
    return ok(res, resultado, 201);
  } catch (err) {
    console.error('Error al registrar la entrada:', err);
    return error(res, 'No se pudo registrar la entrada', 500);
  }
}

async function registrarMerma(req, res) {
  const { ingrediente_id, cantidad, motivo } = req.body;

  if (!ingrediente_id || cantidad === undefined || cantidad === null || Number(cantidad) <= 0) {
    return error(res, 'El ingrediente y una cantidad mayor a 0 son obligatorios', 400);
  }
  if (!motivo) {
    return error(res, 'El motivo de la merma es obligatorio', 400);
  }

  try {
    const resultado = await inventarioModel.registrarMovimiento({
      id: uuidv4(),
      restaurante_id: req.usuario.restauranteId,
      ingrediente_id,
      tipo: 'merma',
      cantidad: -Math.abs(Number(cantidad)),
      motivo,
      usuario_id: req.usuario.userId,
    });
    if (!resultado) {
      return error(res, 'Ingrediente no encontrado', 404);
    }
    return ok(res, resultado, 201);
  } catch (err) {
    console.error('Error al registrar la merma:', err);
    return error(res, 'No se pudo registrar la merma', 500);
  }
}

async function ajustarStock(req, res) {
  const { ingrediente_id, nuevo_stock, motivo } = req.body;

  if (!ingrediente_id || nuevo_stock === undefined || nuevo_stock === null || Number(nuevo_stock) < 0) {
    return error(res, 'El ingrediente y un nuevo stock válido son obligatorios', 400);
  }
  if (!motivo) {
    return error(res, 'El motivo del ajuste es obligatorio', 400);
  }

  try {
    const resultado = await inventarioModel.registrarAjuste({
      id: uuidv4(),
      restaurante_id: req.usuario.restauranteId,
      ingrediente_id,
      nuevo_stock,
      motivo,
      usuario_id: req.usuario.userId,
    });
    if (!resultado) {
      return error(res, 'Ingrediente no encontrado', 404);
    }
    return ok(res, resultado, 201);
  } catch (err) {
    console.error('Error al ajustar el stock:', err);
    return error(res, 'No se pudo ajustar el stock', 500);
  }
}

async function obtenerMovimientos(req, res) {
  const { ingrediente_id, tipo, fecha_inicio, fecha_fin } = req.query;

  if (tipo !== undefined && !TIPOS_MOVIMIENTO_VALIDOS.includes(tipo)) {
    return error(res, `Tipo inválido. Valores permitidos: ${TIPOS_MOVIMIENTO_VALIDOS.join(', ')}`, 400);
  }

  try {
    const filtros = {};
    if (ingrediente_id !== undefined) filtros.ingrediente_id = ingrediente_id;
    if (tipo !== undefined) filtros.tipo = tipo;
    if (fecha_inicio !== undefined) filtros.fecha_inicio = fecha_inicio;
    if (fecha_fin !== undefined) filtros.fecha_fin = fecha_fin;

    const movimientos = await inventarioModel.obtenerMovimientos(req.usuario.restauranteId, filtros);
    return ok(res, { movimientos });
  } catch (err) {
    console.error('Error al obtener los movimientos de inventario:', err);
    return error(res, 'No se pudieron obtener los movimientos de inventario', 500);
  }
}

async function obtenerAlertas(req, res) {
  try {
    const alertas = await inventarioModel.obtenerAlertas(req.usuario.restauranteId);
    return ok(res, { alertas });
  } catch (err) {
    console.error('Error al obtener las alertas de inventario:', err);
    return error(res, 'No se pudieron obtener las alertas de inventario', 500);
  }
}

module.exports = {
  crearIngrediente,
  listarIngredientes,
  obtenerIngrediente,
  actualizarIngrediente,
  eliminarIngrediente,
  crearReceta,
  obtenerRecetasPorProducto,
  eliminarReceta,
  registrarEntrada,
  registrarMerma,
  ajustarStock,
  obtenerMovimientos,
  obtenerAlertas,
};
