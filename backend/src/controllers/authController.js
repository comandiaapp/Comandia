const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const pool = require('../config/database');
const restauranteModel = require('../models/restauranteModel');
const sucursalModel = require('../models/sucursalModel');
const usuarioModel = require('../models/usuarioModel');
const { generarToken } = require('../utils/jwt');
const { ok, error } = require('../utils/respuestas');

const SALT_ROUNDS = 12;

function sinPassword(usuario) {
  const { password_hash, ...resto } = usuario;
  return resto;
}

async function registro(req, res) {
  const { nombre_restaurante, email_restaurante, nombre_usuario, email_usuario, password } = req.body;

  if (!nombre_restaurante || !email_restaurante || !nombre_usuario || !email_usuario || !password) {
    return error(
      res,
      'Faltan campos obligatorios: nombre_restaurante, email_restaurante, nombre_usuario, email_usuario, password',
      400
    );
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const restaurante = await restauranteModel.crear(client, {
      id: uuidv4(),
      nombre: nombre_restaurante,
      email: email_restaurante,
    });

    const sucursal = await sucursalModel.crear(client, {
      id: uuidv4(),
      restaurante_id: restaurante.id,
      nombre: 'Principal',
    });

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const usuario = await usuarioModel.crear(client, {
      id: uuidv4(),
      restaurante_id: restaurante.id,
      sucursal_id: sucursal.id,
      nombre: nombre_usuario,
      email: email_usuario,
      password_hash,
      rol: 'admin',
    });

    await client.query('COMMIT');

    const token = generarToken({
      userId: usuario.id,
      restauranteId: restaurante.id,
      sucursalId: sucursal.id,
      rol: usuario.rol,
    });

    return ok(
      res,
      {
        token,
        usuario: sinPassword(usuario),
        restaurante,
        sucursal,
      },
      201
    );
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }

    if (err.code === '23505') {
      return error(res, 'El email del restaurante o del usuario ya está registrado', 409);
    }

    console.error('Error en registro:', err);
    return error(res, 'No se pudo completar el registro', 500);
  } finally {
    if (client) {
      client.release();
    }
  }
}

async function login(req, res) {
  const { email, password, restaurante_id } = req.body;

  if (!email || !password) {
    return error(res, 'Email y password son obligatorios', 400);
  }

  try {
    const usuarios = await usuarioModel.buscarPorEmail(email, restaurante_id);

    if (usuarios.length === 0) {
      return error(res, 'Credenciales inválidas', 401);
    }

    if (usuarios.length > 1) {
      return error(
        res,
        'Este email está registrado en más de un restaurante. Especifica restaurante_id para iniciar sesión.',
        409
      );
    }

    const usuario = usuarios[0];

    if (!usuario.activo) {
      return error(res, 'Usuario inactivo', 403);
    }

    const passwordValida = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordValida) {
      return error(res, 'Credenciales inválidas', 401);
    }

    const restaurante = await restauranteModel.buscarPorId(usuario.restaurante_id);
    if (!restaurante || !restaurante.activo) {
      return error(res, 'Restaurante inactivo', 403);
    }

    const token = generarToken({
      userId: usuario.id,
      restauranteId: usuario.restaurante_id,
      sucursalId: usuario.sucursal_id,
      rol: usuario.rol,
    });

    return ok(res, {
      token,
      usuario: sinPassword(usuario),
      restaurante,
    });
  } catch (err) {
    console.error('Error en login:', err);
    return error(res, 'No se pudo iniciar sesión', 500);
  }
}

async function me(req, res) {
  try {
    const usuario = await usuarioModel.buscarPorId(req.usuario.userId);
    if (!usuario) {
      return error(res, 'Usuario no encontrado', 404);
    }

    const restaurante = await restauranteModel.buscarPorId(usuario.restaurante_id);

    return ok(res, {
      usuario: sinPassword(usuario),
      restaurante,
    });
  } catch (err) {
    console.error('Error en me:', err);
    return error(res, 'No se pudo obtener la información del usuario', 500);
  }
}

module.exports = { registro, login, me };
