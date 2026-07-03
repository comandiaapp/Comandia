const { v4: uuidv4 } = require('uuid');

const contaduriaModel = require('../models/contaduriaModel');
const jornadaModel = require('../models/jornadaModel');
const { ok, error } = require('../utils/respuestas');

const TIPOS_TRANSACCION_VALIDOS = ['ingreso', 'egreso', 'retiro', 'nomina', 'compra'];
const METODOS_PAGO_VALIDOS = ['efectivo', 'tarjeta', 'transferencia', 'nequi'];
const ROLES_EMPLEADO_VALIDOS = ['mesero', 'cocina', 'cajero', 'domiciliario', 'otro'];

function hoyISO() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' });
}

function sumarDias(fechaISO, dias) {
  const fecha = new Date(`${fechaISO}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

// --- Categorías ---

async function listarCategorias(req, res) {
  try {
    const categorias = await contaduriaModel.obtenerCategorias(req.usuario.restauranteId);
    return ok(res, { categorias });
  } catch (err) {
    console.error('Error al listar las categorías contables:', err);
    return error(res, 'No se pudieron obtener las categorías contables', 500);
  }
}

// --- Transacciones ---

async function crearTransaccion(req, res) {
  const { tipo, categoria, descripcion, monto, metodo_pago, proveedor, numero_factura, fecha, jornada_id } = req.body;

  if (!tipo || !TIPOS_TRANSACCION_VALIDOS.includes(tipo)) {
    return error(res, `Tipo inválido. Valores permitidos: ${TIPOS_TRANSACCION_VALIDOS.join(', ')}`, 400);
  }
  if (!descripcion) {
    return error(res, 'La descripción es obligatoria', 400);
  }
  if (monto === undefined || monto === null || Number(monto) <= 0) {
    return error(res, 'El monto debe ser mayor a 0', 400);
  }
  if (metodo_pago !== undefined && metodo_pago !== null && !METODOS_PAGO_VALIDOS.includes(metodo_pago)) {
    return error(res, `Método de pago inválido. Valores permitidos: ${METODOS_PAGO_VALIDOS.join(', ')}`, 400);
  }

  try {
    const transaccion = await contaduriaModel.crearTransaccion({
      id: uuidv4(),
      restaurante_id: req.usuario.restauranteId,
      jornada_id: jornada_id ?? null,
      tipo,
      categoria,
      descripcion,
      monto,
      metodo_pago,
      proveedor,
      numero_factura,
      fecha: fecha || hoyISO(),
      usuario_id: req.usuario.userId,
    });
    return ok(res, { transaccion }, 201);
  } catch (err) {
    console.error('Error al crear la transacción contable:', err);
    return error(res, 'No se pudo crear la transacción', 500);
  }
}

async function listarTransacciones(req, res) {
  try {
    const { tipo, categoria, metodo_pago, fecha_inicio, fecha_fin, jornada_id } = req.query;
    const filtros = {};
    if (tipo !== undefined) filtros.tipo = tipo;
    if (categoria !== undefined) filtros.categoria = categoria;
    if (metodo_pago !== undefined) filtros.metodo_pago = metodo_pago;
    if (fecha_inicio !== undefined) filtros.fecha_inicio = fecha_inicio;
    if (fecha_fin !== undefined) filtros.fecha_fin = fecha_fin;
    if (jornada_id !== undefined) filtros.jornada_id = jornada_id;

    const transacciones = await contaduriaModel.obtenerTransacciones(req.usuario.restauranteId, filtros);
    return ok(res, { transacciones });
  } catch (err) {
    console.error('Error al listar las transacciones contables:', err);
    return error(res, 'No se pudieron obtener las transacciones', 500);
  }
}

async function actualizarTransaccion(req, res) {
  if (req.body.tipo !== undefined && !TIPOS_TRANSACCION_VALIDOS.includes(req.body.tipo)) {
    return error(res, `Tipo inválido. Valores permitidos: ${TIPOS_TRANSACCION_VALIDOS.join(', ')}`, 400);
  }
  if (req.body.metodo_pago !== undefined && req.body.metodo_pago !== null && !METODOS_PAGO_VALIDOS.includes(req.body.metodo_pago)) {
    return error(res, `Método de pago inválido. Valores permitidos: ${METODOS_PAGO_VALIDOS.join(', ')}`, 400);
  }

  try {
    const transaccion = await contaduriaModel.actualizarTransaccion(req.params.id, req.usuario.restauranteId, req.body);
    if (!transaccion) {
      return error(res, 'Transacción no encontrada', 404);
    }
    return ok(res, { transaccion });
  } catch (err) {
    console.error('Error al actualizar la transacción contable:', err);
    return error(res, 'No se pudo actualizar la transacción', 500);
  }
}

async function eliminarTransaccion(req, res) {
  try {
    const transaccion = await contaduriaModel.eliminarTransaccion(req.params.id, req.usuario.restauranteId);
    if (!transaccion) {
      return error(res, 'Transacción no encontrada', 404);
    }
    return ok(res, { transaccion });
  } catch (err) {
    console.error('Error al eliminar la transacción contable:', err);
    return error(res, 'No se pudo eliminar la transacción', 500);
  }
}

// --- Resumen y flujo de efectivo ---

async function resumenFinanciero(req, res) {
  const fecha_fin = req.query.fecha_fin || hoyISO();
  const fecha_inicio = req.query.fecha_inicio || fecha_fin;

  try {
    const resumen = await contaduriaModel.resumenFinanciero(req.usuario.restauranteId, fecha_inicio, fecha_fin);
    return ok(res, { resumen });
  } catch (err) {
    console.error('Error al generar el resumen financiero:', err);
    return error(res, 'No se pudo generar el resumen financiero', 500);
  }
}

async function flujoEfectivo(req, res) {
  const fecha_fin = req.query.fecha_fin || hoyISO();
  const fecha_inicio = req.query.fecha_inicio || sumarDias(fecha_fin, -6);

  try {
    const flujo = await contaduriaModel.flujoEfectivo(req.usuario.restauranteId, fecha_inicio, fecha_fin);
    return ok(res, { flujo });
  } catch (err) {
    console.error('Error al generar el flujo de efectivo:', err);
    return error(res, 'No se pudo generar el flujo de efectivo', 500);
  }
}

// --- Empleados de jornada ---

async function listarEmpleadosJornada(req, res) {
  try {
    const jornada = await jornadaModel.obtenerAbierta(req.usuario.restauranteId, req.usuario.sucursalId);
    if (!jornada) {
      return ok(res, { jornada: null, empleados: [], nomina: { total: 0, cantidad_empleados: 0 } });
    }

    const [empleados, nomina] = await Promise.all([
      contaduriaModel.obtenerEmpleadosJornada(jornada.id, req.usuario.restauranteId),
      contaduriaModel.calcularNominaJornada(jornada.id, req.usuario.restauranteId),
    ]);
    return ok(res, { jornada, empleados, nomina });
  } catch (err) {
    console.error('Error al listar los empleados de la jornada:', err);
    return error(res, 'No se pudieron obtener los empleados de la jornada', 500);
  }
}

async function historialEmpleados(req, res) {
  try {
    const empleados = await contaduriaModel.obtenerHistorialEmpleados(req.usuario.restauranteId);
    return ok(res, { empleados });
  } catch (err) {
    console.error('Error al obtener el historial de empleados:', err);
    return error(res, 'No se pudo obtener el historial de empleados', 500);
  }
}

async function agregarEmpleadoJornada(req, res) {
  const { nombre_empleado, rol_empleado, hora_entrada, pago_dia, notas } = req.body;

  if (!nombre_empleado) {
    return error(res, 'El nombre del empleado es obligatorio', 400);
  }
  if (rol_empleado !== undefined && rol_empleado !== null && !ROLES_EMPLEADO_VALIDOS.includes(rol_empleado)) {
    return error(res, `Rol inválido. Valores permitidos: ${ROLES_EMPLEADO_VALIDOS.join(', ')}`, 400);
  }

  try {
    const jornada = await jornadaModel.obtenerAbierta(req.usuario.restauranteId, req.usuario.sucursalId);
    if (!jornada) {
      return error(res, 'No hay una jornada abierta para agregar empleados', 400);
    }

    const empleado = await contaduriaModel.agregarEmpleadoJornada({
      id: uuidv4(),
      restaurante_id: req.usuario.restauranteId,
      jornada_id: jornada.id,
      nombre_empleado,
      rol_empleado,
      hora_entrada,
      pago_dia,
      notas,
    });
    return ok(res, { empleado }, 201);
  } catch (err) {
    console.error('Error al agregar el empleado a la jornada:', err);
    return error(res, 'No se pudo agregar el empleado', 500);
  }
}

async function actualizarEmpleadoJornada(req, res) {
  if (req.body.rol_empleado !== undefined && req.body.rol_empleado !== null && !ROLES_EMPLEADO_VALIDOS.includes(req.body.rol_empleado)) {
    return error(res, `Rol inválido. Valores permitidos: ${ROLES_EMPLEADO_VALIDOS.join(', ')}`, 400);
  }

  try {
    const empleado = await contaduriaModel.actualizarEmpleadoJornada(req.params.id, req.usuario.restauranteId, req.body);
    if (!empleado) {
      return error(res, 'Empleado no encontrado', 404);
    }
    return ok(res, { empleado });
  } catch (err) {
    console.error('Error al actualizar el empleado de la jornada:', err);
    return error(res, 'No se pudo actualizar el empleado', 500);
  }
}

async function marcarSalidaEmpleado(req, res) {
  try {
    const empleado = await contaduriaModel.marcarSalidaEmpleado(req.params.id, req.usuario.restauranteId);
    if (!empleado) {
      return error(res, 'Empleado no encontrado', 404);
    }
    return ok(res, { empleado });
  } catch (err) {
    console.error('Error al marcar la salida del empleado:', err);
    return error(res, 'No se pudo marcar la salida del empleado', 500);
  }
}

async function eliminarEmpleadoJornada(req, res) {
  try {
    const empleado = await contaduriaModel.eliminarEmpleadoJornada(req.params.id, req.usuario.restauranteId);
    if (!empleado) {
      return error(res, 'Empleado no encontrado', 404);
    }
    return ok(res, { empleado });
  } catch (err) {
    console.error('Error al eliminar el empleado de la jornada:', err);
    return error(res, 'No se pudo eliminar el empleado', 500);
  }
}

module.exports = {
  listarCategorias,
  crearTransaccion,
  listarTransacciones,
  actualizarTransaccion,
  eliminarTransaccion,
  resumenFinanciero,
  flujoEfectivo,
  listarEmpleadosJornada,
  historialEmpleados,
  agregarEmpleadoJornada,
  actualizarEmpleadoJornada,
  marcarSalidaEmpleado,
  eliminarEmpleadoJornada,
};
