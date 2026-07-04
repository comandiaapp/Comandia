const express = require('express');

const {
  registro,
  login,
  me,
  verificarEmail,
  olvideMiPassword,
  resetPassword,
  reenviarVerificacion,
} = require('../controllers/authController');
const { verificarToken } = require('../middlewares/auth');

const router = express.Router();

router.post('/registro', registro);
router.post('/login', login);
router.get('/me', verificarToken, me);
router.get('/verificar-email', verificarEmail);
router.post('/olvide-password', olvideMiPassword);
router.post('/reset-password', resetPassword);
router.post('/reenviar-verificacion', verificarToken, reenviarVerificacion);

module.exports = router;
