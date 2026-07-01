const pool = require('../config/database');

const CAMPOS_ACTUALIZABLES = [
  'categoria_id',
  'nombre',
  'descripcion',
  'imagen_url',
  'precio',
  'costo',
  'tipo',
  'disponible',
  'disponible_para',
  'tiempo_preparacion',
  'orden',
  'activo',
];

async function crear({
  id,
  restaurante_id,
  categoria_id,
  nombre,
  descripcion,
  imagen_url,
  precio,
  costo,
  tipo,
  disponible,
  disponible_para,
  tiempo_preparacion,
  orden,
}) {
  const { rows } = await pool.query(
    `INSERT INTO productos (
       id, restaurante_id, categoria_id, nombre, descripcion, imagen_url,
       precio, costo, tipo, disponible, disponible_para, tiempo_preparacion, orden
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      id,
      restaurante_id,
      categoria_id ?? null,
      nombre,
      descripcion ?? null,
      imagen_url ?? null,
      precio,
      costo ?? null,
      tipo ?? 'producto',
      disponible ?? true,
      disponible_para ?? 'todos',
      tiempo_preparacion ?? null,
      orden ?? 0,
    ]
  );
  return rows[0];
}

async function obtenerTodos(restauranteId, filtros = {}) {
  const condiciones = ['restaurante_id = $1', 'activo = true'];
  const valores = [restauranteId];
  let i = 2;

  if (filtros.categoria_id !== undefined) {
    condiciones.push(`categoria_id = $${i}`);
    valores.push(filtros.categoria_id);
    i++;
  }
  if (filtros.disponible !== undefined) {
    condiciones.push(`disponible = $${i}`);
    valores.push(filtros.disponible);
    i++;
  }
  if (filtros.tipo !== undefined) {
    condiciones.push(`tipo = $${i}`);
    valores.push(filtros.tipo);
    i++;
  }
  if (filtros.disponible_para !== undefined) {
    condiciones.push(`disponible_para = $${i}`);
    valores.push(filtros.disponible_para);
    i++;
  }

  const { rows } = await pool.query(
    `SELECT * FROM productos WHERE ${condiciones.join(' AND ')} ORDER BY orden ASC, nombre ASC`,
    valores
  );

  if (rows.length === 0) {
    return rows;
  }

  // El POS necesita saber, por producto, si tiene grupos de modificadores
  // (para decidir si abre el modal de personalización). Se trae en un solo
  // query adicional en lugar de uno por producto.
  const idsProductos = rows.map((producto) => producto.id);
  const { rows: modificadoresPorProducto } = await pool.query(
    `SELECT pm.producto_id, g.id, g.nombre, g.requerido, g.seleccion_multiple, g.minimo, g.maximo,
            COALESCE(
              jsonb_agg(
                jsonb_build_object('id', o.id, 'nombre', o.nombre, 'precio_extra', o.precio_extra)
                ORDER BY o.orden ASC
              ) FILTER (WHERE o.id IS NOT NULL),
              '[]'::jsonb
            ) AS opciones
     FROM productos_modificadores pm
     JOIN modificadores_grupo g ON g.id = pm.grupo_id AND g.activo = true
     LEFT JOIN modificadores_opciones o ON o.grupo_id = g.id AND o.activo = true
     WHERE pm.producto_id = ANY($1::uuid[])
     GROUP BY pm.producto_id, g.id
     ORDER BY g.nombre ASC`,
    [idsProductos]
  );

  const modificadoresPorId = new Map();
  for (const fila of modificadoresPorProducto) {
    const lista = modificadoresPorId.get(fila.producto_id) || [];
    lista.push({
      id: fila.id,
      nombre: fila.nombre,
      requerido: fila.requerido,
      seleccion_multiple: fila.seleccion_multiple,
      minimo: fila.minimo,
      maximo: fila.maximo,
      opciones: fila.opciones,
    });
    modificadoresPorId.set(fila.producto_id, lista);
  }

  return rows.map((producto) => ({
    ...producto,
    modificadores: modificadoresPorId.get(producto.id) || [],
  }));
}

async function obtenerPorId(id, restauranteId) {
  const { rows } = await pool.query(
    `SELECT p.*,
            CASE WHEN c.id IS NOT NULL
              THEN jsonb_build_object('id', c.id, 'nombre', c.nombre, 'color', c.color)
              ELSE NULL
            END AS categoria
     FROM productos p
     LEFT JOIN categorias c ON c.id = p.categoria_id
     WHERE p.id = $1 AND p.restaurante_id = $2`,
    [id, restauranteId]
  );

  const producto = rows[0];
  if (!producto) {
    return null;
  }

  const { rows: modificadores } = await pool.query(
    `SELECT g.id, g.nombre, g.requerido, g.seleccion_multiple, g.minimo, g.maximo,
            COALESCE(
              jsonb_agg(
                jsonb_build_object('id', o.id, 'nombre', o.nombre, 'precio_extra', o.precio_extra)
                ORDER BY o.orden ASC
              ) FILTER (WHERE o.id IS NOT NULL),
              '[]'::jsonb
            ) AS opciones
     FROM productos_modificadores pm
     JOIN modificadores_grupo g ON g.id = pm.grupo_id
     LEFT JOIN modificadores_opciones o ON o.grupo_id = g.id AND o.activo = true
     WHERE pm.producto_id = $1 AND g.activo = true
     GROUP BY g.id
     ORDER BY g.nombre ASC`,
    [id]
  );

  producto.modificadores = modificadores;
  return producto;
}

async function actualizar(id, restauranteId, datos) {
  const asignaciones = [];
  const valores = [];
  let i = 1;

  for (const campo of CAMPOS_ACTUALIZABLES) {
    if (datos[campo] !== undefined) {
      asignaciones.push(`${campo} = $${i}`);
      valores.push(datos[campo]);
      i++;
    }
  }

  if (asignaciones.length === 0) {
    return obtenerPorId(id, restauranteId);
  }

  asignaciones.push('updated_at = now()');
  valores.push(id, restauranteId);

  const { rows } = await pool.query(
    `UPDATE productos SET ${asignaciones.join(', ')}
     WHERE id = $${i} AND restaurante_id = $${i + 1}
     RETURNING *`,
    valores
  );
  return rows[0] || null;
}

async function eliminar(id, restauranteId) {
  const { rows } = await pool.query(
    `UPDATE productos SET activo = false, updated_at = now()
     WHERE id = $1 AND restaurante_id = $2
     RETURNING *`,
    [id, restauranteId]
  );
  return rows[0] || null;
}

async function obtenerMenu(restauranteId) {
  const { rows: categorias } = await pool.query(
    `SELECT id, nombre, descripcion, imagen_url, color, orden
     FROM categorias
     WHERE restaurante_id = $1 AND activa = true
     ORDER BY orden ASC`,
    [restauranteId]
  );

  const { rows: productos } = await pool.query(
    `SELECT id, categoria_id, nombre, descripcion, imagen_url, precio,
            tipo, disponible_para, tiempo_preparacion, orden
     FROM productos
     WHERE restaurante_id = $1 AND activo = true AND disponible = true
     ORDER BY orden ASC, nombre ASC`,
    [restauranteId]
  );

  return categorias.map((categoria) => ({
    ...categoria,
    productos: productos.filter((producto) => producto.categoria_id === categoria.id),
  }));
}

module.exports = { crear, obtenerTodos, obtenerPorId, actualizar, eliminar, obtenerMenu };
