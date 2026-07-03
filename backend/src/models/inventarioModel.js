const { v4: uuidv4 } = require('uuid');

const pool = require('../config/database');

const CAMPOS_ACTUALIZABLES_INGREDIENTE = [
  'nombre',
  'descripcion',
  'unidad_medida',
  'stock_actual',
  'stock_minimo',
  'stock_maximo',
  'costo_unitario',
  'activo',
];

// --- Ingredientes ---

async function crearIngrediente({
  id,
  restaurante_id,
  nombre,
  descripcion,
  unidad_medida,
  stock_actual,
  stock_minimo,
  stock_maximo,
  costo_unitario,
}) {
  const { rows } = await pool.query(
    `INSERT INTO ingredientes (
       id, restaurante_id, nombre, descripcion, unidad_medida,
       stock_actual, stock_minimo, stock_maximo, costo_unitario
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      id,
      restaurante_id,
      nombre,
      descripcion ?? null,
      unidad_medida,
      stock_actual ?? 0,
      stock_minimo ?? 0,
      stock_maximo ?? null,
      costo_unitario ?? 0,
    ]
  );
  return rows[0];
}

async function obtenerIngredientes(restauranteId, filtros = {}) {
  const condiciones = ['restaurante_id = $1'];
  const valores = [restauranteId];
  let i = 2;

  if (filtros.activo !== undefined) {
    condiciones.push(`activo = $${i}`);
    valores.push(filtros.activo);
    i++;
  }
  if (filtros.stock_bajo) {
    condiciones.push('stock_actual <= stock_minimo');
  }

  const { rows } = await pool.query(
    `SELECT * FROM ingredientes WHERE ${condiciones.join(' AND ')} ORDER BY nombre ASC`,
    valores
  );
  return rows;
}

async function obtenerIngredientePorId(id, restauranteId) {
  const { rows } = await pool.query(`SELECT * FROM ingredientes WHERE id = $1 AND restaurante_id = $2`, [
    id,
    restauranteId,
  ]);
  return rows[0] || null;
}

async function actualizarIngrediente(id, restauranteId, datos) {
  const asignaciones = [];
  const valores = [];
  let i = 1;

  for (const campo of CAMPOS_ACTUALIZABLES_INGREDIENTE) {
    if (datos[campo] !== undefined) {
      asignaciones.push(`${campo} = $${i}`);
      valores.push(datos[campo]);
      i++;
    }
  }

  if (asignaciones.length === 0) {
    return obtenerIngredientePorId(id, restauranteId);
  }

  asignaciones.push('updated_at = now()');
  valores.push(id, restauranteId);

  const { rows } = await pool.query(
    `UPDATE ingredientes SET ${asignaciones.join(', ')}
     WHERE id = $${i} AND restaurante_id = $${i + 1}
     RETURNING *`,
    valores
  );
  return rows[0] || null;
}

async function eliminarIngrediente(id, restauranteId) {
  const { rows } = await pool.query(
    `UPDATE ingredientes SET activo = false, updated_at = now()
     WHERE id = $1 AND restaurante_id = $2
     RETURNING *`,
    [id, restauranteId]
  );
  return rows[0] || null;
}

// --- Recetas ---

async function crearReceta({ id, restaurante_id, producto_id, ingrediente_id, cantidad }) {
  const { rows } = await pool.query(
    `INSERT INTO recetas (id, restaurante_id, producto_id, ingrediente_id, cantidad)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (producto_id, ingrediente_id)
     DO UPDATE SET cantidad = EXCLUDED.cantidad
     RETURNING *`,
    [id, restaurante_id, producto_id, ingrediente_id, cantidad]
  );
  return rows[0];
}

async function obtenerRecetasPorProducto(productoId, restauranteId) {
  const { rows } = await pool.query(
    `SELECT r.*, i.nombre AS ingrediente_nombre, i.unidad_medida, i.costo_unitario, i.stock_actual
     FROM recetas r
     JOIN ingredientes i ON i.id = r.ingrediente_id
     WHERE r.producto_id = $1 AND r.restaurante_id = $2
     ORDER BY i.nombre ASC`,
    [productoId, restauranteId]
  );
  return rows;
}

async function eliminarReceta(id, restauranteId) {
  const { rows } = await pool.query(`DELETE FROM recetas WHERE id = $1 AND restaurante_id = $2 RETURNING *`, [
    id,
    restauranteId,
  ]);
  return rows[0] || null;
}

// --- Movimientos de inventario ---

// Registra un movimiento y actualiza el stock del ingrediente de forma
// atómica. Si se recibe un `client` externo (de una transacción ya abierta,
// como el descuento de stock por venta) reutiliza esa conexión en vez de
// abrir una nueva transacción.
async function registrarMovimiento(datos, clienteExterno) {
  const client = clienteExterno || (await pool.connect());
  const manejaTransaccion = !clienteExterno;

  try {
    if (manejaTransaccion) await client.query('BEGIN');

    const { rows: ingRows } = await client.query(
      `SELECT * FROM ingredientes WHERE id = $1 AND restaurante_id = $2 FOR UPDATE`,
      [datos.ingrediente_id, datos.restaurante_id]
    );
    const ingrediente = ingRows[0];
    if (!ingrediente) {
      if (manejaTransaccion) await client.query('ROLLBACK');
      return null;
    }

    const stockAntes = Number(ingrediente.stock_actual);
    const cantidad = Number(datos.cantidad);
    const stockDespues = stockAntes + cantidad;

    const { rows: movRows } = await client.query(
      `INSERT INTO movimientos_inventario (
         id, restaurante_id, ingrediente_id, tipo, cantidad, stock_antes, stock_despues,
         costo_unitario, motivo, pedido_id, usuario_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        datos.id,
        datos.restaurante_id,
        datos.ingrediente_id,
        datos.tipo,
        cantidad,
        stockAntes,
        stockDespues,
        datos.costo_unitario ?? null,
        datos.motivo ?? null,
        datos.pedido_id ?? null,
        datos.usuario_id ?? null,
      ]
    );

    // Una entrada de mercancía con costo unitario actualiza el costo de
    // referencia del ingrediente (último precio de compra).
    const actualizaCosto = datos.tipo === 'entrada' && datos.costo_unitario !== undefined && datos.costo_unitario !== null;

    const { rows: ingActualizadoRows } = await client.query(
      `UPDATE ingredientes SET stock_actual = $1, updated_at = now()${actualizaCosto ? ', costo_unitario = $4' : ''}
       WHERE id = $2 AND restaurante_id = $3
       RETURNING *`,
      actualizaCosto
        ? [stockDespues, datos.ingrediente_id, datos.restaurante_id, datos.costo_unitario]
        : [stockDespues, datos.ingrediente_id, datos.restaurante_id]
    );

    if (manejaTransaccion) await client.query('COMMIT');
    return { movimiento: movRows[0], ingrediente: ingActualizadoRows[0] };
  } catch (err) {
    if (manejaTransaccion) await client.query('ROLLBACK');
    throw err;
  } finally {
    if (manejaTransaccion) client.release();
  }
}

// Ajuste manual: fija el stock a un valor absoluto, calculando la
// diferencia dentro de la misma transacción para evitar condiciones de
// carrera con otros movimientos concurrentes.
async function registrarAjuste({ id, restaurante_id, ingrediente_id, nuevo_stock, motivo, usuario_id }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: ingRows } = await client.query(
      `SELECT * FROM ingredientes WHERE id = $1 AND restaurante_id = $2 FOR UPDATE`,
      [ingrediente_id, restaurante_id]
    );
    const ingrediente = ingRows[0];
    if (!ingrediente) {
      await client.query('ROLLBACK');
      return null;
    }

    const cantidad = Number(nuevo_stock) - Number(ingrediente.stock_actual);

    const resultado = await registrarMovimiento(
      { id, restaurante_id, ingrediente_id, tipo: 'ajuste', cantidad, motivo, usuario_id },
      client
    );

    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function obtenerMovimientos(restauranteId, filtros = {}) {
  const condiciones = ['mi.restaurante_id = $1'];
  const valores = [restauranteId];
  let i = 2;

  if (filtros.ingrediente_id !== undefined) {
    condiciones.push(`mi.ingrediente_id = $${i}`);
    valores.push(filtros.ingrediente_id);
    i++;
  }
  if (filtros.tipo !== undefined) {
    condiciones.push(`mi.tipo = $${i}`);
    valores.push(filtros.tipo);
    i++;
  }
  if (filtros.fecha_inicio !== undefined) {
    condiciones.push(`DATE(mi.created_at AT TIME ZONE 'America/Bogota') >= $${i}`);
    valores.push(filtros.fecha_inicio);
    i++;
  }
  if (filtros.fecha_fin !== undefined) {
    condiciones.push(`DATE(mi.created_at AT TIME ZONE 'America/Bogota') <= $${i}`);
    valores.push(filtros.fecha_fin);
    i++;
  }

  const { rows } = await pool.query(
    `SELECT mi.*, i.nombre AS ingrediente_nombre, i.unidad_medida, u.nombre AS usuario_nombre
     FROM movimientos_inventario mi
     JOIN ingredientes i ON i.id = mi.ingrediente_id
     LEFT JOIN usuarios u ON u.id = mi.usuario_id
     WHERE ${condiciones.join(' AND ')}
     ORDER BY mi.created_at DESC`,
    valores
  );
  return rows;
}

// Al cobrar un pedido, descuenta de cada ingrediente lo consumido según la
// receta de cada producto vendido. No bloquea ni valida stock suficiente:
// si no alcanza, el stock simplemente queda en negativo.
async function descontarStockPorVenta(pedidoId, restauranteId, usuarioId) {
  const { rows: items } = await pool.query(
    `SELECT producto_id, cantidad FROM pedido_items
     WHERE pedido_id = $1 AND restaurante_id = $2 AND producto_id IS NOT NULL AND estado != 'cancelado'`,
    [pedidoId, restauranteId]
  );
  if (items.length === 0) {
    return [];
  }

  const productoIds = [...new Set(items.map((item) => item.producto_id))];
  const { rows: recetas } = await pool.query(
    `SELECT producto_id, ingrediente_id, cantidad FROM recetas
     WHERE restaurante_id = $1 AND producto_id = ANY($2::uuid[])`,
    [restauranteId, productoIds]
  );
  if (recetas.length === 0) {
    return [];
  }

  const consumoPorIngrediente = new Map();
  for (const item of items) {
    for (const receta of recetas) {
      if (receta.producto_id !== item.producto_id) continue;
      const consumo = Number(receta.cantidad) * Number(item.cantidad);
      consumoPorIngrediente.set(receta.ingrediente_id, (consumoPorIngrediente.get(receta.ingrediente_id) || 0) + consumo);
    }
  }

  const client = await pool.connect();
  const resultados = [];
  try {
    await client.query('BEGIN');
    for (const [ingredienteId, cantidadConsumida] of consumoPorIngrediente) {
      const resultado = await registrarMovimiento(
        {
          id: uuidv4(),
          restaurante_id: restauranteId,
          ingrediente_id: ingredienteId,
          tipo: 'venta',
          cantidad: -cantidadConsumida,
          motivo: 'Descuento automático por venta',
          pedido_id: pedidoId,
          usuario_id: usuarioId ?? null,
        },
        client
      );
      if (resultado) resultados.push(resultado);
    }
    await client.query('COMMIT');
    return resultados;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function obtenerAlertas(restauranteId) {
  const { rows } = await pool.query(
    `SELECT * FROM ingredientes
     WHERE restaurante_id = $1 AND activo = true AND stock_actual <= stock_minimo
     ORDER BY (stock_actual - stock_minimo) ASC`,
    [restauranteId]
  );
  return rows;
}

module.exports = {
  crearIngrediente,
  obtenerIngredientes,
  obtenerIngredientePorId,
  actualizarIngrediente,
  eliminarIngrediente,
  crearReceta,
  obtenerRecetasPorProducto,
  eliminarReceta,
  registrarMovimiento,
  registrarAjuste,
  obtenerMovimientos,
  descontarStockPorVenta,
  obtenerAlertas,
};
