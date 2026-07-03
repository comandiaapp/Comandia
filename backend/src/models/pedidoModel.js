const { v4: uuidv4 } = require('uuid');

const pool = require('../config/database');

const ESTADOS_ACTIVOS = ['abierto', 'enviado_cocina', 'listo', 'cuenta_pedida'];

class PedidoNoEditableError extends Error {
  constructor(estado) {
    super(`El pedido está en estado '${estado}' y ya no admite más productos`);
    this.pedidoNoEditable = true;
  }
}

class SinItemsPendientesError extends Error {
  constructor() {
    super('No hay items nuevos para enviar a cocina');
    this.sinItemsPendientes = true;
  }
}

class MontoInsuficienteError extends Error {
  constructor(faltante) {
    super(`Falta ${faltante.toFixed(2)} para completar el pago`);
    this.montoInsuficiente = true;
    this.faltante = faltante;
  }
}

async function recalcularTotales(pedidoId, client) {
  const { rows: itemRows } = await client.query(
    `SELECT COALESCE(SUM(subtotal), 0) AS subtotal_items
     FROM pedido_items
     WHERE pedido_id = $1 AND estado != 'cancelado'`,
    [pedidoId]
  );
  const subtotalItems = Number(itemRows[0].subtotal_items);

  const { rows: pedidoRows } = await client.query(
    `SELECT descuento, impuesto, propina FROM pedidos WHERE id = $1`,
    [pedidoId]
  );
  const { descuento, impuesto, propina } = pedidoRows[0];

  const total = Math.max(0, subtotalItems - Number(descuento) + Number(impuesto) + Number(propina));

  const { rows } = await client.query(
    `UPDATE pedidos SET subtotal = $1, total = $2, updated_at = now() WHERE id = $3 RETURNING *`,
    [subtotalItems, total, pedidoId]
  );
  return rows[0];
}

async function crear({ id, restaurante_id, sucursal_id, mesa_id, jornada_id, usuario_id, tipo, notas }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // numero_jornada es el correlativo que ven meseros y cocina (#01, #02...)
    // y reinicia con cada jornada. Sin jornada activa no hay contra qué
    // contar, así que se completa después del INSERT con el correlativo
    // global como respaldo (nunca queda vacío).
    let numeroJornada = null;
    if (jornada_id) {
      const { rows: countRows } = await client.query(
        `SELECT COUNT(*) + 1 AS numero FROM pedidos WHERE jornada_id = $1 AND restaurante_id = $2`,
        [jornada_id, restaurante_id]
      );
      numeroJornada = Number(countRows[0].numero);
    }

    const { rows } = await client.query(
      `INSERT INTO pedidos (id, restaurante_id, sucursal_id, mesa_id, jornada_id, usuario_id, tipo, notas, numero_jornada)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        restaurante_id,
        sucursal_id ?? null,
        mesa_id ?? null,
        jornada_id ?? null,
        usuario_id,
        tipo ?? 'mesa',
        notas ?? null,
        numeroJornada,
      ]
    );
    let pedido = rows[0];

    if (!jornada_id) {
      const { rows: sinJornadaRows } = await client.query(
        `UPDATE pedidos SET numero_jornada = numero_global WHERE id = $1 RETURNING *`,
        [pedido.id]
      );
      pedido = sinJornadaRows[0];
    }

    if (mesa_id) {
      await client.query(
        `UPDATE mesas SET estado = 'ocupada', updated_at = now() WHERE id = $1 AND restaurante_id = $2`,
        [mesa_id, restaurante_id]
      );
    }

    await client.query('COMMIT');
    return pedido;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function obtenerPorMesa(mesaId, restauranteId) {
  const { rows } = await pool.query(
    `SELECT * FROM pedidos
     WHERE mesa_id = $1 AND restaurante_id = $2 AND estado = ANY($3::varchar[])
     ORDER BY created_at DESC
     LIMIT 1`,
    [mesaId, restauranteId, ESTADOS_ACTIVOS]
  );
  return rows[0] || null;
}

async function obtenerPorId(id, restauranteId) {
  const { rows } = await pool.query(
    `SELECT p.*, m.numero AS mesa_numero
     FROM pedidos p
     LEFT JOIN mesas m ON m.id = p.mesa_id
     WHERE p.id = $1 AND p.restaurante_id = $2`,
    [id, restauranteId]
  );
  const pedido = rows[0];
  if (!pedido) {
    return null;
  }

  const { rows: items } = await pool.query(
    `SELECT pi.*,
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'id', pim.id,
                  'modificador_opcion_id', pim.modificador_opcion_id,
                  'nombre_opcion', pim.nombre_opcion,
                  'precio_extra', pim.precio_extra
                )
              ) FILTER (WHERE pim.id IS NOT NULL),
              '[]'::jsonb
            ) AS modificadores
     FROM pedido_items pi
     LEFT JOIN pedido_item_modificadores pim ON pim.pedido_item_id = pi.id
     WHERE pi.pedido_id = $1
     GROUP BY pi.id
     ORDER BY pi.created_at ASC`,
    [id]
  );

  pedido.items = items;
  return pedido;
}

async function obtenerTodos(restauranteId, filtros = {}) {
  const condiciones = ['p.restaurante_id = $1'];
  const valores = [restauranteId];
  let i = 2;

  if (filtros.estados !== undefined) {
    condiciones.push(`p.estado = ANY($${i}::varchar[])`);
    valores.push(filtros.estados);
    i++;
  } else if (filtros.estado !== undefined) {
    condiciones.push(`p.estado = $${i}`);
    valores.push(filtros.estado);
    i++;
  }
  if (filtros.mesa_id !== undefined) {
    condiciones.push(`p.mesa_id = $${i}`);
    valores.push(filtros.mesa_id);
    i++;
  }
  if (filtros.fecha !== undefined) {
    condiciones.push(`DATE(p.created_at AT TIME ZONE 'America/Bogota') = $${i}`);
    valores.push(filtros.fecha);
    i++;
  }
  if (filtros.tipo !== undefined) {
    condiciones.push(`p.tipo = $${i}`);
    valores.push(filtros.tipo);
    i++;
  }

  // items_resumen trae un texto tipo "Hamburguesa x2, Limonada x1" para la
  // tabla de historial, sin necesidad de pedir el detalle completo de cada
  // pedido (que incluye modificadores y notas por item).
  const { rows } = await pool.query(
    `SELECT p.*, m.numero AS mesa_numero,
            COALESCE(
              (SELECT string_agg(pi.nombre_producto || ' x' || pi.cantidad, ', ' ORDER BY pi.created_at)
               FROM pedido_items pi
               WHERE pi.pedido_id = p.id AND pi.estado != 'cancelado'),
              ''
            ) AS items_resumen
     FROM pedidos p
     LEFT JOIN mesas m ON m.id = p.mesa_id
     WHERE ${condiciones.join(' AND ')}
     ORDER BY p.created_at DESC`,
    valores
  );
  return rows;
}

async function agregarItem(pedidoId, item, restauranteId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: pedidoRows } = await client.query(
      `SELECT id, estado FROM pedidos WHERE id = $1 AND restaurante_id = $2`,
      [pedidoId, restauranteId]
    );
    if (pedidoRows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }
    if (!ESTADOS_ACTIVOS.includes(pedidoRows[0].estado)) {
      await client.query('ROLLBACK');
      throw new PedidoNoEditableError(pedidoRows[0].estado);
    }

    const cantidad = item.cantidad ?? 1;
    const precioModificadores = (item.modificadores || []).reduce(
      (suma, mod) => suma + Number(mod.precio_extra || 0),
      0
    );
    const subtotalItem = (Number(item.precio_unitario) + precioModificadores) * cantidad;

    const { rows } = await client.query(
      `INSERT INTO pedido_items (
         id, pedido_id, restaurante_id, producto_id, nombre_producto,
         precio_unitario, cantidad, subtotal, notas
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        item.id,
        pedidoId,
        restauranteId,
        item.producto_id ?? null,
        item.nombre_producto,
        item.precio_unitario,
        cantidad,
        subtotalItem,
        item.notas ?? null,
      ]
    );
    const pedidoItem = rows[0];

    for (const mod of item.modificadores || []) {
      await client.query(
        `INSERT INTO pedido_item_modificadores (id, pedido_item_id, modificador_opcion_id, nombre_opcion, precio_extra)
         VALUES ($1, $2, $3, $4, $5)`,
        [uuidv4(), pedidoItem.id, mod.modificador_opcion_id ?? null, mod.nombre_opcion ?? null, mod.precio_extra ?? 0]
      );
    }

    const pedido = await recalcularTotales(pedidoId, client);

    await client.query('COMMIT');
    return { item: pedidoItem, pedido };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function actualizarItem(itemId, datos, restauranteId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: itemRows } = await client.query(
      `SELECT pi.*, COALESCE(SUM(pim.precio_extra), 0) AS precio_modificadores
       FROM pedido_items pi
       LEFT JOIN pedido_item_modificadores pim ON pim.pedido_item_id = pi.id
       WHERE pi.id = $1 AND pi.restaurante_id = $2
       GROUP BY pi.id`,
      [itemId, restauranteId]
    );
    const itemActual = itemRows[0];
    if (!itemActual) {
      await client.query('ROLLBACK');
      return null;
    }

    const nuevaCantidad = datos.cantidad !== undefined ? datos.cantidad : itemActual.cantidad;
    const nuevasNotas = datos.notas !== undefined ? datos.notas : itemActual.notas;
    const nuevoSubtotal =
      (Number(itemActual.precio_unitario) + Number(itemActual.precio_modificadores)) * nuevaCantidad;

    const { rows } = await client.query(
      `UPDATE pedido_items SET cantidad = $1, notas = $2, subtotal = $3 WHERE id = $4 RETURNING *`,
      [nuevaCantidad, nuevasNotas, nuevoSubtotal, itemId]
    );

    const pedido = await recalcularTotales(itemActual.pedido_id, client);

    await client.query('COMMIT');
    return { item: rows[0], pedido };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function eliminarItem(itemId, pedidoId, restauranteId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `DELETE FROM pedido_items WHERE id = $1 AND pedido_id = $2 AND restaurante_id = $3 RETURNING *`,
      [itemId, pedidoId, restauranteId]
    );
    const itemEliminado = rows[0];
    if (!itemEliminado) {
      await client.query('ROLLBACK');
      return null;
    }

    const pedido = await recalcularTotales(pedidoId, client);

    await client.query('COMMIT');
    return { item: itemEliminado, pedido };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function enviarCocina(pedidoId, restauranteId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: pedidoRows } = await client.query(
      `SELECT id FROM pedidos WHERE id = $1 AND restaurante_id = $2`,
      [pedidoId, restauranteId]
    );
    if (pedidoRows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    // Solo se envían los items realmente nuevos ('pendiente'); los que ya
    // están en preparación, listos o entregados de una ronda anterior se
    // quedan como están.
    const { rows: pendientesRows } = await client.query(
      `SELECT COUNT(*)::int AS total FROM pedido_items WHERE pedido_id = $1 AND estado = 'pendiente'`,
      [pedidoId]
    );
    if (pendientesRows[0].total === 0) {
      await client.query('ROLLBACK');
      throw new SinItemsPendientesError();
    }

    await client.query(
      `UPDATE pedido_items SET estado = 'en_preparacion', enviado_cocina_at = now()
       WHERE pedido_id = $1 AND estado = 'pendiente'`,
      [pedidoId]
    );

    const { rows } = await client.query(
      `UPDATE pedidos SET estado = 'enviado_cocina', updated_at = now()
       WHERE id = $1 AND restaurante_id = $2
       RETURNING *`,
      [pedidoId, restauranteId]
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function pedirCuenta(pedidoId, restauranteId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE pedidos SET estado = 'cuenta_pedida', cuenta_pedida_at = now(), updated_at = now()
       WHERE id = $1 AND restaurante_id = $2
       RETURNING *`,
      [pedidoId, restauranteId]
    );
    const pedido = rows[0];
    if (!pedido) {
      await client.query('ROLLBACK');
      return null;
    }

    if (pedido.mesa_id) {
      await client.query(
        `UPDATE mesas SET estado = 'cuenta_pedida', updated_at = now() WHERE id = $1 AND restaurante_id = $2`,
        [pedido.mesa_id, restauranteId]
      );
    }

    await client.query('COMMIT');
    return pedido;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function reabrirCuenta(pedidoId, restauranteId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE pedidos SET estado = 'abierto', updated_at = now()
       WHERE id = $1 AND restaurante_id = $2 AND estado = 'cuenta_pedida'
       RETURNING *`,
      [pedidoId, restauranteId]
    );
    const pedido = rows[0];
    if (!pedido) {
      await client.query('ROLLBACK');
      return null;
    }

    if (pedido.mesa_id) {
      await client.query(
        `UPDATE mesas SET estado = 'ocupada', updated_at = now() WHERE id = $1 AND restaurante_id = $2`,
        [pedido.mesa_id, restauranteId]
      );
    }

    await client.query('COMMIT');
    return pedido;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function cobrar(pedidoId, datos, restauranteId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: actualRows } = await client.query(
      `SELECT * FROM pedidos WHERE id = $1 AND restaurante_id = $2`,
      [pedidoId, restauranteId]
    );
    const pedidoActual = actualRows[0];
    if (!pedidoActual) {
      await client.query('ROLLBACK');
      return null;
    }

    const descuento = datos.descuento !== undefined ? Number(datos.descuento) : Number(pedidoActual.descuento);
    const impuesto = datos.impuesto !== undefined ? Number(datos.impuesto) : Number(pedidoActual.impuesto);
    const propina = datos.propina !== undefined ? Number(datos.propina) : Number(pedidoActual.propina);
    const total = Math.max(0, Number(pedidoActual.subtotal) - descuento + impuesto + propina);

    const montoRecibido = datos.monto_recibido !== undefined ? Number(datos.monto_recibido) : total;
    if (montoRecibido < total) {
      await client.query('ROLLBACK');
      throw new MontoInsuficienteError(total - montoRecibido);
    }
    const cambio = Math.max(0, montoRecibido - total);

    const { rows } = await client.query(
      `UPDATE pedidos
       SET estado = 'pagado', descuento = $1, impuesto = $2, propina = $3, total = $4,
           pagado_con = $5, monto_recibido = $6, cambio = $7, pagado_at = now(),
           mesa_liberada_at = CASE WHEN mesa_id IS NOT NULL THEN now() ELSE mesa_liberada_at END,
           updated_at = now()
       WHERE id = $8 AND restaurante_id = $9
       RETURNING *`,
      [descuento, impuesto, propina, total, datos.pagado_con, montoRecibido, cambio, pedidoId, restauranteId]
    );
    const pedido = rows[0];

    if (pedido.mesa_id) {
      await client.query(
        `UPDATE mesas SET estado = 'libre', updated_at = now() WHERE id = $1 AND restaurante_id = $2`,
        [pedido.mesa_id, restauranteId]
      );
    }

    await client.query('COMMIT');
    return pedido;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function cancelar(pedidoId, restauranteId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE pedidos SET estado = 'cancelado', updated_at = now()
       WHERE id = $1 AND restaurante_id = $2
       RETURNING *`,
      [pedidoId, restauranteId]
    );
    const pedido = rows[0];
    if (!pedido) {
      await client.query('ROLLBACK');
      return null;
    }

    if (pedido.mesa_id) {
      await client.query(
        `UPDATE mesas SET estado = 'libre', updated_at = now() WHERE id = $1 AND restaurante_id = $2`,
        [pedido.mesa_id, restauranteId]
      );
    }

    await client.query('COMMIT');
    return pedido;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const ESTADOS_COCINA = ['enviado_cocina', 'listo'];
const ESTADOS_ITEM_VISIBLES_COCINA = ['pendiente', 'en_preparacion', 'listo'];

async function obtenerCocina(restauranteId) {
  const { rows: pedidos } = await pool.query(
    `SELECT p.id, p.numero_global, p.numero_jornada, p.tipo, p.estado, p.mesa_id, m.numero AS mesa_numero
     FROM pedidos p
     LEFT JOIN mesas m ON m.id = p.mesa_id
     WHERE p.restaurante_id = $1 AND p.estado = ANY($2::varchar[])
     ORDER BY p.created_at ASC`,
    [restauranteId, ESTADOS_COCINA]
  );

  if (pedidos.length === 0) {
    return [];
  }

  const pedidoIds = pedidos.map((p) => p.id);
  const { rows: items } = await pool.query(
    `SELECT pi.*,
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'id', pim.id,
                  'nombre_opcion', pim.nombre_opcion,
                  'precio_extra', pim.precio_extra
                )
              ) FILTER (WHERE pim.id IS NOT NULL),
              '[]'::jsonb
            ) AS modificadores
     FROM pedido_items pi
     LEFT JOIN pedido_item_modificadores pim ON pim.pedido_item_id = pi.id
     WHERE pi.pedido_id = ANY($1::uuid[]) AND pi.estado = ANY($2::varchar[])
     GROUP BY pi.id
     ORDER BY pi.created_at ASC`,
    [pedidoIds, ESTADOS_ITEM_VISIBLES_COCINA]
  );

  const itemsPorPedido = new Map();
  for (const item of items) {
    if (!itemsPorPedido.has(item.pedido_id)) {
      itemsPorPedido.set(item.pedido_id, []);
    }
    itemsPorPedido.get(item.pedido_id).push(item);
  }

  // Un pedido cuyos items ya están todos entregados/cancelados no debe
  // seguir mostrándose en el KDS aunque el pedido siga en estado 'listo'
  // (el mesero todavía no ha cobrado).
  return pedidos
    .map((pedido) => {
      const pedidoItems = itemsPorPedido.get(pedido.id) || [];
      const timestamps = pedidoItems.map((i) => i.enviado_cocina_at).filter(Boolean);
      const enviadoCocinaAt =
        timestamps.length > 0 ? new Date(Math.min(...timestamps.map((t) => new Date(t).getTime()))) : null;
      return { ...pedido, items: pedidoItems, enviado_cocina_at: enviadoCocinaAt };
    })
    .filter((pedido) => pedido.items.length > 0)
    .sort((a, b) => {
      if (!a.enviado_cocina_at) return 1;
      if (!b.enviado_cocina_at) return -1;
      return a.enviado_cocina_at - b.enviado_cocina_at;
    });
}

async function marcarItemEnPreparacion(itemId, pedidoId, restauranteId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE pedido_items SET estado = 'en_preparacion'
       WHERE id = $1 AND pedido_id = $2 AND restaurante_id = $3
       RETURNING *`,
      [itemId, pedidoId, restauranteId]
    );
    const item = rows[0];
    if (!item) {
      await client.query('ROLLBACK');
      return null;
    }

    // Si el pedido ya estaba marcado como 'listo' y uno de sus items vuelve
    // a prepararse, el pedido deja de estar realmente listo.
    const { rows: pedidoRows } = await client.query(
      `UPDATE pedidos SET estado = 'enviado_cocina', updated_at = now()
       WHERE id = $1 AND restaurante_id = $2 AND estado = 'listo'
       RETURNING *`,
      [pedidoId, restauranteId]
    );

    await client.query('COMMIT');
    return { item, pedido: pedidoRows[0] || null };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function marcarItemListo(itemId, pedidoId, restauranteId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE pedido_items SET estado = 'listo'
       WHERE id = $1 AND pedido_id = $2 AND restaurante_id = $3
       RETURNING *`,
      [itemId, pedidoId, restauranteId]
    );
    const item = rows[0];
    if (!item) {
      await client.query('ROLLBACK');
      return null;
    }

    const { rows: pendientes } = await client.query(
      `SELECT COUNT(*)::int AS total FROM pedido_items
       WHERE pedido_id = $1 AND estado NOT IN ('listo', 'entregado', 'cancelado')`,
      [pedidoId]
    );

    let pedido = null;
    if (pendientes[0].total === 0) {
      const { rows: pedidoRows } = await client.query(
        `UPDATE pedidos SET estado = 'listo', updated_at = now()
         WHERE id = $1 AND restaurante_id = $2
         RETURNING *`,
        [pedidoId, restauranteId]
      );
      pedido = pedidoRows[0];
    }

    await client.query('COMMIT');
    return { item, pedido };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function marcarPedidoEntregado(pedidoId, restauranteId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Entregar los platos no cierra la mesa: el pedido vuelve a 'abierto'
    // para que el mesero pueda seguir agregando productos a la misma
    // cuenta hasta que el cliente pida pagar.
    const { rows: pedidoRows } = await client.query(
      `UPDATE pedidos SET estado = 'abierto', updated_at = now()
       WHERE id = $1 AND restaurante_id = $2
       RETURNING *`,
      [pedidoId, restauranteId]
    );
    const pedido = pedidoRows[0];
    if (!pedido) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(
      `UPDATE pedido_items SET estado = 'entregado'
       WHERE pedido_id = $1 AND estado NOT IN ('cancelado', 'entregado')`,
      [pedidoId]
    );

    await client.query('COMMIT');
    return pedido;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  crear,
  obtenerPorMesa,
  obtenerPorId,
  obtenerTodos,
  agregarItem,
  actualizarItem,
  eliminarItem,
  enviarCocina,
  pedirCuenta,
  reabrirCuenta,
  cobrar,
  cancelar,
  obtenerCocina,
  marcarItemEnPreparacion,
  marcarItemListo,
  marcarPedidoEntregado,
};
