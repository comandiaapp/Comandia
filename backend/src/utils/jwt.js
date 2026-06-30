const jwt = require('jsonwebtoken');

const env = require('../config/env');

const EXPIRA_EN = '7d';

function generarToken(payload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: EXPIRA_EN });
}

function verificarTokenJWT(token) {
  return jwt.verify(token, env.jwtSecret);
}

module.exports = { generarToken, verificarTokenJWT };
