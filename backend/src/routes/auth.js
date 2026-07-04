const express = require('express');

const {
  registro,
  login,
  me,
  verificarEmail,
  olvideMiPassword,
  resetPassword,
  reenviarVerificacion,
  validarCodigoAcceso,
} = require('../controllers/authController');
const { verificarToken } = require('../middlewares/auth');

const router = express.Router();

router.post('/registro', registro);
router.post('/validar-codigo', validarCodigoAcceso);
router.post('/login', login);
router.get('/me', verificarToken, me);
router.get('/verificar-email', verificarEmail);
router.post('/olvide-password', olvideMiPassword);
router.post('/reset-password', resetPassword);
router.post('/reenviar-verificacion', verificarToken, reenviarVerificacion);

module.exports = router;
