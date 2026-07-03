const express = require('express');

const {
  crearOrden,
  listarOrdenes,
  obtenerSugeridas,
  obtenerOrden,
  actualizarOrden,
  recibirOrden,
  cancelarOrden,
} = require('../controllers/comprasController');
const { verificarToken, verificarRol } = require('../middlewares/auth');

const router = express.Router();

router.use(verificarToken);
router.use(verificarRol('admin', 'gerente'));

// Ruta literal: debe ir antes de /compras/:id para que "sugeridas" no se
// interprete como un id.
router.get('/compras/sugeridas', obtenerSugeridas);

router.get('/compras', listarOrdenes);
router.post('/compras', crearOrden);
router.get('/compras/:id', obtenerOrden);
router.put('/compras/:id', actualizarOrden);
router.post('/compras/:id/recibir', recibirOrden);
router.post('/compras/:id/cancelar', cancelarOrden);

module.exports = router;
