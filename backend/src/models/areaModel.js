const { v4: uuidv4 } = require('uuid');

const pool = require('../config/database');

const CAMPOS_ACTUALIZABLES = ['nombre', 'descripcion', 'orden', 'activa'];
const NOMBRE_AREA_REMOTA = 'Pedidos remotos';

async function crear({ id, restaurante_id, nombre, descripcion, orden }) {
  const { rows } = await pool.query(
    `INSERT INTO areas (id, restaurante_id, nombre, descripcion, orden)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, restaurante_id, nombre, descripcion ?? null, orden ?? 0]
  );
  return rows[0];
}

async function obtenerTodas(restauranteId) {
  const { rows } = await pool.query(
    `SELECT * FROM areas WHERE restaurante_id = $1 AND activa = true ORDER BY orden ASC`,
    [restauranteId]
  );
  return rows;
}

async function obtenerPorId(id, restauranteId) {
  const { rows } = await pool.query('SELECT * FROM areas WHERE id = $1 AND restaurante_id = $2', [
    id,
    restauranteId,
  ]);
  return rows[0] || null;
}

async function actualizar(id, restauranteId, datos) {
  const asignaciones = [];
  const valores = [];
  let i = 1;

  for (const campo of CAMPOS_ACTUALIZABLES) {
    if (datos[campo] !== undefined) {
      asignaciones.push(`${campo} = $${i}`);
      valores.push(datos[campo]);
      i++;
    }
  }

  if (asignaciones.length === 0) {
    return obtenerPorId(id, restauranteId);
  }

  valores.push(id, restauranteId);

  const { rows } = await pool.query(
    `UPDATE areas SET ${asignaciones.join(', ')}
     WHERE id = $${i} AND restaurante_id = $${i + 1}
     RETURNING *`,
    valores
  );
  return rows[0] || null;
}

async function eliminar(id, restauranteId) {
  const { rows } = await pool.query(
    `UPDATE areas SET activa = false WHERE id = $1 AND restaurante_id = $2 RETURNING *`,
    [id, restauranteId]
  );
  return rows[0] || null;
}

// Garantiza que exista el área especial de pedidos remotos para el
// restaurante, creándola la primera vez que se necesita.
async function obtenerOCrearAreaRemota(restauranteId) {
  const { rows } = await pool.query(
    `SELECT * FROM areas WHERE restaurante_id = $1 AND es_remota = true AND activa = true LIMIT 1`,
    [restauranteId]
  );
  if (rows[0]) {
    return rows[0];
  }

  const { rows: nuevas } = await pool.query(
    `INSERT INTO areas (id, restaurante_id, nombre, es_remota, orden)
     VALUES ($1, $2, $3, true, $4)
     RETURNING *`,
    [uuidv4(), restauranteId, NOMBRE_AREA_REMOTA, 999]
  );
  return nuevas[0];
}

module.exports = { crear, obtenerTodas, obtenerPorId, actualizar, eliminar, obtenerOCrearAreaRemota };
