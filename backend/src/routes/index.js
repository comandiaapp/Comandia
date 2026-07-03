const express = require('express');

const router = express.Router();

router.use('/auth', require('./auth'));
router.use('/categorias', require('./categorias'));
router.use('/', require('./productos'));
router.use('/', require('./mesas'));
router.use('/', require('./pedidos'));
router.use('/', require('./inventario'));
router.use('/', require('./reportes'));
router.use('/', require('./jornadas'));
router.use('/', require('./contaduria'));
router.use('/', require('./compras'));
router.use('/', require('./configuracion'));
router.use('/', require('./facturas'));

module.exports = router;
