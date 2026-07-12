# Foto de producto en Menú (con soporte offline) — Diseño

## Contexto

`productos.imagen_url` ya existe en el schema (TEXT plano) y `POS.jsx` ya la
consume para mostrar la foto en la comanda. Pero no existe forma de subirla:
`Menu.jsx` no tiene input de imagen en el formulario de producto, y su
tarjeta de producto siempre muestra el placeholder "Sin imagen".

Objetivo: poder subir una foto al crear/editar un producto desde Menú, verla
en preview antes de guardar, que se guarde y se vea luego en el POS —
funcionando también sin conexión (la app es local-first).

## Hallazgo de alcance (bloqueante para el requisito offline)

Hoy **crear/editar un producto no tiene ningún soporte offline**:
`frontend/src/utils/apiOffline.js` no tiene entradas en `RUTAS` para
`POST/PUT /api/productos`, ni en `RUTAS_MIRROR`. Sin conexión, `crearProducto`/
`actualizarProducto` (`frontend/src/utils/productos.js`) fallan con el error
de red crudo.

El requisito "subir foto offline no debe bloquear la creación del producto"
implica, entonces, construir soporte offline de creación/edición de
productos por primera vez — no solo el manejo de la imagen. Se sigue el
mismo patrón que ya existe para pedidos (`pedidos_local` + `sync_queue` +
`id_map`), adaptado a `productos_cache`.

## Motor local (recordatorio, ya existente)

`frontend/src/db/database.js` corre sobre dos motores con la misma interfaz
async: SQLite nativo (`@tauri-apps/plugin-sql`) en el `.exe`, y `sql.js`
(WASM) + IndexedDB (`localforage`) como fallback en navegador. `productos_cache`
guarda el producto completo como JSON en la columna `datos`; hoy es un cache
de solo lectura que `syncService.actualizarCache()` borra y repuebla entero
en cada sync.

## Decisiones tomadas

1. **Storage de imágenes en el backend**: volumen persistente montado en el
   servicio de Railway (no S3/Cloudinary — cero dependencias/cuentas
   externas nuevas). El volumen lo configura el usuario en Railway; el path
   de montaje se lee de una env var.
2. **Procesamiento en backend**: redimensionar/recomprimir con `sharp` (ancho
   máx. ~800px, re-encode a webp) antes de guardar — más liviano para servir
   en el POS sobre wifi de restaurante.
3. **Compresión en frontend antes de guardar localmente**: usando `Canvas`
   nativo (sin dependencia nueva) antes de convertir a base64, para no
   inflar SQLite local ni `sync_queue` mientras la foto está pendiente de
   sync.

## Diseño

### Backend

- **`POST /api/productos/:id/imagen`** (nuevo, multipart vía `multer`,
  memory storage): valida tipo (jpg/png/webp) y tamaño máx. de subida (ej.
  5MB antes de reescalar), redimensiona con `sharp`, guarda el archivo en el
  volumen persistente, y llama `productoModel.actualizar(id, restauranteId,
  { imagen_url })` — el modelo ya soporta update parcial, no requiere
  cambios. Mismos middlewares que el resto de mutaciones de menú
  (`verificarToken`, `verificarRol('admin','gerente')`).
- El volumen se sirve como estático (mismo patrón que `frontend/dist` en
  `server.js`), bajo una ruta tipo `/uploads/productos/...`.
- `crear`/`actualizar` de producto (JSON) **no cambian**. La imagen siempre
  es una llamada aparte, antes o después de guardar los campos de texto.
- Nueva dependencia: `multer` (recepción multipart) y `sharp` (resize). No
  se agrega SDK de storage externo.

### Frontend — Menu.jsx

- El formulario de producto agrega `<input type="file" accept="image/*">` +
  preview + botón para quitar/reemplazar. Al elegir archivo: se redimensiona
  con `Canvas` a un ancho razonable y se guarda como base64 en el estado del
  formulario (mismo dato para preview y para el guardado offline).
- La tarjeta de producto en Menú muestra `imagen_url` igual que ya hace
  `POS.jsx`, en vez del placeholder fijo.
- `handleGuardarProducto`: 1) crea/actualiza el producto (campos de texto),
  2) si hay imagen nueva, sube vía el endpoint de imagen. Online son dos
  llamadas HTTP secuenciales normales.

### Offline

- **`database.js`**: agrega columnas `sincronizado` y `creado_offline` a
  `productos_cache` vía `ALTER TABLE` idempotente (try/catch ignorando el
  error de columna duplicada — ni sqlx ni sql.js soportan `ADD COLUMN IF NOT
  EXISTS` de forma portable).
- **`apiOffline.js`**: nuevos handlers en `RUTAS` para `POST /api/productos`
  y `PUT /api/productos/:id` que escriben directo en `productos_cache` (id
  local generado con `uuid` si es creación), guardando `imagen_url` como la
  data URI base64 si vino foto. Visible de inmediato en Menú y POS sin red.
- **`syncService.js`**: nueva rama en `procesarItem` para
  `tabla === 'productos'`:
  1. `POST`/`PUT /api/productos` con los campos de texto.
  2. Si fue creación offline, `guardarMapeo('producto', idLocal, idRemoto)`.
  3. Si el payload trae `imagen_base64`, se convierte a `Blob` y se sube a
     `POST /api/productos/:id/imagen`; la `imagen_url` real devuelta
     reemplaza la base64 en `productos_cache`.
- **`actualizarCache()`**: el `DELETE FROM productos_cache` pasa a ser
  condicional (`WHERE sincronizado = 1`, o upsert) para no arrasar productos
  aún pendientes en la cola de sync.

## Fuera de alcance (deuda conocida, no bloquea esta entrega)

- Un solo tamaño de imagen — no se generan thumbnails múltiples.
- Sin editor de recorte/crop — se sube la foto tal cual, solo se reescala.
- `eliminarProducto` no borra el archivo de imagen huérfano del volumen.
- Reemplazar una imagen no borra la anterior del volumen (se acumulan
  archivos huérfanos) — aceptable para primera versión.

## Verificación

- `npm run build` sin errores (root, que builda frontend).
- Subir foto con internet activo → aparece en POS.
- Subir foto con internet apagado → se ve local de inmediato; al reconectar,
  se sincroniza y la URL local (base64) se reemplaza por la URL real.
