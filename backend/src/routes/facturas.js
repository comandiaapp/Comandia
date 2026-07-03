const express = require('express');

const { generar, obtenerPorPedido, listar, obtenerPorId, precuenta } = require('../controllers/facturaController');
const { verificarToken, verificarRol } = require('../middlewares/auth');

const router = express.Router();

router.use(verificarToken);

router.post('/facturas/generar/:pedidoId', verificarRol('cajero', 'gerente', 'admin'), generar);
router.post('/facturas/precuenta/:pedidoId', verificarRol('mesero', 'cajero', 'gerente', 'admin'), precuenta);
router.get('/facturas/pedido/:pedidoId', obtenerPorPedido);
router.get('/facturas', listar);
router.get('/facturas/:id', obtenerPorId);

module.exports = router;
