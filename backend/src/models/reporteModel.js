const pool = require('../config/database');
const jornadaModel = require('./jornadaModel');

async function ventasDia(restauranteId, fecha) {
  const { rows: pedidos } = await pool.query(
    `SELECT p.id, p.numero, p.mesa_id, m.numero AS mesa_numero, p.tipo, p.subtotal, p.descuento,
            p.impuesto, p.propina, p.total, p.pagado_con, p.created_at, p.updated_at,
            COALESCE(
              (SELECT SUM(pi.cantidad) FROM pedido_items pi
               WHERE pi.pedido_id = p.id AND pi.estado != 'cancelado'),
              0
            )::int AS cantidad_items
     FROM pedidos p
     LEFT JOIN mesas m ON m.id = p.mesa_id
     WHERE p.restaurante_id = $1 AND p.estado = 'pagado' AND p.updated_at::date = $2
     ORDER BY p.updated_at ASC`,
    [restauranteId, fecha]
  );

  const porHora = new Map();
  for (const pedido of pedidos) {
    const hora = new Date(pedido.updated_at).getHours();
    const actual = porHora.get(hora) || { hora, total_ventas: 0, cantidad_pedidos: 0 };
    actual.total_ventas += Number(pedido.total);
    actual.cantidad_pedidos += 1;
    porHora.set(hora, actual);
  }

  const porMetodoPago = new Map();
  for (const pedido of pedidos) {
    const metodo = pedido.pagado_con || 'sin_especificar';
    const actual = porMetodoPago.get(metodo) || { metodo, total: 0, cantidad: 0 };
    actual.total += Number(pedido.total);
    actual.cantidad += 1;
    porMetodoPago.set(metodo, actual);
  }

  const totalVentas = pedidos.reduce((suma, p) => suma + Number(p.total), 0);
  const totalDescuentos = pedidos.reduce((suma, p) => suma + Number(p.descuento), 0);
  const totalPropinas = pedidos.reduce((suma, p) => suma + Number(p.propina), 0);
  const cantidadPedidos = pedidos.length;

  return {
    fecha,
    total_ventas: totalVentas,
    cantidad_pedidos: cantidadPedidos,
    ticket_promedio: cantidadPedidos > 0 ? totalVentas / cantidadPedidos : 0,
    total_descuentos: totalDescuentos,
    total_propinas: totalPropinas,
    ventas_por_hora: [...porHora.values()].sort((a, b) => a.hora - b.hora),
    por_metodo_pago: [...porMetodoPago.values()],
    pedidos,
  };
}

async function ventasPeriodo(restauranteId, fechaInicio, fechaFin) {
  const { rows: porDia } = await pool.query(
    `SELECT updated_at::date AS fecha,
            COALESCE(SUM(total), 0) AS total_ventas,
            COUNT(*)::int AS cantidad_pedidos
     FROM pedidos
     WHERE restaurante_id = $1 AND estado = 'pagado'
       AND updated_at::date BETWEEN $2 AND $3
     GROUP BY updated_at::date
     ORDER BY updated_at::date ASC`,
    [restauranteId, fechaInicio, fechaFin]
  );

  const totalVentas = porDia.reduce((suma, d) => suma + Number(d.total_ventas), 0);
  const totalPedidos = porDia.reduce((suma, d) => suma + Number(d.cantidad_pedidos), 0);

  return {
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    total_ventas: totalVentas,
    cantidad_pedidos: totalPedidos,
    ventas_por_dia: porDia.map((d) => ({
      fecha: d.fecha,
      total_ventas: Number(d.total_ventas),
      cantidad_pedidos: d.cantidad_pedidos,
    })),
  };
}

async function productosMasVendidos(restauranteId, fechaInicio, fechaFin, limite) {
  const { rows } = await pool.query(
    `SELECT pi.producto_id, pi.nombre_producto,
            SUM(pi.cantidad)::int AS cantidad_vendida,
            SUM(pi.subtotal) AS total_generado,
            MAX(pr.costo) AS costo_unitario
     FROM pedido_items pi
     JOIN pedidos p ON p.id = pi.pedido_id
     LEFT JOIN productos pr ON pr.id = pi.producto_id
     WHERE p.restaurante_id = $1 AND p.estado = 'pagado' AND pi.estado != 'cancelado'
       AND p.updated_at::date BETWEEN $2 AND $3
     GROUP BY pi.producto_id, pi.nombre_producto
     ORDER BY cantidad_vendida DESC
     LIMIT $4`,
    [restauranteId, fechaInicio, fechaFin, limite]
  );

  return rows.map((fila) => {
    const totalGenerado = Number(fila.total_generado);
    const costoUnitario = fila.costo_unitario !== null ? Number(fila.costo_unitario) : null;
    const costoTotal = costoUnitario !== null ? costoUnitario * fila.cantidad_vendida : null;
    const margenGanancia = costoTotal !== null ? totalGenerado - costoTotal : null;

    return {
      producto_id: fila.producto_id,
      nombre: fila.nombre_producto,
      cantidad_vendida: fila.cantidad_vendida,
      total_generado: totalGenerado,
      costo_total: costoTotal,
      margen_ganancia: margenGanancia,
    };
  });
}

async function resumenDashboard(restauranteId, sucursalId, hoy, inicioSemana) {
  const { rows: ventasSemanaRows } = await pool.query(
    `SELECT COALESCE(SUM(total), 0) AS total
     FROM pedidos WHERE restaurante_id = $1 AND estado = 'pagado' AND updated_at::date BETWEEN $2 AND $3`,
    [restauranteId, inicioSemana, hoy]
  );
  const { rows: pedidosActivosRows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM pedidos
     WHERE restaurante_id = $1 AND estado = ANY($2::varchar[])`,
    [restauranteId, ['abierto', 'enviado_cocina', 'listo', 'cuenta_pedida']]
  );
  const { rows: mesasRows } = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE estado != 'libre')::int AS ocupadas, COUNT(*)::int AS total
     FROM mesas WHERE restaurante_id = $1 AND activa = true`,
    [restauranteId]
  );
  const { rows: productoEstrellaRows } = await pool.query(
    `SELECT pi.nombre_producto, SUM(pi.cantidad)::int AS cantidad
     FROM pedido_items pi
     JOIN pedidos p ON p.id = pi.pedido_id
     WHERE p.restaurante_id = $1 AND p.estado = 'pagado' AND pi.estado != 'cancelado'
       AND p.updated_at::date = $2
     GROUP BY pi.nombre_producto
     ORDER BY cantidad DESC
     LIMIT 1`,
    [restauranteId, hoy]
  );

  // Las ventas del dashboard ya no son "de hoy" sino de la jornada activa
  // (desde que se abrió hasta ahora), para que cuadren con la jornada que
  // el cajero está a punto de cerrar. Si no hay jornada abierta no hay nada
  // que sumar.
  const jornadaActual = await jornadaModel.obtenerAbierta(restauranteId, sucursalId);
  let ventasJornada = 0;
  let pedidosJornada = 0;
  let ventasPorHoraJornada = [];

  if (jornadaActual) {
    const ventas = await jornadaModel.calcularVentas(jornadaActual);
    ventasJornada = ventas.total_ventas;
    pedidosJornada = ventas.cantidad_pedidos;

    const { rows: pedidosJornadaRows } = await pool.query(
      `SELECT total, updated_at FROM pedidos
       WHERE restaurante_id = $1 AND sucursal_id = $2 AND estado = 'pagado' AND updated_at >= $3`,
      [restauranteId, jornadaActual.sucursal_id, jornadaActual.fecha_apertura]
    );

    const porHora = new Map();
    for (const pedido of pedidosJornadaRows) {
      const hora = new Date(pedido.updated_at).getHours();
      const actual = porHora.get(hora) || { hora, total_ventas: 0, cantidad_pedidos: 0 };
      actual.total_ventas += Number(pedido.total);
      actual.cantidad_pedidos += 1;
      porHora.set(hora, actual);
    }
    ventasPorHoraJornada = [...porHora.values()].sort((a, b) => a.hora - b.hora);
  }

  const jornadaAnterior = await jornadaModel.obtenerUltimaCerrada(restauranteId, sucursalId);
  let ventasJornadaAnterior = 0;
  if (jornadaAnterior) {
    const ventas = await jornadaModel.calcularVentas(jornadaAnterior);
    ventasJornadaAnterior = ventas.total_ventas;
  }

  const variacionJornada =
    ventasJornadaAnterior > 0
      ? ((ventasJornada - ventasJornadaAnterior) / ventasJornadaAnterior) * 100
      : ventasJornada > 0
        ? 100
        : 0;

  return {
    ventas_jornada: ventasJornada,
    pedidos_jornada: pedidosJornada,
    jornada_abierta: Boolean(jornadaActual),
    ventas_jornada_anterior: ventasJornadaAnterior,
    hay_jornada_anterior: Boolean(jornadaAnterior),
    variacion_jornada: variacionJornada,
    ventas_por_hora_jornada: ventasPorHoraJornada,
    pedidos_activos: pedidosActivosRows[0].total,
    mesas_ocupadas: mesasRows[0].ocupadas,
    mesas_total: mesasRows[0].total,
    producto_estrella: productoEstrellaRows[0]
      ? { nombre: productoEstrellaRows[0].nombre_producto, cantidad: productoEstrellaRows[0].cantidad }
      : null,
    total_semana: Number(ventasSemanaRows[0].total),
  };
}

module.exports = { ventasDia, ventasPeriodo, productosMasVendidos, resumenDashboard };
