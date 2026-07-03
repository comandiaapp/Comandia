const express = require('express');

const {
  obtenerConfiguracion,
  actualizarConfiguracion,
  listarUsuarios,
  invitarUsuario,
  actualizarRolUsuario,
  actualizarEstadoUsuario,
} = require('../controllers/configuracionController');
const { verificarToken, verificarRol } = require('../middlewares/auth');

const router = express.Router();

router.use(verificarToken);

router.get('/configuracion', obtenerConfiguracion);
router.put('/configuracion', verificarRol('admin'), actualizarConfiguracion);

router.get('/configuracion/usuarios', verificarRol('admin'), listarUsuarios);
router.post('/configuracion/usuarios', verificarRol('admin'), invitarUsuario);
router.put('/configuracion/usuarios/:id/rol', verificarRol('admin'), actualizarRolUsuario);
router.put('/configuracion/usuarios/:id/estado', verificarRol('admin'), actualizarEstadoUsuario);

module.exports = router;
