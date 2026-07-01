const fs = require('fs');
const path = require('path');

const { v4: uuidv4 } = require('uuid');

const pool = require('./database');

const EMAIL_RESTAURANTE_DEMO = 'demo@comandia.test';

async function seedDatosEjemplo() {
  const { rows: existentes } = await pool.query('SELECT id FROM restaurantes WHERE email = $1', [
    EMAIL_RESTAURANTE_DEMO,
  ]);

  if (existentes.length > 0) {
    console.log('\nLos datos de ejemplo ya existen, se omite el seed.');
    return;
  }

  console.log('\nInsertando datos de ejemplo...');

  const restauranteId = uuidv4();
  await pool.query('INSERT INTO restaurantes (id, nombre, email) VALUES ($1, $2, $3)', [
    restauranteId,
    'Restaurante Demo',
    EMAIL_RESTAURANTE_DEMO,
  ]);
  console.log('  restaurante "Restaurante Demo" creado');

  const nombresCategorias = ['Entradas', 'Platos Fuertes', 'Bebidas', 'Postres'];
  const idsCategorias = {};

  for (let i = 0; i < nombresCategorias.length; i++) {
    const id = uuidv4();
    idsCategorias[nombresCategorias[i]] = id;
    await pool.query('INSERT INTO categorias (id, restaurante_id, nombre, orden) VALUES ($1, $2, $3, $4)', [
      id,
      restauranteId,
      nombresCategorias[i],
      i,
    ]);
    console.log(`  categoria "${nombresCategorias[i]}" creada`);
  }

  const productosPlatosFuertes = [
    { nombre: 'Lomo Saltado', descripcion: 'Clásico salteado peruano con papas fritas y arroz', precio: 45.0 },
    { nombre: 'Arroz con Pollo', descripcion: 'Arroz verde con pollo y salsa criolla', precio: 32.0 },
    { nombre: 'Ají de Gallina', descripcion: 'Pollo deshilachado en salsa de ají amarillo', precio: 30.0 },
  ];

  const idsProductos = [];
  for (const producto of productosPlatosFuertes) {
    const id = uuidv4();
    idsProductos.push(id);
    await pool.query(
      `INSERT INTO productos (id, restaurante_id, categoria_id, nombre, descripcion, precio)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, restauranteId, idsCategorias['Platos Fuertes'], producto.nombre, producto.descripcion, producto.precio]
    );
    console.log(`  producto "${producto.nombre}" creado`);
  }

  const grupoId = uuidv4();
  await pool.query(
    `INSERT INTO modificadores_grupo (id, restaurante_id, nombre, requerido, seleccion_multiple, minimo, maximo)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [grupoId, restauranteId, 'Término de cocción', true, false, 1, 1]
  );
  console.log('  grupo de modificadores "Término de cocción" creado');

  const opciones = ['Término 3/4', 'Término medio', 'Bien cocido'];
  for (let i = 0; i < opciones.length; i++) {
    await pool.query(
      `INSERT INTO modificadores_opciones (id, grupo_id, restaurante_id, nombre, orden)
       VALUES ($1, $2, $3, $4, $5)`,
      [uuidv4(), grupoId, restauranteId, opciones[i], i]
    );
    console.log(`    opción "${opciones[i]}" creada`);
  }

  await pool.query('INSERT INTO productos_modificadores (producto_id, grupo_id) VALUES ($1, $2)', [
    idsProductos[0],
    grupoId,
  ]);

  console.log('\nDatos de ejemplo insertados correctamente.');
}

async function initDB() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  const statements = schema
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

  console.log('Inicializando base de datos de Comandia...\n');

  for (const statement of statements) {
    await pool.query(statement);

    const tabla = statement.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
    if (tabla) {
      console.log(`  tabla "${tabla[1]}" lista`);
      continue;
    }

    const indice = statement.match(/CREATE INDEX IF NOT EXISTS (\w+)/i);
    if (indice) {
      console.log(`  indice "${indice[1]}" listo`);
    }
  }

  console.log('\nBase de datos inicializada correctamente.');

  await seedDatosEjemplo();
}

initDB()
  .catch((err) => {
    console.error('Error al inicializar la base de datos:', err.message || err.code || err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

module.exports = initDB;
