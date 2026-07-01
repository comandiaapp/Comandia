const express = require('express');

const { crear, listar, obtener, actualizar, eliminar, obtenerMenu } = require('../controllers/productoController');
const { verificarToken, verificarRol } = require('../middlewares/auth');

const router = express.Router();

// Público, sin autenticación (para el menú QR)
router.get('/menu/:restauranteId', obtenerMenu);

router.get('/productos', verificarToken, listar);
router.post('/productos', verificarToken, verificarRol('admin', 'gerente'), crear);
router.get('/productos/:id', verificarToken, obtener);
router.put('/productos/:id', verificarToken, verificarRol('admin', 'gerente'), actualizar);
router.delete('/productos/:id', verificarToken, verificarRol('admin'), eliminar);

module.exports = router;
