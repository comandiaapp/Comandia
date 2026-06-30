const { verificarTokenJWT } = require('../utils/jwt');
const { error } = require('../utils/respuestas');

function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, 'Token no proporcionado', 401);
  }

  const token = authHeader.slice('Bearer '.length);

  try {
    const decoded = verificarTokenJWT(token);
    req.usuario = {
      userId: decoded.userId,
      restauranteId: decoded.restauranteId,
      sucursalId: decoded.sucursalId,
      rol: decoded.rol,
    };
    next();
  } catch (err) {
    return error(res, 'Token inválido o expirado', 401);
  }
}

function verificarRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return error(
        res,
        `No tienes permiso para realizar esta acción. Rol requerido: ${rolesPermitidos.join(', ')}`,
        403
      );
    }
    next();
  };
}

module.exports = { verificarToken, verificarRol };
