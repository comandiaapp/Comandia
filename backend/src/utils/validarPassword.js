const REGEX_MAYUSCULA = /[A-Z]/;
const REGEX_NUMERO = /[0-9]/;
const REGEX_ESPECIAL = /[!@#$%^&*]/;

// Se usa tanto en el registro público como en el reset de contraseña, así
// que el mensaje debe ser lo bastante específico para mostrarse tal cual
// al usuario en el formulario.
function validarPasswordFuerte(password) {
  if (!password || password.length < 8) {
    return 'La contraseña debe tener mínimo 8 caracteres';
  }
  if (!REGEX_MAYUSCULA.test(password)) {
    return 'La contraseña debe tener al menos una letra mayúscula';
  }
  if (!REGEX_NUMERO.test(password)) {
    return 'La contraseña debe tener al menos un número';
  }
  if (!REGEX_ESPECIAL.test(password)) {
    return 'La contraseña debe tener al menos un carácter especial (!@#$%^&*)';
  }
  return null;
}

module.exports = { validarPasswordFuerte };
