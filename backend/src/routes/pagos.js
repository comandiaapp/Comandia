const express = require('express');

const { iniciarPago, verificarPago, historialPagos, estadoSuscripcion } = require('../controllers/pagoController');
const { verificarToken, verificarRol } = require('../middlewares/auth');

const router = express.Router();

router.use(verificarToken);

router.post('/pagos/iniciar', verificarRol('admin'), iniciarPago);
router.get('/pagos/verificar', verificarPago);
router.get('/pagos/historial', verificarRol('admin'), historialPagos);
router.get('/pagos/estado', estadoSuscripcion);

module.exports = router;
