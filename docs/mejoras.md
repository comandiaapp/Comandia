# Plan de Mejoras de Producto — Comandia

> **Para quien ejecute esto:** cada mejora es una tarea autocontenida (schema → backend → frontend → verificación manual → commit). Este proyecto **no tiene suite de tests ni linter configurado** (ver CLAUDE.md), así que "verificación" aquí significa pasos manuales concretos (curl / consola / UI), no tests automatizados. Si se quiere ejecutar una mejora con `superpowers:subagent-driven-development` o `superpowers:executing-plans`, cada tarea de abajo puede partirse en pasos más finos en ese momento.

**Objetivo de este documento:** dejar planeadas, con detalle suficiente para implementar sin adivinar, las mejoras de negocio identificadas en la revisión de producto de Comandia (reportes de gestión, CRM básico, reparto de propinas, reservas y autopedido QR).

**Este archivo vive en `docs/` y no afecta el build ni el runtime de la app** (el Dockerfile solo copia `frontend/` y `backend/`).

## Restricciones globales (aplican a todas las tareas)

- Todo texto de UI, mensajes de API, nombres de variables/funciones: **en español**.
- Respuestas de API siempre vía `utils/respuestas.js`: `ok(res, datos, status)` / `error(res, mensaje, status)`.
- Todo modelo filtra por `restaurante_id`; nunca confiar en un `restaurante_id` del body, siempre `req.usuario.restauranteId`.
- Cambios de esquema van al final de `backend/src/config/schema.sql`, de forma idempotente (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`), con un comentario explicando el porqué. No reestructurar a carpeta de migraciones.
- IDs nuevos: `uuidv4()` en Node, nunca `gen_random_uuid()` de Postgres (debe funcionar igual contra la copia SQLite offline).
- Escrituras multi-paso: `pool.connect()` + `BEGIN`/`COMMIT` explícito (ver `descontarStockPorVenta` en `inventarioModel.js` como referencia).
- Después de cada tarea: `npm run db:init` en `backend/` para aplicar el schema nuevo contra la base local antes de probar.

---

## Índice

1. [Reporte de rentabilidad por producto](#1-reporte-de-rentabilidad-por-producto)
2. [Reporte de rotación de mesas](#2-reporte-de-rotación-de-mesas)
3. [Reporte de ventas por mesero](#3-reporte-de-ventas-por-mesero)
4. [Reporte de mermas y ajustes de inventario](#4-reporte-de-mermas-y-ajustes-de-inventario)
5. [CRM básico (clientes frecuentes)](#5-crm-básico-clientes-frecuentes)
6. [Reparto de propinas por jornada](#6-reparto-de-propinas-por-jornada)
7. [Reservas de mesa](#7-reservas-de-mesa)
8. [Carta pública por QR (fase 1: solo lectura)](#8-carta-pública-por-qr-fase-1-solo-lectura)

**Prioridad sugerida:** 1 → 4 → 6 → 3 → 2 → 5 → 7 → 8 (de menor a mayor esfuerzo/riesgo; el detalle de cada una explica por qué).

---

## 1. Reporte de rentabilidad por producto

**Hallazgo clave:** esto **ya existe parcialmente**. `reporteModel.productosMasVendidos` (`backend/src/models/reporteModel.js:86-118`) ya calcula `margen_ganancia` usando `productos.costo`, y `Reportes.jsx` (`TabProductos`, línea 316+) ya lo muestra en columna. Lo que falta no es el cálculo, son dos cosas: (a) permitir **ordenar por margen** en vez de solo por cantidad vendida, y (b) usar el costo de la **receta** como respaldo cuando `productos.costo` está vacío (muchos productos tendrán receta cargada en `recetas`/`ingredientes` pero nunca un `costo` manual).

**Archivos:**
- Modificar: `backend/src/models/reporteModel.js:86-118` (función `productosMasVendidos`)
- Modificar: `backend/src/controllers/reporteController.js:42-59` (función `productosMasVendidos`)
- Modificar: `frontend/src/utils/reportes.js` (función `getProductosMasVendidos`)
- Modificar: `frontend/src/pages/Reportes.jsx:316+` (`TabProductos`)

### Paso 1: Backend — costo con respaldo de receta y orden configurable

Reemplazar la función completa en `backend/src/models/reporteModel.js`:

```js
async function productosMasVendidos(restauranteId, fechaInicio, fechaFin, limite, ordenarPor = 'cantidad') {
  const columnaOrden = ordenarPor === 'margen' ? 'margen_ganancia' : 'cantidad_vendida';

  const { rows } = await pool.query(
    `SELECT pi.producto_id, pi.nombre_producto,
            SUM(pi.cantidad)::int AS cantidad_vendida,
            SUM(pi.subtotal) AS total_generado,
            MAX(COALESCE(
              pr.costo,
              (SELECT SUM(r.cantidad * i.costo_unitario)
               FROM recetas r JOIN ingredientes i ON i.id = r.ingrediente_id
               WHERE r.producto_id = pi.producto_id AND r.restaurante_id = $1)
            )) AS costo_unitario
     FROM pedido_items pi
     JOIN pedidos p ON p.id = pi.pedido_id
     LEFT JOIN productos pr ON pr.id = pi.producto_id
     WHERE p.restaurante_id = $1 AND p.estado = 'pagado' AND pi.estado != 'cancelado'
       AND DATE(p.updated_at AT TIME ZONE 'America/Bogota') BETWEEN $2 AND $3
     GROUP BY pi.producto_id, pi.nombre_producto`,
    [restauranteId, fechaInicio, fechaFin]
  );

  const conMargen = rows.map((fila) => {
    const totalGenerado = Number(fila.total_generado);
    const costoUnitario = fila.costo_unitario !== null ? Number(fila.costo_unitario) : null;
    const costoTotal = costoUnitario !== null ? costoUnitario * fila.cantidad_vendida : null;
    const margenGanancia = costoTotal !== null ? totalGenerado - costoTotal : null;

    return {
      producto_id: fila.producto_id,
      nombre: fila.nombre_producto,
      cantidad_vendida: fila.cantidad_vendida,
      total_generado: totalGenerado,
      costo_total: costoTotal,
      margen_ganancia: margenGanancia,
    };
  });

  conMargen.sort((a, b) => {
    const valorA = a[columnaOrden] ?? -Infinity;
    const valorB = b[columnaOrden] ?? -Infinity;
    return valorB - valorA;
  });

  return conMargen.slice(0, limite);
}
```

Nota: el `COALESCE` con subconsulta a `recetas`/`ingredientes` corre por cada fila agrupada (no por cada línea de pedido), así que el costo no escala con volumen de ventas — es aceptable para un reporte gerencial que se corre bajo demanda, no en el hot path de cobro.

### Paso 2: Controller — parámetro `orden`

En `backend/src/controllers/reporteController.js`, dentro de `productosMasVendidos`:

```js
async function productosMasVendidos(req, res) {
  const fecha_fin = req.query.fecha_fin || hoyISO();
  const fecha_inicio = req.query.fecha_inicio || fecha_fin;
  const limite = req.query.limite ? Number(req.query.limite) : 10;
  const orden = req.query.orden === 'margen' ? 'margen' : 'cantidad';

  try {
    const productos = await reporteModel.productosMasVendidos(
      req.usuario.restauranteId,
      fecha_inicio,
      fecha_fin,
      limite,
      orden
    );
    return ok(res, { productos });
  } catch (err) {
    console.error('Error al generar el reporte de productos más vendidos:', err);
    return error(res, 'No se pudo generar el reporte de productos más vendidos', 500);
  }
}
```

No hay cambios de ruta: sigue siendo `GET /reportes/productos-vendidos`, solo con un query param nuevo y opcional.

### Paso 3: Frontend — selector de orden

En `frontend/src/utils/reportes.js`, la función `getProductosMasVendidos` debe aceptar y enviar `orden` como query param adicional (mismo patrón que `fecha_inicio`/`fecha_fin`/`limite` que ya usa).

En `frontend/src/pages/Reportes.jsx`, dentro de `TabProductos`, agregar un estado `orden` (`'cantidad' | 'margen'`) con dos botones tipo pestaña ("Más vendidos" / "Mejor margen"), y volver a pedir el reporte cuando cambie — mismo patrón que el selector de fechas que ya existe en ese componente.

### Verificación manual

1. `cd backend && npm run dev`
2. Con un producto que tenga receta cargada pero **sin** `costo` manual, cobrar un pedido con ese producto.
3. `curl http://localhost:4000/api/reportes/productos-vendidos?orden=margen -H "Authorization: Bearer <token>"` — confirmar que `margen_ganancia` no es `null` para ese producto (viene del cálculo de receta).
4. En la UI, cambiar entre "Más vendidos" y "Mejor margen" y confirmar que el orden de la tabla cambia.

### Commit

```bash
git add backend/src/models/reporteModel.js backend/src/controllers/reporteController.js frontend/src/utils/reportes.js frontend/src/pages/Reportes.jsx
git commit -m "feat: ordenar reporte de productos por margen y usar costo de receta como respaldo"
```

---

## 2. Reporte de rotación de mesas

**Qué mide:** tiempo promedio que una mesa está ocupada por ciclo (desde que se abre el pedido hasta que se libera), y cuántos ciclos tuvo cada mesa en un período. Ya existe todo el dato: `pedidos.created_at` y `pedidos.mesa_liberada_at` (`schema.sql:168-196`).

**Archivos:**
- Modificar: `backend/src/models/reporteModel.js` (nueva función `rotacionMesas`)
- Modificar: `backend/src/controllers/reporteController.js` (nueva función `rotacionMesas`)
- Modificar: `backend/src/routes/reportes.js` (nueva ruta)
- Modificar: `frontend/src/utils/reportes.js` (nueva función `getRotacionMesas`)
- Modificar: `frontend/src/pages/Reportes.jsx` (nueva pestaña "Mesas")

### Paso 1: Modelo

Agregar a `backend/src/models/reporteModel.js`:

```js
async function rotacionMesas(restauranteId, fechaInicio, fechaFin) {
  const { rows } = await pool.query(
    `SELECT m.id AS mesa_id, m.numero, m.nombre AS mesa_nombre, a.nombre AS area_nombre,
            COUNT(p.id)::int AS ciclos,
            AVG(EXTRACT(EPOCH FROM (COALESCE(p.mesa_liberada_at, p.pagado_at) - p.created_at)))::int AS segundos_promedio
     FROM pedidos p
     JOIN mesas m ON m.id = p.mesa_id
     LEFT JOIN areas a ON a.id = m.area_id
     WHERE p.restaurante_id = $1 AND p.tipo = 'mesa' AND p.estado = 'pagado'
       AND (p.mesa_liberada_at IS NOT NULL OR p.pagado_at IS NOT NULL)
       AND DATE(p.updated_at AT TIME ZONE 'America/Bogota') BETWEEN $2 AND $3
     GROUP BY m.id, m.numero, m.nombre, a.nombre
     ORDER BY segundos_promedio DESC NULLS LAST`,
    [restauranteId, fechaInicio, fechaFin]
  );

  return rows.map((fila) => ({
    mesa_id: fila.mesa_id,
    numero: fila.numero,
    nombre: fila.mesa_nombre,
    area: fila.area_nombre,
    ciclos: fila.ciclos,
    minutos_promedio: fila.segundos_promedio !== null ? Math.round(fila.segundos_promedio / 60) : null,
  }));
}

module.exports = { ventasDia, ventasPeriodo, productosMasVendidos, resumenDashboard, rotacionMesas };
```

(Recordar actualizar el `module.exports` al final del archivo con las demás funciones ya existentes.)

### Paso 2: Controller

Agregar a `backend/src/controllers/reporteController.js`, siguiendo el mismo patrón de validación que `ventasPeriodo`:

```js
async function rotacionMesas(req, res) {
  const { fecha_inicio, fecha_fin } = req.query;

  if (!fecha_inicio || !fecha_fin) {
    return error(res, 'fecha_inicio y fecha_fin son obligatorios', 400);
  }

  try {
    const rotacion = await reporteModel.rotacionMesas(req.usuario.restauranteId, fecha_inicio, fecha_fin);
    return ok(res, { rotacion });
  } catch (err) {
    console.error('Error al generar el reporte de rotación de mesas:', err);
    return error(res, 'No se pudo generar el reporte de rotación de mesas', 500);
  }
}

module.exports = { ventasDia, ventasPeriodo, productosMasVendidos, resumenDashboard, rotacionMesas };
```

### Paso 3: Ruta

En `backend/src/routes/reportes.js`, agregar antes de `module.exports`:

```js
router.get('/reportes/rotacion-mesas', verificarRol('gerente', 'admin'), rotacionMesas);
```

(Y agregar `rotacionMesas` al `require` de arriba.)

### Paso 4: Frontend

- `frontend/src/utils/reportes.js`: agregar `getRotacionMesas(fechaInicio, fechaFin)` con el mismo patrón de `getVentasPeriodo`.
- `frontend/src/pages/Reportes.jsx`: agregar `{ id: 'mesas', label: 'Mesas' }` a `TABS`, y un componente `TabMesas` (copiar la estructura de selector de fechas de `TabPeriodo` si existe, o de `TabProductos`) que muestre una tabla: Mesa | Área | Ciclos | Tiempo promedio (formatear `minutos_promedio` como `Xh Ym` si es mayor a 60).

### Verificación manual

1. Abrir y cobrar 2-3 pedidos de mesa distintos con algunos minutos de diferencia.
2. `curl "http://localhost:4000/api/reportes/rotacion-mesas?fecha_inicio=2026-07-13&fecha_fin=2026-07-13" -H "Authorization: Bearer <token>"` y confirmar que `minutos_promedio` es coherente con el tiempo real que estuvo abierta cada mesa.
3. En la UI, pestaña "Mesas" debe mostrar la misma información.

### Commit

```bash
git add backend/src/models/reporteModel.js backend/src/controllers/reporteController.js backend/src/routes/reportes.js frontend/src/utils/reportes.js frontend/src/pages/Reportes.jsx
git commit -m "feat: agregar reporte de rotación de mesas"
```

---

## 3. Reporte de ventas por mesero

**Asunción a confirmar antes de implementar:** este plan asume que `pedidos.usuario_id` representa al mesero/usuario que atendió el pedido (quien lo abrió). Si en la práctica quien cobra (cajero) sobrescribe ese campo al cerrar el pedido, este reporte terminaría midiendo cajeros, no meseros — **revisar `pedidoModel.cobrar` antes de dar esto por bueno** (no lo confirmé en el código: la firma es `cobrar(pedidoId, datos, restauranteId)` y no vi que reasigne `usuario_id`, pero vale la pena un vistazo rápido antes de construir el reporte).

**Archivos:** mismos 4 archivos que la tarea 2 (reporteModel.js, reporteController.js, routes/reportes.js, utils/reportes.js, Reportes.jsx).

### Paso 1: Modelo

```js
async function ventasPorMesero(restauranteId, fechaInicio, fechaFin) {
  const { rows } = await pool.query(
    `SELECT p.usuario_id, u.nombre AS usuario_nombre,
            COUNT(*)::int AS cantidad_pedidos,
            SUM(p.total) AS total_ventas,
            SUM(p.propina) AS total_propinas
     FROM pedidos p
     JOIN usuarios u ON u.id = p.usuario_id
     WHERE p.restaurante_id = $1 AND p.estado = 'pagado'
       AND DATE(p.updated_at AT TIME ZONE 'America/Bogota') BETWEEN $2 AND $3
     GROUP BY p.usuario_id, u.nombre
     ORDER BY total_ventas DESC`,
    [restauranteId, fechaInicio, fechaFin]
  );

  return rows.map((fila) => ({
    usuario_id: fila.usuario_id,
    nombre: fila.usuario_nombre,
    cantidad_pedidos: fila.cantidad_pedidos,
    total_ventas: Number(fila.total_ventas),
    total_propinas: Number(fila.total_propinas),
    ticket_promedio: fila.cantidad_pedidos > 0 ? Number(fila.total_ventas) / fila.cantidad_pedidos : 0,
  }));
}
```

Agregar a `module.exports` en las tres capas (modelo, controller, ruta), mismo patrón que la tarea 2.

### Paso 2: Controller y ruta

Idéntico patrón a `rotacionMesas` (arriba): valida `fecha_inicio`/`fecha_fin` obligatorios, llama al modelo, `ok(res, { ventas })`. Ruta: `GET /reportes/ventas-por-mesero`, `verificarRol('gerente', 'admin')`.

### Paso 3: Frontend

Nueva pestaña "Meseros" en `Reportes.jsx`, tabla: Nombre | Pedidos | Ventas | Propinas | Ticket promedio, ordenada por ventas descendente (ya viene ordenada del backend).

### Verificación manual

1. Cobrar pedidos con al menos 2 usuarios distintos logueados.
2. `curl "http://localhost:4000/api/reportes/ventas-por-mesero?fecha_inicio=...&fecha_fin=..." -H "Authorization: Bearer <token>"` y confirmar que la suma de `total_ventas` de todos los meseros coincide con `ventas-periodo` del mismo rango.

### Commit

```bash
git commit -m "feat: agregar reporte de ventas por mesero"
```

---

## 4. Reporte de mermas y ajustes de inventario

**Hallazgo clave:** no hace falta "comparar teórico vs. real" desde cero — el sistema **ya separa** el consumo teórico (movimientos `tipo='venta'`, generados automáticamente por `descontarStockPorVenta` en `inventarioModel.js:301-358` a partir de la receta) de la merma explícita (`tipo='merma'`, vía `POST /inventario/merma`) y de los ajustes por conteo físico (`tipo='ajuste'`, vía `registrarAjuste`, que ya guarda la diferencia entre el conteo real y el stock del sistema). Lo que falta es **un reporte que valore esas pérdidas en dinero y las agrupe por ingrediente** — hoy solo existe `GET /inventario/movimientos`, una lista cruda sin agregación ni valorización.

**Archivos:**
- Modificar: `backend/src/models/reporteModel.js` (nueva función `reporteMermas`)
- Modificar: `backend/src/controllers/reporteController.js` (nueva función `reporteMermas`)
- Modificar: `backend/src/routes/reportes.js` (nueva ruta)
- Modificar: `frontend/src/utils/reportes.js` y `frontend/src/pages/Reportes.jsx` (nueva pestaña "Mermas")

### Paso 1: Modelo

```js
async function reporteMermas(restauranteId, fechaInicio, fechaFin) {
  const { rows } = await pool.query(
    `SELECT i.id AS ingrediente_id, i.nombre, i.unidad_medida,
            COALESCE(SUM(ABS(mi.cantidad)) FILTER (WHERE mi.tipo = 'merma'), 0) AS total_merma,
            COALESCE(SUM(ABS(mi.cantidad)) FILTER (WHERE mi.tipo = 'ajuste' AND mi.cantidad < 0), 0) AS total_ajuste_negativo,
            COALESCE(SUM(ABS(mi.cantidad) * COALESCE(mi.costo_unitario, i.costo_unitario))
              FILTER (WHERE mi.tipo IN ('merma', 'ajuste') AND mi.cantidad < 0), 0) AS valor_perdido
     FROM movimientos_inventario mi
     JOIN ingredientes i ON i.id = mi.ingrediente_id
     WHERE mi.restaurante_id = $1
       AND mi.tipo IN ('merma', 'ajuste')
       AND DATE(mi.created_at AT TIME ZONE 'America/Bogota') BETWEEN $2 AND $3
     GROUP BY i.id, i.nombre, i.unidad_medida
     HAVING COALESCE(SUM(ABS(mi.cantidad)) FILTER (WHERE mi.tipo = 'merma'), 0)
          + COALESCE(SUM(ABS(mi.cantidad)) FILTER (WHERE mi.tipo = 'ajuste' AND mi.cantidad < 0), 0) > 0
     ORDER BY valor_perdido DESC`,
    [restauranteId, fechaInicio, fechaFin]
  );

  return rows.map((fila) => ({
    ingrediente_id: fila.ingrediente_id,
    nombre: fila.nombre,
    unidad_medida: fila.unidad_medida,
    total_merma: Number(fila.total_merma),
    total_ajuste_negativo: Number(fila.total_ajuste_negativo),
    valor_perdido: Number(fila.valor_perdido),
  }));
}
```

El `HAVING` excluye ingredientes con solo ajustes positivos (sobrantes de conteo, no pérdida) para que el reporte muestre únicamente fuga real.

### Paso 2 y 3: Controller y ruta

Mismo patrón que `rotacionMesas`: `GET /reportes/mermas`, obligatorios `fecha_inicio`/`fecha_fin`, `verificarRol('gerente', 'admin')`.

### Paso 4: Frontend

Nueva pestaña "Mermas": tabla Ingrediente | Merma registrada | Ajuste negativo | Valor perdido, con un total al pie sumando `valor_perdido`. Este es el número que más le importa al dueño: "esto es lo que se perdió este mes en plata".

### Verificación manual

1. Registrar una merma vía `POST /inventario/merma` para un ingrediente con `costo_unitario` configurado.
2. Registrar un ajuste negativo (conteo físico menor al sistema) vía `POST /inventario/ajuste`.
3. `curl "http://localhost:4000/api/reportes/mermas?fecha_inicio=...&fecha_fin=..." -H "Authorization: Bearer <token>"` y confirmar que `valor_perdido` = merma×costo + ajuste×costo.
4. Registrar un ajuste **positivo** (sobrante) y confirmar que ese ingrediente no aparece en el reporte (por el `HAVING`).

### Commit

```bash
git commit -m "feat: agregar reporte de mermas y ajustes valorizados"
```

---

## 5. CRM básico (clientes frecuentes)

**Qué es:** captar opcionalmente el teléfono del cliente al cobrar, para poder identificar clientes recurrentes. **No** puntos ni cashback todavía — esa es una fase 2 que depende de que esta tabla exista y tenga datos.

**Regla de negocio innegociable:** la captura debe ser **opcional y de un solo campo**. Si se vuelve obligatoria o de varios pasos, el mesero la va a saltar siempre en hora pico y la tabla quedará vacía. No se implementa offline en esta fase (si no hay conexión, el cobro sigue funcionando igual, simplemente sin asociar cliente — se sincroniza sin ese dato, no bloquea nada).

**Archivos:**
- Modificar: `backend/src/config/schema.sql` (tabla `clientes` + columna `cliente_id` en `pedidos`)
- Crear: `backend/src/models/clienteModel.js`
- Crear: `backend/src/controllers/clienteController.js`
- Crear: `backend/src/routes/clientes.js`
- Modificar: `backend/src/routes/index.js` (montar el router nuevo)
- Modificar: `backend/src/controllers/pedidoController.js` (función de cobro, para aceptar `telefono_cliente` opcional)
- Modificar: `frontend/src/pages/POS.jsx` (o el modal de cobro que use `Pedidos.jsx`/`Mesas.jsx`) — agregar campo opcional

### Paso 1: Schema

Agregar al final de `backend/src/config/schema.sql`:

```sql
-- Clientes: captura opcional de teléfono al cobrar, para identificar
-- clientes frecuentes. No bloquea el cobro si no se captura.
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY,
  restaurante_id UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  nombre VARCHAR(255),
  telefono VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  fecha_nacimiento DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurante_id, telefono)
);

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL;
```

### Paso 2: Modelo

Crear `backend/src/models/clienteModel.js`:

```js
const pool = require('../config/database');

async function buscarOCrearPorTelefono(restauranteId, telefono, nombre, id) {
  const { rows } = await pool.query(
    `INSERT INTO clientes (id, restaurante_id, telefono, nombre)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (restaurante_id, telefono)
     DO UPDATE SET nombre = COALESCE(EXCLUDED.nombre, clientes.nombre), updated_at = now()
     RETURNING *`,
    [id, restauranteId, telefono, nombre ?? null]
  );
  return rows[0];
}

async function listarFrecuentes(restauranteId, minimoVisitas = 2) {
  const { rows } = await pool.query(
    `SELECT c.id, c.nombre, c.telefono, COUNT(p.id)::int AS cantidad_visitas,
            SUM(p.total) AS total_gastado, MAX(p.updated_at) AS ultima_visita
     FROM clientes c
     JOIN pedidos p ON p.cliente_id = c.id AND p.estado = 'pagado'
     WHERE c.restaurante_id = $1
     GROUP BY c.id, c.nombre, c.telefono
     HAVING COUNT(p.id) >= $2
     ORDER BY cantidad_visitas DESC`,
    [restauranteId, minimoVisitas]
  );
  return rows;
}

module.exports = { buscarOCrearPorTelefono, listarFrecuentes };
```

### Paso 3: Controller

Crear `backend/src/controllers/clienteController.js`:

```js
const { v4: uuidv4 } = require('uuid');

const clienteModel = require('../models/clienteModel');
const { ok, error } = require('../utils/respuestas');

async function buscarOCrear(req, res) {
  const { telefono, nombre } = req.body;

  if (!telefono) {
    return error(res, 'El teléfono es obligatorio', 400);
  }

  try {
    const cliente = await clienteModel.buscarOCrearPorTelefono(req.usuario.restauranteId, telefono, nombre, uuidv4());
    return ok(res, { cliente }, 201);
  } catch (err) {
    console.error('Error al buscar o crear el cliente:', err);
    return error(res, 'No se pudo registrar el cliente', 500);
  }
}

async function listarFrecuentes(req, res) {
  try {
    const clientes = await clienteModel.listarFrecuentes(req.usuario.restauranteId);
    return ok(res, { clientes });
  } catch (err) {
    console.error('Error al listar los clientes frecuentes:', err);
    return error(res, 'No se pudieron obtener los clientes frecuentes', 500);
  }
}

module.exports = { buscarOCrear, listarFrecuentes };
```

### Paso 4: Ruta

Crear `backend/src/routes/clientes.js`:

```js
const express = require('express');

const { buscarOCrear, listarFrecuentes } = require('../controllers/clienteController');
const { verificarToken, verificarRol } = require('../middlewares/auth');

const router = express.Router();

router.use(verificarToken);

router.post('/clientes', buscarOCrear);
router.get('/clientes/frecuentes', verificarRol('gerente', 'admin'), listarFrecuentes);

module.exports = router;
```

Montar en `backend/src/routes/index.js`: `router.use('/', require('./clientes'));`

### Paso 5: Integración con el cobro

Revisar `backend/src/controllers/pedidoController.js`, la función que maneja `POST /pedidos/:id/cobrar` (o como se llame — buscarla junto a `pedidoModel.cobrar`). Agregar, **antes** de llamar a `pedidoModel.cobrar`, un bloque que si viene `telefono_cliente` en el body, llama a `clienteModel.buscarOCrearPorTelefono` y pasa el `cliente_id` resultante a los datos que recibe `cobrar` (que ya acepta un objeto `datos` — solo hay que agregar `cliente_id` a la lista de campos que ese modelo persiste en el `UPDATE pedidos`). Si falla la búsqueda/creación de cliente, **no debe bloquear el cobro** — mismo patrón que los efectos secundarios de `cobrar` (inventario, contaduría, factura): registrar el error y seguir.

### Paso 6: Frontend

En el modal de cobro (buscar en `frontend/src/pages/POS.jsx` o `Mesas.jsx` el componente que dispara el cobro), agregar un campo opcional "Teléfono del cliente (opcional)" usando el componente `Campo` existente, sin validación de obligatoriedad. Si el campo está vacío, no se envía `telefono_cliente` en el payload.

### Verificación manual

1. Cobrar un pedido con teléfono capturado. Cobrar otro sin teléfono — confirmar que el cobro funciona igual en ambos casos.
2. `curl -X POST http://localhost:4000/api/clientes -H "Authorization: Bearer <token>" -d '{"telefono":"3001234567","nombre":"Juan"}'` y confirmar que responde 201.
3. Repetir el mismo POST con el mismo teléfono — confirmar que actualiza en vez de fallar por duplicado (gracias al `ON CONFLICT`).
4. Cobrar 2 pedidos distintos con el mismo teléfono y llamar a `GET /clientes/frecuentes` — debe aparecer con `cantidad_visitas: 2`.

### Commit

```bash
git commit -m "feat: captura opcional de cliente al cobrar y listado de clientes frecuentes"
```

---

## 6. Reparto de propinas por jornada

**Hallazgo clave que cambia el diseño:** `empleados_jornada` (`schema.sql:307-319`) guarda `nombre_empleado` como texto libre, **sin** relación a `usuarios.id`. Para calcular reparto "por ventas" (ponderado por lo que vendió cada mesero) hace falta poder cruzar un `empleado_jornada` con un `usuario` del sistema — hoy no se puede hacer de forma confiable (cruzar por nombre es frágil: typos, empleados sin cuenta de sistema como ayudantes de cocina, etc.). Este plan agrega un `usuario_id` opcional a `empleados_jornada` como parte de la tarea.

**Decisión de negocio a confirmar con el usuario/dueño antes de construir:** ¿la propina se reparte por igual entre todos los meseros del turno, o proporcional a cuánto vendió cada uno? Este plan implementa ambas políticas detrás de un campo de configuración (`restaurantes.politica_propinas`), pero alguien debe elegir el default.

**Archivos:**
- Modificar: `backend/src/config/schema.sql`
- Modificar: `backend/src/models/jornadaModel.js` (nueva función `repartirPropinas`, llamada desde `cerrar`)
- Modificar: `backend/src/controllers/configuracionController.js` (aceptar `politica_propinas` en `actualizarConfiguracion`)
- Modificar: `frontend/src/pages/Jornadas` o el modal de cierre de jornada (mostrar el desglose)

### Paso 1: Schema

```sql
-- Política de reparto de propinas del restaurante: se usa al cerrar jornada
-- para calcular cuánto le corresponde a cada mesero.
ALTER TABLE restaurantes ADD COLUMN IF NOT EXISTS politica_propinas VARCHAR(20) NOT NULL DEFAULT 'manual'
  CHECK (politica_propinas IN ('manual', 'igualitaria', 'por_ventas'));

-- Vincula el registro de turno con el usuario del sistema cuando aplica
-- (permite calcular reparto "por_ventas" cruzando con pedidos.usuario_id).
ALTER TABLE empleados_jornada ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS reparto_propinas (
  id UUID PRIMARY KEY,
  restaurante_id UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  jornada_id UUID NOT NULL REFERENCES jornadas(id) ON DELETE CASCADE,
  empleado_jornada_id UUID NOT NULL REFERENCES empleados_jornada(id) ON DELETE CASCADE,
  monto DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Paso 2: Modelo — cálculo del reparto

Agregar a `backend/src/models/jornadaModel.js`:

```js
async function repartirPropinas(jornadaId, restauranteId) {
  const { rows: restauranteRows } = await pool.query(
    `SELECT politica_propinas FROM restaurantes WHERE id = $1`,
    [restauranteId]
  );
  const politica = restauranteRows[0]?.politica_propinas;
  if (!politica || politica === 'manual') {
    return [];
  }

  const { rows: jornadaRows } = await pool.query(`SELECT * FROM jornadas WHERE id = $1`, [jornadaId]);
  const jornada = jornadaRows[0];
  if (!jornada) return [];

  const { rows: totalPropinaRows } = await pool.query(
    `SELECT COALESCE(SUM(propina), 0) AS total FROM pedidos
     WHERE restaurante_id = $1 AND sucursal_id = $2 AND estado = 'pagado' AND updated_at >= $3`,
    [restauranteId, jornada.sucursal_id, jornada.fecha_apertura]
  );
  const totalPropinas = Number(totalPropinaRows[0].total);
  if (totalPropinas <= 0) return [];

  const { rows: meseros } = await pool.query(
    `SELECT * FROM empleados_jornada WHERE jornada_id = $1 AND rol_empleado = 'mesero'`,
    [jornadaId]
  );
  if (meseros.length === 0) return [];

  let repartos;
  if (politica === 'igualitaria') {
    const montoIgual = totalPropinas / meseros.length;
    repartos = meseros.map((m) => ({ empleado_jornada_id: m.id, monto: montoIgual }));
  } else {
    // por_ventas: ponderado por lo que vendió cada mesero con cuenta de sistema.
    const conUsuario = meseros.filter((m) => m.usuario_id);
    if (conUsuario.length === 0) return [];

    const { rows: ventasPorUsuario } = await pool.query(
      `SELECT usuario_id, COALESCE(SUM(total), 0) AS total_ventas FROM pedidos
       WHERE restaurante_id = $1 AND sucursal_id = $2 AND estado = 'pagado' AND updated_at >= $3
       GROUP BY usuario_id`,
      [restauranteId, jornada.sucursal_id, jornada.fecha_apertura]
    );
    const ventasMap = new Map(ventasPorUsuario.map((v) => [v.usuario_id, Number(v.total_ventas)]));
    const totalVentasMeseros = conUsuario.reduce((suma, m) => suma + (ventasMap.get(m.usuario_id) || 0), 0);

    if (totalVentasMeseros <= 0) return [];

    repartos = conUsuario.map((m) => ({
      empleado_jornada_id: m.id,
      monto: totalPropinas * ((ventasMap.get(m.usuario_id) || 0) / totalVentasMeseros),
    }));
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultados = [];
    for (const r of repartos) {
      const { rows } = await client.query(
        `INSERT INTO reparto_propinas (id, restaurante_id, jornada_id, empleado_jornada_id, monto)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [uuidv4(), restauranteId, jornadaId, r.empleado_jornada_id, r.monto]
      );
      resultados.push(rows[0]);
    }
    await client.query('COMMIT');
    return resultados;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { /* ...funciones existentes..., */ repartirPropinas };
```

(Agregar `const { v4: uuidv4 } = require('uuid');` al inicio del archivo si no está ya.)

### Paso 3: Enganchar en el cierre de jornada

En `backend/src/controllers/jornadaController.js`, dentro de `cerrarJornada`, después de `const resultado = await jornadaModel.cerrar(...)` y antes del `return ok(res, resultado)`, agregar — **sin bloquear la respuesta si falla** (mismo patrón que los efectos secundarios de `cobrar` en pedidos):

```js
    let repartoPropinas = [];
    try {
      repartoPropinas = await jornadaModel.repartirPropinas(jornada.id, req.usuario.restauranteId);
    } catch (err) {
      console.error('Error al repartir las propinas de la jornada:', err);
    }

    return ok(res, { ...resultado, reparto_propinas: repartoPropinas });
```

### Paso 4: Configuración

En `backend/src/controllers/configuracionController.js`, `actualizarConfiguracion` ya construye `datos = { ...req.body }` y lo pasa tal cual a `restauranteModel.actualizarConfiguracion` — agregar validación de `politica_propinas` igual que las de `regimen`/`modo_operacion`:

```js
const POLITICAS_PROPINAS_VALIDAS = ['manual', 'igualitaria', 'por_ventas'];
// ...
if (politica_propinas !== undefined && !POLITICAS_PROPINAS_VALIDAS.includes(politica_propinas)) {
  return error(res, `Política de propinas inválida. Valores permitidos: ${POLITICAS_PROPINAS_VALIDAS.join(', ')}`, 400);
}
```

(Y agregar `politica_propinas` a la desestructuración del `req.body` al inicio de la función.)

### Paso 5: Frontend

- `Configuracion.jsx`: agregar un selector "Política de reparto de propinas" (Manual / Igualitaria / Por ventas).
- Donde se listan `empleados_jornada` al abrir/gestionar el turno: si el empleado tiene rol mesero, permitir opcionalmente vincularlo a un usuario del sistema (select de usuarios del restaurante) — este es el campo `usuario_id` nuevo.
- Pantalla de cierre de jornada: si `reparto_propinas` viene con datos en la respuesta, mostrar una tabla "Reparto de propinas" (empleado → monto) antes de confirmar el cierre.

### Verificación manual

1. Configurar `politica_propinas = 'igualitaria'`.
2. Abrir jornada, registrar 2 `empleados_jornada` con `rol_empleado = 'mesero'`.
3. Cobrar pedidos con propina.
4. Cerrar la jornada y confirmar en la respuesta que `reparto_propinas` tiene 2 entradas con montos iguales que suman el total de propinas.
5. Repetir con `politica_propinas = 'por_ventas'`, vinculando cada `empleado_jornada` a un `usuario_id` distinto, y confirmar que el reparto es proporcional a las ventas de cada uno.

### Commit

```bash
git commit -m "feat: reparto automático de propinas al cerrar jornada"
```

---

## 7. Reservas de mesa

**Qué resuelve:** `mesas.estado` ya incluye `'reservada'` (`schema.sql:159-160`) pero es un flag sin contenido — nadie sabe a nombre de quién es, para cuándo, ni cuántas personas. Esta tarea le da sustancia a ese estado.

**Decisión de diseño (YAGNI):** no se agrega un job/cron de backend para marcar automáticamente `mesas.estado = 'reservada'`. Se calcula en el frontend al cargar `Mesas.jsx` (comparar la hora actual contra las reservas del día ya cargadas) — evita meter infraestructura de scheduler para un caso que no la necesita.

**Archivos:**
- Modificar: `backend/src/config/schema.sql`
- Crear: `backend/src/models/reservaModel.js`
- Crear: `backend/src/controllers/reservaController.js`
- Crear: `backend/src/routes/reservas.js`
- Modificar: `backend/src/routes/index.js`
- Modificar: `frontend/src/pages/Mesas.jsx`

### Paso 1: Schema

```sql
CREATE TABLE IF NOT EXISTS reservas (
  id UUID PRIMARY KEY,
  restaurante_id UUID NOT NULL REFERENCES restaurantes(id) ON DELETE CASCADE,
  mesa_id UUID REFERENCES mesas(id) ON DELETE SET NULL,
  nombre_cliente VARCHAR(255) NOT NULL,
  telefono VARCHAR(20),
  personas INTEGER NOT NULL DEFAULT 2,
  fecha_hora TIMESTAMPTZ NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'confirmada'
    CHECK (estado IN ('confirmada', 'llegada', 'cancelada', 'no_show')),
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Paso 2: Modelo

Crear `backend/src/models/reservaModel.js`:

```js
const pool = require('../config/database');

async function crear(datos) {
  const { rows } = await pool.query(
    `INSERT INTO reservas (id, restaurante_id, mesa_id, nombre_cliente, telefono, personas, fecha_hora, notas)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [datos.id, datos.restaurante_id, datos.mesa_id ?? null, datos.nombre_cliente, datos.telefono ?? null,
     datos.personas ?? 2, datos.fecha_hora, datos.notas ?? null]
  );
  return rows[0];
}

async function listarPorFecha(restauranteId, fecha) {
  const { rows } = await pool.query(
    `SELECT * FROM reservas
     WHERE restaurante_id = $1 AND DATE(fecha_hora AT TIME ZONE 'America/Bogota') = $2
       AND estado != 'cancelada'
     ORDER BY fecha_hora ASC`,
    [restauranteId, fecha]
  );
  return rows;
}

async function actualizarEstado(id, restauranteId, estado) {
  const { rows } = await pool.query(
    `UPDATE reservas SET estado = $1 WHERE id = $2 AND restaurante_id = $3 RETURNING *`,
    [estado, id, restauranteId]
  );
  return rows[0] || null;
}

module.exports = { crear, listarPorFecha, actualizarEstado };
```

### Paso 3: Controller

Crear `backend/src/controllers/reservaController.js`:

```js
const { v4: uuidv4 } = require('uuid');

const reservaModel = require('../models/reservaModel');
const { ok, error } = require('../utils/respuestas');

const ESTADOS_VALIDOS = ['confirmada', 'llegada', 'cancelada', 'no_show'];

async function crearReserva(req, res) {
  const { mesa_id, nombre_cliente, telefono, personas, fecha_hora, notas } = req.body;

  if (!nombre_cliente || !fecha_hora) {
    return error(res, 'nombre_cliente y fecha_hora son obligatorios', 400);
  }

  try {
    const reserva = await reservaModel.crear({
      id: uuidv4(),
      restaurante_id: req.usuario.restauranteId,
      mesa_id,
      nombre_cliente,
      telefono,
      personas,
      fecha_hora,
      notas,
    });
    return ok(res, { reserva }, 201);
  } catch (err) {
    console.error('Error al crear la reserva:', err);
    return error(res, 'No se pudo crear la reserva', 500);
  }
}

async function listarPorFecha(req, res) {
  const fecha = req.query.fecha;
  if (!fecha) {
    return error(res, 'El parámetro fecha es obligatorio', 400);
  }

  try {
    const reservas = await reservaModel.listarPorFecha(req.usuario.restauranteId, fecha);
    return ok(res, { reservas });
  } catch (err) {
    console.error('Error al listar las reservas:', err);
    return error(res, 'No se pudieron obtener las reservas', 500);
  }
}

async function actualizarEstado(req, res) {
  const { estado } = req.body;
  if (!estado || !ESTADOS_VALIDOS.includes(estado)) {
    return error(res, `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}`, 400);
  }

  try {
    const reserva = await reservaModel.actualizarEstado(req.params.id, req.usuario.restauranteId, estado);
    if (!reserva) {
      return error(res, 'Reserva no encontrada', 404);
    }
    return ok(res, { reserva });
  } catch (err) {
    console.error('Error al actualizar el estado de la reserva:', err);
    return error(res, 'No se pudo actualizar la reserva', 500);
  }
}

module.exports = { crearReserva, listarPorFecha, actualizarEstado };
```

### Paso 4: Ruta

Crear `backend/src/routes/reservas.js`:

```js
const express = require('express');

const { crearReserva, listarPorFecha, actualizarEstado } = require('../controllers/reservaController');
const { verificarToken, verificarRol } = require('../middlewares/auth');

const router = express.Router();

router.use(verificarToken);

router.get('/reservas', listarPorFecha);
router.post('/reservas', verificarRol('cajero', 'gerente', 'admin'), crearReserva);
router.put('/reservas/:id/estado', verificarRol('cajero', 'gerente', 'admin'), actualizarEstado);

module.exports = router;
```

Montar en `backend/src/routes/index.js`: `router.use('/', require('./reservas'));`

### Paso 5: Frontend

En `frontend/src/pages/Mesas.jsx`:
- Al cargar el plano de mesas, también pedir `GET /reservas?fecha=hoy`.
- Para cada mesa con una reserva `confirmada` cuya `fecha_hora` esté dentro de los próximos 30 minutos, mostrar un indicador visual (badge con el nombre y hora) sobre la mesa en el plano.
- Un botón/modal simple para crear una reserva (nombre, teléfono, personas, fecha/hora, mesa opcional) y otro para marcar "Llegó" (`PUT /reservas/:id/estado` con `estado: 'llegada'`).

### Verificación manual

1. Crear una reserva para dentro de 10 minutos en una mesa específica.
2. Cargar `Mesas.jsx` y confirmar que aparece el indicador visual sobre esa mesa.
3. Marcar la reserva como "Llegó" y confirmar que el indicador desaparece.
4. `curl "http://localhost:4000/api/reservas?fecha=2026-07-13" -H "Authorization: Bearer <token>"` y confirmar que no devuelve reservas canceladas.

### Commit

```bash
git commit -m "feat: agregar gestión de reservas de mesa"
```

---

## 8. Carta pública por QR (fase 1: solo lectura)

**Alcance de esta fase, explícito:** el cliente escanea un QR y ve la carta desde su celular. **No** se implementa en esta fase que el cliente pueda agregar ítems al pedido — eso requiere que el dueño decida si el pedido del cliente entra directo a cocina o pasa primero por confirmación del mesero (ver la conversación previa). Construir eso ahora sería adelantarse a una decisión de negocio no tomada. Esta fase es de solo lectura y ya es valiosa por sí sola (reduce preguntas de precio/ingredientes al mesero).

**Archivos:**
- Modificar: `backend/src/config/schema.sql` (columna `codigo_qr` en `mesas`)
- Crear: `backend/src/models/publicoModel.js`
- Crear: `backend/src/controllers/publicoController.js`
- Crear: `backend/src/routes/publico.js`
- Modificar: `backend/src/routes/index.js`
- Crear: `frontend/src/pages/CartaPublica.jsx`
- Modificar: `frontend/src/App.jsx` (nueva ruta pública)
- Modificar: `backend/package.json` (agregar `express-rate-limit`)

### Paso 1: Schema

```sql
-- Código corto y opaco para el QR de cada mesa: no se expone el UUID
-- interno en una URL pública.
ALTER TABLE mesas ADD COLUMN IF NOT EXISTS codigo_qr VARCHAR(20) UNIQUE;
```

Como es una migración retroactiva (mesas existentes quedan con `codigo_qr = NULL`), agregar en `backend/src/config/initDB.js` (junto a los demás one-off migrations que `IF NOT EXISTS` no puede expresar) un backfill:

```js
const { rows: mesasSinCodigo } = await pool.query(`SELECT id FROM mesas WHERE codigo_qr IS NULL`);
for (const mesa of mesasSinCodigo) {
  await pool.query(`UPDATE mesas SET codigo_qr = $1 WHERE id = $2`, [uuidv4().slice(0, 8), mesa.id]);
}
```

(Revisar el patrón exacto de `initDB.js` para las migraciones one-off existentes antes de agregar esta, y seguirlo — no reinventar la estructura del archivo.)

### Paso 2: Modelo

Crear `backend/src/models/publicoModel.js`:

```js
const pool = require('../config/database');

async function obtenerMenuPorCodigoQr(codigoQr) {
  const { rows: mesaRows } = await pool.query(
    `SELECT m.id AS mesa_id, m.numero, m.estado, m.restaurante_id
     FROM mesas m WHERE m.codigo_qr = $1 AND m.activa = true`,
    [codigoQr]
  );
  const mesa = mesaRows[0];
  if (!mesa) return null;

  const { rows: restauranteRows } = await pool.query(
    `SELECT nombre, logo_url FROM restaurantes WHERE id = $1`,
    [mesa.restaurante_id]
  );

  const { rows: categorias } = await pool.query(
    `SELECT id, nombre FROM categorias WHERE restaurante_id = $1 AND activa = true ORDER BY orden`,
    [mesa.restaurante_id]
  );

  const { rows: productos } = await pool.query(
    `SELECT id, categoria_id, nombre, descripcion, imagen_url, precio, tipo
     FROM productos
     WHERE restaurante_id = $1 AND activo = true AND disponible = true
       AND disponible_para IN ('todos', 'mesa')
     ORDER BY orden`,
    [mesa.restaurante_id]
  );

  return {
    restaurante: restauranteRows[0],
    mesa: { numero: mesa.numero, estado: mesa.estado },
    categorias,
    productos,
  };
}

module.exports = { obtenerMenuPorCodigoQr };
```

Nota deliberada: **no** se reutiliza `productoModel`/`categoriaModel` porque esos módulos probablemente devuelven campos internos (costo, timestamps de auditoría) que no deben exponerse en una ruta pública sin autenticación — esta consulta selecciona explícitamente solo columnas seguras de mostrar a un desconocido.

### Paso 3: Controller

Crear `backend/src/controllers/publicoController.js`:

```js
const publicoModel = require('../models/publicoModel');
const { ok, error } = require('../utils/respuestas');

async function obtenerMenu(req, res) {
  try {
    const menu = await publicoModel.obtenerMenuPorCodigoQr(req.params.codigoQr);
    if (!menu) {
      return error(res, 'Mesa no encontrada', 404);
    }
    return ok(res, { menu });
  } catch (err) {
    console.error('Error al obtener el menú público:', err);
    return error(res, 'No se pudo obtener el menú', 500);
  }
}

module.exports = { obtenerMenu };
```

### Paso 4: Ruta pública con rate limiting

Esta ruta **no lleva `verificarToken`** (es pública) — por eso necesita su propio límite de tasa, ya que cualquiera en internet puede llamarla sin autenticarse:

```bash
cd backend && npm install express-rate-limit
```

Crear `backend/src/routes/publico.js`:

```js
const express = require('express');
const rateLimit = require('express-rate-limit');

const { obtenerMenu } = require('../controllers/publicoController');

const router = express.Router();

const limitador = rateLimit({ windowMs: 60 * 1000, max: 30 });

router.get('/publico/mesa/:codigoQr/menu', limitador, obtenerMenu);

module.exports = router;
```

Montar en `backend/src/routes/index.js`: `router.use('/', require('./publico'));` — **antes** de cualquier `router.use(verificarToken)` de otros routers no importa, porque Express solo aplica middleware dentro de su propio sub-router (cada archivo de rutas ya hace `router.use(verificarToken)` internamente, así que esta ruta pública queda aislada de esos por diseño, igual que ya hace `/pagos/webhook` en `pagos.js:8-10`).

### Paso 5: Frontend

Crear `frontend/src/pages/CartaPublica.jsx` — página standalone, sin `Layout`/`ProtectedRoute`:

```jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import api from '../utils/api';
import Spinner from '../components/Spinner';
import { formatearPrecio } from '../utils/formato';

function CartaPublica() {
  const { codigoQr } = useParams();
  const [menu, setMenu] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get(`/publico/mesa/${codigoQr}/menu`)
      .then((res) => setMenu(res.data.datos.menu))
      .catch(() => setError(true))
      .finally(() => setCargando(false));
  }, [codigoQr]);

  if (cargando) return <Spinner />;
  if (error || !menu) return <p>No se pudo cargar la carta. Verifica el código QR.</p>;

  return (
    <div>
      <h1>{menu.restaurante.nombre}</h1>
      <p>Mesa {menu.mesa.numero}</p>
      {menu.categorias.map((cat) => (
        <section key={cat.id}>
          <h2>{cat.nombre}</h2>
          {menu.productos
            .filter((p) => p.categoria_id === cat.id)
            .map((p) => (
              <div key={p.id}>
                <strong>{p.nombre}</strong> — {formatearPrecio(p.precio)}
                {p.descripcion && <p>{p.descripcion}</p>}
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}

export default CartaPublica;
```

En `frontend/src/App.jsx`, agregar junto a las demás rutas públicas (antes de las que usan `ConLayout`):

```jsx
import CartaPublica from './pages/CartaPublica';
// ...
<Route path="/carta/:codigoQr" element={<CartaPublica />} />
```

`api.js` sirve para esto sin cambios: su interceptor solo agrega el header `Authorization` **si hay token guardado**; si el cliente que escanea el QR no tiene sesión, simplemente no se envía ese header y el backend no lo exige en esta ruta.

### Paso 6: Mostrar el QR al dueño

En `Mesas.jsx` o `Configuracion.jsx`, agregar un botón "Ver código QR" por mesa que muestre/genere una imagen QR apuntando a `https://<dominio>/carta/<codigo_qr>` (usar una librería liviana de generación de QR en el cliente, ej. `qrcode.react`, o un servicio que ya tengan — no inventar generación de QR en el backend si no hace falta imprimirlo desde ahí).

### Verificación manual

1. Aplicar la migración y confirmar que las mesas existentes tienen `codigo_qr` no nulo: `SELECT numero, codigo_qr FROM mesas;`
2. `curl http://localhost:4000/api/publico/mesa/<codigo_qr>/menu` (sin header de autorización) y confirmar que devuelve el menú.
3. Llamar el mismo endpoint 31 veces en un minuto y confirmar que la request 31 devuelve 429 (rate limit).
4. Abrir `/carta/<codigo_qr>` en el navegador (sin sesión iniciada) y confirmar que se ve la carta.
5. Marcar un producto como `disponible = false` y confirmar que desaparece de la carta pública.

### Commit

```bash
git add backend/src/config/schema.sql backend/src/config/initDB.js backend/src/models/publicoModel.js backend/src/controllers/publicoController.js backend/src/routes/publico.js backend/src/routes/index.js backend/package.json backend/package-lock.json frontend/src/pages/CartaPublica.jsx frontend/src/App.jsx
git commit -m "feat: agregar carta pública de solo lectura accesible por QR"
```

---

## Qué queda fuera deliberadamente (fase 2, no planeada aquí)

- **Puntos/cashback de fidelización** — depende de que la tarea 5 (CRM básico) ya tenga datos reales de clientes recurrentes.
- **Marketing segmentado con Brevo** (cumpleaños, inactividad) — depende de la tarea 5 por la misma razón; no tiene sentido construirlo antes.
- **Autopedido QR con escritura a cocina** — depende de que el dueño decida la política de confirmación del mesero (ver tarea 8).
- **Integración con Rappi/Uber Eats** — esfuerzo muy alto y específico por plataforma; no priorizar sin demanda confirmada de clientes reales.
