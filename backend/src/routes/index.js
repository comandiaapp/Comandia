const express = require('express');

const router = express.Router();

router.use('/auth', require('./auth'));
router.use('/categorias', require('./categorias'));
router.use('/', require('./productos'));

// Las rutas de cada módulo (pedidos, etc.) se montarán aquí

module.exports = router;
