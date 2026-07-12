import localforage from 'localforage';

const CLAVE_STORAGE = 'comandia_db';

// En Tauri v2 __TAURI_INTERNALS__ siempre está inyectado; __TAURI__ solo si
// withGlobalTauri está activo. Se chequean ambos por si cambia la config.
const esTauri =
  typeof window !== 'undefined' &&
  (window.__TAURI__ !== undefined || window.__TAURI_INTERNALS__ !== undefined);

// Un statement por entrada: el plugin SQL de Tauri (sqlx) prepara cada
// execute() y no admite varios statements en una sola llamada.
const ESQUEMA = [
  `CREATE TABLE IF NOT EXISTS pedidos_local (
    id TEXT PRIMARY KEY,
    mesa_id TEXT,
    numero_jornada INTEGER,
    tipo TEXT DEFAULT 'mesa',
    estado TEXT DEFAULT 'abierto',
    subtotal REAL DEFAULT 0,
    total REAL DEFAULT 0,
    descuento REAL DEFAULT 0,
    impuesto REAL DEFAULT 0,
    propina REAL DEFAULT 0,
    notas TEXT,
    creado_offline INTEGER DEFAULT 0,
    sincronizado INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS pedido_items_local (
    id TEXT PRIMARY KEY,
    pedido_id TEXT,
    producto_id TEXT,
    nombre_producto TEXT NOT NULL,
    precio_unitario REAL NOT NULL,
    cantidad INTEGER DEFAULT 1,
    subtotal REAL NOT NULL,
    notas TEXT,
    modificadores TEXT DEFAULT '[]',
    estado TEXT DEFAULT 'pendiente',
    creado_offline INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
  )`,

  // Las tablas *_cache guardan el objeto completo tal como lo devuelve
  // la API (columna "datos" en JSON) para no arriesgar divergencias de
  // forma entre la copia local y la respuesta real del backend; "id" solo
  // sirve para upsert e indexado.
  `CREATE TABLE IF NOT EXISTS productos_cache (
    id TEXT PRIMARY KEY,
    datos TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS categorias_cache (
    id TEXT PRIMARY KEY,
    datos TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS mesas_cache (
    id TEXT PRIMARY KEY,
    area_id TEXT,
    datos TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS areas_cache (
    id TEXT PRIMARY KEY,
    datos TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY,
    tabla TEXT NOT NULL,
    operacion TEXT NOT NULL,
    datos TEXT NOT NULL,
    intentos INTEGER DEFAULT 0,
    error TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE TABLE IF NOT EXISTS id_map (
    tipo TEXT NOT NULL,
    id_local TEXT NOT NULL,
    id_remoto TEXT NOT NULL,
    PRIMARY KEY (tipo, id_local)
  )`,

  `CREATE TABLE IF NOT EXISTS config_local (
    clave TEXT PRIMARY KEY,
    valor TEXT
  )`,
];

// Adaptador con una sola interfaz async sobre dos motores: SQLite nativo
// (plugin SQL de Tauri) en la app de escritorio, sql.js (WASM) persistido en
// IndexedDB como fallback en el navegador. Mismo esquema y mismas consultas
// en ambos; los consumidores no saben sobre qué motor corren.
class LocalDatabase {
  constructor() {
    this.db = null;
    this.esTauri = esTauri;
    this.initPromise = null;
  }

  // Varias partes de la app (contexto de conectividad, interceptor de axios,
  // páginas) pueden pedir la base al mismo tiempo durante el arranque; se
  // memoiza la promesa para que la carga corra una sola vez.
  async init() {
    if (this.initPromise) return this.initPromise;
    // Si la apertura falla (p. ej. no carga el WASM) se descarta la promesa
    // para que el próximo init() reintente en vez de quedar roto para siempre.
    this.initPromise = this._init().catch((err) => {
      this.initPromise = null;
      throw err;
    });
    return this.initPromise;
  }

  async _init() {
    if (this.esTauri) {
      // Import dinámico: el bundle web no necesita el plugin de Tauri.
      const { default: Database } = await import('@tauri-apps/plugin-sql');
      this.db = await Database.load('sqlite:comandia.db');
      for (const sql of ESQUEMA) {
        await this.db.execute(sql);
      }
      await this._migrar();
      return this;
    }

    const { default: initSqlJs } = await import('sql.js');
    const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });

    const guardado = await localforage.getItem(CLAVE_STORAGE);
    this.db = guardado ? new SQL.Database(new Uint8Array(guardado)) : new SQL.Database();

    for (const sql of ESQUEMA) {
      this.db.run(sql);
    }
    await this._migrar();
    await this.guardar();

    return this;
  }

  // SQLite (ambos motores) no soporta ADD COLUMN IF NOT EXISTS de forma
  // portable entre sqlx (Tauri) y sql.js; se intenta agregar y se ignora el
  // error si la columna ya existe.
  async _migrar() {
    const alteraciones = [
      `ALTER TABLE productos_cache ADD COLUMN sincronizado INTEGER DEFAULT 1`,
      `ALTER TABLE productos_cache ADD COLUMN creado_offline INTEGER DEFAULT 0`,
    ];
    for (const sql of alteraciones) {
      try {
        await this.ejecutar(sql);
      } catch (err) {
        if (!/duplicate column/i.test(err.message || '')) throw err;
      }
    }
  }

  // En Tauri la persistencia es nativa (archivo comandia.db); guardar() solo
  // existe para el motor sql.js, que vive en memoria y se vuelca a IndexedDB.
  async guardar() {
    if (this.esTauri) return;
    const data = this.db.export();
    await localforage.setItem(CLAVE_STORAGE, Array.from(data));
  }

  async ejecutar(sql, params = []) {
    if (this.esTauri) return this.db.execute(sql, params);
    this.db.run(sql, params);
  }

  async consultar(sql, params = []) {
    if (this.esTauri) return this.db.select(sql, params);

    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const filas = [];
    while (stmt.step()) {
      filas.push(stmt.getAsObject());
    }
    stmt.free();
    return filas;
  }

  async consultarUno(sql, params = []) {
    const filas = await this.consultar(sql, params);
    return filas[0] || null;
  }
}

export const localDb = new LocalDatabase();
export default localDb;
