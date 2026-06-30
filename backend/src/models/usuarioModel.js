const pool = require('../config/database');

async function crear(db, { id, restaurante_id, sucursal_id, nombre, email, password_hash, rol }) {
  const { rows } = await db.query(
    `INSERT INTO usuarios (id, restaurante_id, sucursal_id, nombre, email, password_hash, rol)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [id, restaurante_id, sucursal_id || null, nombre, email, password_hash, rol]
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

module.exports = { crear, buscarPorEmail, buscarPorId };
