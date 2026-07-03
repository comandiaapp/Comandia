const { v4: uuidv4 } = require('uuid');

const pedidoModel = require('../models/pedidoModel');
const inventarioModel = require('../models/inventarioModel');
const jornadaModel = require('../models/jornadaModel');
const contaduriaModel = require('../models/contaduriaModel');
const { ok, error } = require('../utils/respuestas');

const TIPOS_VALIDOS = ['mesa', 'barra', 'delivery', 'take_away'];
const METODOS_PAGO_VALIDOS = ['efectivo', 'tarjeta', 'qr', 'nequi', 'transferencia', 'mixto'];
const ESTADOS_ACTIVOS_FILTRO = ['abierto', 'enviado_cocina', 'listo', 'cuenta_pedida'];

// transacciones_contables.metodo_pago solo acepta este subconjunto de los
// métodos de pago de pedidos; 'qr' y 'mixto' no tienen equivalente contable
// directo y se registran sin método específico.
const METODOS_PAGO_CONTABLES = ['efectivo', 'tarjeta', 'transferencia', 'nequi'];

function fechaBogota(fecha) {
  return new Date(fecha).toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' });
}

async function crear(req, res) {
  const { mesa_id, sucursal_id, tipo, notas } = req.body;

  if (tipo !== undefined && !TIPOS_VALIDOS.includes(tipo)) {
    return error(res, `Tipo inválido. Valores permitidos: ${TIPOS_VALIDOS.join(', ')}`, 400);
  }

  try {
    if (mesa_id) {
      const existente = await pedidoModel.obtenerPorMesa(mesa_id, req.usuario.restauranteId);
      if (existente) {
        const completo = await pedidoModel.obtenerPorId(existente.id, req.usuario.restauranteId);
        return ok(res, { pedido: completo });
      }
    }

    const sucursalId = sucursal_id ?? req.usuario.sucursalId;
    // El número de jornada se calcula a partir de la jornada abierta del
    // servidor, no de lo que mande el cliente, para que #01, #02... siempre
    // cuadre con la jornada realmente activa.
    const jornadaActual = await jornadaModel.obtenerAbierta(req.usuario.restauranteId, sucursalId);

    const pedido = await pedidoModel.crear({
      id: uuidv4(),
      restaurante_id: req.usuario.restauranteId,
      sucursal_id: sucursalId,
      mesa_id,
      jornada_id: jornadaActual ? jornadaActual.id : null,
      usuario_id: req.usuario.userId,
      tipo,
      notas,
    });

    return ok(res, { pedido: { ...pedido, items: [] } }, 201);
  } catch (err) {
    if (err.code === '23505' && mesa_id) {
      // Otra petición concurrente ganó la carrera y ya creó el pedido
      // activo de esta mesa (ej. dos clicks casi simultáneos en "Abrir
      // mesa"). Devolvemos ese pedido en vez de fallar.
      try {
        const existente = await pedidoModel.obtenerPorMesa(mesa_id, req.usuario.restauranteId);
        if (existente) {
          const completo = await pedidoModel.obtenerPorId(existente.id, req.usuario.restauranteId);
          return ok(res, { pedido: completo });
        }
      } catch (err2) {
        console.error('Error al recuperar el pedido tras conflicto de concurrencia:', err2);
      }
    }
    if (err.code === '23503') {
      return error(res, 'La mesa especificada no existe', 400);
    }
    console.error('Error al crear pedido:', err);
    return error(res, 'No se pudo crear el pedido', 500);
  }
}

async function obtenerPorMesa(req, res) {
  try {
    const resumen = await pedidoModel.obtenerPorMesa(req.params.mesaId, req.usuario.restauranteId);
    if (!resumen) {
      return error(res, 'No hay un pedido activo para esta mesa', 404);
    }
    const pedido = await pedidoModel.obtenerPorId(resumen.id, req.usuario.restauranteId);
    return ok(res, { pedido });
  } catch (err) {
    console.error('Error al obtener el pedido de la mesa:', err);
    return error(res, 'No se pudo obtener el pedido', 500);
  }
}

async function obtenerPorId(req, res) {
  try {
    const pedido = await pedidoModel.obtenerPorId(req.params.id, req.usuario.restauranteId);
    if (!pedido) {
      return error(res, 'Pedido no encontrado', 404);
    }
    return ok(res, { pedido });
  } catch (err) {
    console.error('Error al obtener el pedido:', err);
    return error(res, 'No se pudo obtener el pedido', 500);
  }
}

async function listar(req, res) {
  try {
    const { estado, fecha, mesa_id, tipo } = req.query;
    const filtros = {};
    if (fecha !== undefined) filtros.fecha = fecha;
    if (mesa_id !== undefined) filtros.mesa_id = mesa_id;
    if (tipo !== undefined) filtros.tipo = tipo;
    if (estado === 'activos') {
      filtros.estados = ESTADOS_ACTIVOS_FILTRO;
    } else if (estado !== undefined) {
      filtros.estado = estado;
    }

    const pedidos = await pedidoModel.obtenerTodos(req.usuario.restauranteId, filtros);
    return ok(res, { pedidos });
  } catch (err) {
    console.error('Error al listar pedidos:', err);
    return error(res, 'No se pudieron obtener los pedidos', 500);
  }
}

async function agregarItem(req, res) {
  const { producto_id, nombre_producto, precio_unitario, cantidad, notas, modificadores } = req.body;

  if (!nombre_producto || precio_unitario === undefined || precio_unitario === null) {
    return error(res, 'El nombre y el precio del producto son obligatorios', 400);
  }

  try {
    const resultado = await pedidoModel.agregarItem(
      req.params.id,
      { id: uuidv4(), producto_id, nombre_producto, precio_unitario, cantidad, notas, modificadores },
      req.usuario.restauranteId
    );

    if (!resultado) {
      return error(res, 'Pedido no encontrado', 404);
    }

    return ok(res, resultado, 201);
  } catch (err) {
    if (err.pedidoNoEditable) {
      return error(res, err.message, 400);
    }
    console.error('Error al agregar el item:', err);
    return error(res, 'No se pudo agregar el producto al pedido', 500);
  }
}

async function actualizarItem(req, res) {
  try {
    const resultado = await pedidoModel.actualizarItem(req.params.itemId, req.body, req.usuario.restauranteId);
    if (!resultado) {
      return error(res, 'Item no encontrado', 404);
    }
    return ok(res, resultado);
  } catch (err) {
    console.error('Error al actualizar el item:', err);
    return error(res, 'No se pudo actualizar el item', 500);
  }
}

async function eliminarItem(req, res) {
  try {
    const resultado = await pedidoModel.eliminarItem(req.params.itemId, req.params.id, req.usuario.restauranteId);
    if (!resultado) {
      return error(res, 'Item no encontrado', 404);
    }
    return ok(res, resultado);
  } catch (err) {
    console.error('Error al eliminar el item:', err);
    return error(res, 'No se pudo eliminar el item', 500);
  }
}

async function enviarCocina(req, res) {
  try {
    const pedido = await pedidoModel.enviarCocina(req.params.id, req.usuario.restauranteId);
    if (!pedido) {
      return error(res, 'Pedido no encontrado', 404);
    }
    return ok(res, { pedido });
  } catch (err) {
    if (err.sinItemsPendientes) {
      return error(res, err.message, 400);
    }
    console.error('Error al enviar el pedido a cocina:', err);
    return error(res, 'No se pudo enviar el pedido a cocina', 500);
  }
}

async function pedirCuenta(req, res) {
  try {
    const pedido = await pedidoModel.pedirCuenta(req.params.id, req.usuario.restauranteId);
    if (!pedido) {
      return error(res, 'Pedido no encontrado', 404);
    }
    return ok(res, { pedido });
  } catch (err) {
    console.error('Error al pedir la cuenta:', err);
    return error(res, 'No se pudo pedir la cuenta', 500);
  }
}

async function reabrirCuenta(req, res) {
  try {
    const pedido = await pedidoModel.reabrirCuenta(req.params.id, req.usuario.restauranteId);
    if (!pedido) {
      return error(res, 'El pedido no existe o no está en estado "cuenta pedida"', 404);
    }
    return ok(res, { pedido });
  } catch (err) {
    console.error('Error al reabrir la cuenta:', err);
    return error(res, 'No se pudo reabrir la cuenta', 500);
  }
}

async function cobrar(req, res) {
  const { pagado_con, monto_recibido, descuento, impuesto, propina } = req.body;

  if (!pagado_con || !METODOS_PAGO_VALIDOS.includes(pagado_con)) {
    return error(res, `Método de pago inválido. Valores permitidos: ${METODOS_PAGO_VALIDOS.join(', ')}`, 400);
  }

  try {
    const pedido = await pedidoModel.cobrar(
      req.params.id,
      { pagado_con, monto_recibido, descuento, impuesto, propina },
      req.usuario.restauranteId
    );
    if (!pedido) {
      return error(res, 'Pedido no encontrado', 404);
    }

    // Descuenta el stock de ingredientes en background: no debe retrasar
    // ni bloquear la respuesta del cobro si falla.
    inventarioModel
      .descontarStockPorVenta(pedido.id, req.usuario.restauranteId, req.usuario.userId)
      .catch((err) => console.error('Error al descontar stock por venta:', err));

    // Toda venta cobrada se refleja automáticamente en Contaduría como un
    // ingreso; el dueño solo registra manualmente egresos y otros ingresos.
    contaduriaModel
      .crearTransaccion({
        id: uuidv4(),
        restaurante_id: req.usuario.restauranteId,
        jornada_id: pedido.jornada_id,
        tipo: 'ingreso',
        categoria: 'Venta',
        descripcion: `Venta - Pedido #${String(pedido.numero_jornada).padStart(2, '0')}`,
        monto: pedido.total,
        metodo_pago: METODOS_PAGO_CONTABLES.includes(pedido.pagado_con) ? pedido.pagado_con : null,
        fecha: fechaBogota(pedido.pagado_at),
        usuario_id: req.usuario.userId,
      })
      .catch((err) => console.error('Error al registrar la venta en contaduría:', err));

    return ok(res, { pedido });
  } catch (err) {
    if (err.montoInsuficiente) {
      return error(res, err.message, 400);
    }
    console.error('Error al cobrar el pedido:', err);
    return error(res, 'No se pudo cobrar el pedido', 500);
  }
}

async function cancelar(req, res) {
  try {
    const pedido = await pedidoModel.cancelar(req.params.id, req.usuario.restauranteId);
    if (!pedido) {
      return error(res, 'Pedido no encontrado', 404);
    }
    return ok(res, { pedido });
  } catch (err) {
    console.error('Error al cancelar el pedido:', err);
    return error(res, 'No se pudo cancelar el pedido', 500);
  }
}

async function obtenerCocina(req, res) {
  try {
    const pedidos = await pedidoModel.obtenerCocina(req.usuario.restauranteId);
    return ok(res, { pedidos });
  } catch (err) {
    console.error('Error al obtener los pedidos de cocina:', err);
    return error(res, 'No se pudieron obtener los pedidos de cocina', 500);
  }
}

async function marcarItemEnPreparacion(req, res) {
  try {
    const resultado = await pedidoModel.marcarItemEnPreparacion(
      req.params.itemId,
      req.params.id,
      req.usuario.restauranteId
    );
    if (!resultado) {
      return error(res, 'Item no encontrado', 404);
    }
    return ok(res, resultado);
  } catch (err) {
    console.error('Error al marcar el item en preparación:', err);
    return error(res, 'No se pudo marcar el item en preparación', 500);
  }
}

async function marcarItemListo(req, res) {
  try {
    const resultado = await pedidoModel.marcarItemListo(req.params.itemId, req.params.id, req.usuario.restauranteId);
    if (!resultado) {
      return error(res, 'Item no encontrado', 404);
    }
    return ok(res, resultado);
  } catch (err) {
    console.error('Error al marcar el item como listo:', err);
    return error(res, 'No se pudo marcar el item como listo', 500);
  }
}

async function marcarPedidoEntregado(req, res) {
  try {
    const pedido = await pedidoModel.marcarPedidoEntregado(req.params.id, req.usuario.restauranteId);
    if (!pedido) {
      return error(res, 'Pedido no encontrado', 404);
    }
    return ok(res, { pedido });
  } catch (err) {
    console.error('Error al marcar el pedido como entregado:', err);
    return error(res, 'No se pudo marcar el pedido como entregado', 500);
  }
}

module.exports = {
  crear,
  obtenerPorMesa,
  obtenerPorId,
  listar,
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
