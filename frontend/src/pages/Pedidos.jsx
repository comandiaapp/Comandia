import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Search } from 'lucide-react';

import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import VisorFactura from '../components/VisorFactura';
import { useAuth } from '../context/AuthContext';
import { formatearPrecio } from '../utils/formato';
import { getPedidos, getPedido, cancelarPedido } from '../utils/pedidos';
import { generarFactura, obtenerFacturaPorPedido } from '../utils/facturas';
import { formatearHora, fechaHoyBogota } from '../utils/fecha';

const LABEL_ESTADO_PEDIDO = {
  abierto: 'Abierto',
  enviado_cocina: 'Enviado a cocina',
  listo: 'Listo',
  cuenta_pedida: 'Cuenta pedida',
  pagado: 'Pagado',
  cancelado: 'Cancelado',
};

const COLOR_ESTADO_PEDIDO = {
  abierto: '#6b7280',
  enviado_cocina: '#3b82f6',
  listo: 'var(--success)',
  cuenta_pedida: 'var(--warning)',
  pagado: 'var(--success)',
  cancelado: 'var(--error)',
};

// Los colores de estado pueden ser var(--...) o hex directo; color-mix
// permite obtener un fondo translúcido a partir de cualquiera de los dos.
function fondoConAlpha(color) {
  return `color-mix(in srgb, ${color} 10%, transparent)`;
}

const LABEL_METODO_PAGO = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  qr: 'QR',
  nequi: 'Nequi',
  transferencia: 'Transferencia',
  mixto: 'Mixto',
};

const LABEL_TIPO = {
  mesa: 'Mesa',
  barra: 'Barra',
  delivery: 'Domicilio',
  take_away: 'Para llevar',
};

const FILTROS_ESTADO = [
  { value: 'todos', label: 'Todos' },
  { value: 'pagado', label: 'Pagados' },
  { value: 'activos', label: 'Activos' },
  { value: 'cancelado', label: 'Cancelados' },
];

const FILTROS_TIPO = [
  { value: 'todos', label: 'Todos' },
  { value: 'mesa', label: 'Mesa' },
  { value: 'delivery', label: 'Domicilio' },
  { value: 'take_away', label: 'Para llevar' },
];

function hoyISO() {
  return fechaHoyBogota();
}

function numeroPedido(pedido) {
  return pedido.numero_jornada > 0 ? pedido.numero_jornada : pedido.numero_global;
}

function formatearFechaHora(fechaIso) {
  if (!fechaIso) return '-';
  return new Date(fechaIso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Pedidos() {
  const [fecha, setFecha] = useState(hoyISO());
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [busqueda, setBusqueda] = useState('');

  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [pedidoDetalleId, setPedidoDetalleId] = useState(null);

  const cargarPedidos = useCallback(async () => {
    setCargando(true);
    try {
      setPedidos(await getPedidos({ fecha }));
    } catch {
      toast.error('No se pudo cargar el historial de pedidos');
    } finally {
      setCargando(false);
    }
  }, [fecha]);

  useEffect(() => {
    cargarPedidos();
  }, [cargarPedidos]);

  const pedidosPagados = useMemo(() => pedidos.filter((p) => p.estado === 'pagado'), [pedidos]);
  const totalDia = pedidosPagados.reduce((suma, p) => suma + Number(p.total), 0);
  const ticketPromedio = pedidosPagados.length > 0 ? totalDia / pedidosPagados.length : 0;

  const ESTADOS_ACTIVOS = ['abierto', 'enviado_cocina', 'listo', 'cuenta_pedida'];

  const pedidosFiltrados = pedidos.filter((p) => {
    if (estadoFiltro === 'activos' && !ESTADOS_ACTIVOS.includes(p.estado)) return false;
    if (estadoFiltro !== 'todos' && estadoFiltro !== 'activos' && p.estado !== estadoFiltro) return false;
    if (tipoFiltro !== 'todos' && p.tipo !== tipoFiltro) return false;
    if (busqueda) {
      const termino = busqueda.trim().toLowerCase();
      const coincideNumero =
        String(p.numero_jornada).includes(termino) || String(p.numero_global).includes(termino);
      const coincideMesa = (p.mesa_numero || '').toLowerCase().includes(termino);
      if (!coincideNumero && !coincideMesa) return false;
    }
    return true;
  });

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Historial de pedidos</h1>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Fecha</span>
          <input
            type="date"
            value={fecha}
            max={hoyISO()}
            onChange={(e) => setFecha(e.target.value)}
            className="input w-auto"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Estado</span>
          <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} className="input w-auto">
            {FILTROS_ESTADO.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Tipo</span>
          <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)} className="input w-auto">
            {FILTROS_TIPO.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block flex-1 min-w-[200px]">
          <span className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Buscar</span>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Número de pedido o mesa..."
              className="input pl-9"
            />
          </div>
        </label>
      </div>

      {cargando ? (
        <Spinner />
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <p className="text-sm text-[var(--text-secondary)]">Total del día</p>
              <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{formatearPrecio(totalDia)}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <p className="text-sm text-[var(--text-secondary)]">Pedidos pagados</p>
              <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{pedidosPagados.length}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <p className="text-sm text-[var(--text-secondary)]">Ticket promedio</p>
              <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{formatearPrecio(ticketPromedio)}</p>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-[var(--border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Mesa / Tipo</th>
                  <th className="px-4 py-3">Apertura</th>
                  <th className="px-4 py-3">Pago</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Método</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pedidosFiltrados.map((p) => (
                  <tr key={p.id} className="border-t border-[var(--border)] bg-[var(--bg-card)]">
                    <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                      #{String(numeroPedido(p)).padStart(2, '0')}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-primary)]">{p.mesa_numero || LABEL_TIPO[p.tipo] || p.tipo}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{formatearHora(p.created_at)}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {p.estado === 'pagado' ? formatearHora(p.pagado_at || p.updated_at) : '-'}
                    </td>
                    <td className="max-w-[280px] truncate px-4 py-3 text-[var(--text-secondary)]" title={p.items_resumen}>
                      {p.items_resumen || '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[var(--text-primary)]">{formatearPrecio(p.total)}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{LABEL_METODO_PAGO[p.pagado_con] || '-'}</td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded-full px-2 py-1 text-xs font-medium"
                        style={{
                          color: COLOR_ESTADO_PEDIDO[p.estado],
                          backgroundColor: fondoConAlpha(COLOR_ESTADO_PEDIDO[p.estado]),
                        }}
                      >
                        {LABEL_ESTADO_PEDIDO[p.estado] || p.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setPedidoDetalleId(p.id)}
                        className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
                {pedidosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                      No hay pedidos que coincidan con los filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pedidoDetalleId && (
        <ModalDetallePedido
          pedidoId={pedidoDetalleId}
          onClose={() => setPedidoDetalleId(null)}
          onCambio={cargarPedidos}
        />
      )}
    </div>
  );
}

const ESTADOS_ITEM_LISTOS = ['listo', 'entregado'];

function construirTimeline(pedido) {
  const itemsEnviados = (pedido.items || []).map((i) => i.enviado_cocina_at).filter(Boolean);
  const enviadoCocinaAt =
    itemsEnviados.length > 0 ? new Date(Math.min(...itemsEnviados.map((t) => new Date(t).getTime()))) : null;

  const itemsConEstado = pedido.items || [];
  const todosListos =
    itemsConEstado.length > 0 && itemsConEstado.every((i) => ESTADOS_ITEM_LISTOS.includes(i.estado) || i.estado === 'cancelado');

  return [
    { label: 'Abierto', timestamp: pedido.created_at, alcanzado: true },
    { label: 'Enviado a cocina', timestamp: enviadoCocinaAt, alcanzado: Boolean(enviadoCocinaAt) },
    {
      label: 'Listo',
      timestamp: null,
      alcanzado: todosListos || ['listo', 'cuenta_pedida', 'pagado'].includes(pedido.estado),
    },
    { label: 'Cuenta pedida', timestamp: pedido.cuenta_pedida_at, alcanzado: Boolean(pedido.cuenta_pedida_at) },
    {
      label: 'Pagado',
      timestamp: pedido.pagado_at || (pedido.estado === 'pagado' ? pedido.updated_at : null),
      alcanzado: pedido.estado === 'pagado',
    },
  ];
}

function ModalDetallePedido({ pedidoId, onClose, onCambio }) {
  const { usuario } = useAuth();
  const [pedido, setPedido] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoFactura, setCargandoFactura] = useState(false);
  const [htmlFactura, setHtmlFactura] = useState(null);
  const [cancelando, setCancelando] = useState(false);

  const esGestor = usuario?.rol === 'admin' || usuario?.rol === 'gerente';
  const sinItems = (pedido?.items || []).length === 0;
  const mostrarCancelar = pedido?.estado === 'abierto' && sinItems;
  const mostrarForzarCierre = !sinItems && pedido?.mesa_estado === 'libre' && esGestor;

  async function handleCancelar(mensajeConfirmacion) {
    if (!window.confirm(mensajeConfirmacion)) return;
    setCancelando(true);
    try {
      await cancelarPedido(pedidoId);
      toast.success('Pedido cancelado');
      onCambio?.();
      onClose();
    } catch {
      toast.error('No se pudo cancelar el pedido');
    } finally {
      setCancelando(false);
    }
  }

  async function handleVerFactura() {
    setCargandoFactura(true);
    try {
      let resultado;
      try {
        resultado = await obtenerFacturaPorPedido(pedidoId);
      } catch {
        // El pedido está pagado pero no tiene factura aún (p. ej. la
        // generación automática al cobrar falló): se genera ahora.
        resultado = await generarFactura(pedidoId);
      }
      setHtmlFactura(resultado.html);
    } catch {
      toast.error('No se pudo obtener la factura de este pedido');
    } finally {
      setCargandoFactura(false);
    }
  }

  useEffect(() => {
    let activo = true;
    setCargando(true);
    getPedido(pedidoId)
      .then((datos) => {
        if (activo) setPedido(datos);
      })
      .catch(() => toast.error('No se pudo cargar el detalle del pedido'))
      .finally(() => {
        if (activo) setCargando(false);
      });
    return () => {
      activo = false;
    };
  }, [pedidoId]);

  return (
    <Modal
      titulo={pedido ? `Pedido #${String(numeroPedido(pedido)).padStart(2, '0')}` : 'Detalle del pedido'}
      onClose={onClose}
    >
      {cargando || !pedido ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--text-secondary)]">{pedido.mesa_numero ? `Mesa ${pedido.mesa_numero}` : LABEL_TIPO[pedido.tipo]}</span>
            <span
              className="rounded-full px-2 py-1 text-xs font-medium"
              style={{
                color: COLOR_ESTADO_PEDIDO[pedido.estado],
                backgroundColor: fondoConAlpha(COLOR_ESTADO_PEDIDO[pedido.estado]),
              }}
            >
              {LABEL_ESTADO_PEDIDO[pedido.estado] || pedido.estado}
            </span>
          </div>

          {(mostrarCancelar || mostrarForzarCierre) && (
            <div
              className="rounded-lg border p-3 text-sm"
              style={{ borderColor: 'var(--warning)', backgroundColor: fondoConAlpha('var(--warning)') }}
            >
              <p className="text-[var(--text-secondary)]">
                {mostrarCancelar
                  ? 'Este pedido está abierto y no tiene productos.'
                  : 'Este pedido tiene productos pero su mesa ya figura libre.'}
              </p>
              <button
                type="button"
                disabled={cancelando}
                onClick={() =>
                  handleCancelar(
                    mostrarCancelar
                      ? '¿Cancelar este pedido vacío?'
                      : '¿Forzar el cierre de este pedido? Quedará cancelado y no admitirá más cambios.'
                  )
                }
                className="mt-2 w-full rounded-lg border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}
              >
                {cancelando ? 'Procesando...' : mostrarCancelar ? 'Cancelar pedido' : 'Forzar cierre'}
              </button>
            </div>
          )}

          <div className="space-y-2">
            {construirTimeline(pedido).map((paso) => (
              <div key={paso.label} className="flex items-center justify-between text-sm">
                <span
                  className={`flex items-center gap-2 ${
                    paso.alcanzado ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] opacity-50'
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: paso.alcanzado ? 'var(--success)' : 'var(--border)' }}
                  />
                  {paso.label}
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  {paso.timestamp ? formatearFechaHora(paso.timestamp) : ''}
                </span>
              </div>
            ))}
          </div>

          <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-[var(--border)] p-3">
            {(pedido.items || []).map((item) => (
              <div key={item.id} className="border-b border-[var(--border)] pb-2 last:border-0 last:pb-0">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--text-primary)]">
                    {item.cantidad}× {item.nombre_producto}
                  </span>
                  <span className="font-medium text-[var(--text-primary)]">{formatearPrecio(item.subtotal)}</span>
                </div>
                {item.modificadores?.length > 0 && (
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                    {item.modificadores.map((m) => m.nombre_opcion).join(', ')}
                  </p>
                )}
                {item.notas && <p className="mt-0.5 text-xs italic text-[var(--text-secondary)]">"{item.notas}"</p>}
              </div>
            ))}
            {(pedido.items || []).length === 0 && <p className="text-sm text-[var(--text-secondary)]">Sin productos.</p>}
          </div>

          <div className="space-y-1 border-t border-[var(--border)] pt-3 text-sm">
            <div className="flex justify-between text-[var(--text-secondary)]">
              <span>Subtotal</span>
              <span>{formatearPrecio(pedido.subtotal)}</span>
            </div>
            <div className="flex justify-between text-[var(--text-secondary)]">
              <span>Descuento</span>
              <span>-{formatearPrecio(pedido.descuento)}</span>
            </div>
            <div className="flex justify-between text-[var(--text-secondary)]">
              <span>Impuesto</span>
              <span>{formatearPrecio(pedido.impuesto)}</span>
            </div>
            <div className="flex justify-between text-[var(--text-secondary)]">
              <span>Propina</span>
              <span>{formatearPrecio(pedido.propina)}</span>
            </div>
            <div className="flex justify-between border-t border-[var(--border)] pt-2 text-base font-semibold text-[var(--text-primary)]">
              <span>Total</span>
              <span>{formatearPrecio(pedido.total)}</span>
            </div>
          </div>

          {pedido.estado === 'pagado' && (
            <div className="space-y-1 border-t border-[var(--border)] pt-3 text-sm">
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Método de pago</span>
                <span className="text-[var(--text-primary)]">{LABEL_METODO_PAGO[pedido.pagado_con] || '-'}</span>
              </div>
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Monto recibido</span>
                <span className="text-[var(--text-primary)]">{formatearPrecio(pedido.monto_recibido)}</span>
              </div>
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Cambio</span>
                <span className="text-[var(--text-primary)]">{formatearPrecio(pedido.cambio)}</span>
              </div>

              <button
                type="button"
                onClick={handleVerFactura}
                disabled={cargandoFactura}
                className="mt-2 w-full rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cargandoFactura ? 'Cargando factura...' : 'Ver/Imprimir factura'}
              </button>
            </div>
          )}
        </div>
      )}

      {htmlFactura && (
        <VisorFactura titulo="Factura" html={htmlFactura} onClose={() => setHtmlFactura(null)} />
      )}
    </Modal>
  );
}

export default Pedidos;
