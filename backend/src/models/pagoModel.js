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

async function marcarEstado(id, estado) {
  const { rows } = await pool.query(`UPDATE pagos SET estado = $1 WHERE id = $2 RETURNING *`, [estado, id]);
  return rows[0] || null;
}

// Aprueba el pago y activa el plan del restaurante en una sola transacción.
// El FOR UPDATE bloquea la fila mientras se revisa el estado, así que si
// Mercado Pago notifica el mismo pago dos veces en paralelo (webhook +
// verificación manual, o reintento del webhook) la segunda llamada espera,
// ve que ya no está 'pendiente' y no repite el efecto (activar el plan,
// reenviar el email).
async function aprobarYActivarPlan(pagoId, { referenciaExterna, metodoPago } = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: pagoRows } = await client.query('SELECT * FROM pagos WHERE id = $1 FOR UPDATE', [pagoId]);
    const pago = pagoRows[0];

    if (!pago || pago.estado !== 'pendiente') {
      await client.query('ROLLBACK');
      return { pago: pago || null, restaurante: null, yaProcesado: true };
    }

    const fechaPago = new Date();
    const periodoFin = new Date(fechaPago.getTime() + DIAS_PERIODO * 24 * 60 * 60 * 1000);

    const { rows: pagoActualizadoRows } = await client.query(
      `UPDATE pagos
       SET estado = 'aprobado', referencia_externa = $1, metodo_pago = $2,
           fecha_pago = $3, periodo_inicio = $3, periodo_fin = $4
       WHERE id = $5
       RETURNING *`,
      [referenciaExterna || null, metodoPago || null, fechaPago, periodoFin, pagoId]
    );

    const { rows: restauranteRows } = await client.query(
      `UPDATE restaurantes
       SET suscripcion_plan = $1, suscripcion_activa = true, trial_expira = NULL, updated_at = now()
       WHERE id = $2
       RETURNING *`,
      [pago.plan, pago.restaurante_id]
    );

    await client.query('COMMIT');

    return { pago: pagoActualizadoRows[0], restaurante: restauranteRows[0], yaProcesado: false };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  crear,
  obtenerPorId,
  listarPorRestaurante,
  marcarEstado,
  aprobarYActivarPlan,
  MONTOS_PLAN,
};
