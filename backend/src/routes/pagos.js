const express = require('express');

const { iniciarPago, verificarPago, historialPagos, estadoSuscripcion, webhook } = require('../controllers/pagoController');
const { verificarToken, verificarRol } = require('../middlewares/auth');

const router = express.Router();

// Lo llama Mercado Pago, no un usuario autenticado de Comandia: debe ir
// antes del verificarToken de abajo, que aplica a todo lo demás en este router.
router.post('/pagos/webhook', webhook);

router.use(verificarToken);

router.post('/pagos/iniciar', verificarRol('admin'), iniciarPago);
router.get('/pagos/verificar', verificarPago);
router.get('/pagos/historial', verificarRol('admin'), historialPagos);
router.get('/pagos/estado', estadoSuscripcion);

module.exports = router;
