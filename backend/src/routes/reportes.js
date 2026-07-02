const express = require('express');

const {
  ventasDia,
  ventasPeriodo,
  productosMasVendidos,
  resumenDashboard,
} = require('../controllers/reporteController');
const { verificarToken, verificarRol } = require('../middlewares/auth');

const router = express.Router();

router.use(verificarToken);

router.get('/reportes/ventas-dia', verificarRol('gerente', 'admin'), ventasDia);
router.get('/reportes/ventas-periodo', verificarRol('gerente', 'admin'), ventasPeriodo);
router.get('/reportes/productos-vendidos', verificarRol('gerente', 'admin'), productosMasVendidos);
router.get('/reportes/dashboard', resumenDashboard);

module.exports = router;
