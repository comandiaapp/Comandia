const express = require('express');

const {
  crearMesa,
  crearMesaRemota,
  listarMesas,
  obtenerMesa,
  actualizarMesa,
  cambiarEstadoMesa,
  actualizarPosicion,
  resetearPosiciones,
  eliminarMesa,
  obtenerPlano,
  crearArea,
  listarAreas,
  actualizarArea,
  eliminarArea,
} = require('../controllers/mesaController');
const { verificarToken, verificarRol } = require('../middlewares/auth');

const router = express.Router();

router.use(verificarToken);

// Rutas literales: deben ir antes de /mesas/:id para que Express no las
// interprete como un id.
router.get('/mesas/plano', obtenerPlano);
router.patch('/mesas/resetear-posiciones', verificarRol('admin', 'gerente'), resetearPosiciones);
router.post('/mesas/remota', verificarRol('mesero', 'cajero', 'gerente', 'admin'), crearMesaRemota);

router.get('/mesas', listarMesas);
router.post('/mesas', verificarRol('admin', 'gerente'), crearMesa);
router.get('/mesas/:id', obtenerMesa);
router.put('/mesas/:id', verificarRol('admin', 'gerente'), actualizarMesa);
router.delete('/mesas/:id', verificarRol('admin'), eliminarMesa);
router.patch('/mesas/:id/estado', verificarRol('mesero', 'cajero', 'gerente', 'admin'), cambiarEstadoMesa);
router.patch('/mesas/:id/posicion', verificarRol('admin', 'gerente'), actualizarPosicion);

router.get('/areas', listarAreas);
router.post('/areas', verificarRol('admin', 'gerente'), crearArea);
router.put('/areas/:id', verificarRol('admin', 'gerente'), actualizarArea);
router.delete('/areas/:id', verificarRol('admin'), eliminarArea);

module.exports = router;
