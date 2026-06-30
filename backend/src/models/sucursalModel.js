const pool = require('../config/database');

async function crear(db, { id, restaurante_id, nombre, direccion, telefono }) {
  const { rows } = await db.query(
    `INSERT INTO sucursales (id, restaurante_id, nombre, direccion, telefono)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, restaurante_id, nombre, direccion || null, telefono || null]
  );
  return rows[0];
}

async function buscarPorId(id) {
  const { rows } = await pool.query('SELECT * FROM sucursales WHERE id = $1', [id]);
  return rows[0] || null;
}

module.exports = { crear, buscarPorId };
