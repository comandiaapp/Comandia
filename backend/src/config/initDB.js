const fs = require('fs');
const path = require('path');

const pool = require('./database');

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
}

initDB()
  .catch((err) => {
    console.error('Error al inicializar la base de datos:', err.message || err.code || err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

module.exports = initDB;
