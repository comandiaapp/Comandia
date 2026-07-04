const pool = require('../config/database');

const INTENTOS_LOGIN_MAXIMOS = 5;
const BLOQUEO_MINUTOS = 15;

async function crear(
  db,
  {
    id,
    restaurante_id,
    sucursal_id,
    nombre,
    email,
    password_hash,
    rol,
    debe_cambiar_password,
    token_verificacion,
    token_verificacion_expira,
    trial_expira,
  }
) {
  const { rows } = await db.query(
    `INSERT INTO usuarios
       (id, restaurante_id, sucursal_id, nombre, email, password_hash, rol, debe_cambiar_password,
        token_verificacion, token_verificacion_expira, trial_expira)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      id,
      restaurante_id,
      sucursal_id || null,
      nombre,
      email,
      password_hash,
      rol,
      debe_cambiar_password ?? false,
      token_verificacion || null,
      token_verificacion_expira || null,
      trial_expira || null,
    ]
  );
  return rows[0];
}

// Retorna un arreglo: el email solo es unico por restaurante, asi que sin
// restaurante_id puede haber mas de un usuario con el mismo email.
async function buscarPorEmail(email, restaurante_id = null) {
  if (restaurante_id) {
    const { rows } = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1 AND restaurante_id = $2',
      [email, restaurante_id]
    );
    return rows;
  }

  const { rows } = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
  return rows;
}

async function buscarPorId(id) {
  const { rows } = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
  return rows[0] || null;
}

async function listarPorRestaurante(restauranteId) {
  const { rows } = await pool.query(
    `SELECT id, restaurante_id, sucursal_id, nombre, email, rol, activo, debe_cambiar_password, created_at
     FROM usuarios WHERE restaurante_id = $1 ORDER BY nombre ASC`,
    [restauranteId]
  );
  return rows;
}

async function actualizarRol(id, restauranteId, rol) {
  const { rows } = await pool.query(
    `UPDATE usuarios SET rol = $1, updated_at = now() WHERE id = $2 AND restaurante_id = $3
     RETURNING id, restaurante_id, sucursal_id, nombre, email, rol, activo, debe_cambiar_password, created_at`,
    [rol, id, restauranteId]
  );
  return rows[0] || null;
}

async function actualizarEstadoActivo(id, restauranteId, activo) {
  const { rows } = await pool.query(
    `UPDATE usuarios SET activo = $1, updated_at = now() WHERE id = $2 AND restaurante_id = $3
     RETURNING id, restaurante_id, sucursal_id, nombre, email, rol, activo, debe_cambiar_password, created_at`,
    [activo, id, restauranteId]
  );
  return rows[0] || null;
}

async function buscarPorTokenVerificacion(token) {
  const { rows } = await pool.query(
    `SELECT * FROM usuarios WHERE token_verificacion = $1 AND token_verificacion_expira > now()`,
    [token]
  );
  return rows[0] || null;
}

async function marcarEmailVerificado(id) {
  const { rows } = await pool.query(
    `UPDATE usuarios
     SET email_verificado = true, token_verificacion = NULL, token_verificacion_expira = NULL, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

async function actualizarTokenVerificacion(id, token, expira) {
  const { rows } = await pool.query(
    `UPDATE usuarios
     SET token_verificacion = $1, token_verificacion_expira = $2, updated_at = now()
     WHERE id = $3
     RETURNING *`,
    [token, expira, id]
  );
  return rows[0] || null;
}

async function actualizarTokenReset(id, token, expira) {
  const { rows } = await pool.query(
    `UPDATE usuarios
     SET token_reset_password = $1, token_reset_expira = $2, updated_at = now()
     WHERE id = $3
     RETURNING *`,
    [token, expira, id]
  );
  return rows[0] || null;
}

async function buscarPorTokenReset(token) {
  const { rows } = await pool.query(
    `SELECT * FROM usuarios WHERE token_reset_password = $1 AND token_reset_expira > now()`,
    [token]
  );
  return rows[0] || null;
}

async function actualizarPassword(id, password_hash) {
  const { rows } = await pool.query(
    `UPDATE usuarios
     SET password_hash = $1, token_reset_password = NULL, token_reset_expira = NULL,
         intentos_login = 0, bloqueado_hasta = NULL, updated_at = now()
     WHERE id = $2
     RETURNING *`,
    [password_hash, id]
  );
  return rows[0] || null;
}

async function registrarIntentoFallido(id) {
  const { rows } = await pool.query(
    `UPDATE usuarios
     SET intentos_login = intentos_login + 1,
         bloqueado_hasta = CASE
           WHEN intentos_login + 1 >= $2 THEN now() + ($3 || ' minutes')::interval
           ELSE bloqueado_hasta
         END,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, INTENTOS_LOGIN_MAXIMOS, BLOQUEO_MINUTOS]
  );
  return rows[0] || null;
}

async function resetearIntentosLogin(id) {
  const { rows } = await pool.query(
    `UPDATE usuarios SET intentos_login = 0, bloqueado_hasta = NULL, updated_at = now() WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

module.exports = {
  crear,
  buscarPorEmail,
  buscarPorId,
  listarPorRestaurante,
  actualizarRol,
  actualizarEstadoActivo,
  buscarPorTokenVerificacion,
  marcarEmailVerificado,
  actualizarTokenVerificacion,
  actualizarTokenReset,
  buscarPorTokenReset,
  actualizarPassword,
  registrarIntentoFallido,
  resetearIntentosLogin,
  INTENTOS_LOGIN_MAXIMOS,
  BLOQUEO_MINUTOS,
};
