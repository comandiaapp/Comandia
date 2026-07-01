const express = require('express');

const router = express.Router();

router.use('/auth', require('./auth'));
router.use('/categorias', require('./categorias'));
router.use('/', require('./productos'));
router.use('/', require('./mesas'));
router.use('/', require('./pedidos'));

module.exports = router;
