const express = require('express');

const router = express.Router();

router.use('/auth', require('./auth'));

// Las rutas de cada módulo (pedidos, productos, etc.) se montarán aquí

module.exports = router;
