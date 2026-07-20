const facturaModel = require('../models/facturaModel');
const pedidoModel = require('../models/pedidoModel');
const restauranteModel = require('../models/restauranteModel');
const usuarioModel = require('../models/usuarioModel');
const { generarHTMLTicket, generarHTMLPrecuenta } = require('../utils/generarTicket');
const { ok, error } = require('../utils/respuestas');

// El "vendedor" que se imprime en la factura es el usuario dueño del
// pedido (pedidos.usuario_id): quien lo abrió y, en el flujo típico de un
// restaurante pequeño, también quien termina cobrándolo.
async function obtenerVendedor(pedido) {
  if (!pedido?.usuario_id) return null;
  return usuarioModel.buscarPorId(pedido.usuario_id);
}

async function generar(req, res) {
  const { nombre_cliente, nit_cliente, email_cliente } = req.body || {};

  try {
    const factura = await facturaModel.crear(req.params.pedidoId, req.usuario.restauranteId, {
      nombre_cliente,
      nit_cliente,
      email_cliente,
    });
    if (!factura) {
      return error(res, 'Pedido no encontrado', 404);
    }

    const [pedido, restaurante] = await Promise.all([
      pedidoModel.obtenerPorId(req.params.pedidoId, req.usuario.restauranteId),
      restauranteModel.buscarPorId(req.usuario.restauranteId),
    ]);
    const vendedor = await obtenerVendedor(pedido);

    const html = await generarHTMLTicket(factura, restaurante, pedido, vendedor);
    return ok(res, { factura, html }, 201);
  } catch (err) {
    if (err.pedidoNoPagado) {
      return error(res, err.message, 400);
    }
    console.error('Error al generar la factura:', err);
    return error(res, 'No se pudo generar la factura', 500);
  }
}

async function obtenerPorPedido(req, res) {
  try {
    const factura = await facturaModel.obtenerPorPedido(req.params.pedidoId, req.usuario.restauranteId);
    if (!factura) {
      return error(res, 'Este pedido no tiene factura generada', 404);
    }

    const [pedido, restaurante] = await Promise.all([
      pedidoModel.obtenerPorId(req.params.pedidoId, req.usuario.restauranteId),
      restauranteModel.buscarPorId(req.usuario.restauranteId),
    ]);
    const vendedor = await obtenerVendedor(pedido);

    const html = await generarHTMLTicket(factura, restaurante, pedido, vendedor);
    return ok(res, { factura, html });
  } catch (err) {
    console.error('Error al obtener la factura del pedido:', err);
    return error(res, 'No se pudo obtener la factura', 500);
  }
}

async function listar(req, res) {
  try {
    const { fecha, estado } = req.query;
    const filtros = {};
    if (fecha !== undefined) filtros.fecha = fecha;
    if (estado !== undefined) filtros.estado = estado;

    const facturas = await facturaModel.listar(req.usuario.restauranteId, filtros);
    return ok(res, { facturas });
  } catch (err) {
    console.error('Error al listar facturas:', err);
    return error(res, 'No se pudieron obtener las facturas', 500);
  }
}

async function obtenerPorId(req, res) {
  try {
    const factura = await facturaModel.obtenerPorId(req.params.id, req.usuario.restauranteId);
    if (!factura) {
      return error(res, 'Factura no encontrada', 404);
    }

    const [pedido, restaurante] = await Promise.all([
      pedidoModel.obtenerPorId(factura.pedido_id, req.usuario.restauranteId),
      restauranteModel.buscarPorId(req.usuario.restauranteId),
    ]);
    const vendedor = await obtenerVendedor(pedido);

    const html = await generarHTMLTicket(factura, restaurante, pedido, vendedor);
    return ok(res, { factura, html });
  } catch (err) {
    console.error('Error al obtener la factura:', err);
    return error(res, 'No se pudo obtener la factura', 500);
  }
}

// La precuenta se genera al vuelo a partir de los totales que el cajero
// tiene editados en pantalla (aún no persistidos en el pedido), por eso no
// depende de una factura guardada.
async function precuenta(req, res) {
  try {
    const pedido = await pedidoModel.obtenerPorId(req.params.pedidoId, req.usuario.restauranteId);
    if (!pedido) {
      return error(res, 'Pedido no encontrado', 404);
    }
    const restaurante = await restauranteModel.buscarPorId(req.usuario.restauranteId);

    const { descuento, impuesto, propina, costo_domicilio } = req.body || {};
    const pedidoConTotales = {
      ...pedido,
      descuento: descuento !== undefined ? Number(descuento) : Number(pedido.descuento),
      impuesto: impuesto !== undefined ? Number(impuesto) : Number(pedido.impuesto),
      propina: propina !== undefined ? Number(propina) : Number(pedido.propina),
      costo_domicilio: costo_domicilio !== undefined ? Number(costo_domicilio) : Number(pedido.costo_domicilio),
    };
    pedidoConTotales.total = Math.max(
      0,
      Number(pedido.subtotal) -
        pedidoConTotales.descuento +
        pedidoConTotales.impuesto +
        pedidoConTotales.propina +
        pedidoConTotales.costo_domicilio
    );

    const html = generarHTMLPrecuenta(pedidoConTotales, restaurante);
    return ok(res, { html });
  } catch (err) {
    console.error('Error al generar la precuenta:', err);
    return error(res, 'No se pudo generar la precuenta', 500);
  }
}

module.exports = {
  generar,
  obtenerPorPedido,
  listar,
  obtenerPorId,
  precuenta,
};
