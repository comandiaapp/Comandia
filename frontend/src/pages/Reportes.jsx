import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { RotateCcw } from 'lucide-react';

import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import GraficaBarras from '../components/GraficaBarras';
import { formatearPrecio } from '../utils/formato';
import { getVentasDia, getVentasPeriodo, getProductosMasVendidos } from '../utils/reportes';
import { getHistorialJornadas, reabrirJornada } from '../utils/jornadas';
import { useAuth } from '../context/AuthContext';
import { formatearHora, fechaHoyBogota } from '../utils/fecha';

const LABEL_METODO_PAGO = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  qr: 'QR',
  nequi: 'Nequi',
  transferencia: 'Transferencia',
  mixto: 'Mixto',
  sin_especificar: 'Sin especificar',
};

const TABS = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'periodo', label: 'Por período' },
  { id: 'productos', label: 'Productos' },
  { id: 'jornadas', label: 'Jornadas' },
];

function hoyISO() {
  return fechaHoyBogota();
}

function restarDias(fechaISO, dias) {
  const fecha = new Date(`${fechaISO}T00:00:00`);
  fecha.setDate(fecha.getDate() - dias);
  return fecha.toISOString().slice(0, 10);
}

function formatearHoraCorta(fechaIso) {
  return formatearHora(fechaIso);
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

function Reportes() {
  const [tab, setTab] = useState('hoy');

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Reportes</h1>

      <div className="mt-4 flex flex-wrap gap-2 border-b border-[var(--border)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'hoy' && <TabHoy />}
        {tab === 'periodo' && <TabPeriodo />}
        {tab === 'productos' && <TabProductos />}
        {tab === 'jornadas' && <TabJornadas />}
      </div>
    </div>
  );
}

function TarjetaMetrica({ titulo, valor }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <p className="text-sm text-[var(--text-secondary)]">{titulo}</p>
      <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{valor}</p>
    </div>
  );
}

function TabHoy() {
  const [fecha, setFecha] = useState(hoyISO());
  const [reporte, setReporte] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    getVentasDia(fecha)
      .then(setReporte)
      .catch(() => toast.error('No se pudo cargar el reporte del día'))
      .finally(() => setCargando(false));
  }, [fecha]);

  const maximoMetodo = Math.max(...(reporte?.por_metodo_pago || []).map((m) => m.total), 1);

  return (
    <div>
      <div className="mb-4">
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
      </div>

      {cargando || !reporte ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <TarjetaMetrica titulo="Total ventas" valor={formatearPrecio(reporte.total_ventas)} />
            <TarjetaMetrica titulo="Pedidos" valor={reporte.cantidad_pedidos} />
            <TarjetaMetrica titulo="Ticket promedio" valor={formatearPrecio(reporte.ticket_promedio)} />
            <TarjetaMetrica titulo="Descuentos" valor={formatearPrecio(reporte.total_descuentos)} />
            <TarjetaMetrica titulo="Propinas" valor={formatearPrecio(reporte.total_propinas)} />
          </div>

          <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Desglose por método de pago</h2>
            <div className="mt-4 space-y-3">
              {reporte.por_metodo_pago.map((m) => (
                <div key={m.metodo}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-[var(--text-primary)]">{LABEL_METODO_PAGO[m.metodo] || m.metodo}</span>
                    <span className="text-[var(--text-secondary)]">
                      {formatearPrecio(m.total)} · {m.cantidad} pedidos
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--border)]">
                    <div
                      className="h-2 rounded-full bg-[var(--accent)]"
                      style={{ width: `${(m.total / maximoMetodo) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              {reporte.por_metodo_pago.length === 0 && (
                <p className="text-sm text-[var(--text-secondary)]">No hay ventas en esta fecha.</p>
              )}
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-[var(--border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--bg-card)] text-[var(--text-secondary)]">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Hora</th>
                  <th className="px-4 py-3">Mesa</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Método de pago</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {reporte.pedidos.map((p) => (
                  <tr key={p.id} className="border-t border-[var(--border)] bg-[var(--bg-secondary)]">
                    <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">
                      #{String(p.numero_jornada).padStart(2, '0')}
                      <span className="ml-1 font-normal text-[var(--text-secondary)]">(Global: #{p.numero_global})</span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{formatearHoraCorta(p.updated_at)}</td>
                    <td className="px-4 py-3 text-[var(--text-primary)]">{p.mesa_numero || p.tipo}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{p.cantidad_items}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{LABEL_METODO_PAGO[p.pagado_con] || '-'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[var(--text-primary)]">{formatearPrecio(p.total)}</td>
                  </tr>
                ))}
                {reporte.pedidos.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                      No hay pedidos pagados en esta fecha.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function TabPeriodo() {
  const [fechaInicio, setFechaInicio] = useState(restarDias(hoyISO(), 6));
  const [fechaFin, setFechaFin] = useState(hoyISO());
  const [reporte, setReporte] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    getVentasPeriodo(fechaInicio, fechaFin)
      .then(setReporte)
      .catch(() => toast.error('No se pudo cargar el reporte del período'))
      .finally(() => setCargando(false));
  }, [fechaInicio, fechaFin]);

  const datosGrafica = (reporte?.ventas_por_dia || []).map((d) => ({
    label: new Date(`${d.fecha}`).toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      day: '2-digit',
      month: '2-digit',
    }),
    valor: d.total_ventas,
  }));

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Fecha inicio</span>
          <input
            type="date"
            value={fechaInicio}
            max={fechaFin}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="input w-auto"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Fecha fin</span>
          <input
            type="date"
            value={fechaFin}
            min={fechaInicio}
            max={hoyISO()}
            onChange={(e) => setFechaFin(e.target.value)}
            className="input w-auto"
          />
        </label>
      </div>

      {cargando || !reporte ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TarjetaMetrica titulo="Total del período" valor={formatearPrecio(reporte.total_ventas)} />
            <TarjetaMetrica titulo="Pedidos del período" valor={reporte.cantidad_pedidos} />
          </div>

          <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Ventas por día</h2>
            <div className="mt-4">
              <GraficaBarras datos={datosGrafica} />
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-[var(--border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--bg-card)] text-[var(--text-secondary)]">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Pedidos</th>
                  <th className="px-4 py-3 text-right">Total ventas</th>
                </tr>
              </thead>
              <tbody>
                {reporte.ventas_por_dia.map((d) => (
                  <tr key={d.fecha} className="border-t border-[var(--border)] bg-[var(--bg-secondary)]">
                    <td className="px-4 py-3 text-[var(--text-primary)]">
                      {new Date(`${d.fecha}`).toLocaleDateString('es-CO', {
                        timeZone: 'America/Bogota',
                        weekday: 'long',
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{d.cantidad_pedidos}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[var(--text-primary)]">
                      {formatearPrecio(d.total_ventas)}
                    </td>
                  </tr>
                ))}
                {reporte.ventas_por_dia.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                      No hay ventas en este período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const MEDALLAS = ['🥇', '🥈', '🥉'];

function TabProductos() {
  const [fechaInicio, setFechaInicio] = useState(restarDias(hoyISO(), 6));
  const [fechaFin, setFechaFin] = useState(hoyISO());
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    getProductosMasVendidos({ fechaInicio, fechaFin, limite: 20 })
      .then(setProductos)
      .catch(() => toast.error('No se pudo cargar el reporte de productos'))
      .finally(() => setCargando(false));
  }, [fechaInicio, fechaFin]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Fecha inicio</span>
          <input
            type="date"
            value={fechaInicio}
            max={fechaFin}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="input w-auto"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Fecha fin</span>
          <input
            type="date"
            value={fechaFin}
            min={fechaInicio}
            max={hoyISO()}
            onChange={(e) => setFechaFin(e.target.value)}
            className="input w-auto"
          />
        </label>
      </div>

      {cargando ? (
        <Spinner />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--bg-card)] text-[var(--text-secondary)]">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Producto</th>
                <th className="px-4 py-3 text-right">Cantidad</th>
                <th className="px-4 py-3 text-right">Total generado</th>
                <th className="px-4 py-3 text-right">Costo total</th>
                <th className="px-4 py-3 text-right">Margen</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p, i) => (
                <tr key={p.producto_id || p.nombre} className="border-t border-[var(--border)] bg-[var(--bg-secondary)]">
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{MEDALLAS[i] || i + 1}</td>
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{p.nombre}</td>
                  <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{p.cantidad_vendida}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[var(--text-primary)]">
                    {formatearPrecio(p.total_generado)}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--text-secondary)]">
                    {p.costo_total !== null ? formatearPrecio(p.costo_total) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--text-secondary)]">
                    {p.margen_ganancia !== null ? formatearPrecio(p.margen_ganancia) : '-'}
                  </td>
                </tr>
              ))}
              {productos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                    No hay productos vendidos en este período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TabJornadas() {
  const { usuario } = useAuth();
  const esGestor = usuario?.rol === 'admin' || usuario?.rol === 'gerente';

  const [jornadas, setJornadas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [detalle, setDetalle] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setJornadas(await getHistorialJornadas());
    } catch {
      toast.error('No se pudo cargar el historial de jornadas');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function handleReabrir(jornada) {
    if (!window.confirm(`¿Reabrir la jornada del ${formatearFechaHora(jornada.fecha_apertura)}?`)) return;
    try {
      await reabrirJornada(jornada.id);
      toast.success('Jornada reabierta');
      setDetalle(null);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo reabrir la jornada');
    }
  }

  if (cargando) {
    return <Spinner />;
  }

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--bg-card)] text-[var(--text-secondary)]">
            <tr>
              <th className="px-4 py-3">Apertura</th>
              <th className="px-4 py-3">Cierre</th>
              <th className="px-4 py-3">Abrió</th>
              <th className="px-4 py-3">Cerró</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Total vendido</th>
              <th className="px-4 py-3 text-right">Diferencia caja</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {jornadas.map((j) => (
              <tr key={j.id} className="border-t border-[var(--border)] bg-[var(--bg-secondary)]">
                <td className="px-4 py-3 text-[var(--text-primary)]">{formatearFechaHora(j.fecha_apertura)}</td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">{formatearFechaHora(j.fecha_cierre)}</td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">{j.usuario_apertura_nombre || '-'}</td>
                <td className="px-4 py-3 text-[var(--text-secondary)]">{j.usuario_cierre_nombre || '-'}</td>
                <td className="px-4 py-3 text-[var(--text-secondary)] capitalize">{j.estado}</td>
                <td className="px-4 py-3 text-right font-semibold text-[var(--text-primary)]">
                  {formatearPrecio(j.ventas.total_ventas)}
                </td>
                <td
                  className={`px-4 py-3 text-right font-semibold ${
                    j.diferencia === null
                      ? 'text-[var(--text-secondary)]'
                      : j.diferencia === 0
                        ? 'text-[var(--success)]'
                        : j.diferencia > 0
                          ? 'text-[var(--success)]'
                          : 'text-[var(--error)]'
                  }`}
                >
                  {j.diferencia === null ? '-' : formatearPrecio(j.diferencia)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setDetalle(j)}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    Ver detalle
                  </button>
                </td>
              </tr>
            ))}
            {jornadas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                  No hay jornadas registradas todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detalle && (
        <Modal titulo={`Jornada del ${formatearFechaHora(detalle.fecha_apertura)}`} onClose={() => setDetalle(null)}>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Apertura</span>
              <span className="text-[var(--text-primary)]">{formatearFechaHora(detalle.fecha_apertura)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Cierre</span>
              <span className="text-[var(--text-primary)]">{formatearFechaHora(detalle.fecha_cierre)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Monto apertura</span>
              <span className="text-[var(--text-primary)]">{formatearPrecio(detalle.monto_apertura)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Total vendido</span>
              <span className="text-[var(--text-primary)]">{formatearPrecio(detalle.ventas.total_ventas)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Pedidos</span>
              <span className="text-[var(--text-primary)]">{detalle.ventas.cantidad_pedidos}</span>
            </div>
            <div className="border-t border-[var(--border)] pt-3">
              <p className="mb-2 text-xs uppercase tracking-wide text-[var(--text-secondary)]">Métodos de pago</p>
              {detalle.ventas.por_metodo_pago.map((m) => (
                <div key={m.metodo} className="flex justify-between text-[var(--text-secondary)]">
                  <span>{LABEL_METODO_PAGO[m.metodo] || m.metodo}</span>
                  <span>{formatearPrecio(m.total)}</span>
                </div>
              ))}
              {detalle.ventas.por_metodo_pago.length === 0 && <p className="text-[var(--text-secondary)]">Sin ventas</p>}
            </div>
            <div className="flex justify-between border-t border-[var(--border)] pt-3">
              <span className="text-[var(--text-secondary)]">Efectivo esperado</span>
              <span className="text-[var(--text-primary)]">{formatearPrecio(detalle.monto_cierre_esperado ?? detalle.ventas.monto_esperado_caja)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Efectivo contado</span>
              <span className="text-[var(--text-primary)]">{detalle.monto_cierre_real !== null ? formatearPrecio(detalle.monto_cierre_real) : '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">Diferencia</span>
              <span className={detalle.diferencia > 0 ? 'text-[var(--success)]' : detalle.diferencia < 0 ? 'text-[var(--error)]' : 'text-[var(--text-primary)]'}>
                {detalle.diferencia === null ? '-' : formatearPrecio(detalle.diferencia)}
              </span>
            </div>
            {detalle.notas && (
              <div className="border-t border-[var(--border)] pt-3">
                <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Notas</p>
                <p className="mt-1 text-[var(--text-primary)]">{detalle.notas}</p>
              </div>
            )}
          </div>

          {esGestor && detalle.estado === 'cerrada' && (
            <button
              type="button"
              onClick={() => handleReabrir(detalle)}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/10"
            >
              <RotateCcw size={16} />
              Reabrir jornada
            </button>
          )}
        </Modal>
      )}
    </div>
  );
}

export default Reportes;
