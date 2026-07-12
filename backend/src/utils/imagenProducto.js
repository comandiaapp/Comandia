const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const env = require('../config/env');

const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5MB, antes de reescalar
const ANCHO_MAXIMO = 800;
const PATRON_DATA_URL = /^data:image\/(jpeg|png|webp);base64,(.+)$/;

class ImagenInvalidaError extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.imagenInvalida = true;
  }
}

async function guardarImagenProducto(productoId, dataUrl, req) {
  const match = PATRON_DATA_URL.exec(dataUrl);
  if (!match) {
    throw new ImagenInvalidaError('La imagen debe ser jpg, png o webp');
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > TAMANO_MAXIMO_BYTES) {
    throw new ImagenInvalidaError('La imagen no puede pesar más de 5MB');
  }

  let redimensionada;
  try {
    redimensionada = await sharp(buffer)
      .resize({ width: ANCHO_MAXIMO, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new ImagenInvalidaError('No se pudo procesar la imagen');
  }

  fs.mkdirSync(env.uploadsDir, { recursive: true });
  const nombreArchivo = `${productoId}.webp`;
  fs.writeFileSync(path.join(env.uploadsDir, nombreArchivo), redimensionada);

  return `${req.protocol}://${req.get('host')}/uploads/productos/${nombreArchivo}`;
}

function eliminarImagenProducto(productoId) {
  fs.rm(path.join(env.uploadsDir, `${productoId}.webp`), { force: true }, () => {});
}

module.exports = { guardarImagenProducto, eliminarImagenProducto, ImagenInvalidaError };
