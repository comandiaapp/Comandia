const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const pool = require('../config/database');
const restauranteModel = require('../models/restauranteModel');
const sucursalModel = require('../models/sucursalModel');
const usuarioModel = require('../models/usuarioModel');
const contaduriaModel = require('../models/contaduriaModel');
const codigoAccesoModel = require('../models/codigoAccesoModel');
const { generarToken } = require('../utils/jwt');
const { ok, error } = require('../utils/respuestas');
const { validarPasswordFuerte } = require('../utils/validarPassword');
const { enviarVerificacionEmail, enviarResetPassword, enviarBienvenida } = require('../utils/email');

const SALT_ROUNDS = 12;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DIAS_TRIAL = 14;
const HORAS_TOKEN_VERIFICACION = 24;
const HORAS_TOKEN_RESET = 1;
const MINUTOS_RATE_LIMIT_REENVIO = 2;

function sinPassword(usuario) {
  const { password_hash, token_verificacion, token_reset_password, ...resto } = usuario;
  return resto;
}

function calcularDiasRestantes(fechaExpira) {
  if (!fechaExpira) {
    return null;
  }
  const diferenciaMs = new Date(fechaExpira).getTime() - Date.now();
  return Math.max(0, Math.ceil(diferenciaMs / (24 * 60 * 60 * 1000)));
}

function mensajeBeneficioCodigo(codigo) {
  if (codigo.tipo === 'gratuito_vitalicio') {
    return 'Acceso gratuito de por vida';
  }
  if (codigo.tipo === 'trial_extendido') {
    return `${DIAS_TRIAL + codigo.trial_dias_extra} días de prueba gratis`;
  }
  if (codigo.tipo === 'descuento') {
    return `${codigo.descuento_porcentaje}% de descuento`;
  }
  return 'Código válido';
}

async function registro(req, res) {
  const { nombre_restaurante, ciudad, telefono_restaurante, nombre_usuario, email_usuario, password, codigo_acceso } =
    req.body;

  if (!nombre_restaurante || !nombre_usuario || !email_usuario || !password) {
    return error(
      res,
      'Faltan campos obligatorios: nombre_restaurante, nombre_usuario, email_usuario, password',
      400
    );
  }

  if (!EMAIL_REGEX.test(email_usuario)) {
    return error(res, 'El email no tiene un formato válido', 400);
  }

  const errorPassword = validarPasswordFuerte(password);
  if (errorPassword) {
    return error(res, errorPassword, 400);
  }

  const codigoNormalizado = codigo_acceso ? codigo_acceso.trim().toUpperCase() : null;
  let codigoValidado = null;

  if (codigoNormalizado) {
    const resultado = await codigoAccesoModel.validarCodigo(codigoNormalizado);
    if (!resultado.valido) {
      return error(res, resultado.mensaje, 400);
    }
    codigoValidado = resultado.codigo;
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const ahora = Date.now();
    let trialExpira = new Date(ahora + DIAS_TRIAL * 24 * 60 * 60 * 1000);
    let suscripcionPlan;
    let descuentoPorcentaje = null;

    if (codigoValidado) {
      if (codigoValidado.tipo === 'gratuito_vitalicio') {
        suscripcionPlan = 'gratuito_vitalicio';
        trialExpira = null;
      } else if (codigoValidado.tipo === 'trial_extendido') {
        trialExpira = new Date(ahora + (DIAS_TRIAL + codigoValidado.trial_dias_extra) * 24 * 60 * 60 * 1000);
      } else if (codigoValidado.tipo === 'descuento') {
        descuentoPorcentaje = codigoValidado.descuento_porcentaje;
      }

      const consumido = await codigoAccesoModel.usarCodigo(codigoNormalizado, null, client);
      if (!consumido) {
        await client.query('ROLLBACK');
        return error(res, 'Este código acaba de agotarse, intenta registrarte sin código', 409);
      }
    }

    const tokenVerificacion = uuidv4();
    const tokenVerificacionExpira = new Date(ahora + HORAS_TOKEN_VERIFICACION * 60 * 60 * 1000);

    const restaurante = await restauranteModel.crear(client, {
      id: uuidv4(),
      nombre: nombre_restaurante,
      email: email_usuario,
      telefono: telefono_restaurante,
      ciudad,
      trial_expira: trialExpira,
      suscripcion_plan: suscripcionPlan,
      codigo_acceso_usado: codigoValidado ? codigoNormalizado : null,
      descuento_porcentaje: descuentoPorcentaje,
    });

    const sucursal = await sucursalModel.crear(client, {
      id: uuidv4(),
      restaurante_id: restaurante.id,
      nombre: 'Principal',
      telefono: telefono_restaurante,
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
      token_verificacion: tokenVerificacion,
      token_verificacion_expira: tokenVerificacionExpira,
      trial_expira: trialExpira,
    });

    await contaduriaModel.crearCategoriasDefault(client, restaurante.id);

    await client.query('COMMIT');

    const token = generarToken({
      userId: usuario.id,
      restauranteId: restaurante.id,
      sucursalId: sucursal.id,
      rol: usuario.rol,
    });

    // El envío de correos no debe tumbar el registro si Resend falla o no
    // está configurado (p. ej. en desarrollo sin RESEND_API_KEY).
    enviarVerificacionEmail(usuario.email, usuario.nombre, tokenVerificacion).catch((err) => {
      console.error('Error enviando email de verificación:', err.message || err);
    });
    enviarBienvenida(usuario.email, usuario.nombre, restaurante.nombre, trialExpira).catch((err) => {
      console.error('Error enviando email de bienvenida:', err.message || err);
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

    let usuario = usuarios[0];

    if (!usuario.activo) {
      return error(res, 'Usuario inactivo', 403);
    }

    if (usuario.bloqueado_hasta && new Date(usuario.bloqueado_hasta) > new Date()) {
      const minutosRestantes = Math.ceil((new Date(usuario.bloqueado_hasta) - new Date()) / 60000);
      return error(res, `Cuenta bloqueada temporalmente. Intenta en ${minutosRestantes} minuto(s)`, 429);
    }

    const passwordValida = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordValida) {
      usuario = await usuarioModel.registrarIntentoFallido(usuario.id);

      if (usuario.bloqueado_hasta && new Date(usuario.bloqueado_hasta) > new Date()) {
        const minutosRestantes = Math.ceil((new Date(usuario.bloqueado_hasta) - new Date()) / 60000);
        return error(res, `Cuenta bloqueada temporalmente. Intenta en ${minutosRestantes} minuto(s)`, 429);
      }

      return error(res, 'Credenciales inválidas', 401);
    }

    if (usuario.intentos_login > 0) {
      usuario = await usuarioModel.resetearIntentosLogin(usuario.id);
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
      email_verificado: usuario.email_verificado,
      trial_expira: restaurante.trial_expira,
      dias_trial_restantes: calcularDiasRestantes(restaurante.trial_expira),
      suscripcion_activa: restaurante.suscripcion_activa,
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

async function verificarEmail(req, res) {
  const { token } = req.query;

  if (!token) {
    return error(res, 'Token no proporcionado', 400);
  }

  try {
    const usuario = await usuarioModel.buscarPorTokenVerificacion(token);
    if (!usuario) {
      return error(res, 'Link inválido o expirado', 400);
    }

    await usuarioModel.marcarEmailVerificado(usuario.id);

    return ok(res, { mensaje: 'Email verificado' });
  } catch (err) {
    console.error('Error en verificarEmail:', err);
    return error(res, 'No se pudo verificar el email', 500);
  }
}

async function olvideMiPassword(req, res) {
  const { email } = req.body;

  if (!email) {
    return error(res, 'Email es obligatorio', 400);
  }

  try {
    const usuarios = await usuarioModel.buscarPorEmail(email);

    if (usuarios.length > 0) {
      const usuario = usuarios[0];
      const token = uuidv4();
      const expira = new Date(Date.now() + HORAS_TOKEN_RESET * 60 * 60 * 1000);

      await usuarioModel.actualizarTokenReset(usuario.id, token, expira);

      enviarResetPassword(usuario.email, usuario.nombre, token).catch((err) => {
        console.error('Error enviando email de reset:', err.message || err);
      });
    }

    // Nunca se revela si el email existe o no en el sistema.
    return ok(res, { mensaje: 'Si el email existe, recibirás instrucciones' });
  } catch (err) {
    console.error('Error en olvideMiPassword:', err);
    return error(res, 'No se pudo procesar la solicitud', 500);
  }
}

async function resetPassword(req, res) {
  const { token, nueva_password } = req.body;

  if (!token || !nueva_password) {
    return error(res, 'Token y nueva_password son obligatorios', 400);
  }

  const errorPassword = validarPasswordFuerte(nueva_password);
  if (errorPassword) {
    return error(res, errorPassword, 400);
  }

  try {
    const usuario = await usuarioModel.buscarPorTokenReset(token);
    if (!usuario) {
      return error(res, 'Link inválido o expirado', 400);
    }

    const password_hash = await bcrypt.hash(nueva_password, SALT_ROUNDS);
    await usuarioModel.actualizarPassword(usuario.id, password_hash);

    return ok(res, { mensaje: 'Contraseña actualizada' });
  } catch (err) {
    console.error('Error en resetPassword:', err);
    return error(res, 'No se pudo restablecer la contraseña', 500);
  }
}

async function reenviarVerificacion(req, res) {
  try {
    const usuario = await usuarioModel.buscarPorId(req.usuario.userId);
    if (!usuario) {
      return error(res, 'Usuario no encontrado', 404);
    }

    if (usuario.email_verificado) {
      return ok(res, { mensaje: 'El email ya está verificado' });
    }

    if (usuario.token_verificacion_expira) {
      const enviadoEn = new Date(usuario.token_verificacion_expira).getTime() - HORAS_TOKEN_VERIFICACION * 60 * 60 * 1000;
      const minutosDesdeEnvio = (Date.now() - enviadoEn) / 60000;

      if (minutosDesdeEnvio < MINUTOS_RATE_LIMIT_REENVIO) {
        const restante = Math.ceil(MINUTOS_RATE_LIMIT_REENVIO - minutosDesdeEnvio);
        return error(res, `Espera ${restante} minuto(s) antes de solicitar otro email de verificación`, 429);
      }
    }

    const token = uuidv4();
    const expira = new Date(Date.now() + HORAS_TOKEN_VERIFICACION * 60 * 60 * 1000);
    await usuarioModel.actualizarTokenVerificacion(usuario.id, token, expira);

    await enviarVerificacionEmail(usuario.email, usuario.nombre, token);

    return ok(res, { mensaje: 'Email de verificación reenviado' });
  } catch (err) {
    console.error('Error en reenviarVerificacion:', err);
    return error(res, 'No se pudo reenviar el email de verificación', 500);
  }
}

async function validarCodigoAcceso(req, res) {
  const { codigo } = req.body;

  if (!codigo) {
    return error(res, 'Código no proporcionado', 400);
  }

  try {
    const resultado = await codigoAccesoModel.validarCodigo(codigo.trim().toUpperCase());

    if (!resultado.valido) {
      return error(res, resultado.mensaje, 400);
    }

    return ok(res, {
      valido: true,
      tipo: resultado.codigo.tipo,
      beneficio: mensajeBeneficioCodigo(resultado.codigo),
    });
  } catch (err) {
    console.error('Error en validarCodigoAcceso:', err);
    return error(res, 'No se pudo validar el código', 500);
  }
}

module.exports = {
  registro,
  login,
  me,
  verificarEmail,
  olvideMiPassword,
  resetPassword,
  reenviarVerificacion,
  validarCodigoAcceso,
};
