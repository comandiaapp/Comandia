const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const pool = require('../config/database');
const restauranteModel = require('../models/restauranteModel');
const usuarioModel = require('../models/usuarioModel');
const { ok, error } = require('../utils/respuestas');

const SALT_ROUNDS = 12;
const PASSWORD_TEMPORAL = 'Comandia2024';

const REGIMENES_VALIDOS = ['simplificado', 'comun'];
const MODOS_OPERACION_VALIDOS = ['todo_en_uno', 'multi_estacion'];
const ROLES_INVITABLES = ['admin', 'gerente', 'cajero', 'mesero', 'cocina'];

function sinPassword(usuario) {
  const { password_hash, ...resto } = usuario;
  return resto;
}

// --- Configuración del restaurante ---

async function obtenerConfiguracion(req, res) {
  try {
    const restaurante = await restauranteModel.obtenerConfiguracion(req.usuario.restauranteId);
    if (!restaurante) {
      return error(res, 'Restaurante no encontrado', 404);
    }
    return ok(res, { restaurante });
  } catch (err) {
    console.error('Error al obtener la configuración del restaurante:', err);
    return error(res, 'No se pudo obtener la configuración del restaurante', 500);
  }
}

async function actualizarConfiguracion(req, res) {
  const {
    regimen,
    modo_operacion,
    porcentaje_impuesto,
    porcentaje_propina_sugerida,
    factura_desde,
    factura_hasta,
  } = req.body;

  if (regimen !== undefined && !REGIMENES_VALIDOS.includes(regimen)) {
    return error(res, `Régimen inválido. Valores permitidos: ${REGIMENES_VALIDOS.join(', ')}`, 400);
  }
  if (modo_operacion !== undefined && !MODOS_OPERACION_VALIDOS.includes(modo_operacion)) {
    return error(res, `Modo de operación inválido. Valores permitidos: ${MODOS_OPERACION_VALIDOS.join(', ')}`, 400);
  }
  if (porcentaje_impuesto !== undefined && (Number(porcentaje_impuesto) < 0 || Number(porcentaje_impuesto) > 100)) {
    return error(res, 'El porcentaje de IVA debe estar entre 0 y 100', 400);
  }
  if (
    porcentaje_propina_sugerida !== undefined &&
    (Number(porcentaje_propina_sugerida) < 0 || Number(porcentaje_propina_sugerida) > 100)
  ) {
    return error(res, 'El porcentaje de propina sugerida debe estar entre 0 y 100', 400);
  }
  if (
    factura_desde !== undefined &&
    factura_hasta !== undefined &&
    Number(factura_desde) > Number(factura_hasta)
  ) {
    return error(res, 'El número "desde" no puede ser mayor que el número "hasta"', 400);
  }

  try {
    const restaurante = await restauranteModel.actualizarConfiguracion(req.usuario.restauranteId, req.body);
    if (!restaurante) {
      return error(res, 'Restaurante no encontrado', 404);
    }
    return ok(res, { restaurante });
  } catch (err) {
    console.error('Error al actualizar la configuración del restaurante:', err);
    return error(res, 'No se pudo actualizar la configuración del restaurante', 500);
  }
}

// --- Usuarios y roles ---

async function listarUsuarios(req, res) {
  try {
    const usuarios = await usuarioModel.listarPorRestaurante(req.usuario.restauranteId);
    return ok(res, { usuarios });
  } catch (err) {
    console.error('Error al listar los usuarios del restaurante:', err);
    return error(res, 'No se pudieron obtener los usuarios', 500);
  }
}

async function invitarUsuario(req, res) {
  const { nombre, email, rol } = req.body;

  if (!nombre || !email) {
    return error(res, 'El nombre y el email son obligatorios', 400);
  }
  if (!rol || !ROLES_INVITABLES.includes(rol)) {
    return error(res, `Rol inválido. Valores permitidos: ${ROLES_INVITABLES.join(', ')}`, 400);
  }

  try {
    const password_hash = await bcrypt.hash(PASSWORD_TEMPORAL, SALT_ROUNDS);

    const usuario = await usuarioModel.crear(pool, {
      id: uuidv4(),
      restaurante_id: req.usuario.restauranteId,
      sucursal_id: req.usuario.sucursalId,
      nombre,
      email,
      password_hash,
      rol,
      debe_cambiar_password: true,
    });

    return ok(res, { usuario: sinPassword(usuario), password_temporal: PASSWORD_TEMPORAL }, 201);
  } catch (err) {
    if (err.code === '23505') {
      return error(res, 'Ya existe un usuario con ese email en este restaurante', 409);
    }
    console.error('Error al invitar al usuario:', err);
    return error(res, 'No se pudo invitar al usuario', 500);
  }
}

async function actualizarRolUsuario(req, res) {
  const { rol } = req.body;

  if (!rol || !ROLES_INVITABLES.includes(rol)) {
    return error(res, `Rol inválido. Valores permitidos: ${ROLES_INVITABLES.join(', ')}`, 400);
  }

  try {
    const usuario = await usuarioModel.actualizarRol(req.params.id, req.usuario.restauranteId, rol);
    if (!usuario) {
      return error(res, 'Usuario no encontrado', 404);
    }
    return ok(res, { usuario });
  } catch (err) {
    console.error('Error al actualizar el rol del usuario:', err);
    return error(res, 'No se pudo actualizar el rol del usuario', 500);
  }
}

async function actualizarEstadoUsuario(req, res) {
  const { activo } = req.body;

  if (typeof activo !== 'boolean') {
    return error(res, 'El campo activo debe ser verdadero o falso', 400);
  }

  try {
    const usuario = await usuarioModel.actualizarEstadoActivo(req.params.id, req.usuario.restauranteId, activo);
    if (!usuario) {
      return error(res, 'Usuario no encontrado', 404);
    }
    return ok(res, { usuario });
  } catch (err) {
    console.error('Error al actualizar el estado del usuario:', err);
    return error(res, 'No se pudo actualizar el estado del usuario', 500);
  }
}

module.exports = {
  obtenerConfiguracion,
  actualizarConfiguracion,
  listarUsuarios,
  invitarUsuario,
  actualizarRolUsuario,
  actualizarEstadoUsuario,
};
