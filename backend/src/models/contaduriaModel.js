const { v4: uuidv4 } = require('uuid');

const pool = require('../config/database');

// Todo lo que no sea 'ingreso' resta del balance: egresos propiamente
// dichos, retiros del dueño, nómina y compras de insumos.
const TIPOS_EGRESO = ['egreso', 'retiro', 'nomina', 'compra'];

const CATEGORIAS_CONTABLES_DEFAULT = [
  { nombre: 'Venta', tipo: 'ingreso' },
  { nombre: 'Otro ingreso', tipo: 'ingreso' },
  { nombre: 'Arriendo', tipo: 'egreso' },
  { nombre: 'Servicios públicos', tipo: 'egreso' },
  { nombre: 'Insumos/Mercancía', tipo: 'egreso' },
  { nombre: 'Mantenimiento', tipo: 'egreso' },
  { nombre: 'Marketing', tipo: 'egreso' },
  { nombre: 'Otro gasto', tipo: 'egreso' },
  { nombre: 'Retiro dueño', tipo: 'egreso' },
  { nombre: 'Nómina/Salarios', tipo: 'egreso' },
];

const CAMPOS_ACTUALIZABLES_TRANSACCION = [
  'tipo',
  'categoria',
  'descripcion',
  'monto',
  'metodo_pago',
  'proveedor',
  'numero_factura',
  'fecha',
  'jornada_id',
];

const CAMPOS_ACTUALIZABLES_EMPLEADO = ['nombre_empleado', 'rol_empleado', 'hora_entrada', 'hora_salida', 'pago_dia', 'notas'];

// 'fecha' es DATE; se castea a texto para que el frontend reciba siempre un
// 'YYYY-MM-DD' plano en vez de un timestamp dependiente de la zona horaria
// del proceso. Va como lista explícita (no "SELECT *, fecha::text AS fecha")
// porque esa combinación produce dos columnas de salida llamadas "fecha" y
// Postgres no puede resolver el ORDER BY.
const COLUMNAS_TRANSACCION = `id, restaurante_id, jornada_id, tipo, categoria, descripcion, monto,
       metodo_pago, proveedor, numero_factura, fecha::text AS fecha, usuario_id, activo, created_at`;

// --- Categorías ---

// Compartida entre initDB (restaurante demo) y authController.registro
// (restaurantes nuevos), para que todos arranquen con el mismo set.
async function crearCategoriasDefault(db, restauranteId) {
  for (const categoria of CATEGORIAS_CONTABLES_DEFAULT) {
    await db.query('INSERT INTO categorias_contables (id, restaurante_id, nombre, tipo) VALUES ($1, $2, $3, $4)', [
      uuidv4(),
      restauranteId,
      categoria.nombre,
      categoria.tipo,
    ]);
  }
}

async function obtenerCategorias(restauranteId) {
  const { rows } = await pool.query(
    `SELECT * FROM categorias_contables WHERE restaurante_id = $1 AND activa = true ORDER BY tipo ASC, nombre ASC`,
    [restauranteId]
  );
  return rows;
}

// --- Transacciones ---

async function crearTransaccion({
  id,
  restaurante_id,
  jornada_id,
  tipo,
  categoria,
  descripcion,
  monto,
  metodo_pago,
  proveedor,
  numero_factura,
  fecha,
  usuario_id,
}) {
  const { rows } = await pool.query(
    `INSERT INTO transacciones_contables (
       id, restaurante_id, jornada_id, tipo, categoria, descripcion, monto,
       metodo_pago, proveedor, numero_factura, fecha, usuario_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING ${COLUMNAS_TRANSACCION}`,
    [
      id,
      restaurante_id,
      jornada_id ?? null,
      tipo,
      categoria ?? null,
      descripcion,
      monto,
      metodo_pago ?? null,
      proveedor ?? null,
      numero_factura ?? null,
      fecha,
      usuario_id ?? null,
    ]
  );
  return rows[0];
}

async function obtenerTransacciones(restauranteId, filtros = {}) {
  const condiciones = ['restaurante_id = $1', 'activo = true'];
  const valores = [restauranteId];
  let i = 2;

  if (filtros.tipo !== undefined) {
    condiciones.push(`tipo = $${i}`);
    valores.push(filtros.tipo);
    i++;
  }
  if (filtros.categoria !== undefined) {
    condiciones.push(`categoria = $${i}`);
    valores.push(filtros.categoria);
    i++;
  }
  if (filtros.metodo_pago !== undefined) {
    condiciones.push(`metodo_pago = $${i}`);
    valores.push(filtros.metodo_pago);
    i++;
  }
  if (filtros.jornada_id !== undefined) {
    condiciones.push(`jornada_id = $${i}`);
    valores.push(filtros.jornada_id);
    i++;
  }
  if (filtros.fecha_inicio !== undefined) {
    condiciones.push(`fecha >= $${i}`);
    valores.push(filtros.fecha_inicio);
    i++;
  }
  if (filtros.fecha_fin !== undefined) {
    condiciones.push(`fecha <= $${i}`);
    valores.push(filtros.fecha_fin);
    i++;
  }

  const { rows } = await pool.query(
    `SELECT ${COLUMNAS_TRANSACCION} FROM transacciones_contables
     WHERE ${condiciones.join(' AND ')}
     ORDER BY fecha DESC, created_at DESC`,
    valores
  );
  return rows;
}

async function actualizarTransaccion(id, restauranteId, datos) {
  const asignaciones = [];
  const valores = [];
  let i = 1;

  for (const campo of CAMPOS_ACTUALIZABLES_TRANSACCION) {
    if (datos[campo] !== undefined) {
      asignaciones.push(`${campo} = $${i}`);
      valores.push(datos[campo]);
      i++;
    }
  }

  if (asignaciones.length === 0) {
    const { rows } = await pool.query(
      `SELECT ${COLUMNAS_TRANSACCION} FROM transacciones_contables WHERE id = $1 AND restaurante_id = $2 AND activo = true`,
      [id, restauranteId]
    );
    return rows[0] || null;
  }

  valores.push(id, restauranteId);

  const { rows } = await pool.query(
    `UPDATE transacciones_contables SET ${asignaciones.join(', ')}
     WHERE id = $${i} AND restaurante_id = $${i + 1} AND activo = true
     RETURNING ${COLUMNAS_TRANSACCION}`,
    valores
  );
  return rows[0] || null;
}

async function eliminarTransaccion(id, restauranteId) {
  const { rows } = await pool.query(
    `UPDATE transacciones_contables SET activo = false
     WHERE id = $1 AND restaurante_id = $2
     RETURNING ${COLUMNAS_TRANSACCION}`,
    [id, restauranteId]
  );
  return rows[0] || null;
}

async function resumenFinanciero(restauranteId, fechaInicio, fechaFin) {
  const { rows } = await pool.query(
    `SELECT tipo, categoria, metodo_pago, monto FROM transacciones_contables
     WHERE restaurante_id = $1 AND activo = true AND fecha BETWEEN $2 AND $3`,
    [restauranteId, fechaInicio, fechaFin]
  );

  let ingresos = 0;
  let egresos = 0;
  const porCategoria = new Map();
  const porMetodoPago = new Map();

  for (const t of rows) {
    const monto = Number(t.monto);
    if (t.tipo === 'ingreso') {
      ingresos += monto;
    } else {
      egresos += monto;
    }

    const categoria = t.categoria || 'Sin categoría';
    const claveCategoria = `${t.tipo}:${categoria}`;
    const actualCategoria = porCategoria.get(claveCategoria) || { tipo: t.tipo, categoria, total: 0, cantidad: 0 };
    actualCategoria.total += monto;
    actualCategoria.cantidad += 1;
    porCategoria.set(claveCategoria, actualCategoria);

    const metodo = t.metodo_pago || 'sin_especificar';
    const actualMetodo = porMetodoPago.get(metodo) || { metodo, total: 0, cantidad: 0 };
    actualMetodo.total += monto;
    actualMetodo.cantidad += 1;
    porMetodoPago.set(metodo, actualMetodo);
  }

  return {
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    ingresos,
    egresos,
    balance: ingresos - egresos,
    por_categoria: [...porCategoria.values()].sort((a, b) => b.total - a.total),
    por_metodo_pago: [...porMetodoPago.values()].sort((a, b) => b.total - a.total),
  };
}

// Serie día por día entre fechaInicio y fechaFin (ambas inclusive), rellena
// con ceros los días sin movimientos para que la tabla de flujo de efectivo
// no tenga huecos, y arrastra el balance acumulado.
async function flujoEfectivo(restauranteId, fechaInicio, fechaFin) {
  const { rows } = await pool.query(
    `SELECT fecha::text AS fecha,
            COALESCE(SUM(monto) FILTER (WHERE tipo = 'ingreso'), 0) AS ingresos,
            COALESCE(SUM(monto) FILTER (WHERE tipo = ANY($4::varchar[])), 0) AS egresos
     FROM transacciones_contables
     WHERE restaurante_id = $1 AND activo = true AND fecha BETWEEN $2 AND $3
     GROUP BY fecha`,
    [restauranteId, fechaInicio, fechaFin, TIPOS_EGRESO]
  );
  const porFecha = new Map(rows.map((fila) => [fila.fecha, fila]));

  const dias = [];
  const cursor = new Date(`${fechaInicio}T00:00:00Z`);
  const fin = new Date(`${fechaFin}T00:00:00Z`);
  let balanceAcumulado = 0;

  while (cursor <= fin) {
    const fechaISO = cursor.toISOString().slice(0, 10);
    const fila = porFecha.get(fechaISO);
    const ingresosDia = fila ? Number(fila.ingresos) : 0;
    const egresosDia = fila ? Number(fila.egresos) : 0;
    const balanceDia = ingresosDia - egresosDia;
    balanceAcumulado += balanceDia;

    dias.push({
      fecha: fechaISO,
      ingresos: ingresosDia,
      egresos: egresosDia,
      balance_dia: balanceDia,
      balance_acumulado: balanceAcumulado,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dias;
}

// --- Empleados de jornada ---

async function agregarEmpleadoJornada({
  id,
  restaurante_id,
  jornada_id,
  nombre_empleado,
  rol_empleado,
  hora_entrada,
  pago_dia,
  notas,
}) {
  const { rows } = await pool.query(
    `INSERT INTO empleados_jornada (
       id, restaurante_id, jornada_id, nombre_empleado, rol_empleado, hora_entrada, pago_dia, notas
     )
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, now()), $7, $8)
     RETURNING *`,
    [id, restaurante_id, jornada_id, nombre_empleado, rol_empleado ?? null, hora_entrada ?? null, pago_dia ?? null, notas ?? null]
  );
  return rows[0];
}

async function obtenerEmpleadosJornada(jornadaId, restauranteId) {
  const { rows } = await pool.query(
    `SELECT * FROM empleados_jornada WHERE jornada_id = $1 AND restaurante_id = $2 ORDER BY created_at ASC`,
    [jornadaId, restauranteId]
  );
  return rows;
}

async function obtenerHistorialEmpleados(restauranteId, limite = 200) {
  const { rows } = await pool.query(
    `SELECT ej.*, j.fecha_apertura AS jornada_fecha_apertura, j.estado AS jornada_estado
     FROM empleados_jornada ej
     JOIN jornadas j ON j.id = ej.jornada_id
     WHERE ej.restaurante_id = $1
     ORDER BY j.fecha_apertura DESC, ej.created_at ASC
     LIMIT $2`,
    [restauranteId, limite]
  );
  return rows;
}

async function actualizarEmpleadoJornada(id, restauranteId, datos) {
  const asignaciones = [];
  const valores = [];
  let i = 1;

  for (const campo of CAMPOS_ACTUALIZABLES_EMPLEADO) {
    if (datos[campo] !== undefined) {
      asignaciones.push(`${campo} = $${i}`);
      valores.push(datos[campo]);
      i++;
    }
  }

  if (asignaciones.length === 0) {
    const { rows } = await pool.query(`SELECT * FROM empleados_jornada WHERE id = $1 AND restaurante_id = $2`, [
      id,
      restauranteId,
    ]);
    return rows[0] || null;
  }

  valores.push(id, restauranteId);

  const { rows } = await pool.query(
    `UPDATE empleados_jornada SET ${asignaciones.join(', ')}
     WHERE id = $${i} AND restaurante_id = $${i + 1}
     RETURNING *`,
    valores
  );
  return rows[0] || null;
}

async function marcarSalidaEmpleado(id, restauranteId) {
  const { rows } = await pool.query(
    `UPDATE empleados_jornada SET hora_salida = now()
     WHERE id = $1 AND restaurante_id = $2
     RETURNING *`,
    [id, restauranteId]
  );
  return rows[0] || null;
}

async function eliminarEmpleadoJornada(id, restauranteId) {
  const { rows } = await pool.query(
    `DELETE FROM empleados_jornada WHERE id = $1 AND restaurante_id = $2 RETURNING *`,
    [id, restauranteId]
  );
  return rows[0] || null;
}

async function calcularNominaJornada(jornadaId, restauranteId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(pago_dia), 0) AS total, COUNT(*)::int AS cantidad_empleados
     FROM empleados_jornada
     WHERE jornada_id = $1 AND restaurante_id = $2`,
    [jornadaId, restauranteId]
  );
  return { total: Number(rows[0].total), cantidad_empleados: rows[0].cantidad_empleados };
}

module.exports = {
  TIPOS_EGRESO,
  crearCategoriasDefault,
  obtenerCategorias,
  crearTransaccion,
  obtenerTransacciones,
  actualizarTransaccion,
  eliminarTransaccion,
  resumenFinanciero,
  flujoEfectivo,
  agregarEmpleadoJornada,
  obtenerEmpleadosJornada,
  obtenerHistorialEmpleados,
  actualizarEmpleadoJornada,
  marcarSalidaEmpleado,
  eliminarEmpleadoJornada,
  calcularNominaJornada,
};
