import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { TrendingUp, TrendingDown, ClipboardList, LayoutGrid, Star, Clock } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import Campo from '../components/Campo';
import BotonesFormulario from '../components/BotonesFormulario';
import Spinner from '../components/Spinner';
import GraficaBarras from '../components/GraficaBarras';
import { formatearPrecio } from '../utils/formato';
import { getResumenDashboard } from '../utils/reportes';
import { getJornadaActual, abrirJornada, cerrarJornada } from '../utils/jornadas';

const LABEL_METODO_PAGO = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  qr: 'QR',
  nequi: 'Nequi',
  transferencia: 'Transferencia',
  mixto: 'Mixto',
  sin_especificar: 'Sin especificar',
};

function saludoSegunHora() {
  const hora = Number(
    new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', hour12: false })
  );
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function tiempoTranscurrido(fechaIso) {
  const ms = Date.now() - new Date(fechaIso).getTime();
  const minutosTotales = Math.max(0, Math.floor(ms / 60000));
  const horas = Math.floor(minutosTotales / 60);
  const minutos = minutosTotales % 60;
  if (horas === 0) return `${minutos} min`;
  return `${horas}h ${minutos}min`;
}

function formatearHora(hora) {
  return `${String(hora).padStart(2, '0')}:00`;
}

function Dashboard() {
  const { usuario, restaurante } = useAuth();

  const [resumen, setResumen] = useState(null);
  const [jornada, setJornada] = useState(null);
  const [ventasJornada, setVentasJornada] = useState(null);
  const [cargando, setCargando] = useState(true);

  const [modalAbrir, setModalAbrir] = useState(false);
  const [modalCerrar, setModalCerrar] = useState(false);
  const [cargandoCierre, setCargandoCierre] = useState(false);

  const cargarTodo = useCallback(async () => {
    try {
      const [datosResumen, datosJornada] = await Promise.all([getResumenDashboard(), getJornadaActual()]);
      setResumen(datosResumen);
      setJornada(datosJornada.jornada);
      setVentasJornada(datosJornada.ventas || null);
    } catch {
      toast.error('No se pudo cargar la información del dashboard');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarTodo();
  }, [cargarTodo]);

  async function handleAbrirJornada(montoApertura) {
    try {
      await abrirJornada(montoApertura);
      toast.success('Jornada abierta');
      setModalAbrir(false);
      cargarTodo();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo abrir la jornada');
    }
  }

  // Las ventas de la jornada solo se refrescan en cargarTodo(), que corre al
  // montar y tras abrir/cerrar. Si la jornada lleva horas abierta y llegaron
  // ventas nuevas mientras esta pestaña seguía abierta, el total en memoria
  // queda desactualizado; por eso se vuelve a pedir justo antes de mostrar
  // el modal de cierre, para no cerrar con cifras viejas.
  async function handleAbrirModalCerrar() {
    setModalCerrar(true);
    setCargandoCierre(true);
    try {
      const datosJornada = await getJornadaActual();
      setJornada(datosJornada.jornada);
      setVentasJornada(datosJornada.ventas || null);
    } catch {
      toast.error('No se pudo actualizar el resumen de la jornada');
    } finally {
      setCargandoCierre(false);
    }
  }

  async function handleCerrarJornada(datos) {
    try {
      const resultado = await cerrarJornada(datos);
      const diferencia = resultado.diferencia;
      if (diferencia === 0) {
        toast.success('Jornada cerrada. La caja cuadra perfectamente.');
      } else if (diferencia > 0) {
        toast.success(`Jornada cerrada. Sobrante de ${formatearPrecio(diferencia)}.`);
      } else {
        toast.success(`Jornada cerrada. Faltante de ${formatearPrecio(Math.abs(diferencia))}.`);
      }
      setModalCerrar(false);
      cargarTodo();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo cerrar la jornada');
    }
  }

  if (cargando) {
    return <Spinner />;
  }

  const datosGrafica = (resumen?.ventas_por_hora_jornada || []).map((v) => ({
    label: formatearHora(v.hora),
    valor: v.total_ventas,
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">
        {saludoSegunHora()}, {usuario?.nombre?.split(' ')[0] || ''}
      </h1>
      <p className="mt-1 text-sm text-[#a1a1aa]">
        {restaurante?.nombre ? `${restaurante.nombre} — ` : ''}Este es el resumen de tu restaurante hoy.
      </p>

      <SeccionJornada
        jornada={jornada}
        ventasJornada={ventasJornada}
        onAbrir={() => setModalAbrir(true)}
        onCerrar={handleAbrirModalCerrar}
      />

      {resumen && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TarjetaVentasHoy resumen={resumen} />
          <TarjetaResumen
            icono={ClipboardList}
            titulo="Pedidos activos"
            valor={resumen.pedidos_activos}
            link="/pedidos"
          />
          <TarjetaResumen
            icono={LayoutGrid}
            titulo="Mesas ocupadas"
            valor={`${resumen.mesas_ocupadas}/${resumen.mesas_total}`}
            link="/mesas"
          />
          <TarjetaResumen
            icono={Star}
            titulo="Producto estrella"
            valor={resumen.producto_estrella ? resumen.producto_estrella.nombre : '-'}
            subtitulo={resumen.producto_estrella ? `${resumen.producto_estrella.cantidad} vendidos` : ''}
          />
        </div>
      )}

      <div className="mt-6 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <h2 className="text-lg font-semibold text-white">Ventas por hora — jornada actual</h2>
        <div className="mt-4">
          <GraficaBarras datos={datosGrafica} />
        </div>
      </div>

      {modalAbrir && <ModalAbrirJornada onGuardar={handleAbrirJornada} onCancelar={() => setModalAbrir(false)} />}

      {modalCerrar && jornada && (
        <ModalCerrarJornada
          ventasJornada={ventasJornada}
          cargando={cargandoCierre}
          onGuardar={handleCerrarJornada}
          onCancelar={() => setModalCerrar(false)}
        />
      )}
    </div>
  );
}

function SeccionJornada({ jornada, ventasJornada, onAbrir, onCerrar }) {
  if (!jornada) {
    return (
      <div className="mt-6 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <h2 className="text-lg font-semibold text-white">Jornada</h2>
        <p className="mt-1 text-sm text-[#a1a1aa]">El día no ha comenzado. Abre la jornada para empezar.</p>
        <button
          type="button"
          onClick={onAbrir}
          className="mt-4 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea6a0d]"
        >
          Abrir jornada
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-[#a1a1aa]">
            <Clock size={14} />
            Jornada abierta hace {tiempoTranscurrido(jornada.fecha_apertura)}
          </div>
          <p className="mt-2 text-3xl font-bold text-[#f97316]">
            {formatearPrecio(ventasJornada?.total_ventas || 0)}
          </p>
          <p className="mt-1 text-sm text-[#a1a1aa]">{ventasJornada?.cantidad_pedidos || 0} pedidos cobrados</p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-lg border border-[#f97316] px-4 py-2 text-sm font-semibold text-[#f97316] hover:bg-[#f97316]/10"
        >
          Cerrar jornada
        </button>
      </div>
    </div>
  );
}

function TarjetaResumen({ icono: Icono, titulo, valor, subtitulo, link }) {
  const contenido = (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-5 transition-colors hover:border-[#f97316]/50">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#a1a1aa]">{titulo}</p>
        {Icono && <Icono size={16} className="text-[#a1a1aa]" />}
      </div>
      <p className="mt-2 truncate text-2xl font-bold text-white">{valor}</p>
      {subtitulo && <p className="mt-1 text-xs text-[#a1a1aa]">{subtitulo}</p>}
    </div>
  );

  return link ? <Link to={link}>{contenido}</Link> : contenido;
}

function TarjetaVentasHoy({ resumen }) {
  if (!resumen.jornada_abierta) {
    return (
      <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-5">
        <p className="text-sm text-[#a1a1aa]">Ventas esta jornada</p>
        <p className="mt-2 text-lg font-semibold text-[#a1a1aa]">Sin jornada abierta</p>
      </div>
    );
  }

  const subio = resumen.variacion_jornada >= 0;
  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-5">
      <p className="text-sm text-[#a1a1aa]">Ventas esta jornada</p>
      <p className="mt-2 text-2xl font-bold text-white">{formatearPrecio(resumen.ventas_jornada)}</p>
      {resumen.hay_jornada_anterior && (
        <div
          className={`mt-1 flex items-center gap-1 text-xs font-medium ${subio ? 'text-green-400' : 'text-red-400'}`}
        >
          {subio ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(resumen.variacion_jornada).toFixed(0)}% vs. jornada anterior
        </div>
      )}
    </div>
  );
}

function ModalAbrirJornada({ onGuardar, onCancelar }) {
  const [monto, setMonto] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    await onGuardar(Number(monto) || 0);
    setGuardando(false);
  }

  return (
    <Modal titulo="Abrir jornada" onClose={onCancelar}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Campo label="Efectivo inicial en caja">
          <input
            type="number"
            min="0"
            step="1"
            required
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="input"
            placeholder="0"
            autoFocus
          />
        </Campo>
        <BotonesFormulario onCancelar={onCancelar} guardando={guardando} textoGuardar="Abrir jornada" />
      </form>
    </Modal>
  );
}

function ModalCerrarJornada({ ventasJornada, cargando, onGuardar, onCancelar }) {
  const [montoContado, setMontoContado] = useState('');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);

  const montoEsperado = ventasJornada?.monto_esperado_caja || 0;
  const diferencia = montoContado !== '' ? Number(montoContado) - montoEsperado : null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!window.confirm('¿Confirmas el cierre de la jornada? Esta acción no se puede deshacer.')) return;
    setGuardando(true);
    await onGuardar({ montoCierreReal: Number(montoContado), notas });
    setGuardando(false);
  }

  if (cargando) {
    return (
      <Modal titulo="Cerrar jornada" onClose={onCancelar}>
        <Spinner />
      </Modal>
    );
  }

  return (
    <Modal titulo="Cerrar jornada" onClose={onCancelar}>
      <div className="space-y-3 rounded-lg bg-[#141414] p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-[#a1a1aa]">Total vendido</span>
          <span className="font-semibold text-white">{formatearPrecio(ventasJornada?.total_ventas || 0)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#a1a1aa]">Cantidad de pedidos</span>
          <span className="font-semibold text-white">{ventasJornada?.cantidad_pedidos || 0}</span>
        </div>
        <div className="border-t border-[#2a2a2a] pt-3">
          <p className="mb-2 text-xs uppercase tracking-wide text-[#a1a1aa]">Desglose por método de pago</p>
          {(ventasJornada?.por_metodo_pago || []).map((m) => (
            <div key={m.metodo} className="flex justify-between text-[#a1a1aa]">
              <span>{LABEL_METODO_PAGO[m.metodo] || m.metodo}</span>
              <span>{formatearPrecio(m.total)}</span>
            </div>
          ))}
          {(ventasJornada?.por_metodo_pago || []).length === 0 && (
            <p className="text-[#a1a1aa]">Sin ventas todavía</p>
          )}
        </div>
        <div className="flex justify-between border-t border-[#2a2a2a] pt-3">
          <span className="text-[#a1a1aa]">Efectivo esperado en caja</span>
          <span className="font-semibold text-white">{formatearPrecio(montoEsperado)}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <Campo label="Efectivo contado en caja">
          <input
            type="number"
            min="0"
            step="1"
            required
            value={montoContado}
            onChange={(e) => setMontoContado(e.target.value)}
            className="input"
            placeholder="0"
            autoFocus
          />
        </Campo>

        {diferencia !== null && (
          <p className={`text-sm font-semibold ${diferencia === 0 ? 'text-green-400' : diferencia > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {diferencia === 0
              ? 'La caja cuadra perfectamente'
              : diferencia > 0
                ? `Sobrante de ${formatearPrecio(diferencia)}`
                : `Faltante de ${formatearPrecio(Math.abs(diferencia))}`}
          </p>
        )}

        <Campo label="Notas (opcional)">
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} className="input" rows={2} />
        </Campo>

        <BotonesFormulario onCancelar={onCancelar} guardando={guardando} textoGuardar="Cerrar jornada" />
      </form>
    </Modal>
  );
}

export default Dashboard;
