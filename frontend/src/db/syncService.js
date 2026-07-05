import { v4 as uuidv4 } from 'uuid';

import { localDb } from './database';
import api from '../utils/api';

const MAX_INTENTOS = 3;

class SyncService {
  sincronizando = false;

  // Deja en cola una operación de escritura para reintentar cuando vuelva la
  // conexión. Las lecturas nunca se encolan: se sirven directo desde cache.
  async encolar(tabla, operacion, datos) {
    await localDb.init();
    localDb.ejecutar(
      `INSERT INTO sync_queue (id, tabla, operacion, datos) VALUES (?, ?, ?, ?)`,
      [uuidv4(), tabla, operacion, JSON.stringify(datos)]
    );
    await localDb.guardar();
  }

  guardarMapeo(tipo, idLocal, idRemoto) {
    if (idLocal === idRemoto) return;
    localDb.ejecutar(
      `INSERT OR REPLACE INTO id_map (tipo, id_local, id_remoto) VALUES (?, ?, ?)`,
      [tipo, idLocal, idRemoto]
    );
  }

  // Un id puede ser local (creado offline, todavía sin contraparte en el
  // servidor) o ya un id real. Si no hay mapeo registrado se asume que ya es
  // un id de servidor (p. ej. mesas, que nunca se crean offline).
  resolverId(tipo, id) {
    const fila = localDb.consultarUno(
      `SELECT id_remoto FROM id_map WHERE tipo = ? AND id_local = ?`,
      [tipo, id]
    );
    return fila ? fila.id_remoto : id;
  }

  // ConnectivityContext (vía onCambio) y connectivity.js (su propio
  // sincronizar() de respaldo) pueden disparar esto casi al mismo tiempo al
  // reconectar. Sin este guardia, ambas pasadas leen la misma fila de la
  // cola antes de que la primera la borre y la operación se duplica contra
  // el servidor (ej. un item de pedido creado dos veces).
  async sincronizarTodo() {
    if (this.sincronizando) return;
    this.sincronizando = true;
    try {
      await localDb.init();
      await this.procesarCola();
      await this.actualizarCache();
    } finally {
      this.sincronizando = false;
    }
  }

  // Se procesa en orden estricto de inserción (rowid): una operación sobre
  // un pedido o item creado offline siempre aparece en la cola después de la
  // operación que lo creó, así que para cuando le toca su turno el mapeo de
  // id local -> id remoto ya existe.
  async procesarCola() {
    await localDb.init();
    const pendientes = localDb.consultar(
      `SELECT rowid AS rowid_, * FROM sync_queue WHERE intentos < ? ORDER BY rowid ASC`,
      [MAX_INTENTOS]
    );

    for (const item of pendientes) {
      try {
        await this.procesarItem(item);
        localDb.ejecutar(`DELETE FROM sync_queue WHERE rowid = ?`, [item.rowid_]);
      } catch (err) {
        localDb.ejecutar(
          `UPDATE sync_queue SET intentos = intentos + 1, error = ? WHERE rowid = ?`,
          [err.response?.data?.mensaje || err.message || 'Error desconocido', item.rowid_]
        );
      }
      await localDb.guardar();
    }
  }

  async procesarItem(item) {
    const datos = JSON.parse(item.datos);

    if (item.tabla === 'pedidos') {
      if (item.operacion === 'crear') {
        const { data } = await api.post('/api/pedidos', {
          mesa_id: datos.mesa_id,
          tipo: datos.tipo,
          notas: datos.notas,
        });
        this.guardarMapeo('pedido', datos.id_local, data.datos.pedido.id);
        localDb.ejecutar(`UPDATE pedidos_local SET sincronizado = 1 WHERE id = ?`, [datos.id_local]);
        return;
      }

      const pedidoId = this.resolverId('pedido', datos.pedido_id_local);

      if (item.operacion === 'enviar_cocina') {
        await api.post(`/api/pedidos/${pedidoId}/enviar-cocina`);
      } else if (item.operacion === 'pedir_cuenta') {
        await api.post(`/api/pedidos/${pedidoId}/pedir-cuenta`);
      } else if (item.operacion === 'reabrir_cuenta') {
        await api.post(`/api/pedidos/${pedidoId}/reabrir-cuenta`);
      } else if (item.operacion === 'cobrar') {
        await api.post(`/api/pedidos/${pedidoId}/cobrar`, {
          pagado_con: datos.pagado_con,
          monto_recibido: datos.monto_recibido,
          descuento: datos.descuento,
          impuesto: datos.impuesto,
          propina: datos.propina,
        });
      } else if (item.operacion === 'cancelar') {
        await api.post(`/api/pedidos/${pedidoId}/cancelar`);
      }
      return;
    }

    if (item.tabla === 'pedido_items') {
      const pedidoId = this.resolverId('pedido', datos.pedido_id_local);

      if (item.operacion === 'crear') {
        const { data } = await api.post(`/api/pedidos/${pedidoId}/items`, {
          producto_id: datos.producto_id,
          nombre_producto: datos.nombre_producto,
          precio_unitario: datos.precio_unitario,
          cantidad: datos.cantidad,
          notas: datos.notas,
          modificadores: datos.modificadores,
        });
        this.guardarMapeo('pedido_item', datos.id_local, data.datos.item.id);
        return;
      }

      const itemId = this.resolverId('pedido_item', datos.item_id_local);

      if (item.operacion === 'actualizar') {
        await api.put(`/api/pedidos/${pedidoId}/items/${itemId}`, {
          cantidad: datos.cantidad,
          notas: datos.notas,
        });
      } else if (item.operacion === 'eliminar') {
        await api.delete(`/api/pedidos/${pedidoId}/items/${itemId}`);
      }
      return;
    }

    if (item.tabla === 'mesas' && item.operacion === 'cambiar_estado') {
      await api.patch(`/api/mesas/${datos.mesa_id}/estado`, { estado: datos.estado });
    }
  }

  async actualizarCache() {
    try {
      const [productos, categorias, mesas, areas] = await Promise.all([
        api.get('/api/productos'),
        api.get('/api/categorias'),
        api.get('/api/mesas'),
        api.get('/api/areas'),
      ]);

      localDb.ejecutar('DELETE FROM productos_cache');
      for (const p of productos.data.datos.productos) {
        localDb.ejecutar(`INSERT OR REPLACE INTO productos_cache (id, datos) VALUES (?, ?)`, [
          p.id,
          JSON.stringify(p),
        ]);
      }

      localDb.ejecutar('DELETE FROM categorias_cache');
      for (const c of categorias.data.datos.categorias) {
        localDb.ejecutar(`INSERT OR REPLACE INTO categorias_cache (id, datos) VALUES (?, ?)`, [
          c.id,
          JSON.stringify(c),
        ]);
      }

      localDb.ejecutar('DELETE FROM mesas_cache');
      for (const m of mesas.data.datos.mesas) {
        localDb.ejecutar(`INSERT OR REPLACE INTO mesas_cache (id, area_id, datos) VALUES (?, ?, ?)`, [
          m.id,
          m.area_id,
          JSON.stringify(m),
        ]);
      }

      localDb.ejecutar('DELETE FROM areas_cache');
      for (const a of areas.data.datos.areas) {
        localDb.ejecutar(`INSERT OR REPLACE INTO areas_cache (id, datos) VALUES (?, ?)`, [a.id, JSON.stringify(a)]);
      }

      await localDb.guardar();
    } catch (err) {
      console.warn('No se pudo actualizar la cache local:', err.message);
    }
  }

  resumen() {
    const pendientes = localDb.consultarUno(`SELECT COUNT(*) AS total FROM sync_queue WHERE intentos < ?`, [
      MAX_INTENTOS,
    ]);
    const conError = localDb.consultarUno(`SELECT COUNT(*) AS total FROM sync_queue WHERE intentos >= ?`, [
      MAX_INTENTOS,
    ]);
    return {
      pendientes: pendientes?.total || 0,
      conError: conError?.total || 0,
    };
  }
}

export const syncService = new SyncService();
export default syncService;
