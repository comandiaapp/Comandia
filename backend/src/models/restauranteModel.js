const pool = require('../config/database');

const CAMPOS_ACTUALIZABLES_CONFIGURACION = [
  'nombre',
  'telefono',
  'direccion',
  'logo_url',
  'nit',
  'regimen',
  'ciudad',
  'departamento',
  'porcentaje_impuesto',
  'porcentaje_propina_sugerida',
  'moneda',
  'zona_horaria',
  'modo_operacion',
  'permite_pedidos_sin_jornada',
  'impresora_configurada',
  'mensaje_ticket',
  'numero_resolucion_dian',
  'fecha_resolucion_dian',
  'prefijo_factura',
  'factura_desde',
  'factura_hasta',
];

async function crear(
  db,
  {
    id,
    nombre,
    email,
    telefono,
    direccion,
    ciudad,
    modo_operacion,
    plan,
    trial_expira,
    suscripcion_plan,
    codigo_acceso_usado,
    descuento_porcentaje,
  }
) {
  const { rows } = await db.query(
    `INSERT INTO restaurantes
       (id, nombre, email, telefono, direccion, ciudad, modo_operacion, plan, trial_expira, suscripcion_activa,
        suscripcion_plan, codigo_acceso_usado, descuento_porcentaje)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, 'todo_en_uno'), COALESCE($8, 'basico'), $9, true,
             COALESCE($10, 'trial'), $11, $12)
     RETURNING *`,
    [
      id,
      nombre,
      email,
      telefono || null,
      direccion || null,
      ciudad || null,
      modo_operacion || null,
      plan || null,
      trial_expira || null,
      suscripcion_plan || null,
      codigo_acceso_usado || null,
      descuento_porcentaje ?? null,
    ]
  );
  return rows[0];
}

async function buscarPorId(id) {
  const { rows } = await pool.query('SELECT * FROM restaurantes WHERE id = $1', [id]);
  return rows[0] || null;
}

async function buscarPorEmail(email) {
  const { rows } = await pool.query('SELECT * FROM restaurantes WHERE email = $1', [email]);
  return rows[0] || null;
}

async function obtenerConfiguracion(restauranteId) {
  return buscarPorId(restauranteId);
}

async function actualizarConfiguracion(restauranteId, datos) {
  const asignaciones = [];
  const valores = [];
  let i = 1;

  for (const campo of CAMPOS_ACTUALIZABLES_CONFIGURACION) {
    if (datos[campo] !== undefined) {
      asignaciones.push(`${campo} = $${i}`);
      valores.push(datos[campo]);
      i++;
    }
  }

  if (asignaciones.length === 0) {
    return buscarPorId(restauranteId);
  }

  asignaciones.push('updated_at = now()');
  valores.push(restauranteId);

  const { rows } = await pool.query(
    `UPDATE restaurantes SET ${asignaciones.join(', ')} WHERE id = $${i} RETURNING *`,
    valores
  );
  return rows[0] || null;
}

module.exports = { crear, buscarPorId, buscarPorEmail, obtenerConfiguracion, actualizarConfiguracion };
