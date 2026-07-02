const { v4: uuidv4 } = require('uuid');

const pool = require('../config/database');

const ESTADOS_ABIERTA = ['abierta', 'reabierta'];

async function obtenerAbierta(restauranteId, sucursalId) {
  const { rows } = await pool.query(
    `SELECT * FROM jornadas
     WHERE restaurante_id = $1 AND sucursal_id = $2 AND estado = ANY($3::varchar[])
     ORDER BY fecha_apertura DESC
     LIMIT 1`,
    [restauranteId, sucursalId, ESTADOS_ABIERTA]
  );
  return rows[0] || null;
}

async function abrir({ id, restaurante_id, sucursal_id, usuario_apertura_id, monto_apertura }) {
  const { rows } = await pool.query(
    `INSERT INTO jornadas (id, restaurante_id, sucursal_id, usuario_apertura_id, monto_apertura, estado)
     VALUES ($1, $2, $3, $4, $5, 'abierta')
     RETURNING *`,
    [id, restaurante_id, sucursal_id, usuario_apertura_id, monto_apertura ?? 0]
  );
  return rows[0];
}

// Las ventas de una jornada se calculan por rango de tiempo (fecha_apertura -
// fecha_cierre o ahora) en lugar de por jornada_id, porque el flujo actual de
// creación de pedidos no asigna ese campo de forma consistente.
//
// El límite superior solo puede tomarse de fecha_cierre cuando la jornada
// sigue cerrada: al reabrir (estado 'reabierta') ese campo conserva la fecha
// del cierre anterior, y usarlo como límite dejaría fuera cualquier venta
// hecha después de reabrir. Mientras la jornada esté abierta o reabierta el
// límite superior siempre es "ahora".
async function calcularVentas(jornada) {
  const desde = jornada.fecha_apertura;
  const hasta = jornada.estado === 'cerrada' && jornada.fecha_cierre ? jornada.fecha_cierre : new Date();

  const { rows: pedidos } = await pool.query(
    `SELECT pagado_con, total FROM pedidos
     WHERE restaurante_id = $1 AND sucursal_id = $2 AND estado = 'pagado'
       AND updated_at >= $3 AND updated_at <= $4`,
    [jornada.restaurante_id, jornada.sucursal_id, desde, hasta]
  );

  const porMetodoPago = new Map();
  let totalVentas = 0;
  for (const pedido of pedidos) {
    const metodo = pedido.pagado_con || 'sin_especificar';
    const actual = porMetodoPago.get(metodo) || { metodo, total: 0, cantidad: 0 };
    actual.total += Number(pedido.total);
    actual.cantidad += 1;
    porMetodoPago.set(metodo, actual);
    totalVentas += Number(pedido.total);
  }

  const totalEfectivo = porMetodoPago.get('efectivo')?.total || 0;

  return {
    total_ventas: totalVentas,
    cantidad_pedidos: pedidos.length,
    por_metodo_pago: [...porMetodoPago.values()],
    total_efectivo: totalEfectivo,
    monto_esperado_caja: Number(jornada.monto_apertura) + totalEfectivo,
  };
}

async function obtenerPorId(id, restauranteId) {
  const { rows } = await pool.query(`SELECT * FROM jornadas WHERE id = $1 AND restaurante_id = $2`, [
    id,
    restauranteId,
  ]);
  return rows[0] || null;
}

async function cerrar(id, restauranteId, { monto_cierre_real, notas }, usuarioCierreId) {
  const jornada = await obtenerPorId(id, restauranteId);
  if (!jornada) {
    return null;
  }

  const ventas = await calcularVentas(jornada);
  const montoEsperado = ventas.monto_esperado_caja;
  const montoReal = Number(monto_cierre_real);
  const diferencia = montoReal - montoEsperado;

  const { rows } = await pool.query(
    `UPDATE jornadas
     SET estado = 'cerrada', fecha_cierre = now(), monto_cierre_esperado = $1, monto_cierre_real = $2,
         usuario_cierre_id = $3, notas = $4
     WHERE id = $5 AND restaurante_id = $6
     RETURNING *`,
    [montoEsperado, montoReal, usuarioCierreId, notas ?? null, id, restauranteId]
  );

  return { jornada: rows[0], ventas, diferencia };
}

async function reabrir(id, restauranteId, usuarioId) {
  const { rows } = await pool.query(
    `UPDATE jornadas SET estado = 'reabierta'
     WHERE id = $1 AND restaurante_id = $2 AND estado = 'cerrada'
     RETURNING *`,
    [id, restauranteId]
  );
  const jornada = rows[0];
  if (!jornada) {
    return null;
  }

  await pool.query(
    `INSERT INTO audit_log (id, restaurante_id, usuario_id, accion, tabla_afectada, registro_id, datos_nuevos)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      uuidv4(),
      restauranteId,
      usuarioId,
      'reabrir_jornada',
      'jornadas',
      id,
      JSON.stringify({ estado: 'reabierta' }),
    ]
  );

  return jornada;
}

async function historial(restauranteId, limite = 30) {
  const { rows: jornadas } = await pool.query(
    `SELECT j.*, ua.nombre AS usuario_apertura_nombre, uc.nombre AS usuario_cierre_nombre
     FROM jornadas j
     LEFT JOIN usuarios ua ON ua.id = j.usuario_apertura_id
     LEFT JOIN usuarios uc ON uc.id = j.usuario_cierre_id
     WHERE j.restaurante_id = $1
     ORDER BY j.fecha_apertura DESC
     LIMIT $2`,
    [restauranteId, limite]
  );

  return Promise.all(
    jornadas.map(async (jornada) => {
      const ventas = await calcularVentas(jornada);
      const diferencia =
        jornada.monto_cierre_real !== null ? Number(jornada.monto_cierre_real) - Number(jornada.monto_cierre_esperado) : null;
      return { ...jornada, ventas, diferencia };
    })
  );
}

module.exports = { obtenerAbierta, abrir, calcularVentas, obtenerPorId, cerrar, reabrir, historial };
