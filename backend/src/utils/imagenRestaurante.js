const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const env = require('../config/env');

// Mismo patrón que utils/imagenProducto.js (validar data URL, redimensionar
// con sharp, guardar en disco), en su propia carpeta para no mezclar logos
// de restaurante con fotos de producto.
const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024;
const ANCHO_MAXIMO = 400;
const PATRON_DATA_URL = /^data:image\/(jpeg|png|webp);base64,(.+)$/;
const CARPETA = path.join(env.uploadsDir, 'restaurantes');

class ImagenInvalidaError extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.imagenInvalida = true;
  }
}

async function guardarImagenLogo(restauranteId, dataUrl, req) {
  const match = PATRON_DATA_URL.exec(dataUrl);
  if (!match) {
    throw new ImagenInvalidaError('El logo debe ser jpg, png o webp');
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > TAMANO_MAXIMO_BYTES) {
    throw new ImagenInvalidaError('El logo no puede pesar más de 5MB');
  }

  let redimensionada;
  try {
    redimensionada = await sharp(buffer)
      .resize({ width: ANCHO_MAXIMO, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new ImagenInvalidaError('No se pudo procesar el logo');
  }

  fs.mkdirSync(CARPETA, { recursive: true });
  const nombreArchivo = `${restauranteId}.webp`;
  fs.writeFileSync(path.join(CARPETA, nombreArchivo), redimensionada);

  return `${req.protocol}://${req.get('host')}/uploads/restaurantes/${nombreArchivo}`;
}

function eliminarImagenLogo(restauranteId) {
  fs.rm(path.join(CARPETA, `${restauranteId}.webp`), { force: true }, () => {});
}

module.exports = { guardarImagenLogo, eliminarImagenLogo, ImagenInvalidaError };
