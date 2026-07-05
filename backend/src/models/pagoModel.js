const { v4: uuidv4 } = require('uuid');

const pool = require('../config/database');

const MONTOS_PLAN = {
  basico: 89000,
  profesional: 179000,
  empresarial: 299000,
};

const DIAS_PERIODO = 30;

async function crear(restauranteId, plan) {
  const { rows } = await pool.query(
    `INSERT INTO pagos (id, restaurante_id, plan, monto, estado)
     VALUES ($1, $2, $3, $4, 'pendiente')
     RETURNING *`,
    [uuidv4(), restauranteId, plan, MONTOS_PLAN[plan]]
  );
  return rows[0];
}

async function obtenerPorId(id) {
  const { rows } = await pool.query('SELECT * FROM pagos WHERE id = $1', [id]);
  return rows[0] || null;
}

async function listarPorRestaurante(restauranteId) {
  const { rows } = await pool.query('SELECT * FROM pagos WHERE restaurante_id = $1 ORDER BY created_at DESC', [
    restauranteId,
  ]);
  return rows;
}

async function marcarAprobado(id, { referenciaExterna, metodoPago }) {
  const fechaPago = new Date();
  const periodoFin = new Date(fechaPago.getTime() + DIAS_PERIODO * 24 * 60 * 60 * 1000);

  const { rows } = await pool.query(
    `UPDATE pagos
     SET estado = 'aprobado', referencia_externa = $1, metodo_pago = $2,
         fecha_pago = $3, periodo_inicio = $3, periodo_fin = $4
     WHERE id = $5
     RETURNING *`,
    [referenciaExterna || null, metodoPago || null, fechaPago, periodoFin, id]
  );
  return rows[0] || null;
}

async function marcarEstado(id, estado) {
  const { rows } = await pool.query(`UPDATE pagos SET estado = $1 WHERE id = $2 RETURNING *`, [estado, id]);
  return rows[0] || null;
}

module.exports = {
  crear,
  obtenerPorId,
  listarPorRestaurante,
  marcarAprobado,
  marcarEstado,
  MONTOS_PLAN,
};
