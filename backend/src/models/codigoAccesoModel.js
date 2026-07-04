const { v4: uuidv4 } = require('uuid');

const pool = require('../config/database');

async function buscarPorCodigo(codigo, db = pool) {
  const { rows } = await db.query('SELECT * FROM codigos_acceso WHERE codigo = $1', [codigo]);
  return rows[0] || null;
}

// Verifica que el código exista, esté activo, no haya expirado y no haya
// alcanzado su tope de usos. No lo consume: solo lo valida (usado tanto por
// el preview de /validar-codigo como por el registro antes de canjearlo).
async function validarCodigo(codigo, db = pool) {
  const encontrado = await buscarPorCodigo(codigo, db);

  if (!encontrado) {
    return { valido: false, mensaje: 'Código inválido', codigo: null };
  }

  if (!encontrado.activo) {
    return { valido: false, mensaje: 'Este código ya no está activo', codigo: null };
  }

  if (encontrado.expira_at && new Date(encontrado.expira_at) < new Date()) {
    return { valido: false, mensaje: 'Este código expiró', codigo: null };
  }

  if (encontrado.usos_actuales >= encontrado.usos_maximos) {
    return { valido: false, mensaje: 'Este código ya alcanzó su límite de usos', codigo: null };
  }

  return { valido: true, mensaje: 'Código válido', codigo: encontrado };
}

// Incrementa usos_actuales de forma atómica y solo si sigue habiendo cupo,
// para evitar que dos registros concurrentes exceedan usos_maximos.
// restauranteId no se persiste hoy (no hay tabla de auditoría de canjes) pero
// se recibe para dejar la puerta abierta a loguear quién canjeó cada código.
async function usarCodigo(codigo, restauranteId, db = pool) {
  const { rows } = await db.query(
    `UPDATE codigos_acceso
     SET usos_actuales = usos_actuales + 1
     WHERE codigo = $1 AND activo = true AND usos_actuales < usos_maximos
     RETURNING *`,
    [codigo]
  );
  return rows[0] || null;
}

async function crearCodigo({
  codigo,
  tipo = 'descuento',
  descuento_porcentaje,
  trial_dias_extra = 0,
  descripcion,
  usos_maximos = 1,
  expira_at,
}) {
  const { rows } = await pool.query(
    `INSERT INTO codigos_acceso
       (id, codigo, tipo, descuento_porcentaje, trial_dias_extra, descripcion, usos_maximos, expira_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      uuidv4(),
      codigo,
      tipo,
      descuento_porcentaje ?? null,
      trial_dias_extra ?? 0,
      descripcion || null,
      usos_maximos ?? 1,
      expira_at || null,
    ]
  );
  return rows[0];
}

module.exports = { buscarPorCodigo, validarCodigo, usarCodigo, crearCodigo };
