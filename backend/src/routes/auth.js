const express = require('express');

const { registro, login, me } = require('../controllers/authController');
const { verificarToken } = require('../middlewares/auth');

const router = express.Router();

router.post('/registro', registro);
router.post('/login', login);
router.get('/me', verificarToken, me);

module.exports = router;
