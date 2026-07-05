import initSqlJs from 'sql.js';
import localforage from 'localforage';

const CLAVE_STORAGE = 'comandia_db';

class LocalDatabase {
  constructor() {
    this.db = null;
    this.initPromise = null;
  }

  // Varias partes de la app (contexto de conectividad, interceptor de axios,
  // páginas) pueden pedir la base al mismo tiempo durante el arranque; se
  // memoiza la promesa para que sql.js y la carga desde IndexedDB corran una
  // sola vez.
  async init() {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._init();
    return this.initPromise;
  }

  async _init() {
    const SQL = await initSqlJs({ locateFile: () => '/sql-wasm.wasm' });

    const guardado = await localforage.getItem(CLAVE_STORAGE);

    if (guardado) {
      this.db = new SQL.Database(new Uint8Array(guardado));
    } else {
      this.db = new SQL.Database();
    }

    this.crearEsquema();
    await this.guardar();

    return this;
  }

  crearEsquema() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS pedidos_local (
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
      );

      CREATE TABLE IF NOT EXISTS pedido_items_local (
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
      );

      -- Las tablas *_cache guardan el objeto completo tal como lo devuelve
      -- la API (columna "datos" en JSON) para no arriesgar divergencias de
      -- forma entre la copia local y la respuesta real del backend; "id" solo
      -- sirve para upsert e indexado.
      CREATE TABLE IF NOT EXISTS productos_cache (
        id TEXT PRIMARY KEY,
        datos TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS categorias_cache (
        id TEXT PRIMARY KEY,
        datos TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS mesas_cache (
        id TEXT PRIMARY KEY,
        area_id TEXT,
        datos TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS areas_cache (
        id TEXT PRIMARY KEY,
        datos TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        tabla TEXT NOT NULL,
        operacion TEXT NOT NULL,
        datos TEXT NOT NULL,
        intentos INTEGER DEFAULT 0,
        error TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS id_map (
        tipo TEXT NOT NULL,
        id_local TEXT NOT NULL,
        id_remoto TEXT NOT NULL,
        PRIMARY KEY (tipo, id_local)
      );

      CREATE TABLE IF NOT EXISTS config_local (
        clave TEXT PRIMARY KEY,
        valor TEXT
      );
    `);
  }

  async guardar() {
    const data = this.db.export();
    await localforage.setItem(CLAVE_STORAGE, Array.from(data));
  }

  ejecutar(sql, params = []) {
    this.db.run(sql, params);
  }

  consultar(sql, params = []) {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const filas = [];
    while (stmt.step()) {
      filas.push(stmt.getAsObject());
    }
    stmt.free();
    return filas;
  }

  consultarUno(sql, params = []) {
    return this.consultar(sql, params)[0] || null;
  }
}

export const localDb = new LocalDatabase();
export default localDb;
