const pool = require('../config/database');

async function crear(db, { id, restaurante_id, sucursal_id, nombre, email, password_hash, rol, debe_cambiar_password }) {
  const { rows } = await db.query(
    `INSERT INTO usuarios (id, restaurante_id, sucursal_id, nombre, email, password_hash, rol, debe_cambiar_password)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [id, restaurante_id, sucursal_id || null, nombre, email, password_hash, rol, debe_cambiar_password ?? false]
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

module.exports = {
  crear,
  buscarPorEmail,
  buscarPorId,
  listarPorRestaurante,
  actualizarRol,
  actualizarEstadoActivo,
};
