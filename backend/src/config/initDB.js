const fs = require('fs');
const path = require('path');

const { v4: uuidv4 } = require('uuid');

const pool = require('./database');
const contaduriaModel = require('../models/contaduriaModel');

const EMAIL_RESTAURANTE_DEMO = 'demo@comandia.test';

// pedidos.numero (SERIAL) se renombró a numero_global (el correlativo real
// para DIAN); numero_jornada es el correlativo que ve el usuario y reinicia
// en cada jornada. Postgres no soporta "RENAME COLUMN IF EXISTS", así que la
// condición se resuelve consultando information_schema.
async function migrarNumeroPedidos() {
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'pedidos' AND column_name IN ('numero', 'numero_global')`
  );
  const columnas = rows.map((r) => r.column_name);

  if (columnas.includes('numero') && !columnas.includes('numero_global')) {
    await pool.query('ALTER TABLE pedidos RENAME COLUMN numero TO numero_global');
    console.log('  columna "pedidos.numero" renombrada a "numero_global"');
  }
}

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

  const salonPrincipalId = uuidv4();
  await pool.query('INSERT INTO areas (id, restaurante_id, nombre, orden) VALUES ($1, $2, $3, $4)', [
    salonPrincipalId,
    restauranteId,
    'Salón Principal',
    0,
  ]);
  console.log('  area "Salón Principal" creada');

  const terrazaId = uuidv4();
  await pool.query('INSERT INTO areas (id, restaurante_id, nombre, orden) VALUES ($1, $2, $3, $4)', [
    terrazaId,
    restauranteId,
    'Terraza',
    1,
  ]);
  console.log('  area "Terraza" creada');

  const estadosSalon = { 1: 'ocupada', 2: 'ocupada', 3: 'ocupada', 4: 'cuenta_pedida' };
  for (let numero = 1; numero <= 8; numero++) {
    await pool.query(
      `INSERT INTO mesas (id, restaurante_id, area_id, numero, capacidad, estado)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uuidv4(), restauranteId, salonPrincipalId, String(numero), 4, estadosSalon[numero] || 'libre']
    );
  }
  console.log('  8 mesas creadas en "Salón Principal"');

  for (let numero = 1; numero <= 4; numero++) {
    await pool.query(
      `INSERT INTO mesas (id, restaurante_id, area_id, numero, capacidad, estado)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uuidv4(), restauranteId, terrazaId, `T${numero}`, 6, 'libre']
    );
  }
  console.log('  4 mesas creadas en "Terraza"');

  const areaRemotaId = uuidv4();
  await pool.query('INSERT INTO areas (id, restaurante_id, nombre, es_remota, orden) VALUES ($1, $2, $3, $4, $5)', [
    areaRemotaId,
    restauranteId,
    'Pedidos remotos',
    true,
    999,
  ]);
  console.log('  area "Pedidos remotos" creada');

  await pool.query(
    `INSERT INTO mesas (id, restaurante_id, area_id, numero, capacidad)
     VALUES ($1, $2, $3, $4, $5)`,
    [uuidv4(), restauranteId, areaRemotaId, 'Domicilio-1', 1]
  );
  console.log('  1 mesa remota de ejemplo creada ("Domicilio-1")');

  const ingredientesSeed = [
    { nombre: 'Pan de hamburguesa', unidad_medida: 'unidad', stock_actual: 20, stock_minimo: 5 },
    { nombre: 'Carne de res 150g', unidad_medida: 'porcion', stock_actual: 15, stock_minimo: 5 },
    { nombre: 'Queso', unidad_medida: 'g', stock_actual: 500, stock_minimo: 100 },
    { nombre: 'Lechuga', unidad_medida: 'g', stock_actual: 300, stock_minimo: 50 },
    { nombre: 'Papa', unidad_medida: 'kg', stock_actual: 5, stock_minimo: 1 },
    { nombre: 'Limón', unidad_medida: 'unidad', stock_actual: 30, stock_minimo: 10 },
  ];

  const idsIngredientes = {};
  for (const ingrediente of ingredientesSeed) {
    const id = uuidv4();
    idsIngredientes[ingrediente.nombre] = id;
    await pool.query(
      `INSERT INTO ingredientes (id, restaurante_id, nombre, unidad_medida, stock_actual, stock_minimo)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, restauranteId, ingrediente.nombre, ingrediente.unidad_medida, ingrediente.stock_actual, ingrediente.stock_minimo]
    );
    console.log(`  ingrediente "${ingrediente.nombre}" creado`);
  }

  const { rows: hamburguesaRows } = await pool.query(
    `SELECT id FROM productos WHERE restaurante_id = $1 AND nombre = $2`,
    [restauranteId, 'Hamburguesa de Costilla']
  );
  if (hamburguesaRows.length > 0) {
    const productoId = hamburguesaRows[0].id;
    const recetaSeed = [
      { nombre: 'Pan de hamburguesa', cantidad: 1 },
      { nombre: 'Carne de res 150g', cantidad: 1 },
      { nombre: 'Queso', cantidad: 30 },
      { nombre: 'Lechuga', cantidad: 20 },
    ];
    for (const receta of recetaSeed) {
      await pool.query(
        `INSERT INTO recetas (id, restaurante_id, producto_id, ingrediente_id, cantidad)
         VALUES ($1, $2, $3, $4, $5)`,
        [uuidv4(), restauranteId, productoId, idsIngredientes[receta.nombre], receta.cantidad]
      );
    }
    console.log('  receta de "Hamburguesa de Costilla" creada');
  }

  await contaduriaModel.crearCategoriasDefault(pool, restauranteId);
  console.log('  categorías contables predeterminadas creadas');

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

  await migrarNumeroPedidos();

  for (const statement of statements) {
    await pool.query(statement);

    const tabla = statement.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
    if (tabla) {
      console.log(`  tabla "${tabla[1]}" lista`);
      continue;
    }

    const indice = statement.match(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS (\w+)/i);
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
