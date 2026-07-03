const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const pool = require('../config/database');
const pedidoModel = require('./pedidoModel');
const restauranteModel = require('./restauranteModel');

class PedidoNoPagadoError extends Error {
  constructor() {
    super('Solo se puede generar la factura de un pedido pagado');
    this.pedidoNoPagado = true;
  }
}

function generarCUFESimulado({ restauranteId, numeroFactura, fecha, total }) {
  const base = `${restauranteId}|${numeroFactura}|${fecha}|${total}|${crypto.randomBytes(8).toString('hex')}`;
  return crypto.createHash('sha256').update(base).digest('hex').toUpperCase();
}

async function obtenerPorPedido(pedidoId, restauranteId) {
  const { rows } = await pool.query(`SELECT * FROM facturas WHERE pedido_id = $1 AND restaurante_id = $2`, [
    pedidoId,
    restauranteId,
  ]);
  return rows[0] || null;
}

async function obtenerPorId(id, restauranteId) {
  const { rows } = await pool.query(`SELECT * FROM facturas WHERE id = $1 AND restaurante_id = $2`, [
    id,
    restauranteId,
  ]);
  return rows[0] || null;
}

async function listar(restauranteId, filtros = {}) {
  const condiciones = ['f.restaurante_id = $1'];
  const valores = [restauranteId];
  let i = 2;

  if (filtros.fecha !== undefined) {
    condiciones.push(`DATE(f.fecha_emision AT TIME ZONE 'America/Bogota') = $${i}`);
    valores.push(filtros.fecha);
    i++;
  }
  if (filtros.estado !== undefined) {
    condiciones.push(`f.estado = $${i}`);
    valores.push(filtros.estado);
    i++;
  }

  const { rows } = await pool.query(
    `SELECT f.*, p.numero_jornada, p.numero_global, p.tipo AS pedido_tipo, m.numero AS mesa_numero
     FROM facturas f
     JOIN pedidos p ON p.id = f.pedido_id
     LEFT JOIN mesas m ON m.id = p.mesa_id
     WHERE ${condiciones.join(' AND ')}
     ORDER BY f.numero_consecutivo DESC`,
    valores
  );
  return rows;
}

async function crear(pedidoId, restauranteId, datosCliente = {}) {
  const existente = await obtenerPorPedido(pedidoId, restauranteId);
  if (existente) {
    return existente;
  }

  const pedido = await pedidoModel.obtenerPorId(pedidoId, restauranteId);
  if (!pedido) {
    return null;
  }
  if (pedido.estado !== 'pagado') {
    throw new PedidoNoPagadoError();
  }

  const restaurante = await restauranteModel.buscarPorId(restauranteId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Serializa la numeración de facturas por restaurante: dos cobros
    // concurrentes no pueden terminar generando el mismo consecutivo, algo
    // que la DIAN exige que sea único y sin huecos.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [restauranteId]);

    // Mientras se esperaba el lock, otra transacción pudo haber creado ya
    // la factura de este mismo pedido.
    const { rows: repetidoRows } = await client.query(
      `SELECT * FROM facturas WHERE pedido_id = $1 AND restaurante_id = $2`,
      [pedidoId, restauranteId]
    );
    if (repetidoRows[0]) {
      await client.query('COMMIT');
      return repetidoRows[0];
    }

    const { rows: consecutivoRows } = await client.query(
      `SELECT COALESCE(MAX(numero_consecutivo), 0) + 1 AS siguiente FROM facturas WHERE restaurante_id = $1`,
      [restauranteId]
    );
    const numeroConsecutivo = Number(consecutivoRows[0].siguiente);
    const prefijo = restaurante.prefijo_factura || 'FE';
    const numeroFactura = `${prefijo}-${String(numeroConsecutivo).padStart(4, '0')}`;

    // Base gravable: el subtotal de los items menos el descuento aplicado.
    // El impuesto se recalcula aquí según el porcentaje configurado en el
    // restaurante (INC 8% o IVA 19%), independiente del monto que el cajero
    // haya escrito manualmente al cobrar.
    const subtotal = Math.max(0, Number(pedido.subtotal) - Number(pedido.descuento));
    const impuestoPorcentaje = Number(restaurante.porcentaje_impuesto) || 0;
    const impuestoMonto = Math.round((subtotal * impuestoPorcentaje) / 100);
    const total = subtotal + impuestoMonto;

    // La propina nunca suma al total fiscal: se calcula aparte como cifra
    // sugerida informativa.
    const porcentajePropinaSugerida = Number(restaurante.porcentaje_propina_sugerida) || 0;
    const propinaSugerida = Math.round((total * porcentajePropinaSugerida) / 100);
    const propinaCobrada = Number(pedido.propina) || 0;
    const totalConPropina = total + (propinaCobrada > 0 ? propinaCobrada : propinaSugerida);

    const fechaEmision = new Date();
    const cufe = generarCUFESimulado({
      restauranteId,
      numeroFactura,
      fecha: fechaEmision.toISOString(),
      total,
    });

    const { rows } = await client.query(
      `INSERT INTO facturas (
         id, restaurante_id, pedido_id, numero_factura, numero_consecutivo, fecha_emision,
         nombre_cliente, nit_cliente, email_cliente,
         subtotal, impuesto_porcentaje, impuesto_monto, propina_sugerida, total, total_con_propina,
         metodo_pago, cufe
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        uuidv4(),
        restauranteId,
        pedidoId,
        numeroFactura,
        numeroConsecutivo,
        fechaEmision,
        datosCliente.nombre_cliente || 'Consumidor Final',
        datosCliente.nit_cliente || '222222222222',
        datosCliente.email_cliente || null,
        subtotal,
        impuestoPorcentaje,
        impuestoMonto,
        propinaSugerida,
        total,
        totalConPropina,
        pedido.pagado_con,
        cufe,
      ]
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

module.exports = {
  crear,
  obtenerPorPedido,
  obtenerPorId,
  listar,
  PedidoNoPagadoError,
};
