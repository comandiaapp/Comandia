const express = require('express');

const {
  abrirJornada,
  obtenerJornadaActual,
  cerrarJornada,
  reabrirJornada,
  historialJornadas,
} = require('../controllers/jornadaController');
const { verificarToken, verificarRol } = require('../middlewares/auth');

const router = express.Router();

router.use(verificarToken);

router.get('/jornadas/actual', obtenerJornadaActual);
router.post('/jornadas/abrir', verificarRol('cajero', 'gerente', 'admin'), abrirJornada);
router.post('/jornadas/cerrar', verificarRol('cajero', 'gerente', 'admin'), cerrarJornada);
router.post('/jornadas/reabrir', verificarRol('gerente', 'admin'), reabrirJornada);
router.get('/jornadas/historial', verificarRol('gerente', 'admin'), historialJornadas);

module.exports = router;
