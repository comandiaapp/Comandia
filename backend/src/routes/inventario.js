const express = require('express');

const {
  crearIngrediente,
  listarIngredientes,
  obtenerIngrediente,
  actualizarIngrediente,
  eliminarIngrediente,
  crearReceta,
  obtenerRecetasPorProducto,
  eliminarReceta,
  registrarEntrada,
  registrarMerma,
  ajustarStock,
  obtenerMovimientos,
  obtenerAlertas,
} = require('../controllers/inventarioController');
const { verificarToken, verificarRol } = require('../middlewares/auth');

const router = express.Router();

router.use(verificarToken);

// Rutas literales: deben ir antes de /inventario/ingredientes/:id para que
// Express no las interprete como un id.
router.get('/inventario/alertas', obtenerAlertas);
router.post('/inventario/entrada', verificarRol('admin', 'gerente'), registrarEntrada);
router.post('/inventario/merma', verificarRol('admin', 'gerente', 'mesero'), registrarMerma);
router.post('/inventario/ajuste', verificarRol('admin', 'gerente'), ajustarStock);
router.get('/inventario/movimientos', verificarRol('admin', 'gerente'), obtenerMovimientos);

router.get('/inventario/recetas/:productoId', verificarRol('admin', 'gerente'), obtenerRecetasPorProducto);
router.post('/inventario/recetas', verificarRol('admin', 'gerente'), crearReceta);
router.delete('/inventario/recetas/:id', verificarRol('admin', 'gerente'), eliminarReceta);

router.get('/inventario/ingredientes', verificarRol('admin', 'gerente'), listarIngredientes);
router.post('/inventario/ingredientes', verificarRol('admin', 'gerente'), crearIngrediente);
router.get('/inventario/ingredientes/:id', verificarRol('admin', 'gerente'), obtenerIngrediente);
router.put('/inventario/ingredientes/:id', verificarRol('admin', 'gerente'), actualizarIngrediente);
router.delete('/inventario/ingredientes/:id', verificarRol('admin', 'gerente'), eliminarIngrediente);

module.exports = router;
