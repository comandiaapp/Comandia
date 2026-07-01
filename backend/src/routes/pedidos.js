const express = require('express');

const {
  crear,
  obtenerPorMesa,
  obtenerPorId,
  listar,
  agregarItem,
  actualizarItem,
  eliminarItem,
  enviarCocina,
  pedirCuenta,
  cobrar,
  cancelar,
} = require('../controllers/pedidoController');
const { verificarToken, verificarRol } = require('../middlewares/auth');

const router = express.Router();

router.use(verificarToken);

router.post('/pedidos', verificarRol('mesero', 'cajero', 'gerente', 'admin'), crear);
router.get('/pedidos', listar);

// Ruta literal: debe ir antes de /pedidos/:id para que "mesa" no se
// interprete como un id.
router.get('/pedidos/mesa/:mesaId', obtenerPorMesa);

router.get('/pedidos/:id', obtenerPorId);
router.post('/pedidos/:id/items', verificarRol('mesero', 'cajero', 'gerente', 'admin'), agregarItem);
router.put('/pedidos/:id/items/:itemId', verificarRol('mesero', 'cajero', 'gerente', 'admin'), actualizarItem);
router.delete('/pedidos/:id/items/:itemId', verificarRol('mesero', 'gerente', 'admin'), eliminarItem);
router.post('/pedidos/:id/enviar-cocina', verificarRol('mesero', 'gerente', 'admin'), enviarCocina);
router.post('/pedidos/:id/pedir-cuenta', verificarRol('mesero', 'cajero', 'gerente', 'admin'), pedirCuenta);
router.post('/pedidos/:id/cobrar', verificarRol('cajero', 'gerente', 'admin'), cobrar);
router.post('/pedidos/:id/cancelar', verificarRol('gerente', 'admin'), cancelar);

module.exports = router;
