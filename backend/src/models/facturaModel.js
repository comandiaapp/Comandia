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

function soloDigitos(texto) {
  return String(texto || '').replace(/\D/g, '');
}

// El NitOFE del CUFE va sin dígito de verificación (DV): admite "900123456"
// o "900123456-7", en ambos casos se usa solo la parte numérica principal.
function nitSinDV(nit) {
  const match = String(nit || '').match(/^(\d+)-?\d?$/);
  return match ? match[1] : soloDigitos(nit);
}

function decimalDIAN(valor) {
  return (Math.round(Number(valor) * 100) / 100).toFixed(2);
}

function fechaHoraBogota(fecha) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(fecha)
    .reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return { fecFac: `${partes.year}-${partes.month}-${partes.day}`, horaFac: `${partes.hour}:${partes.minute}:${partes.second}-05:00` };
}

// Fórmula oficial de la DIAN (Anexo Técnico Factura Electrónica de Venta)
// para el CUFE: SHA-384 sobre la concatenación de estos campos en este
// orden y formato exactos. impuestoPorcentaje === 8 es el Impuesto Nacional
// al Consumo (código 04); cualquier otro valor se trata como IVA (código
// 03 -ICA- siempre queda en 0 porque este sistema no lo maneja).
// 'clave_tecnica_dian' la entrega la DIAN al habilitar el NIT como
// facturador electrónico; sin ella el CUFE sigue siendo determinístico
// (mismos datos → mismo hash) pero queda en TipoAmbiente "2" (pruebas), ya
// que no hay forma de que la DIAN lo valide sin la clave real.
function generarCUFE({ restaurante, numeroFactura, fechaEmision, subtotal, impuestoPorcentaje, impuestoMonto, total, nitCliente }) {
  const { fecFac, horaFac } = fechaHoraBogota(fechaEmision);
  const esINC = Number(impuestoPorcentaje) === 8;
  const claveTecnica = restaurante.clave_tecnica_dian || '';

  const campos = [
    String(numeroFactura).replace(/\s/g, ''),
    fecFac,
    horaFac,
    decimalDIAN(subtotal),
    '01', decimalDIAN(esINC ? 0 : impuestoMonto),
    '04', decimalDIAN(esINC ? impuestoMonto : 0),
    '03', decimalDIAN(0),
    decimalDIAN(total),
    nitSinDV(restaurante.nit),
    soloDigitos(nitCliente) || '222222222222',
    claveTecnica,
    claveTecnica ? '1' : '2',
  ];

  return crypto.createHash('sha384').update(campos.join('')).digest('hex');
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
    const cufe = generarCUFE({
      restaurante,
      numeroFactura,
      fechaEmision,
      subtotal,
      impuestoPorcentaje,
      impuestoMonto,
      total,
      nitCliente: datosCliente.nit_cliente || '222222222222',
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
