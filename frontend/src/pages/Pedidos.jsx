import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Search } from 'lucide-react';

import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import { formatearPrecio } from '../utils/formato';
import { getPedidos, getPedido } from '../utils/pedidos';
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
  listo: '#22c55e',
  cuenta_pedida: '#eab308',
  pagado: '#22c55e',
  cancelado: '#ef4444',
};

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
      <h1 className="text-2xl font-bold text-white">Historial de pedidos</h1>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[#a1a1aa]">Fecha</span>
          <input
            type="date"
            value={fecha}
            max={hoyISO()}
            onChange={(e) => setFecha(e.target.value)}
            className="input w-auto"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[#a1a1aa]">Estado</span>
          <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} className="input w-auto">
            {FILTROS_ESTADO.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[#a1a1aa]">Tipo</span>
          <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)} className="input w-auto">
            {FILTROS_TIPO.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block flex-1 min-w-[200px]">
          <span className="mb-1 block text-sm font-medium text-[#a1a1aa]">Buscar</span>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
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
            <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-5">
              <p className="text-sm text-[#a1a1aa]">Total del día</p>
              <p className="mt-2 text-2xl font-bold text-white">{formatearPrecio(totalDia)}</p>
            </div>
            <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-5">
              <p className="text-sm text-[#a1a1aa]">Pedidos pagados</p>
              <p className="mt-2 text-2xl font-bold text-white">{pedidosPagados.length}</p>
            </div>
            <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-5">
              <p className="text-sm text-[#a1a1aa]">Ticket promedio</p>
              <p className="mt-2 text-2xl font-bold text-white">{formatearPrecio(ticketPromedio)}</p>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-[#2a2a2a]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#1a1a1a] text-[#a1a1aa]">
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
                  <tr key={p.id} className="border-t border-[#2a2a2a] bg-[#141414]">
                    <td className="px-4 py-3 font-semibold text-white">
                      #{String(p.numero_jornada).padStart(2, '0')}
                      <span className="ml-1 font-normal text-[#a1a1aa]">(Global: #{p.numero_global})</span>
                    </td>
                    <td className="px-4 py-3 text-white">{p.mesa_numero || LABEL_TIPO[p.tipo] || p.tipo}</td>
                    <td className="px-4 py-3 text-[#a1a1aa]">{formatearHora(p.created_at)}</td>
                    <td className="px-4 py-3 text-[#a1a1aa]">
                      {p.estado === 'pagado' ? formatearHora(p.pagado_at || p.updated_at) : '-'}
                    </td>
                    <td className="max-w-[280px] truncate px-4 py-3 text-[#a1a1aa]" title={p.items_resumen}>
                      {p.items_resumen || '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-white">{formatearPrecio(p.total)}</td>
                    <td className="px-4 py-3 text-[#a1a1aa]">{LABEL_METODO_PAGO[p.pagado_con] || '-'}</td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded-full px-2 py-1 text-xs font-medium"
                        style={{
                          color: COLOR_ESTADO_PEDIDO[p.estado],
                          backgroundColor: `${COLOR_ESTADO_PEDIDO[p.estado]}1a`,
                        }}
                      >
                        {LABEL_ESTADO_PEDIDO[p.estado] || p.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setPedidoDetalleId(p.id)}
                        className="rounded-lg border border-[#333] px-3 py-1.5 text-xs font-medium text-[#a1a1aa] hover:text-white"
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))}
                {pedidosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-[#a1a1aa]">
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
        <ModalDetallePedido pedidoId={pedidoDetalleId} onClose={() => setPedidoDetalleId(null)} />
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

function ModalDetallePedido({ pedidoId, onClose }) {
  const [pedido, setPedido] = useState(null);
  const [cargando, setCargando] = useState(true);

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
      titulo={
        pedido
          ? `Pedido #${String(pedido.numero_jornada).padStart(2, '0')} (Global: #${pedido.numero_global})`
          : 'Detalle del pedido'
      }
      onClose={onClose}
    >
      {cargando || !pedido ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#a1a1aa]">{pedido.mesa_numero ? `Mesa ${pedido.mesa_numero}` : LABEL_TIPO[pedido.tipo]}</span>
            <span
              className="rounded-full px-2 py-1 text-xs font-medium"
              style={{
                color: COLOR_ESTADO_PEDIDO[pedido.estado],
                backgroundColor: `${COLOR_ESTADO_PEDIDO[pedido.estado]}1a`,
              }}
            >
              {LABEL_ESTADO_PEDIDO[pedido.estado] || pedido.estado}
            </span>
          </div>

          <div className="space-y-2">
            {construirTimeline(pedido).map((paso) => (
              <div key={paso.label} className="flex items-center justify-between text-sm">
                <span className={`flex items-center gap-2 ${paso.alcanzado ? 'text-white' : 'text-[#555]'}`}>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: paso.alcanzado ? '#22c55e' : '#333' }}
                  />
                  {paso.label}
                </span>
                <span className="text-xs text-[#a1a1aa]">
                  {paso.timestamp ? formatearFechaHora(paso.timestamp) : ''}
                </span>
              </div>
            ))}
          </div>

          <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-[#2a2a2a] p-3">
            {(pedido.items || []).map((item) => (
              <div key={item.id} className="border-b border-[#2a2a2a] pb-2 last:border-0 last:pb-0">
                <div className="flex justify-between text-sm">
                  <span className="text-white">
                    {item.cantidad}× {item.nombre_producto}
                  </span>
                  <span className="font-medium text-white">{formatearPrecio(item.subtotal)}</span>
                </div>
                {item.modificadores?.length > 0 && (
                  <p className="mt-0.5 text-xs text-[#a1a1aa]">
                    {item.modificadores.map((m) => m.nombre_opcion).join(', ')}
                  </p>
                )}
                {item.notas && <p className="mt-0.5 text-xs italic text-[#a1a1aa]">"{item.notas}"</p>}
              </div>
            ))}
            {(pedido.items || []).length === 0 && <p className="text-sm text-[#a1a1aa]">Sin productos.</p>}
          </div>

          <div className="space-y-1 border-t border-[#2a2a2a] pt-3 text-sm">
            <div className="flex justify-between text-[#a1a1aa]">
              <span>Subtotal</span>
              <span>{formatearPrecio(pedido.subtotal)}</span>
            </div>
            <div className="flex justify-between text-[#a1a1aa]">
              <span>Descuento</span>
              <span>-{formatearPrecio(pedido.descuento)}</span>
            </div>
            <div className="flex justify-between text-[#a1a1aa]">
              <span>Impuesto</span>
              <span>{formatearPrecio(pedido.impuesto)}</span>
            </div>
            <div className="flex justify-between text-[#a1a1aa]">
              <span>Propina</span>
              <span>{formatearPrecio(pedido.propina)}</span>
            </div>
            <div className="flex justify-between border-t border-[#2a2a2a] pt-2 text-base font-semibold text-white">
              <span>Total</span>
              <span>{formatearPrecio(pedido.total)}</span>
            </div>
          </div>

          {pedido.estado === 'pagado' && (
            <div className="space-y-1 border-t border-[#2a2a2a] pt-3 text-sm">
              <div className="flex justify-between text-[#a1a1aa]">
                <span>Método de pago</span>
                <span className="text-white">{LABEL_METODO_PAGO[pedido.pagado_con] || '-'}</span>
              </div>
              <div className="flex justify-between text-[#a1a1aa]">
                <span>Monto recibido</span>
                <span className="text-white">{formatearPrecio(pedido.monto_recibido)}</span>
              </div>
              <div className="flex justify-between text-[#a1a1aa]">
                <span>Cambio</span>
                <span className="text-white">{formatearPrecio(pedido.cambio)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export default Pedidos;
