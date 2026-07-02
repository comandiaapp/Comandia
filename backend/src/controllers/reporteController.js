const reporteModel = require('../models/reporteModel');
const { ok, error } = require('../utils/respuestas');

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function sumarDias(fechaISO, dias) {
  const fecha = new Date(`${fechaISO}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

async function ventasDia(req, res) {
  const fecha = req.query.fecha || hoyISO();

  try {
    const reporte = await reporteModel.ventasDia(req.usuario.restauranteId, fecha);
    return ok(res, { reporte });
  } catch (err) {
    console.error('Error al generar el reporte de ventas del día:', err);
    return error(res, 'No se pudo generar el reporte de ventas del día', 500);
  }
}

async function ventasPeriodo(req, res) {
  const { fecha_inicio, fecha_fin } = req.query;

  if (!fecha_inicio || !fecha_fin) {
    return error(res, 'fecha_inicio y fecha_fin son obligatorios', 400);
  }

  try {
    const reporte = await reporteModel.ventasPeriodo(req.usuario.restauranteId, fecha_inicio, fecha_fin);
    return ok(res, { reporte });
  } catch (err) {
    console.error('Error al generar el reporte de ventas del período:', err);
    return error(res, 'No se pudo generar el reporte de ventas del período', 500);
  }
}

async function productosMasVendidos(req, res) {
  const fecha_fin = req.query.fecha_fin || hoyISO();
  const fecha_inicio = req.query.fecha_inicio || fecha_fin;
  const limite = req.query.limite ? Number(req.query.limite) : 10;

  try {
    const productos = await reporteModel.productosMasVendidos(
      req.usuario.restauranteId,
      fecha_inicio,
      fecha_fin,
      limite
    );
    return ok(res, { productos });
  } catch (err) {
    console.error('Error al generar el reporte de productos más vendidos:', err);
    return error(res, 'No se pudo generar el reporte de productos más vendidos', 500);
  }
}

async function resumenDashboard(req, res) {
  const hoy = hoyISO();
  const ayer = sumarDias(hoy, -1);
  const inicioSemana = sumarDias(hoy, -6);

  try {
    const resumen = await reporteModel.resumenDashboard(req.usuario.restauranteId, hoy, ayer, inicioSemana);
    return ok(res, { resumen });
  } catch (err) {
    console.error('Error al generar el resumen del dashboard:', err);
    return error(res, 'No se pudo generar el resumen del dashboard', 500);
  }
}

module.exports = { ventasDia, ventasPeriodo, productosMasVendidos, resumenDashboard };
