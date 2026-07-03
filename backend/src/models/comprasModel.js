const { v4: uuidv4 } = require('uuid');

const pool = require('../config/database');
const inventarioModel = require('./inventarioModel');

const CAMPOS_ACTUALIZABLES_ORDEN = ['proveedor', 'notas', 'fecha_esperada', 'estado'];

const COLUMNAS_ORDEN = `id, restaurante_id, numero, estado, proveedor, notas, total_estimado,
       fecha_esperada::text AS fecha_esperada, fecha_recibida::text AS fecha_recibida,
       usuario_id, created_at, updated_at`;

// --- Órdenes de compra ---

async function crearOrden({ id, restaurante_id, proveedor, notas, fecha_esperada, usuario_id, items }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Correlativo por restaurante, calculado dentro de la misma transacción
    // (mismo patrón que pedidoModel.crear para numero_jornada).
    const { rows: countRows } = await client.query(
      `SELECT COUNT(*) + 1 AS numero FROM ordenes_compra WHERE restaurante_id = $1`,
      [restaurante_id]
    );
    const numero = Number(countRows[0].numero);

    const totalEstimado = items.reduce(
      (suma, item) => suma + Number(item.cantidad_solicitada) * Number(item.costo_unitario || 0),
      0
    );

    const { rows: ordenRows } = await client.query(
      `INSERT INTO ordenes_compra (id, restaurante_id, numero, proveedor, notas, total_estimado, fecha_esperada, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [id, restaurante_id, numero, proveedor ?? null, notas ?? null, totalEstimado, fecha_esperada ?? null, usuario_id ?? null]
    );
    const ordenId = ordenRows[0].id;

    for (const item of items) {
      const subtotal = Number(item.cantidad_solicitada) * Number(item.costo_unitario || 0);
      await client.query(
        `INSERT INTO orden_compra_items (
           id, orden_id, ingrediente_id, restaurante_id, nombre_ingrediente,
           cantidad_solicitada, costo_unitario, subtotal, unidad_medida
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          uuidv4(),
          ordenId,
          item.ingrediente_id ?? null,
          restaurante_id,
          item.nombre_ingrediente,
          item.cantidad_solicitada,
          item.costo_unitario ?? null,
          subtotal,
          item.unidad_medida ?? null,
        ]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return obtenerOrdenPorId(id, restaurante_id);
}

async function obtenerOrdenes(restauranteId, filtros = {}) {
  const condiciones = ['oc.restaurante_id = $1'];
  const valores = [restauranteId];
  let i = 2;

  if (filtros.estado !== undefined) {
    condiciones.push(`oc.estado = $${i}`);
    valores.push(filtros.estado);
    i++;
  }
  if (filtros.fecha_inicio !== undefined) {
    condiciones.push(`DATE(oc.created_at AT TIME ZONE 'America/Bogota') >= $${i}`);
    valores.push(filtros.fecha_inicio);
    i++;
  }
  if (filtros.fecha_fin !== undefined) {
    condiciones.push(`DATE(oc.created_at AT TIME ZONE 'America/Bogota') <= $${i}`);
    valores.push(filtros.fecha_fin);
    i++;
  }

  const { rows } = await pool.query(
    `SELECT oc.id, oc.restaurante_id, oc.numero, oc.estado, oc.proveedor, oc.notas, oc.total_estimado,
            oc.fecha_esperada::text AS fecha_esperada, oc.fecha_recibida::text AS fecha_recibida,
            oc.usuario_id, oc.created_at, oc.updated_at,
            COUNT(oci.id)::int AS items_count
     FROM ordenes_compra oc
     LEFT JOIN orden_compra_items oci ON oci.orden_id = oc.id
     WHERE ${condiciones.join(' AND ')}
     GROUP BY oc.id
     ORDER BY oc.numero DESC`,
    valores
  );
  return rows;
}

async function obtenerOrdenPorId(id, restauranteId) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS_ORDEN} FROM ordenes_compra WHERE id = $1 AND restaurante_id = $2`,
    [id, restauranteId]
  );
  const orden = rows[0];
  if (!orden) {
    return null;
  }

  const { rows: items } = await pool.query(
    `SELECT * FROM orden_compra_items WHERE orden_id = $1 AND restaurante_id = $2 ORDER BY nombre_ingrediente ASC`,
    [id, restauranteId]
  );
  return { ...orden, items };
}

async function actualizarOrden(id, restauranteId, datos) {
  const asignaciones = [];
  const valores = [];
  let i = 1;

  for (const campo of CAMPOS_ACTUALIZABLES_ORDEN) {
    if (datos[campo] !== undefined) {
      asignaciones.push(`${campo} = $${i}`);
      valores.push(datos[campo]);
      i++;
    }
  }

  if (asignaciones.length === 0) {
    return obtenerOrdenPorId(id, restauranteId);
  }

  asignaciones.push('updated_at = now()');
  valores.push(id, restauranteId);

  const { rows } = await pool.query(
    `UPDATE ordenes_compra SET ${asignaciones.join(', ')}
     WHERE id = $${i} AND restaurante_id = $${i + 1}
     RETURNING id`,
    valores
  );
  if (!rows[0]) {
    return null;
  }
  return obtenerOrdenPorId(id, restauranteId);
}

// Marca la orden como recibida: por cada item con cantidad_recibida > 0
// registra una entrada de inventario y suma su costo a una única
// transacción contable tipo 'compra'. Todo dentro de una transacción de BD
// para que el inventario, la contabilidad y el estado de la orden queden
// consistentes entre sí.
async function recibirOrden(id, restauranteId, itemsRecibidos, usuarioId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: ordenRows } = await client.query(
      `SELECT * FROM ordenes_compra WHERE id = $1 AND restaurante_id = $2 FOR UPDATE`,
      [id, restauranteId]
    );
    const orden = ordenRows[0];
    if (!orden) {
      await client.query('ROLLBACK');
      return null;
    }
    if (orden.estado === 'recibida' || orden.estado === 'cancelada') {
      await client.query('ROLLBACK');
      return { conflicto: `La orden ya está en estado "${orden.estado}"` };
    }

    const { rows: items } = await client.query(
      `SELECT * FROM orden_compra_items WHERE orden_id = $1 AND restaurante_id = $2`,
      [id, restauranteId]
    );
    const itemsPorId = new Map(items.map((item) => [item.id, item]));

    let totalRecibido = 0;
    for (const recibido of itemsRecibidos) {
      const item = itemsPorId.get(recibido.id);
      const cantidad = Number(recibido.cantidad_recibida);
      if (!item || !(cantidad > 0)) {
        continue;
      }

      await client.query(`UPDATE orden_compra_items SET cantidad_recibida = $1 WHERE id = $2`, [cantidad, item.id]);

      if (item.ingrediente_id) {
        await inventarioModel.registrarMovimiento(
          {
            id: uuidv4(),
            restaurante_id: restauranteId,
            ingrediente_id: item.ingrediente_id,
            tipo: 'entrada',
            cantidad,
            costo_unitario: item.costo_unitario,
            motivo: `Recepción de orden de compra #${orden.numero}`,
            usuario_id: usuarioId,
          },
          client
        );
      }

      totalRecibido += cantidad * Number(item.costo_unitario || 0);
    }

    if (totalRecibido > 0) {
      await client.query(
        `INSERT INTO transacciones_contables (id, restaurante_id, tipo, categoria, descripcion, monto, proveedor, fecha, usuario_id)
         VALUES ($1, $2, 'compra', $3, $4, $5, $6, (now() AT TIME ZONE 'America/Bogota')::date, $7)`,
        [
          uuidv4(),
          restauranteId,
          'Insumos/Mercancía',
          `Recepción de orden de compra #${orden.numero}`,
          totalRecibido,
          orden.proveedor,
          usuarioId,
        ]
      );
    }

    await client.query(
      `UPDATE ordenes_compra
       SET estado = 'recibida', fecha_recibida = (now() AT TIME ZONE 'America/Bogota')::date, updated_at = now()
       WHERE id = $1 AND restaurante_id = $2`,
      [id, restauranteId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return obtenerOrdenPorId(id, restauranteId);
}

async function cancelarOrden(id, restauranteId) {
  const { rows } = await pool.query(
    `UPDATE ordenes_compra SET estado = 'cancelada', updated_at = now()
     WHERE id = $1 AND restaurante_id = $2 AND estado NOT IN ('recibida', 'cancelada')
     RETURNING id`,
    [id, restauranteId]
  );
  if (!rows[0]) {
    return null;
  }
  return obtenerOrdenPorId(id, restauranteId);
}

// Sugerencia de compra a partir de las alertas de stock bajo. Si el
// ingrediente no tiene stock_maximo definido, usa el doble del mínimo como
// objetivo de reposición.
async function generarDesdeAlertas(restauranteId) {
  const alertas = await inventarioModel.obtenerAlertas(restauranteId);

  return alertas.map((ing) => {
    const stockActual = Number(ing.stock_actual);
    const stockMinimo = Number(ing.stock_minimo);
    const stockMaximo = ing.stock_maximo !== null ? Number(ing.stock_maximo) : null;
    const objetivo = stockMaximo !== null ? stockMaximo : stockMinimo * 2;

    return {
      ingrediente_id: ing.id,
      nombre: ing.nombre,
      unidad_medida: ing.unidad_medida,
      stock_actual: stockActual,
      stock_minimo: stockMinimo,
      stock_maximo: stockMaximo,
      costo_unitario: Number(ing.costo_unitario),
      cantidad_sugerida: Math.max(objetivo - stockActual, 0),
    };
  });
}

module.exports = {
  crearOrden,
  obtenerOrdenes,
  obtenerOrdenPorId,
  actualizarOrden,
  recibirOrden,
  cancelarOrden,
  generarDesdeAlertas,
};
