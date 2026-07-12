# Foto de producto en Menú (con soporte offline) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir subir una foto de producto desde Menú (crear/editar), verla en preview y en la tarjeta de producto, y que se vea en el POS — funcionando también sin conexión.

**Architecture:** El frontend redimensiona la imagen a un data URL (jpeg) con `Canvas` nativo antes de enviarla como campo `imagen_base64` dentro del mismo body JSON de crear/editar producto (no hay endpoint ni multipart separados). El backend, dentro del mismo request de `crear`/`actualizar`, decodifica ese base64, la redimensiona/reencodea a webp con `sharp`, la guarda en un volumen persistente de Railway (servido como estático) y persiste la URL resultante en `imagen_url`. Offline, `productos_cache` (SQLite local, ambos motores) gana una fila editable con bandera `sincronizado`, siguiendo el mismo patrón `sync_queue` + `id_map` que ya usan los pedidos.

**Tech Stack:** Express + `sharp` (backend), React + `Canvas` API nativa (frontend), SQLite local dual-motor ya existente (`@tauri-apps/plugin-sql` / `sql.js`).

## Global Constraints

- Todo el código, UI y mensajes en español (convención del proyecto).
- Storage de imágenes: volumen persistente de Railway montado en el backend — no se agrega SDK de S3/Cloudinary. El path se lee de `UPLOADS_DIR` (env var), default `backend/uploads`.
- Sin `multer` ni multipart/form-data: la imagen viaja como data URL base64 dentro del JSON normal (`express.json()`), igual que el resto de la API.
- Redimensionar en frontend (Canvas nativo, sin dependencia) antes de guardar localmente, y en backend con `sharp` (nueva dependencia, única) antes de persistir — ancho máx. 800px.
- Tipos permitidos: jpeg, png, webp. Tamaño máx. de subida: 5MB (antes de reescalar).
- Nombre de archivo determinístico `${producto_id}.webp` — reemplazar la foto sobreescribe el archivo anterior, no quedan huérfanos al editar (sí puede quedar un huérfano al eliminar un producto — deuda conocida, fuera de alcance).
- El proyecto **no tiene test runner configurado** (ni backend ni frontend). Las verificaciones de este plan son manuales (curl + navegador/dev server), como indica `CLAUDE.md`. No se introduce un framework de testing como parte de esta feature.
- Spec de referencia: `docs/superpowers/specs/2026-07-12-imagen-producto-design.md`.

---

### Task 1: Backend — infraestructura de almacenamiento

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/src/config/env.js`
- Modify: `backend/.env.example`
- Modify: `backend/server.js`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `env.uploadsDir` (string, path absoluto a la carpeta de uploads), estático servido en `GET /uploads/productos/<archivo>`, `express.json()` con límite `8mb`.

- [ ] **Step 1: Instalar `sharp`**

Run: `cd backend && npm install sharp`
Expected: se agrega `"sharp": "^X.Y.Z"` a `backend/package.json` bajo `dependencies`, y `backend/package-lock.json` se actualiza.

- [ ] **Step 2: Agregar `uploadsDir` a la config de entorno**

Modifica `backend/src/config/env.js` completo:

```js
const path = require('path');

require('dotenv').config();

const env = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  brevoApiKey: process.env.BREVO_API_KEY,
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  mpAccessToken: process.env.MP_ACCESS_TOKEN,
  mpWebhookSecret: process.env.MP_WEBHOOK_SECRET,
  uploadsDir: process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads'),
};

module.exports = env;
```

- [ ] **Step 3: Documentar la variable en `.env.example`**

Agrega al final de `backend/.env.example`:

```
# Carpeta donde se guardan las fotos de producto subidas. En Railway debe
# apuntar al mount path de un volumen persistente montado en este servicio;
# si no se configura, cae a ./uploads dentro del contenedor y las fotos se
# pierden en cada redeploy (el filesystem del contenedor es efímero).
UPLOADS_DIR=./uploads
```

- [ ] **Step 4: Servir el volumen como estático y subir el límite de `express.json`**

En `backend/server.js`, reemplaza:

```js
app.use(cors());
app.use(express.json());
```

por:

```js
app.use(cors());
app.use(express.json({ limit: '8mb' }));
```

Y justo después de `app.use('/api', routes);` agrega:

```js
app.use('/uploads/productos', express.static(env.uploadsDir));
```

(`env` ya está importado en la línea 6 de `server.js`.)

- [ ] **Step 5: Ignorar la carpeta de uploads en git**

Agrega a `.gitignore` (raíz del repo), junto a la sección de SQLite local:

```
# Fotos de producto subidas en desarrollo local (en prod viven en el volumen de Railway)
backend/uploads/
```

- [ ] **Step 6: Verificar manualmente**

Run: `cd backend && npm run dev`
Expected en consola: `Comandia backend corriendo en http://localhost:<puerto>` sin errores. La carpeta `backend/uploads/` no necesita existir todavía (se crea en el Task 2 al primer guardado).

- [ ] **Step 7: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/config/env.js backend/.env.example backend/server.js .gitignore
git commit -m "feat: agregar infraestructura de storage para fotos de producto"
```

---

### Task 2: Backend — procesar y guardar la imagen en crear/editar producto

**Files:**
- Create: `backend/src/utils/imagenProducto.js`
- Modify: `backend/src/controllers/productoController.js`

**Interfaces:**
- Consumes: `env.uploadsDir` (Task 1).
- Produces: `guardarImagenProducto(productoId, dataUrl, req) => Promise<string urlAbsoluta>` (lanza `ImagenInvalidaError` si el formato/tamaño no es válido), `eliminarImagenProducto(productoId) => void`. Usados por `productoController.crear`/`actualizar`. El body de `POST/PUT /api/productos(/:id)` acepta un campo opcional `imagen_base64`: un data URL (`data:image/<jpeg|png|webp>;base64,...`) para setear/reemplazar la foto, o `''` (string vacío) para quitarla.

- [ ] **Step 1: Crear el helper de guardado de imagen**

Crea `backend/src/utils/imagenProducto.js`:

```js
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
```

- [ ] **Step 2: Verificar el helper manualmente con un script**

Run (desde `backend/`):

```bash
node -e "
const { guardarImagenProducto } = require('./src/utils/imagenProducto');
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const dataUrl = 'data:image/png;base64,' + pixel.toString('base64');
const reqFalso = { protocol: 'http', get: () => 'localhost:4000' };
guardarImagenProducto('test-id', dataUrl, reqFalso).then((url) => {
  console.log('OK:', url);
  const fs = require('fs');
  if (!fs.existsSync('./uploads/test-id.webp')) throw new Error('No se escribió el archivo');
  fs.unlinkSync('./uploads/test-id.webp');
  console.log('Archivo verificado y limpiado');
}).catch((e) => { console.error('FALLÓ:', e); process.exit(1); });
"
```

Expected: imprime `OK: http://localhost:4000/uploads/productos/test-id.webp` y `Archivo verificado y limpiado`, sin lanzar error.

- [ ] **Step 3: Conectar el helper a `crear`**

En `backend/src/controllers/productoController.js`, agrega el import junto a los existentes:

```js
const { guardarImagenProducto, eliminarImagenProducto } = require('../utils/imagenProducto');
```

Reemplaza toda la función `crear` por:

```js
async function crear(req, res) {
  const {
    categoria_id,
    nombre,
    descripcion,
    imagen_url,
    imagen_base64,
    precio,
    costo,
    tipo,
    disponible,
    disponible_para,
    tiempo_preparacion,
    orden,
  } = req.body;

  if (!nombre || precio === undefined || precio === null) {
    return error(res, 'El nombre y el precio del producto son obligatorios', 400);
  }

  try {
    const id = uuidv4();
    const urlImagen = imagen_base64 ? await guardarImagenProducto(id, imagen_base64, req) : imagen_url;

    const producto = await productoModel.crear({
      id,
      restaurante_id: req.usuario.restauranteId,
      categoria_id,
      nombre,
      descripcion,
      imagen_url: urlImagen,
      precio,
      costo,
      tipo,
      disponible,
      disponible_para,
      tiempo_preparacion,
      orden,
    });

    return ok(res, { producto: serializar(producto, req.usuario.rol) }, 201);
  } catch (err) {
    if (err.imagenInvalida) {
      return error(res, err.message, 400);
    }
    console.error('Error al crear producto:', err);
    return error(res, 'No se pudo crear el producto', 500);
  }
}
```

- [ ] **Step 4: Conectar el helper a `actualizar`**

Reemplaza toda la función `actualizar` por:

```js
async function actualizar(req, res) {
  try {
    const { imagen_base64, ...datos } = req.body;

    if (imagen_base64) {
      datos.imagen_url = await guardarImagenProducto(req.params.id, imagen_base64, req);
    } else if (imagen_base64 === '') {
      datos.imagen_url = null;
      eliminarImagenProducto(req.params.id);
    }

    const producto = await productoModel.actualizar(req.params.id, req.usuario.restauranteId, datos);
    if (!producto) {
      return error(res, 'Producto no encontrado', 404);
    }
    return ok(res, { producto: serializar(producto, req.usuario.rol) });
  } catch (err) {
    if (err.imagenInvalida) {
      return error(res, err.message, 400);
    }
    console.error('Error al actualizar producto:', err);
    return error(res, 'No se pudo actualizar el producto', 500);
  }
}
```

- [ ] **Step 5: Verificar manualmente contra el servidor real**

Run: `cd backend && npm run dev` (dejar corriendo), en otra terminal (ajustar el token a uno válido de un usuario admin/gerente del demo seed):

```bash
TOKEN="<pega aquí un JWT válido de admin o gerente>"
curl -s -X POST http://localhost:4000/api/productos \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"nombre":"Test foto","precio":10000,"imagen_base64":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="}'
```

Expected: respuesta `{"ok":true,"datos":{"producto":{...,"imagen_url":"http://localhost:4000/uploads/productos/<id>.webp",...}}}`. Luego:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "<imagen_url del paso anterior>"
```

Expected: `200`.

Prueba también el rechazo de formato inválido:

```bash
curl -s -X POST http://localhost:4000/api/productos \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"nombre":"Test invalido","precio":1000,"imagen_base64":"no-es-una-imagen"}'
```

Expected: `{"error":true,"mensaje":"La imagen debe ser jpg, png o webp"}` con status 400.

- [ ] **Step 6: Commit**

```bash
git add backend/src/utils/imagenProducto.js backend/src/controllers/productoController.js
git commit -m "feat: procesar y guardar foto de producto al crear/editar"
```

---

### Task 3: Frontend — formulario, preview y tarjeta de producto (flujo online)

**Files:**
- Create: `frontend/src/utils/imagenLocal.js`
- Modify: `frontend/src/pages/Menu.jsx`

**Interfaces:**
- Produces: `redimensionarImagen(archivo: File, anchoMaximo?: number, calidad?: number) => Promise<string dataUrlJpeg>`.
- Consumes: `crearProducto`/`actualizarProducto` de `frontend/src/utils/productos.js` (sin cambios — ya reenvían el body tal cual), backend del Task 2 (acepta `imagen_base64`).

- [ ] **Step 1: Crear el helper de redimensionado (Canvas nativo)**

Crea `frontend/src/utils/imagenLocal.js`:

```js
const ANCHO_MAXIMO = 800;
const CALIDAD = 0.82;

// Redimensiona una imagen en el navegador con Canvas (nativo, sin
// dependencias — funciona igual en el WebView de Tauri) y la devuelve como
// data URL jpeg. Evita que un archivo sin comprimir (foto de celular, varios
// MB) infle la base local o la sync_queue mientras el producto está
// pendiente de sincronizar.
export function redimensionarImagen(archivo, anchoMaximo = ANCHO_MAXIMO, calidad = CALIDAD) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se pudo leer el archivo'));
    lector.onload = () => {
      const imagen = new Image();
      imagen.onerror = () => reject(new Error('El archivo no es una imagen válida'));
      imagen.onload = () => {
        const escala = Math.min(1, anchoMaximo / imagen.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(imagen.width * escala);
        canvas.height = Math.round(imagen.height * escala);
        canvas.getContext('2d').drawImage(imagen, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', calidad));
      };
      imagen.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}
```

- [ ] **Step 2: Agregar el campo de foto al formulario de producto**

En `frontend/src/pages/Menu.jsx`, agrega el import junto a los existentes (línea 12):

```js
import { redimensionarImagen } from '../utils/imagenLocal';
```

Dentro de `FormularioProducto` (empieza en la línea 427), agrega estado nuevo junto a los `useState` existentes (después de la línea `const [guardando, setGuardando] = useState(false);`):

```jsx
const [imagenUrl, setImagenUrl] = useState(producto?.imagen_url || '');
const [imagenBase64, setImagenBase64] = useState(null); // null = sin cambios; '' = quitar; string = nueva foto
const [procesandoImagen, setProcesandoImagen] = useState(false);

async function handleArchivoImagen(e) {
  const archivo = e.target.files?.[0];
  e.target.value = '';
  if (!archivo) return;
  setProcesandoImagen(true);
  try {
    const dataUrl = await redimensionarImagen(archivo);
    setImagenBase64(dataUrl);
    setImagenUrl(dataUrl);
  } catch {
    toast.error('No se pudo procesar la imagen');
  } finally {
    setProcesandoImagen(false);
  }
}

function handleQuitarImagen() {
  setImagenBase64('');
  setImagenUrl('');
}
```

Modifica `handleSubmit` (dentro del mismo componente) agregando el campo de imagen al objeto que se envía. Reemplaza:

```jsx
    await onGuardar({
      nombre,
      descripcion,
      precio: Number(precio),
      ...(puedeVerCosto ? { costo: costo === '' ? null : Number(costo) } : {}),
      categoria_id: categoriaId || null,
      tipo,
      disponible_para: disponiblePara,
      tiempo_preparacion: tiempoPreparacion === '' ? null : Number(tiempoPreparacion),
    });
```

por:

```jsx
    await onGuardar({
      nombre,
      descripcion,
      precio: Number(precio),
      ...(puedeVerCosto ? { costo: costo === '' ? null : Number(costo) } : {}),
      categoria_id: categoriaId || null,
      tipo,
      disponible_para: disponiblePara,
      tiempo_preparacion: tiempoPreparacion === '' ? null : Number(tiempoPreparacion),
      ...(imagenBase64 !== null ? { imagen_base64: imagenBase64 } : {}),
    });
```

Agrega el campo visual justo después del bloque `<Campo label="Descripción">...</Campo>` (antes del `<div className="grid grid-cols-2 gap-4">` de Precio/Costo):

```jsx
      <Campo label="Foto">
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]">
            {imagenUrl ? (
              <img src={imagenUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[10px] text-[var(--text-secondary)]">Sin imagen</span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="cursor-pointer text-sm font-medium text-[var(--accent)]">
              {procesandoImagen ? 'Procesando...' : imagenUrl ? 'Cambiar foto' : 'Subir foto'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleArchivoImagen}
                disabled={procesandoImagen}
                className="hidden"
              />
            </label>
            {imagenUrl && (
              <button type="button" onClick={handleQuitarImagen} className="text-left text-xs text-[var(--error)]">
                Quitar foto
              </button>
            )}
          </div>
        </div>
      </Campo>
```

- [ ] **Step 3: Mostrar la foto en la tarjeta de producto de Menú**

En `frontend/src/pages/Menu.jsx`, dentro del `.map((producto) => ...)` de la grilla de productos, reemplaza:

```jsx
                    <div className="flex h-32 items-center justify-center bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                      <span className="text-xs">Sin imagen</span>
                    </div>
```

por:

```jsx
                    <div className="flex h-32 items-center justify-center overflow-hidden bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                      {producto.imagen_url ? (
                        <img src={producto.imagen_url} alt={producto.nombre} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs">Sin imagen</span>
                      )}
                    </div>
```

- [ ] **Step 4: Verificar manualmente en el navegador**

Run: `cd backend && npm run dev` (terminal 1) y `cd frontend && npm run dev` (terminal 2). Abre `http://localhost:5173`, entra como admin/gerente, ve a Menú → Productos → "Nuevo producto", sube una foto (jpg/png), confirma que aparece el preview, guarda.

Expected:
- La tarjeta del producto en Menú muestra la foto (no "Sin imagen").
- En POS, el mismo producto muestra la foto en su botón (`frontend/src/pages/POS.jsx` ya la consume, sin cambios).
- Editar el producto y click "Cambiar foto" reemplaza la imagen; "Quitar foto" + guardar la deja sin imagen (la tarjeta vuelve a "Sin imagen").

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/imagenLocal.js frontend/src/pages/Menu.jsx
git commit -m "feat: subir y mostrar foto de producto en Menu"
```

---

### Task 4: Frontend — soporte offline para crear/editar producto (con o sin foto)

**Files:**
- Modify: `frontend/src/db/database.js`
- Modify: `frontend/src/utils/apiOffline.js`
- Modify: `frontend/src/db/syncService.js`

**Interfaces:**
- Consumes: `localDb.ejecutar`/`consultar`/`consultarUno` (`database.js`, sin cambios de firma), `encolar`/`OfflineApiError` (`apiOffline.js`, ya existentes), `api` (axios) y `syncService.resolverId`/`guardarMapeo` (`syncService.js`, ya existentes).
- Produces: `productos_cache` gana columnas `sincronizado INTEGER DEFAULT 1` y `creado_offline INTEGER DEFAULT 0`. Nuevas rutas offline: `POST /api/productos` y `PUT /api/productos/:id` (mismo contrato JSON que el backend real, incluido `imagen_base64`). Nueva rama `tabla === 'productos'` en `syncService.procesarItem`.

- [ ] **Step 1: Migración idempotente de columnas en `productos_cache`**

En `frontend/src/db/database.js`, reemplaza el método `_init()` completo:

```js
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
```

- [ ] **Step 2: Verificar la migración manualmente**

Run: `cd frontend && npm run dev`, abre `http://localhost:5173` en el navegador, abre DevTools → Console, y pega:

```js
const { localDb } = await import('/src/db/database.js');
await localDb.init();
console.log(await localDb.consultar('PRAGMA table_info(productos_cache)'));
```

Expected: la lista de columnas incluye `sincronizado` y `creado_offline`. Recarga la página dos veces más y repite — no debe tirar error (confirma que el `ALTER TABLE` es idempotente).

- [ ] **Step 3: Agregar los handlers offline de crear/editar producto**

En `frontend/src/utils/apiOffline.js`, agrega estas dos funciones justo antes de la línea `// El orden importa: las rutas más específicas...` (línea 667):

```js
async function hCrearProducto(match, body) {
  const { nombre, precio } = body;
  if (!nombre || precio === undefined || precio === null) {
    throw new OfflineApiError('El nombre y el precio del producto son obligatorios', 400);
  }

  const id = uuidv4();
  const ahora = new Date().toISOString();
  const producto = {
    id,
    categoria_id: body.categoria_id ?? null,
    nombre,
    descripcion: body.descripcion ?? null,
    imagen_url: body.imagen_base64 || null,
    precio: Number(precio),
    costo: body.costo ?? null,
    tipo: body.tipo || 'producto',
    disponible: body.disponible ?? true,
    disponible_para: body.disponible_para || 'todos',
    tiempo_preparacion: body.tiempo_preparacion ?? null,
    orden: body.orden ?? 0,
    activo: true,
    modificadores: [],
    created_at: ahora,
    updated_at: ahora,
  };

  // ponytail: si este producto se pide en un pedido antes de sincronizar, su
  // producto_id local no se remapea en pedido_items (no hay id_map para esa
  // tabla) — caso raro (crear producto y venderlo offline en el mismo turno
  // antes de reconectar); ampliar si llega a pasar en la práctica.
  await localDb.ejecutar(
    `INSERT INTO productos_cache (id, datos, sincronizado, creado_offline) VALUES (?, ?, 0, 1)`,
    [id, JSON.stringify(producto)]
  );
  await encolar('productos', 'crear', { id_local: id, ...body });

  return { producto };
}

async function hActualizarProducto(match, body) {
  const id = match[1];
  const fila = await localDb.consultarUno(`SELECT datos FROM productos_cache WHERE id = ?`, [id]);
  if (!fila) throw new OfflineApiError('Producto no encontrado');

  const producto = { ...JSON.parse(fila.datos), ...body, updated_at: new Date().toISOString() };
  if (body.imagen_base64 !== undefined) {
    producto.imagen_url = body.imagen_base64 || null;
  }
  delete producto.imagen_base64;

  await localDb.ejecutar(`UPDATE productos_cache SET datos = ?, sincronizado = 0 WHERE id = ?`, [
    JSON.stringify(producto),
    id,
  ]);
  await encolar('productos', 'actualizar', { id_local: id, ...body });

  return { producto };
}
```

Agrega las rutas al array `RUTAS`. Reemplaza la línea:

```js
  { metodo: 'get', re: /^\/api\/productos$/, h: hProductos },
```

por:

```js
  { metodo: 'get', re: /^\/api\/productos$/, h: hProductos },
  { metodo: 'post', re: /^\/api\/productos$/, h: hCrearProducto },
  { metodo: 'put', re: /^\/api\/productos\/([^/]+)$/, h: hActualizarProducto },
```

- [ ] **Step 4: Sincronizar productos pendientes al reconectar**

En `frontend/src/db/syncService.js`, dentro de `procesarItem`, agrega esta rama nueva justo antes del cierre del `if (item.tabla === 'mesas' ...)` (después del bloque `if (item.tabla === 'pedido_items') { ... }`, antes de `if (item.tabla === 'mesas' && ...)`):

```js
    if (item.tabla === 'productos') {
      const { id_local, ...campos } = datos;

      if (item.operacion === 'crear') {
        const { data } = await api.post('/api/productos', campos);
        await this.guardarMapeo('producto', id_local, data.datos.producto.id);
      } else if (item.operacion === 'actualizar') {
        const idRemoto = await this.resolverId('producto', id_local);
        await api.put(`/api/productos/${idRemoto}`, campos);
      }

      await localDb.ejecutar(`UPDATE productos_cache SET sincronizado = 1 WHERE id = ?`, [id_local]);
      return;
    }

```

Y en `actualizarCache()`, reemplaza la línea:

```js
      await localDb.ejecutar('DELETE FROM productos_cache');
```

por:

```js
      // Los productos creados/editados offline y aún no sincronizados
      // (sincronizado = 0) no se tocan acá — si no, se perderían antes de
      // que la cola alcance a subirlos.
      await localDb.ejecutar('DELETE FROM productos_cache WHERE sincronizado = 1');
```

(El `INSERT OR REPLACE` que sigue no necesita cambios: al no listar las columnas `sincronizado`/`creado_offline`, toman su valor `DEFAULT` — `1` y `0` respectivamente — correcto para productos que vienen del servidor.)

- [ ] **Step 5: Verificar el flujo offline manualmente**

Run: `cd backend && npm run dev` y `cd frontend && npm run dev`. En el navegador, DevTools → Network → marca "Offline". En Menú → Productos, crea un producto nuevo con foto.

Expected:
- Aparece un toast "Guardado localmente, se sincronizará al volver la conexión".
- El producto aparece de inmediato en la grilla de Menú con su foto (sin recargar).

Desmarca "Offline" en DevTools y espera (o dispara `ConnectivityContext` reconectando). Revisa en Console:

```js
const { localDb } = await import('/src/db/database.js');
await localDb.init();
console.log(await localDb.consultar('SELECT rowid, tabla, operacion, intentos, error FROM sync_queue'));
```

Expected: la cola queda vacía (el item se borró tras sincronizar con éxito). Recarga Menú y confirma que el producto sigue mostrando la foto (ahora servida desde `imagen_url` real del backend, no el data URL local) — puedes confirmarlo viendo que la URL en el DOM (`Elementos` → inspecciona el `<img>`) empieza con `http://localhost:4000/uploads/...` en vez de `data:image/jpeg;base64,...`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/db/database.js frontend/src/utils/apiOffline.js frontend/src/db/syncService.js
git commit -m "feat: soporte offline para crear y editar productos (incluida la foto)"
```

---

### Task 5: Verificación end-to-end y build

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Build de producción**

Run (desde la raíz del repo): `npm run build`
Expected: termina sin errores (`vite build` genera `frontend/dist`).

- [ ] **Step 2: Escenario online completo**

Con backend y frontend corriendo y con internet real disponible: crear un producto con foto en Menú, abrir POS, confirmar que la foto aparece en la tarjeta del producto en la comanda.

- [ ] **Step 3: Escenario offline completo**

Repetir el Step 5 del Task 4 (DevTools Offline → crear producto con foto → reconectar → confirmar sync), y además: con el producto ya sincronizado, abrir POS y confirmar que también ahí se ve la foto.

- [ ] **Step 4: Confirmar los límites documentados**

Intentar subir una imagen no soportada (ej. un `.gif` o un archivo `.txt` renombrado a `.jpg`) y confirmar que el backend la rechaza con 400 y el mensaje se ve como toast de error en el formulario (no rompe la creación del resto de los campos si se quita la imagen y se reintenta).

No hay commit en esta tarea — es solo verificación del trabajo ya commiteado en las Tasks 1-4.

---

## Self-Review

**Cobertura del spec:**
- Storage en volumen Railway + estático → Task 1.
- Redimensionado backend (`sharp`) → Task 2. Redimensionado frontend (Canvas) → Task 3.
- Input de archivo + preview + quitar/reemplazar en Menú → Task 3.
- Tarjeta de producto en Menú muestra `imagen_url` → Task 3.
- Offline: visible de inmediato + encolado + no bloquea creación → Task 4.
- Verificación (`npm run build`, online, offline) → Task 5.

**Consistencia de tipos/nombres:** `imagen_base64` es el nombre de campo usado consistentemente en: `FormularioProducto` (Task 3) → `productoController.crear/actualizar` (Task 2) → `hCrearProducto/hActualizarProducto` (Task 4) → `syncService.procesarItem` (Task 4, reenviado dentro de `campos`). `redimensionarImagen` (Task 3) es la única función exportada por `imagenLocal.js` y se usa tal cual en `Menu.jsx`. `guardarImagenProducto`/`eliminarImagenProducto`/`ImagenInvalidaError` (Task 2) son los únicos exports de `imagenProducto.js`.
