const pool = require('../config/database');

async function crear(db, { id, nombre, email, telefono, direccion, modo_operacion, plan }) {
  const { rows } = await db.query(
    `INSERT INTO restaurantes (id, nombre, email, telefono, direccion, modo_operacion, plan)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'todo_en_uno'), COALESCE($7, 'basico'))
     RETURNING *`,
    [id, nombre, email, telefono || null, direccion || null, modo_operacion || null, plan || null]
  );
  return rows[0];
}

async function buscarPorId(id) {
  const { rows } = await pool.query('SELECT * FROM restaurantes WHERE id = $1', [id]);
  return rows[0] || null;
}

async function buscarPorEmail(email) {
  const { rows } = await pool.query('SELECT * FROM restaurantes WHERE email = $1', [email]);
  return rows[0] || null;
}

module.exports = { crear, buscarPorId, buscarPorEmail };
