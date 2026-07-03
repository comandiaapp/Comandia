import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Check, Flame, Maximize, Minimize, UtensilsCrossed } from 'lucide-react';

import Spinner from '../components/Spinner';
import { getCocina, marcarItemEnPreparacion, marcarItemListo, marcarPedidoEntregado } from '../utils/pedidos';

const INTERVALO_POLLING = 15000;
const DURACION_FADE_OUT = 400;

function colorTiempo(minutos) {
  if (minutos < 10) return '#22c55e';
  if (minutos < 20) return '#eab308';
  return '#ef4444';
}

function etiquetaOrigen(pedido) {
  if (pedido.mesa_numero) {
    const numero = pedido.mesa_numero.trim();
    // Las mesas remotas (Domicilio-N, o el legado WH-N) ya traen un nombre
    // descriptivo propio; el resto de mesas solo tienen un número.
    if (numero.startsWith('Domicilio') || numero.startsWith('WH-')) return numero;
    return `Mesa ${numero}`;
  }
  if (pedido.tipo === 'delivery') return 'Domicilio';
  if (pedido.tipo === 'take_away') return 'Para llevar';
  if (pedido.tipo === 'barra') return 'Barra';
  return 'Pedido';
}

function Cocina() {
  const navigate = useNavigate();

  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [horaActual, setHoraActual] = useState(new Date());
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const [saliendo, setSaliendo] = useState({});

  const cargarCocina = useCallback(async () => {
    try {
      const datos = await getCocina();
      setPedidos(datos);
    } catch {
      toast.error('No se pudo cargar la pantalla de cocina');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarCocina();
    const intervalo = setInterval(cargarCocina, INTERVALO_POLLING);
    return () => clearInterval(intervalo);
  }, [cargarCocina]);

  useEffect(() => {
    const intervalo = setInterval(() => setHoraActual(new Date()), 1000);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    function handleFullscreenChange() {
      setPantallaCompleta(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  function handleToggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {
        toast.error('El navegador no permitió activar pantalla completa');
      });
    }
  }

  function actualizarItemLocal(pedidoId, itemId, cambios) {
    setPedidos((prev) =>
      prev.map((p) =>
        p.id !== pedidoId ? p : { ...p, items: p.items.map((i) => (i.id === itemId ? { ...i, ...cambios } : i)) }
      )
    );
  }

  function actualizarPedidoLocal(pedidoId, cambios) {
    setPedidos((prev) => prev.map((p) => (p.id === pedidoId ? { ...p, ...cambios } : p)));
  }

  async function handleClickItem(pedido, item) {
    try {
      if (item.estado === 'pendiente') {
        actualizarItemLocal(pedido.id, item.id, { estado: 'en_preparacion' });
        await marcarItemEnPreparacion(pedido.id, item.id);
      } else if (item.estado === 'en_preparacion') {
        actualizarItemLocal(pedido.id, item.id, { estado: 'listo' });
        const { pedido: pedidoActualizado } = await marcarItemListo(pedido.id, item.id);
        if (pedidoActualizado) actualizarPedidoLocal(pedido.id, { estado: pedidoActualizado.estado });
      } else if (item.estado === 'listo') {
        actualizarItemLocal(pedido.id, item.id, { estado: 'en_preparacion' });
        const { pedido: pedidoActualizado } = await marcarItemEnPreparacion(pedido.id, item.id);
        if (pedidoActualizado) actualizarPedidoLocal(pedido.id, { estado: pedidoActualizado.estado });
      }
    } catch {
      toast.error('No se pudo actualizar el producto');
      cargarCocina();
    }
  }

  async function handleTodoListo(pedido) {
    const idsPendientes = pedido.items.filter((i) => i.estado !== 'listo').map((i) => i.id);
    if (idsPendientes.length === 0) return;

    setPedidos((prev) =>
      prev.map((p) =>
        p.id !== pedido.id ? p : { ...p, items: p.items.map((i) => ({ ...i, estado: 'listo' })), estado: 'listo' }
      )
    );

    try {
      let pedidoActualizado = null;
      for (const itemId of idsPendientes) {
        const resultado = await marcarItemListo(pedido.id, itemId);
        pedidoActualizado = resultado.pedido || pedidoActualizado;
      }
      if (pedidoActualizado) actualizarPedidoLocal(pedido.id, { estado: pedidoActualizado.estado });
    } catch {
      toast.error('No se pudieron marcar todos los productos como listos');
      cargarCocina();
    }
  }

  async function handleEntregar(pedido) {
    setSaliendo((prev) => ({ ...prev, [pedido.id]: true }));
    try {
      await marcarPedidoEntregado(pedido.id);
      setTimeout(() => {
        setPedidos((prev) => prev.filter((p) => p.id !== pedido.id));
        setSaliendo((prev) => {
          const { [pedido.id]: _quitado, ...resto } = prev;
          return resto;
        });
      }, DURACION_FADE_OUT);
    } catch {
      toast.error('No se pudo marcar el pedido como entregado');
      setSaliendo((prev) => {
        const { [pedido.id]: _quitado, ...resto } = prev;
        return resto;
      });
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2a2a2a] bg-[#0a0a0a] px-6 py-4">
        <div className="flex items-center gap-3">
          <UtensilsCrossed className="text-[#f97316]" size={28} />
          <span className="text-2xl font-bold text-white">Comandia</span>
          <span className="rounded-full bg-[#f97316]/10 px-3 py-1 text-sm font-bold uppercase tracking-wide text-[#f97316]">
            Cocina
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="font-mono text-xl font-semibold text-white">
            {horaActual.toLocaleTimeString('es-CO', {
              timeZone: 'America/Bogota',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
            })}
          </span>
          <button
            type="button"
            onClick={handleToggleFullscreen}
            title={pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'}
            className="rounded-lg border border-[#2a2a2a] p-2 text-[#a1a1aa] hover:text-white"
          >
            {pantallaCompleta ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <button
            type="button"
            onClick={() => navigate('/mesas')}
            className="flex items-center gap-1 rounded-lg border border-[#2a2a2a] px-3 py-2 text-sm font-medium text-[#a1a1aa] hover:text-white"
          >
            <ArrowLeft size={14} />
            Volver
          </button>
        </div>
      </header>

      <main className="p-6">
        {cargando ? (
          <div className="flex h-[60vh] items-center justify-center">
            <Spinner />
          </div>
        ) : pedidos.length === 0 ? (
          <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-[#52525b]">
            <UtensilsCrossed size={48} />
            <p className="text-xl font-semibold">No hay pedidos pendientes en cocina</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {pedidos.map((pedido) => (
              <TarjetaPedidoCocina
                key={pedido.id}
                pedido={pedido}
                horaActual={horaActual}
                saliendo={Boolean(saliendo[pedido.id])}
                onClickItem={(item) => handleClickItem(pedido, item)}
                onTodoListo={() => handleTodoListo(pedido)}
                onEntregar={() => handleEntregar(pedido)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function TarjetaPedidoCocina({ pedido, horaActual, saliendo, onClickItem, onTodoListo, onEntregar }) {
  const minutos = pedido.enviado_cocina_at
    ? Math.max(0, Math.floor((horaActual - new Date(pedido.enviado_cocina_at)) / 60000))
    : 0;
  const color = colorTiempo(minutos);
  const todosListos = pedido.items.length > 0 && pedido.items.every((item) => item.estado === 'listo');

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border-4 bg-[#151515] transition-opacity duration-[400ms] ${
        saliendo ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{ borderColor: todosListos ? '#22c55e' : '#2a2a2a' }}
    >
      <div className="flex items-start justify-between gap-3 border-b border-[#2a2a2a] px-5 py-4">
        <div>
          <p className="text-[32px] font-black leading-none text-white">
            #{String(pedido.numero_jornada ?? pedido.numero_global).padStart(2, '0')}
          </p>
          <p className="mt-1.5 text-xl font-semibold text-[#d4d4d8]">{etiquetaOrigen(pedido)}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold leading-none" style={{ color }}>
            {minutos} min
          </p>
          <span
            className="mt-2 inline-block rounded-full px-3 py-1 text-base font-bold uppercase tracking-wide"
            style={{
              color: todosListos ? '#22c55e' : '#3b82f6',
              backgroundColor: todosListos ? '#22c55e1a' : '#3b82f61a',
            }}
          >
            {todosListos ? 'Listo' : 'En cocina'}
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-3 p-4">
        {pedido.items.map((item) => (
          <ItemCocina key={item.id} item={item} onClick={() => onClickItem(item)} />
        ))}
      </div>

      <div className="border-t border-[#2a2a2a] p-4">
        {todosListos ? (
          <button
            type="button"
            onClick={onEntregar}
            className="w-full rounded-xl bg-[#22c55e] py-4 text-xl font-bold text-white hover:bg-[#16a34a]"
          >
            Entregar
          </button>
        ) : (
          <button
            type="button"
            onClick={onTodoListo}
            className="w-full rounded-xl bg-[#f97316] py-4 text-xl font-bold text-white hover:bg-[#ea6a0d]"
          >
            Todo listo
          </button>
        )}
      </div>
    </div>
  );
}

function ItemCocina({ item, onClick }) {
  const esListo = item.estado === 'listo';
  const enPreparacion = item.estado === 'en_preparacion';

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] p-3 text-left transition-colors hover:border-[#f97316]/60"
    >
      <span
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2"
        style={{
          borderColor: esListo ? '#22c55e' : enPreparacion ? '#f97316' : '#52525b',
          backgroundColor: esListo ? '#22c55e' : 'transparent',
        }}
      >
        {esListo && <Check size={18} className="text-black" strokeWidth={3} />}
        {enPreparacion && <Flame size={18} className="text-[#f97316]" />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span
            className={`text-xl font-bold ${
              esListo ? 'text-[#22c55e] line-through' : enPreparacion ? 'text-[#f97316]' : 'text-white'
            }`}
          >
            {item.nombre_producto}
          </span>
          <span className="text-xl font-black text-white">x{item.cantidad}</span>
        </div>
        {item.modificadores?.length > 0 && (
          <p className="mt-1 text-sm text-[#a1a1aa]">{item.modificadores.map((m) => m.nombre_opcion).join(', ')}</p>
        )}
        {item.notas && (
          <p className="mt-1.5 rounded-md bg-[#f97316]/10 px-2 py-1 text-sm font-semibold text-[#f97316]">
            "{item.notas}"
          </p>
        )}
      </div>
    </button>
  );
}

export default Cocina;
