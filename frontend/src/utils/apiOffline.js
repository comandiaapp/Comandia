import { v4 as uuidv4 } from 'uuid';

import { localDb } from '../db/database';

const ESTADOS_ACTIVOS = ['abierto', 'enviado_cocina', 'listo', 'cuenta_pedida'];

export class OfflineApiError extends Error {
  constructor(mensaje, status = 404) {
    super(mensaje);
    this.status = status;
  }
}

async function encolar(tabla, operacion, datos) {
  localDb.ejecutar(`INSERT INTO sync_queue (id, tabla, operacion, datos) VALUES (?, ?, ?, ?)`, [
    uuidv4(),
    tabla,
    operacion,
    JSON.stringify(datos),
  ]);
}

function actualizarEstadoMesaCache(mesaId, estado, extra = {}) {
  const fila = localDb.consultarUno(`SELECT datos FROM mesas_cache WHERE id = ?`, [mesaId]);
  if (!fila) return;
  const mesa = { ...JSON.parse(fila.datos), estado, ...extra };
  localDb.ejecutar(`UPDATE mesas_cache SET datos = ? WHERE id = ?`, [JSON.stringify(mesa), mesaId]);
}

function upsertMesaCache(mesa) {
  if (!mesa?.id) return;
  localDb.ejecutar(`INSERT OR REPLACE INTO mesas_cache (id, area_id, datos) VALUES (?, ?, ?)`, [
    mesa.id,
    mesa.area_id ?? null,
    JSON.stringify(mesa),
  ]);
}

function upsertPedidoFila(pedido) {
  const ahora = new Date().toISOString();
  localDb.ejecutar(
    `INSERT OR REPLACE INTO pedidos_local
       (id, mesa_id, numero_jornada, tipo, estado, subtotal, total, descuento, impuesto, propina, notas, creado_offline, sincronizado, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)`,
    [
      pedido.id,
      pedido.mesa_id ?? null,
      pedido.numero_jornada ?? null,
      pedido.tipo || 'mesa',
      pedido.estado,
      Number(pedido.subtotal || 0),
      Number(pedido.total || 0),
      Number(pedido.descuento || 0),
      Number(pedido.impuesto || 0),
      Number(pedido.propina || 0),
      pedido.notas ?? null,
      pedido.created_at || ahora,
      pedido.updated_at || ahora,
    ]
  );
}

function upsertItemFila(item, pedidoId) {
  localDb.ejecutar(
    `INSERT OR REPLACE INTO pedido_items_local
       (id, pedido_id, producto_id, nombre_producto, precio_unitario, cantidad, subtotal, notas, modificadores, estado, creado_offline, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      item.id,
      pedidoId,
      item.producto_id ?? null,
      item.nombre_producto,
      Number(item.precio_unitario),
      item.cantidad,
      Number(item.subtotal),
      item.notas ?? null,
      JSON.stringify(item.modificadores || []),
      item.estado || 'pendiente',
      item.created_at || new Date().toISOString(),
    ]
  );
}

// Rutas cuyas respuestas exitosas (online) se reflejan en la copia local. Sin
// esto, un pedido abierto mientras había conexión no existe en pedidos_local
// y cualquier operación posterior sobre él falla con "no encontrado" en
// cuanto se pierde la conexión a mitad de turno.
const RUTAS_MIRROR = [
  { metodo: 'post', re: /^\/api\/pedidos$/, tipo: 'pedido_completo' },
  { metodo: 'get', re: /^\/api\/pedidos\/mesa\/([^/]+)$/, tipo: 'pedido_completo' },
  { metodo: 'get', re: /^\/api\/pedidos\/([^/]+)$/, tipo: 'pedido_completo' },
  { metodo: 'post', re: /^\/api\/pedidos\/([^/]+)\/items$/, tipo: 'item_upsert' },
  { metodo: 'put', re: /^\/api\/pedidos\/([^/]+)\/items\/([^/]+)$/, tipo: 'item_upsert' },
  { metodo: 'delete', re: /^\/api\/pedidos\/([^/]+)\/items\/([^/]+)$/, tipo: 'item_eliminar' },
  { metodo: 'post', re: /^\/api\/pedidos\/([^/]+)\/enviar-cocina$/, tipo: 'pedido_solo' },
  { metodo: 'post', re: /^\/api\/pedidos\/([^/]+)\/pedir-cuenta$/, tipo: 'pedido_solo' },
  { metodo: 'post', re: /^\/api\/pedidos\/([^/]+)\/reabrir-cuenta$/, tipo: 'pedido_solo' },
  { metodo: 'post', re: /^\/api\/pedidos\/([^/]+)\/cobrar$/, tipo: 'pedido_solo' },
  { metodo: 'post', re: /^\/api\/pedidos\/([^/]+)\/cancelar$/, tipo: 'pedido_solo' },
  { metodo: 'get', re: /^\/api\/mesas\/plano$/, tipo: 'plano' },
  { metodo: 'get', re: /^\/api\/mesas$/, tipo: 'mesas_lista' },
  { metodo: 'get', re: /^\/api\/mesas\/([^/]+)$/, tipo: 'mesa_una' },
  { metodo: 'patch', re: /^\/api\/mesas\/([^/]+)\/estado$/, tipo: 'mesa_una' },
];

// Se llama desde el interceptor de éxito de axios (nunca bloquea la
// respuesta real al usuario): cualquier error acá se traga, perder un
// espejo local no debe romper el flujo online normal.
export async function mirrorRespuestaExitosa(config, data) {
  try {
    const metodo = (config.method || 'get').toLowerCase();
    const url = (config.url || '').split('?')[0];
    const ruta = RUTAS_MIRROR.find((r) => r.metodo === metodo && r.re.test(url));
    if (!ruta) return;

    const datos = data?.datos;
    if (!datos) return;

    await localDb.init();

    if (ruta.tipo === 'plano' && Array.isArray(datos.plano)) {
      for (const area of datos.plano) {
        for (const mesa of area.mesas || []) upsertMesaCache(mesa);
      }
    } else if (ruta.tipo === 'mesas_lista' && Array.isArray(datos.mesas)) {
      for (const mesa of datos.mesas) upsertMesaCache(mesa);
    } else if (ruta.tipo === 'mesa_una' && datos.mesa) {
      upsertMesaCache(datos.mesa);
    } else if (datos.pedido) {
      upsertPedidoFila(datos.pedido);

      if (ruta.tipo === 'pedido_completo' && Array.isArray(datos.pedido.items)) {
        localDb.ejecutar(`DELETE FROM pedido_items_local WHERE pedido_id = ?`, [datos.pedido.id]);
        for (const item of datos.pedido.items) upsertItemFila(item, datos.pedido.id);
      } else if (ruta.tipo === 'item_upsert' && datos.item) {
        upsertItemFila(datos.item, datos.pedido.id);
      } else if (ruta.tipo === 'item_eliminar' && datos.item) {
        localDb.ejecutar(`DELETE FROM pedido_items_local WHERE id = ?`, [datos.item.id]);
      }
    }

    await localDb.guardar();
  } catch (err) {
    console.warn('No se pudo reflejar la respuesta en la copia local:', err.message);
  }
}

function filaAItem(fila) {
  return {
    id: fila.id,
    pedido_id: fila.pedido_id,
    producto_id: fila.producto_id,
    nombre_producto: fila.nombre_producto,
    precio_unitario: Number(fila.precio_unitario),
    cantidad: fila.cantidad,
    subtotal: Number(fila.subtotal),
    notas: fila.notas,
    estado: fila.estado,
    modificadores: JSON.parse(fila.modificadores || '[]'),
  };
}

function construirPedido(pedidoId) {
  const p = localDb.consultarUno(`SELECT * FROM pedidos_local WHERE id = ?`, [pedidoId]);
  if (!p) return null;
  const items = localDb
    .consultar(`SELECT * FROM pedido_items_local WHERE pedido_id = ? ORDER BY created_at ASC`, [pedidoId])
    .map(filaAItem);

  return {
    id: p.id,
    mesa_id: p.mesa_id,
    numero_jornada: p.numero_jornada,
    tipo: p.tipo,
    estado: p.estado,
    subtotal: Number(p.subtotal),
    total: Number(p.total),
    descuento: Number(p.descuento),
    impuesto: Number(p.impuesto),
    propina: Number(p.propina),
    notas: p.notas,
    created_at: p.created_at,
    updated_at: p.updated_at,
    items,
  };
}

// Espeja pedidoModel.recalcularTotales del backend para que el total mostrado
// en el POS no cambie cuando la operación finalmente sincronice.
function recalcularPedidoLocal(pedidoId) {
  const suma = localDb.consultarUno(
    `SELECT COALESCE(SUM(subtotal), 0) AS total FROM pedido_items_local WHERE pedido_id = ? AND estado != 'cancelado'`,
    [pedidoId]
  );
  const pedido = localDb.consultarUno(`SELECT * FROM pedidos_local WHERE id = ?`, [pedidoId]);
  const subtotal = Number(suma.total);
  const total = Math.max(0, subtotal - Number(pedido.descuento) + Number(pedido.impuesto) + Number(pedido.propina));
  localDb.ejecutar(`UPDATE pedidos_local SET subtotal = ?, total = ?, updated_at = ? WHERE id = ?`, [
    subtotal,
    total,
    new Date().toISOString(),
    pedidoId,
  ]);
  return construirPedido(pedidoId);
}

function pedidoActivoDeMesa(mesaId) {
  return localDb.consultarUno(
    `SELECT * FROM pedidos_local WHERE mesa_id = ? AND estado IN ('abierto','enviado_cocina','listo','cuenta_pedida')
     ORDER BY created_at DESC LIMIT 1`,
    [mesaId]
  );
}

// --- Lecturas (mesas / productos / categorías / áreas) ---

function hProductos(match, body, params) {
  let productos = localDb.consultar(`SELECT datos FROM productos_cache`).map((f) => JSON.parse(f.datos));
  if (params.categoria_id !== undefined) productos = productos.filter((p) => p.categoria_id === params.categoria_id);
  if (params.disponible !== undefined) {
    const quiere = params.disponible === true || params.disponible === 'true';
    productos = productos.filter((p) => Boolean(p.disponible) === quiere);
  }
  if (params.tipo !== undefined) productos = productos.filter((p) => p.tipo === params.tipo);
  if (params.disponible_para !== undefined) {
    productos = productos.filter((p) => p.disponible_para === params.disponible_para);
  }
  return { productos };
}

function hCategorias() {
  return { categorias: localDb.consultar(`SELECT datos FROM categorias_cache`).map((f) => JSON.parse(f.datos)) };
}

function hAreas() {
  return { areas: localDb.consultar(`SELECT datos FROM areas_cache`).map((f) => JSON.parse(f.datos)) };
}

function hMesas(match, body, params) {
  let mesas = localDb.consultar(`SELECT datos FROM mesas_cache`).map((f) => JSON.parse(f.datos));
  if (params.area_id) mesas = mesas.filter((m) => m.area_id === params.area_id);
  return { mesas };
}

function hMesa(match) {
  const fila = localDb.consultarUno(`SELECT datos FROM mesas_cache WHERE id = ?`, [match[1]]);
  if (!fila) throw new OfflineApiError('Mesa no encontrada');
  return { mesa: JSON.parse(fila.datos) };
}

function hPlano() {
  const areas = localDb
    .consultar(`SELECT datos FROM areas_cache`)
    .map((f) => JSON.parse(f.datos))
    .filter((a) => !a.es_remota);
  const mesas = localDb.consultar(`SELECT datos FROM mesas_cache`).map((f) => JSON.parse(f.datos));
  const plano = areas.map((area) => ({ ...area, mesas: mesas.filter((m) => m.area_id === area.id) }));
  const sinArea = mesas.filter((m) => !m.area_id);
  if (sinArea.length > 0) plano.push({ id: null, nombre: 'Sin área', mesas: sinArea });
  return { plano };
}

async function hCambiarEstadoMesa(match, body) {
  const mesaId = match[1];
  const { estado } = body;
  const fila = localDb.consultarUno(`SELECT datos FROM mesas_cache WHERE id = ?`, [mesaId]);
  if (!fila) throw new OfflineApiError('Mesa no encontrada');
  actualizarEstadoMesaCache(mesaId, estado);
  await encolar('mesas', 'cambiar_estado', { mesa_id: mesaId, estado });
  const actualizada = localDb.consultarUno(`SELECT datos FROM mesas_cache WHERE id = ?`, [mesaId]);
  return { mesa: JSON.parse(actualizada.datos) };
}

// --- Pedidos ---

function hLeerPedidoPorMesa(match) {
  const pedido = pedidoActivoDeMesa(match[1]);
  if (!pedido) throw new OfflineApiError('No hay un pedido activo para esta mesa');
  return { pedido: construirPedido(pedido.id) };
}

async function hCrearPedido(match, body) {
  const { mesa_id, tipo, notas } = body;

  if (mesa_id) {
    const existente = pedidoActivoDeMesa(mesa_id);
    if (existente) return { pedido: construirPedido(existente.id) };
  }

  const id = uuidv4();
  const ahora = new Date().toISOString();
  localDb.ejecutar(
    `INSERT INTO pedidos_local (id, mesa_id, tipo, estado, notas, creado_offline, created_at, updated_at)
     VALUES (?, ?, ?, 'abierto', ?, 1, ?, ?)`,
    [id, mesa_id ?? null, tipo || 'mesa', notas ?? null, ahora, ahora]
  );
  if (mesa_id) actualizarEstadoMesaCache(mesa_id, 'ocupada');
  await encolar('pedidos', 'crear', { id_local: id, mesa_id, tipo: tipo || 'mesa', notas });

  return { pedido: construirPedido(id) };
}

async function hAgregarItem(match, body) {
  const pedidoId = match[1];
  const pedido = localDb.consultarUno(`SELECT * FROM pedidos_local WHERE id = ?`, [pedidoId]);
  if (!pedido) throw new OfflineApiError('Pedido no encontrado');
  if (!ESTADOS_ACTIVOS.includes(pedido.estado)) {
    throw new OfflineApiError(`El pedido está en estado '${pedido.estado}' y ya no admite más productos`, 400);
  }

  const { producto_id, nombre_producto, precio_unitario, cantidad, notas, modificadores } = body;
  if (!nombre_producto || precio_unitario === undefined || precio_unitario === null) {
    throw new OfflineApiError('El nombre y el precio del producto son obligatorios', 400);
  }

  const id = uuidv4();
  const mods = modificadores || [];
  const cant = cantidad ?? 1;
  const precioMods = mods.reduce((suma, m) => suma + Number(m.precio_extra || 0), 0);
  const subtotal = (Number(precio_unitario) + precioMods) * cant;

  localDb.ejecutar(
    `INSERT INTO pedido_items_local
       (id, pedido_id, producto_id, nombre_producto, precio_unitario, cantidad, subtotal, notas, modificadores, estado, creado_offline, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente', 1, ?)`,
    [
      id,
      pedidoId,
      producto_id ?? null,
      nombre_producto,
      precio_unitario,
      cant,
      subtotal,
      notas ?? null,
      JSON.stringify(mods),
      new Date().toISOString(),
    ]
  );

  const pedidoActualizado = recalcularPedidoLocal(pedidoId);
  await encolar('pedido_items', 'crear', {
    id_local: id,
    pedido_id_local: pedidoId,
    producto_id,
    nombre_producto,
    precio_unitario,
    cantidad: cant,
    notas,
    modificadores: mods,
  });

  const itemFila = localDb.consultarUno(`SELECT * FROM pedido_items_local WHERE id = ?`, [id]);
  return { item: filaAItem(itemFila), pedido: pedidoActualizado };
}

async function hActualizarItem(match, body) {
  const [, pedidoId, itemId] = match;
  const itemFila = localDb.consultarUno(`SELECT * FROM pedido_items_local WHERE id = ? AND pedido_id = ?`, [
    itemId,
    pedidoId,
  ]);
  if (!itemFila) throw new OfflineApiError('Item no encontrado');

  const nuevaCantidad = body.cantidad !== undefined ? body.cantidad : itemFila.cantidad;
  const nuevasNotas = body.notas !== undefined ? body.notas : itemFila.notas;
  const mods = JSON.parse(itemFila.modificadores || '[]');
  const precioMods = mods.reduce((suma, m) => suma + Number(m.precio_extra || 0), 0);
  const nuevoSubtotal = (Number(itemFila.precio_unitario) + precioMods) * nuevaCantidad;

  localDb.ejecutar(`UPDATE pedido_items_local SET cantidad = ?, notas = ?, subtotal = ? WHERE id = ?`, [
    nuevaCantidad,
    nuevasNotas,
    nuevoSubtotal,
    itemId,
  ]);

  const pedidoActualizado = recalcularPedidoLocal(pedidoId);
  await encolar('pedido_items', 'actualizar', {
    pedido_id_local: pedidoId,
    item_id_local: itemId,
    cantidad: nuevaCantidad,
    notas: nuevasNotas,
  });

  const actualizada = localDb.consultarUno(`SELECT * FROM pedido_items_local WHERE id = ?`, [itemId]);
  return { item: filaAItem(actualizada), pedido: pedidoActualizado };
}

async function hEliminarItem(match) {
  const [, pedidoId, itemId] = match;
  const itemFila = localDb.consultarUno(`SELECT * FROM pedido_items_local WHERE id = ? AND pedido_id = ?`, [
    itemId,
    pedidoId,
  ]);
  if (!itemFila) throw new OfflineApiError('Item no encontrado');

  localDb.ejecutar(`DELETE FROM pedido_items_local WHERE id = ?`, [itemId]);
  const pedidoActualizado = recalcularPedidoLocal(pedidoId);
  await encolar('pedido_items', 'eliminar', { pedido_id_local: pedidoId, item_id_local: itemId });

  return { item: filaAItem(itemFila), pedido: pedidoActualizado };
}

async function hEnviarCocina(match) {
  const pedidoId = match[1];
  const pendientes = localDb.consultarUno(
    `SELECT COUNT(*) AS total FROM pedido_items_local WHERE pedido_id = ? AND estado = 'pendiente'`,
    [pedidoId]
  );
  if (!pendientes || pendientes.total === 0) {
    throw new OfflineApiError('No hay items nuevos para enviar a cocina', 400);
  }
  localDb.ejecutar(`UPDATE pedido_items_local SET estado = 'en_preparacion' WHERE pedido_id = ? AND estado = 'pendiente'`, [
    pedidoId,
  ]);
  localDb.ejecutar(`UPDATE pedidos_local SET estado = 'enviado_cocina', updated_at = ? WHERE id = ?`, [
    new Date().toISOString(),
    pedidoId,
  ]);
  await encolar('pedidos', 'enviar_cocina', { pedido_id_local: pedidoId });

  return { pedido: construirPedido(pedidoId) };
}

async function hPedirCuenta(match) {
  const pedidoId = match[1];
  const pedido = localDb.consultarUno(`SELECT * FROM pedidos_local WHERE id = ?`, [pedidoId]);
  if (!pedido) throw new OfflineApiError('Pedido no encontrado');

  const ahora = new Date().toISOString();
  localDb.ejecutar(`UPDATE pedidos_local SET estado = 'cuenta_pedida', updated_at = ? WHERE id = ?`, [ahora, pedidoId]);
  if (pedido.mesa_id) actualizarEstadoMesaCache(pedido.mesa_id, 'cuenta_pedida', { cuenta_pedida_at: ahora });
  await encolar('pedidos', 'pedir_cuenta', { pedido_id_local: pedidoId });

  return { pedido: construirPedido(pedidoId) };
}

async function hReabrirCuenta(match) {
  const pedidoId = match[1];
  const pedido = localDb.consultarUno(`SELECT * FROM pedidos_local WHERE id = ? AND estado = 'cuenta_pedida'`, [
    pedidoId,
  ]);
  if (!pedido) throw new OfflineApiError('El pedido no existe o no está en estado "cuenta pedida"');

  localDb.ejecutar(`UPDATE pedidos_local SET estado = 'abierto', updated_at = ? WHERE id = ?`, [
    new Date().toISOString(),
    pedidoId,
  ]);
  if (pedido.mesa_id) actualizarEstadoMesaCache(pedido.mesa_id, 'ocupada', { cuenta_pedida_at: null });
  await encolar('pedidos', 'reabrir_cuenta', { pedido_id_local: pedidoId });

  return { pedido: construirPedido(pedidoId) };
}

async function hCobrar(match, body) {
  const pedidoId = match[1];
  const pedido = localDb.consultarUno(`SELECT * FROM pedidos_local WHERE id = ?`, [pedidoId]);
  if (!pedido) throw new OfflineApiError('Pedido no encontrado');

  const { pagado_con, monto_recibido, descuento, impuesto, propina } = body;
  const desc = descuento !== undefined ? Number(descuento) : Number(pedido.descuento);
  const imp = impuesto !== undefined ? Number(impuesto) : Number(pedido.impuesto);
  const prop = propina !== undefined ? Number(propina) : Number(pedido.propina);
  const total = Math.max(0, Number(pedido.subtotal) - desc + imp + prop);
  const recibido = monto_recibido !== undefined ? Number(monto_recibido) : total;
  if (recibido < total) {
    throw new OfflineApiError(`Falta ${(total - recibido).toFixed(2)} para completar el pago`, 400);
  }

  localDb.ejecutar(
    `UPDATE pedidos_local SET estado = 'pagado', descuento = ?, impuesto = ?, propina = ?, total = ?, updated_at = ? WHERE id = ?`,
    [desc, imp, prop, total, new Date().toISOString(), pedidoId]
  );
  if (pedido.mesa_id) actualizarEstadoMesaCache(pedido.mesa_id, 'libre');
  await encolar('pedidos', 'cobrar', {
    pedido_id_local: pedidoId,
    pagado_con,
    monto_recibido: recibido,
    descuento: desc,
    impuesto: imp,
    propina: prop,
  });

  return { pedido: construirPedido(pedidoId) };
}

async function hCancelar(match) {
  const pedidoId = match[1];
  const pedido = localDb.consultarUno(`SELECT * FROM pedidos_local WHERE id = ?`, [pedidoId]);
  if (!pedido) throw new OfflineApiError('Pedido no encontrado');

  localDb.ejecutar(`UPDATE pedidos_local SET estado = 'cancelado', updated_at = ? WHERE id = ?`, [
    new Date().toISOString(),
    pedidoId,
  ]);
  if (pedido.mesa_id) actualizarEstadoMesaCache(pedido.mesa_id, 'libre');
  await encolar('pedidos', 'cancelar', { pedido_id_local: pedidoId });

  return { pedido: construirPedido(pedidoId) };
}

// El orden importa: las rutas más específicas van antes que los patrones
// genéricos de un solo parámetro (p. ej. "/mesas/plano" antes que "/mesas/:id").
const RUTAS = [
  { metodo: 'get', re: /^\/api\/productos$/, h: hProductos },
  { metodo: 'get', re: /^\/api\/categorias$/, h: hCategorias },
  { metodo: 'get', re: /^\/api\/areas$/, h: hAreas },
  { metodo: 'get', re: /^\/api\/mesas\/plano$/, h: hPlano },
  { metodo: 'get', re: /^\/api\/mesas$/, h: hMesas },
  { metodo: 'get', re: /^\/api\/mesas\/([^/]+)$/, h: hMesa },
  { metodo: 'patch', re: /^\/api\/mesas\/([^/]+)\/estado$/, h: hCambiarEstadoMesa },
  { metodo: 'get', re: /^\/api\/pedidos\/mesa\/([^/]+)$/, h: hLeerPedidoPorMesa },
  { metodo: 'post', re: /^\/api\/pedidos$/, h: hCrearPedido },
  { metodo: 'post', re: /^\/api\/pedidos\/([^/]+)\/items$/, h: hAgregarItem },
  { metodo: 'put', re: /^\/api\/pedidos\/([^/]+)\/items\/([^/]+)$/, h: hActualizarItem },
  { metodo: 'delete', re: /^\/api\/pedidos\/([^/]+)\/items\/([^/]+)$/, h: hEliminarItem },
  { metodo: 'post', re: /^\/api\/pedidos\/([^/]+)\/enviar-cocina$/, h: hEnviarCocina },
  { metodo: 'post', re: /^\/api\/pedidos\/([^/]+)\/pedir-cuenta$/, h: hPedirCuenta },
  { metodo: 'post', re: /^\/api\/pedidos\/([^/]+)\/reabrir-cuenta$/, h: hReabrirCuenta },
  { metodo: 'post', re: /^\/api\/pedidos\/([^/]+)\/cobrar$/, h: hCobrar },
  { metodo: 'post', re: /^\/api\/pedidos\/([^/]+)\/cancelar$/, h: hCancelar },
];

// Intenta resolver una petición fallida por falta de red usando la copia
// local. Devuelve el objeto `datos` (misma forma que el backend) si la ruta
// tiene soporte offline, o `null` si no hay equivalente local y debe
// propagarse el error de red original.
export async function resolverOffline(config) {
  await localDb.init();

  const metodo = (config.method || 'get').toLowerCase();
  const url = (config.url || '').split('?')[0];
  const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : config.data || {};
  const params = config.params || {};

  for (const ruta of RUTAS) {
    if (ruta.metodo !== metodo) continue;
    const match = ruta.re.exec(url);
    if (!match) continue;
    const datos = await ruta.h(match, body, params);
    await localDb.guardar();
    return datos;
  }

  return null;
}
