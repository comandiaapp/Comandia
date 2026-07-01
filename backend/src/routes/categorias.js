const express = require('express');

const { crear, listar, obtener, actualizar, eliminar } = require('../controllers/categoriaController');
const { verificarToken, verificarRol } = require('../middlewares/auth');

const router = express.Router();

router.use(verificarToken);

router.get('/', listar);
router.post('/', verificarRol('admin', 'gerente'), crear);
router.get('/:id', obtener);
router.put('/:id', verificarRol('admin', 'gerente'), actualizar);
router.delete('/:id', verificarRol('admin'), eliminar);

module.exports = router;
