const express = require('express');

const {
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
} = require('../controllers/contaduriaController');
const { verificarToken, verificarRol } = require('../middlewares/auth');

const router = express.Router();

router.use(verificarToken);
router.use(verificarRol('admin', 'gerente'));

router.get('/contaduria/resumen', resumenFinanciero);
router.get('/contaduria/flujo-efectivo', flujoEfectivo);
router.get('/contaduria/categorias', listarCategorias);

router.get('/contaduria/transacciones', listarTransacciones);
router.post('/contaduria/transacciones', crearTransaccion);
router.put('/contaduria/transacciones/:id', actualizarTransaccion);
router.delete('/contaduria/transacciones/:id', eliminarTransaccion);

// Ruta literal: debe ir antes de /empleados-jornada/:id/... para que
// "historial" no se interprete como un id.
router.get('/contaduria/empleados-jornada/historial', historialEmpleados);
router.get('/contaduria/empleados-jornada', listarEmpleadosJornada);
router.post('/contaduria/empleados-jornada', agregarEmpleadoJornada);
router.put('/contaduria/empleados-jornada/:id', actualizarEmpleadoJornada);
router.patch('/contaduria/empleados-jornada/:id/salida', marcarSalidaEmpleado);
router.delete('/contaduria/empleados-jornada/:id', eliminarEmpleadoJornada);

module.exports = router;
