import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, ArrowUpCircle, ArrowDownCircle, Wallet, ShoppingCart, LogOut, History } from 'lucide-react';

import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import Campo from '../components/Campo';
import BotonesFormulario from '../components/BotonesFormulario';
import InputDinero from '../components/InputDinero';
import { useAuth } from '../context/AuthContext';
import { formatearPrecio } from '../utils/formato';
import { formatearHora, fechaHoyBogota } from '../utils/fecha';
import {
  getCategoriasContables,
  getResumenFinanciero,
  getFlujoEfectivo,
  getTransacciones,
  crearTransaccion,
  actualizarTransaccion,
  eliminarTransaccion,
  getEmpleadosJornada,
  getHistorialEmpleados,
  agregarEmpleadoJornada,
  actualizarEmpleadoJornada,
  marcarSalidaEmpleado,
  eliminarEmpleadoJornada,
} from '../utils/contaduria';

const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'transacciones', label: 'Transacciones' },
  { id: 'empleados', label: 'Empleados de jornada' },
  { id: 'flujo', label: 'Flujo de efectivo' },
];

const TIPOS_TRANSACCION = {
  ingreso: { label: 'Ingreso', color: '#22c55e' },
  egreso: { label: 'Egreso', color: '#ef4444' },
  retiro: { label: 'Retiro', color: '#f97316' },
  nomina: { label: 'Nómina', color: '#a855f7' },
  compra: { label: 'Compra', color: '#3b82f6' },
};

const LABEL_METODO_PAGO = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  nequi: 'Nequi',
  sin_especificar: 'Sin especificar',
};

const LABEL_ROL_EMPLEADO = {
  mesero: 'Mesero',
  cocina: 'Cocina',
  cajero: 'Cajero',
  domiciliario: 'Domiciliario',
  otro: 'Otro',
};

function hoyISO() {
  return fechaHoyBogota();
}

function restarDias(fechaISO, dias) {
  const fecha = new Date(`${fechaISO}T00:00:00`);
  fecha.setDate(fecha.getDate() - dias);
  return fecha.toISOString().slice(0, 10);
}

function inicioMes(fechaISO) {
  return `${fechaISO.slice(0, 7)}-01`;
}

function formatearFechaCorta(fechaISO) {
  return new Date(`${fechaISO}T00:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
}

// Para timestamps reales (TIMESTAMPTZ): el instante se convierte a la hora
// de Bogotá para mostrarlo.
function formatearFechaLarga(fechaIso) {
  if (!fechaIso) return '-';
  return new Date(fechaIso).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Para fechas puras 'YYYY-MM-DD' (columnas DATE, sin hora): NO se puede
// convertir por zona horaria, porque un string sin hora se interpreta como
// medianoche UTC y convertir eso a Bogotá (UTC-5) retrocede un día. Se
// parsea como hora local (sin "Z") para que el calendario coincida con el
// valor recibido.
function formatearFechaSolo(fechaISO) {
  if (!fechaISO) return '-';
  return new Date(`${fechaISO}T00:00:00`).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function Contaduria() {
  const { usuario } = useAuth();
  const autorizado = usuario?.rol === 'admin' || usuario?.rol === 'gerente';

  const [tab, setTab] = useState('resumen');

  if (!autorizado) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Contaduría</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">No tienes permiso para ver este módulo.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Contaduría</h1>

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
        {tab === 'resumen' && <TabResumen />}
        {tab === 'transacciones' && <TabTransacciones />}
        {tab === 'empleados' && <TabEmpleados />}
        {tab === 'flujo' && <TabFlujo />}
      </div>
    </div>
  );
}

// --- Tab 1: Resumen ---

const PERIODOS = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mes' },
  { id: 'personalizado', label: 'Personalizado' },
];

function calcularRangoPeriodo(periodo, fechaInicioPersonal, fechaFinPersonal) {
  const hoy = hoyISO();
  if (periodo === 'semana') return { fechaInicio: restarDias(hoy, 6), fechaFin: hoy };
  if (periodo === 'mes') return { fechaInicio: inicioMes(hoy), fechaFin: hoy };
  if (periodo === 'personalizado') return { fechaInicio: fechaInicioPersonal, fechaFin: fechaFinPersonal };
  return { fechaInicio: hoy, fechaFin: hoy };
}

function TarjetaMetrica({ titulo, valor, color }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5">
      <p className="text-sm text-[var(--text-secondary)]">{titulo}</p>
      <p className="mt-2 text-2xl font-bold" style={{ color }}>
        {valor}
      </p>
    </div>
  );
}

function GraficaIngresosEgresos({ dias }) {
  if (dias.length === 0) {
    return <p className="py-8 text-center text-sm text-[var(--text-secondary)]">No hay movimientos para mostrar todavía.</p>;
  }

  const maximo = Math.max(...dias.flatMap((d) => [d.ingresos, d.egresos]), 1);

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs text-[var(--text-secondary)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--success)]" /> Ingresos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[var(--error)]" /> Egresos
        </span>
      </div>
      <div className="flex items-end gap-4 overflow-x-auto pb-2" style={{ height: 210 }}>
        {dias.map((d) => (
          <div key={d.fecha} className="flex shrink-0 flex-col items-center justify-end gap-1" style={{ width: 56 }}>
            <div className="flex items-end gap-1" style={{ height: 170 }}>
              <div
                className="w-5 rounded-t-md bg-[var(--success)]"
                style={{ height: Math.max(2, (d.ingresos / maximo) * 170) }}
                title={formatearPrecio(d.ingresos)}
              />
              <div
                className="w-5 rounded-t-md bg-[var(--error)]"
                style={{ height: Math.max(2, (d.egresos / maximo) * 170) }}
                title={formatearPrecio(d.egresos)}
              />
            </div>
            <span className="text-[11px] text-[var(--text-secondary)]">{formatearFechaCorta(d.fecha)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabResumen() {
  const [periodo, setPeriodo] = useState('hoy');
  const [fechaInicioPersonal, setFechaInicioPersonal] = useState(restarDias(hoyISO(), 6));
  const [fechaFinPersonal, setFechaFinPersonal] = useState(hoyISO());
  const [resumen, setResumen] = useState(null);
  const [flujo, setFlujo] = useState([]);
  const [cargando, setCargando] = useState(true);

  const { fechaInicio, fechaFin } = calcularRangoPeriodo(periodo, fechaInicioPersonal, fechaFinPersonal);

  useEffect(() => {
    setCargando(true);
    Promise.all([getResumenFinanciero({ fechaInicio, fechaFin }), getFlujoEfectivo({ fechaInicio, fechaFin })])
      .then(([r, f]) => {
        setResumen(r);
        setFlujo(f);
      })
      .catch(() => toast.error('No se pudo cargar el resumen financiero'))
      .finally(() => setCargando(false));
  }, [fechaInicio, fechaFin]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex gap-2">
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriodo(p.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                periodo === p.id ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {periodo === 'personalizado' && (
          <div className="flex items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Desde</span>
              <input
                type="date"
                value={fechaInicioPersonal}
                max={fechaFinPersonal}
                onChange={(e) => setFechaInicioPersonal(e.target.value)}
                className="input w-auto"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Hasta</span>
              <input
                type="date"
                value={fechaFinPersonal}
                min={fechaInicioPersonal}
                max={hoyISO()}
                onChange={(e) => setFechaFinPersonal(e.target.value)}
                className="input w-auto"
              />
            </label>
          </div>
        )}
      </div>

      {cargando || !resumen ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <TarjetaMetrica titulo="Ingresos totales" valor={formatearPrecio(resumen.ingresos)} color="var(--success)" />
            <TarjetaMetrica titulo="Egresos totales" valor={formatearPrecio(resumen.egresos)} color="var(--error)" />
            <TarjetaMetrica
              titulo="Balance"
              valor={formatearPrecio(resumen.balance)}
              color={resumen.balance >= 0 ? 'var(--accent)' : 'var(--error)'}
            />
          </div>

          <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-6">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Ingresos vs. egresos por día</h2>
            <div className="mt-4">
              <GraficaIngresosEgresos dias={flujo} />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-[var(--border)]">
              <div className="bg-[var(--bg-secondary)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">Desglose por categoría</div>
              <table className="w-full text-left text-sm">
                <tbody>
                  {resumen.por_categoria.map((c) => (
                    <tr key={`${c.tipo}:${c.categoria}`} className="border-t border-[var(--border)] bg-[var(--bg-secondary)]">
                      <td className="px-4 py-3 text-[var(--text-primary)]">{c.categoria}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{TIPOS_TRANSACCION[c.tipo]?.label || c.tipo}</td>
                      <td className="px-4 py-3 text-right font-semibold" style={{ color: c.tipo === 'ingreso' ? 'var(--success)' : 'var(--error)' }}>
                        {formatearPrecio(c.total)}
                      </td>
                    </tr>
                  ))}
                  {resumen.por_categoria.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                        Sin movimientos en este período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="overflow-hidden rounded-xl border border-[var(--border)]">
              <div className="bg-[var(--bg-secondary)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)]">Desglose por método de pago</div>
              <table className="w-full text-left text-sm">
                <tbody>
                  {resumen.por_metodo_pago.map((m) => (
                    <tr key={m.metodo} className="border-t border-[var(--border)] bg-[var(--bg-secondary)]">
                      <td className="px-4 py-3 text-[var(--text-primary)]">{LABEL_METODO_PAGO[m.metodo] || m.metodo}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{m.cantidad} mov.</td>
                      <td className="px-4 py-3 text-right font-semibold text-[var(--text-primary)]">{formatearPrecio(m.total)}</td>
                    </tr>
                  ))}
                  {resumen.por_metodo_pago.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                        Sin movimientos en este período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// --- Tab 2: Transacciones ---

const BOTONES_RAPIDOS = [
  { tipo: 'ingreso', label: 'Ingreso', color: '#22c55e', icono: ArrowUpCircle, categoriaDefault: '' },
  { tipo: 'egreso', label: 'Egreso', color: '#ef4444', icono: ArrowDownCircle, categoriaDefault: '' },
  { tipo: 'retiro', label: 'Retiro', color: '#f97316', icono: Wallet, categoriaDefault: 'Retiro dueño' },
  { tipo: 'compra', label: 'Compra', color: '#3b82f6', icono: ShoppingCart, categoriaDefault: 'Insumos/Mercancía' },
];

const FILTROS_TIPO_TRANSACCION = [
  { value: 'todos', label: 'Todos los tipos' },
  { value: 'ingreso', label: 'Ingreso' },
  { value: 'egreso', label: 'Egreso' },
  { value: 'retiro', label: 'Retiro' },
  { value: 'nomina', label: 'Nómina' },
  { value: 'compra', label: 'Compra' },
];

function TabTransacciones() {
  const [transacciones, setTransacciones] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);

  const [fechaInicio, setFechaInicio] = useState(inicioMes(hoyISO()));
  const [fechaFin, setFechaFin] = useState(hoyISO());
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [metodoFiltro, setMetodoFiltro] = useState('todos');

  const [modalTransaccion, setModalTransaccion] = useState(null); // null | { tipo, categoria } | transacción existente

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setTransacciones(await getTransacciones({ fecha_inicio: fechaInicio, fecha_fin: fechaFin }));
    } catch {
      toast.error('No se pudo cargar las transacciones');
    } finally {
      setCargando(false);
    }
  }, [fechaInicio, fechaFin]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    getCategoriasContables()
      .then(setCategorias)
      .catch(() => toast.error('No se pudieron cargar las categorías contables'));
  }, []);

  async function handleGuardar(datos) {
    try {
      if (modalTransaccion?.id) {
        await actualizarTransaccion(modalTransaccion.id, datos);
        toast.success('Transacción actualizada');
      } else {
        await crearTransaccion(datos);
        toast.success('Transacción registrada');
      }
      setModalTransaccion(null);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo guardar la transacción');
    }
  }

  async function handleEliminar(transaccion) {
    if (!window.confirm(`¿Eliminar la transacción "${transaccion.descripcion}"?`)) return;
    try {
      await eliminarTransaccion(transaccion.id);
      toast.success('Transacción eliminada');
      cargar();
    } catch {
      toast.error('No se pudo eliminar la transacción');
    }
  }

  const transaccionesFiltradas = transacciones.filter((t) => {
    if (tipoFiltro !== 'todos' && t.tipo !== tipoFiltro) return false;
    if (metodoFiltro !== 'todos' && (t.metodo_pago || 'sin_especificar') !== metodoFiltro) return false;
    return true;
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {BOTONES_RAPIDOS.map((b) => (
          <button
            key={b.tipo}
            type="button"
            onClick={() => setModalTransaccion({ tipo: b.tipo, categoria: b.categoriaDefault })}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: b.color }}
          >
            <Plus size={16} />
            {b.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Desde</span>
          <input type="date" value={fechaInicio} max={fechaFin} onChange={(e) => setFechaInicio(e.target.value)} className="input w-auto" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Hasta</span>
          <input type="date" value={fechaFin} min={fechaInicio} onChange={(e) => setFechaFin(e.target.value)} className="input w-auto" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Tipo</span>
          <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)} className="input w-auto">
            {FILTROS_TIPO_TRANSACCION.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Método de pago</span>
          <select value={metodoFiltro} onChange={(e) => setMetodoFiltro(e.target.value)} className="input w-auto">
            <option value="todos">Todos</option>
            {Object.entries(LABEL_METODO_PAGO).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {cargando ? (
        <Spinner />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Descripción</th>
                <th className="px-4 py-3">Proveedor</th>
                <th className="px-4 py-3">Método</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {transaccionesFiltradas.map((t) => (
                <tr key={t.id} className="border-t border-[var(--border)] bg-[var(--bg-secondary)]">
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{formatearFechaSolo(t.fecha)}</td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded-full px-2 py-1 text-xs font-medium"
                      style={{ color: TIPOS_TRANSACCION[t.tipo]?.color, backgroundColor: `${TIPOS_TRANSACCION[t.tipo]?.color}1a` }}
                    >
                      {TIPOS_TRANSACCION[t.tipo]?.label || t.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-primary)]">{t.categoria || '-'}</td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-[var(--text-secondary)]" title={t.descripcion}>
                    {t.descripcion}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{t.proveedor || '-'}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{LABEL_METODO_PAGO[t.metodo_pago] || '-'}</td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: t.tipo === 'ingreso' ? 'var(--success)' : 'var(--error)' }}>
                    {t.tipo === 'ingreso' ? '+' : '-'}
                    {formatearPrecio(t.monto)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setModalTransaccion(t)}
                        title="Editar"
                        className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEliminar(t)}
                        title="Eliminar"
                        className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--error)]/10 hover:text-[var(--error)]"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {transaccionesFiltradas.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                    No hay transacciones que coincidan con los filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalTransaccion && (
        <Modal
          titulo={modalTransaccion.id ? 'Editar transacción' : `Nueva transacción — ${TIPOS_TRANSACCION[modalTransaccion.tipo]?.label}`}
          onClose={() => setModalTransaccion(null)}
        >
          <FormularioTransaccion transaccion={modalTransaccion} categorias={categorias} onGuardar={handleGuardar} onCancelar={() => setModalTransaccion(null)} />
        </Modal>
      )}
    </div>
  );
}

function FormularioTransaccion({ transaccion, categorias, onGuardar, onCancelar }) {
  const [tipo, setTipo] = useState(transaccion.tipo);
  const [categoria, setCategoria] = useState(transaccion.categoria || '');
  const [descripcion, setDescripcion] = useState(transaccion.descripcion || '');
  const [monto, setMonto] = useState(transaccion.monto ?? '');
  const [metodoPago, setMetodoPago] = useState(transaccion.metodo_pago || '');
  const [proveedor, setProveedor] = useState(transaccion.proveedor || '');
  const [numeroFactura, setNumeroFactura] = useState(transaccion.numero_factura || '');
  const [fecha, setFecha] = useState(transaccion.fecha || hoyISO());
  const [guardando, setGuardando] = useState(false);

  const categoriasSugeridas = categorias.filter((c) => c.tipo === (tipo === 'ingreso' ? 'ingreso' : 'egreso'));

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    await onGuardar({
      tipo,
      categoria: categoria || null,
      descripcion,
      monto: Number(monto),
      metodo_pago: metodoPago || null,
      proveedor: proveedor || null,
      numero_factura: numeroFactura || null,
      fecha,
    });
    setGuardando(false);
  }

  return (
    <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
      <Campo label="Tipo">
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="input">
          {Object.entries(TIPOS_TRANSACCION).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Campo>
      <Campo label="Categoría">
        <input value={categoria} onChange={(e) => setCategoria(e.target.value)} list="categorias-contables" className="input" placeholder="Ej: Arriendo, Insumos..." />
        <datalist id="categorias-contables">
          {categoriasSugeridas.map((c) => (
            <option key={c.id} value={c.nombre} />
          ))}
        </datalist>
      </Campo>
      <Campo label="Descripción">
        <textarea required value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="input" rows={2} />
      </Campo>
      <div className="grid grid-cols-2 gap-4">
        <Campo label="Monto">
          <InputDinero required value={monto} onChange={setMonto} className="input" />
        </Campo>
        <Campo label="Fecha">
          <input type="date" required value={fecha} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} className="input" />
        </Campo>
      </div>
      <Campo label="Método de pago">
        <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} className="input">
          <option value="">Sin especificar</option>
          {Object.entries(LABEL_METODO_PAGO)
            .filter(([value]) => value !== 'sin_especificar')
            .map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
        </select>
      </Campo>
      <div className="grid grid-cols-2 gap-4">
        <Campo label="Proveedor">
          <input value={proveedor} onChange={(e) => setProveedor(e.target.value)} className="input" />
        </Campo>
        <Campo label="N.º factura">
          <input value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} className="input" />
        </Campo>
      </div>
      <BotonesFormulario onCancelar={onCancelar} guardando={guardando} />
    </form>
  );
}

// --- Tab 3: Empleados de jornada ---

function TabEmpleados() {
  const [jornada, setJornada] = useState(null);
  const [empleados, setEmpleados] = useState([]);
  const [nomina, setNomina] = useState({ total: 0, cantidad_empleados: 0 });
  const [cargando, setCargando] = useState(true);
  const [modalEmpleado, setModalEmpleado] = useState(null); // null | 'nuevo' | empleado

  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const datos = await getEmpleadosJornada();
      setJornada(datos.jornada);
      setEmpleados(datos.empleados);
      setNomina(datos.nomina);
    } catch {
      toast.error('No se pudieron cargar los empleados de la jornada');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function handleVerHistorial() {
    const abrir = !mostrarHistorial;
    setMostrarHistorial(abrir);
    if (abrir && historial.length === 0) {
      setCargandoHistorial(true);
      try {
        setHistorial(await getHistorialEmpleados());
      } catch {
        toast.error('No se pudo cargar el historial de empleados');
      } finally {
        setCargandoHistorial(false);
      }
    }
  }

  async function handleGuardar(datos) {
    try {
      if (modalEmpleado === 'nuevo') {
        await agregarEmpleadoJornada(datos);
        toast.success('Empleado agregado al turno');
      } else {
        await actualizarEmpleadoJornada(modalEmpleado.id, datos);
        toast.success('Empleado actualizado');
      }
      setModalEmpleado(null);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo guardar el empleado');
    }
  }

  async function handleMarcarSalida(empleado) {
    try {
      await marcarSalidaEmpleado(empleado.id);
      toast.success('Salida registrada');
      cargar();
    } catch {
      toast.error('No se pudo registrar la salida');
    }
  }

  async function handleEliminar(empleado) {
    if (!window.confirm(`¿Quitar a "${empleado.nombre_empleado}" del turno?`)) return;
    try {
      await eliminarEmpleadoJornada(empleado.id);
      toast.success('Empleado eliminado del turno');
      cargar();
    } catch {
      toast.error('No se pudo eliminar el empleado');
    }
  }

  if (cargando) return <Spinner />;

  return (
    <div>
      {!jornada ? (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-6 text-center text-[var(--text-secondary)]">
          No hay una jornada abierta. Abre una jornada para registrar el personal del turno.
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Jornada abierta desde <span className="text-[var(--text-primary)]">{formatearFechaLarga(jornada.fecha_apertura)}</span>
            </p>
            <button
              type="button"
              onClick={() => setModalEmpleado('nuevo')}
              className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              <Plus size={16} />
              Agregar empleado al turno
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-[var(--border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                <tr>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Rol</th>
                  <th className="px-4 py-3">Entrada</th>
                  <th className="px-4 py-3">Salida</th>
                  <th className="px-4 py-3 text-right">Pago del día</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {empleados.map((emp) => (
                  <tr key={emp.id} className="border-t border-[var(--border)] bg-[var(--bg-secondary)]">
                    <td className="px-4 py-3 text-[var(--text-primary)]">{emp.nombre_empleado}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{LABEL_ROL_EMPLEADO[emp.rol_empleado] || '-'}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{emp.hora_entrada ? formatearHora(emp.hora_entrada) : '-'}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{emp.hora_salida ? formatearHora(emp.hora_salida) : '-'}</td>
                    <td className="px-4 py-3 text-right text-[var(--text-primary)]">{emp.pago_dia !== null ? formatearPrecio(emp.pago_dia) : '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {!emp.hora_salida && (
                          <button
                            type="button"
                            onClick={() => handleMarcarSalida(emp)}
                            title="Marcar salida"
                            className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--accent)]/10 hover:text-[var(--accent)]"
                          >
                            <LogOut size={16} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setModalEmpleado(emp)}
                          title="Editar"
                          className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEliminar(emp)}
                          title="Eliminar"
                          className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--error)]/10 hover:text-[var(--error)]"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {empleados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                      Todavía no hay empleados registrados en este turno.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-5 py-4">
            <span className="text-sm text-[var(--text-secondary)]">
              Total nómina del día ({nomina.cantidad_empleados} empleado{nomina.cantidad_empleados === 1 ? '' : 's'})
            </span>
            <span className="text-lg font-bold text-[var(--accent)]">{formatearPrecio(nomina.total)}</span>
          </div>
        </>
      )}

      <div className="mt-6">
        <button
          type="button"
          onClick={handleVerHistorial}
          className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <History size={16} />
          {mostrarHistorial ? 'Ocultar historial de jornadas anteriores' : 'Ver historial de jornadas anteriores'}
        </button>

        {mostrarHistorial && (
          <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)]">
            {cargandoHistorial ? (
              <Spinner />
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                  <tr>
                    <th className="px-4 py-3">Jornada</th>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3">Entrada</th>
                    <th className="px-4 py-3">Salida</th>
                    <th className="px-4 py-3 text-right">Pago del día</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((emp) => (
                    <tr key={emp.id} className="border-t border-[var(--border)] bg-[var(--bg-secondary)]">
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{formatearFechaLarga(emp.jornada_fecha_apertura)}</td>
                      <td className="px-4 py-3 text-[var(--text-primary)]">{emp.nombre_empleado}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{LABEL_ROL_EMPLEADO[emp.rol_empleado] || '-'}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{emp.hora_entrada ? formatearHora(emp.hora_entrada) : '-'}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{emp.hora_salida ? formatearHora(emp.hora_salida) : '-'}</td>
                      <td className="px-4 py-3 text-right text-[var(--text-primary)]">{emp.pago_dia !== null ? formatearPrecio(emp.pago_dia) : '-'}</td>
                    </tr>
                  ))}
                  {historial.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                        No hay empleados registrados en jornadas anteriores.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {modalEmpleado && (
        <Modal titulo={modalEmpleado === 'nuevo' ? 'Agregar empleado al turno' : 'Editar empleado'} onClose={() => setModalEmpleado(null)}>
          <FormularioEmpleado
            empleado={modalEmpleado === 'nuevo' ? null : modalEmpleado}
            onGuardar={handleGuardar}
            onCancelar={() => setModalEmpleado(null)}
          />
        </Modal>
      )}
    </div>
  );
}

function FormularioEmpleado({ empleado, onGuardar, onCancelar }) {
  const [nombre, setNombre] = useState(empleado?.nombre_empleado || '');
  const [rol, setRol] = useState(empleado?.rol_empleado || 'mesero');
  const [pagoDia, setPagoDia] = useState(empleado?.pago_dia ?? '');
  const [notas, setNotas] = useState(empleado?.notas || '');
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    await onGuardar({
      nombre_empleado: nombre,
      rol_empleado: rol,
      pago_dia: pagoDia === '' ? null : Number(pagoDia),
      notas: notas || null,
    });
    setGuardando(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Campo label="Nombre">
        <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="input" />
      </Campo>
      <Campo label="Rol">
        <select value={rol} onChange={(e) => setRol(e.target.value)} className="input">
          {Object.entries(LABEL_ROL_EMPLEADO).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Campo>
      <Campo label="Pago del día">
        <InputDinero value={pagoDia} onChange={setPagoDia} className="input" />
      </Campo>
      <Campo label="Notas">
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} className="input" rows={2} />
      </Campo>
      <BotonesFormulario onCancelar={onCancelar} guardando={guardando} />
    </form>
  );
}

// --- Tab 4: Flujo de efectivo ---

function TabFlujo() {
  const [fechaInicio, setFechaInicio] = useState(restarDias(hoyISO(), 6));
  const [fechaFin, setFechaFin] = useState(hoyISO());
  const [flujo, setFlujo] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    getFlujoEfectivo({ fechaInicio, fechaFin })
      .then(setFlujo)
      .catch(() => toast.error('No se pudo cargar el flujo de efectivo'))
      .finally(() => setCargando(false));
  }, [fechaInicio, fechaFin]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Desde</span>
          <input type="date" value={fechaInicio} max={fechaFin} onChange={(e) => setFechaInicio(e.target.value)} className="input w-auto" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--text-secondary)]">Hasta</span>
          <input type="date" value={fechaFin} min={fechaInicio} max={hoyISO()} onChange={(e) => setFechaFin(e.target.value)} className="input w-auto" />
        </label>
      </div>

      {cargando ? (
        <Spinner />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3 text-right">Ingresos</th>
                <th className="px-4 py-3 text-right">Egresos</th>
                <th className="px-4 py-3 text-right">Balance del día</th>
                <th className="px-4 py-3 text-right">Balance acumulado</th>
              </tr>
            </thead>
            <tbody>
              {flujo.map((d) => (
                <tr key={d.fecha} className="border-t border-[var(--border)] bg-[var(--bg-secondary)]">
                  <td className="px-4 py-3 text-[var(--text-primary)]">{formatearFechaSolo(d.fecha)}</td>
                  <td className="px-4 py-3 text-right text-[var(--success)]">{formatearPrecio(d.ingresos)}</td>
                  <td className="px-4 py-3 text-right text-[var(--error)]">{formatearPrecio(d.egresos)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${d.balance_dia >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                    {formatearPrecio(d.balance_dia)}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${d.balance_acumulado >= 0 ? 'text-[var(--success)]' : 'text-[var(--error)]'}`}>
                    {formatearPrecio(d.balance_acumulado)}
                  </td>
                </tr>
              ))}
              {flujo.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                    No hay movimientos en este período.
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

export default Contaduria;
