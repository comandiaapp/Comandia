const pool = require('../config/database');

const CAMPOS_ACTUALIZABLES = [
  'area_id',
  'numero',
  'nombre',
  'capacidad',
  'estado',
  'posicion_x',
  'posicion_y',
  'activa',
];

async function crear({ id, restaurante_id, area_id, numero, nombre, capacidad, estado, posicion_x, posicion_y }) {
  const { rows } = await pool.query(
    `INSERT INTO mesas (id, restaurante_id, area_id, numero, nombre, capacidad, estado, posicion_x, posicion_y)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      id,
      restaurante_id,
      area_id ?? null,
      numero,
      nombre ?? null,
      capacidad ?? 4,
      estado ?? 'libre',
      posicion_x ?? 0,
      posicion_y ?? 0,
    ]
  );
  return rows[0];
}

const ESTADOS_PEDIDO_ACTIVOS = ['abierto', 'enviado_cocina', 'listo', 'cuenta_pedida'];

async function obtenerTodas(restauranteId, areaId) {
  const condiciones = ['m.restaurante_id = $1', 'm.activa = true'];
  const valores = [restauranteId];
  let i = 2;

  if (areaId) {
    condiciones.push(`m.area_id = $${i}`);
    valores.push(areaId);
    i++;
  }

  // El LEFT JOIN a pedidos solo puede aportar como mucho una fila por mesa:
  // el índice único parcial idx_pedidos_mesa_activo garantiza que nunca haya
  // más de un pedido activo simultáneo para la misma mesa.
  const { rows } = await pool.query(
    `SELECT m.*, a.nombre AS area_nombre, p.id AS pedido_id, p.estado AS pedido_estado,
            p.cuenta_pedida_at
     FROM mesas m
     LEFT JOIN areas a ON a.id = m.area_id
     LEFT JOIN pedidos p ON p.mesa_id = m.id AND p.estado = ANY($${i}::varchar[])
     WHERE ${condiciones.join(' AND ')}
     ORDER BY m.numero ASC`,
    [...valores, ESTADOS_PEDIDO_ACTIVOS]
  );
  return rows;
}

async function obtenerPorId(id, restauranteId) {
  const { rows } = await pool.query(
    `SELECT m.*, a.nombre AS area_nombre
     FROM mesas m
     LEFT JOIN areas a ON a.id = m.area_id
     WHERE m.id = $1 AND m.restaurante_id = $2`,
    [id, restauranteId]
  );
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

  asignaciones.push('updated_at = now()');
  valores.push(id, restauranteId);

  const { rows } = await pool.query(
    `UPDATE mesas SET ${asignaciones.join(', ')}
     WHERE id = $${i} AND restaurante_id = $${i + 1}
     RETURNING *`,
    valores
  );
  return rows[0] || null;
}

async function cambiarEstado(id, restauranteId, estado) {
  const { rows } = await pool.query(
    `UPDATE mesas SET estado = $1, updated_at = now()
     WHERE id = $2 AND restaurante_id = $3
     RETURNING *`,
    [estado, id, restauranteId]
  );
  return rows[0] || null;
}

async function resetearPosiciones(restauranteId) {
  const { rows } = await pool.query(
    `UPDATE mesas SET posicion_x = 0, posicion_y = 0, updated_at = now()
     WHERE restaurante_id = $1 AND activa = true
     RETURNING *`,
    [restauranteId]
  );
  return rows;
}

async function eliminar(id, restauranteId) {
  const { rows } = await pool.query(
    `UPDATE mesas SET activa = false, updated_at = now()
     WHERE id = $1 AND restaurante_id = $2
     RETURNING *`,
    [id, restauranteId]
  );
  return rows[0] || null;
}

// Busca el número más alto usado alguna vez en el patrón "Domicilio-N" para
// este restaurante (incluyendo mesas eliminadas, para nunca reutilizar un
// número ya usado) y devuelve el siguiente correlativo.
async function obtenerSiguienteNumeroRemoto(restauranteId) {
  const { rows } = await pool.query(
    `SELECT numero FROM mesas WHERE restaurante_id = $1 AND numero LIKE 'Domicilio-%'`,
    [restauranteId]
  );

  let maximo = 0;
  for (const { numero } of rows) {
    const coincidencia = /^Domicilio-(\d+)$/.exec(numero.trim());
    if (coincidencia) {
      maximo = Math.max(maximo, parseInt(coincidencia[1], 10));
    }
  }

  return `Domicilio-${maximo + 1}`;
}

async function contarActivasEnArea(restauranteId, areaId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM mesas WHERE restaurante_id = $1 AND area_id = $2 AND activa = true`,
    [restauranteId, areaId]
  );
  return rows[0].total;
}

module.exports = {
  crear,
  obtenerTodas,
  obtenerPorId,
  actualizar,
  cambiarEstado,
  resetearPosiciones,
  eliminar,
  obtenerSiguienteNumeroRemoto,
  contarActivasEnArea,
};
