import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Users, Plus, Pencil, Trash2, LayoutGrid, List, Settings, Move, RotateCcw, Phone, Clock, X } from 'lucide-react';
import { DndContext, PointerSensor, useDraggable, useSensor, useSensors } from '@dnd-kit/core';

import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import Campo from '../components/Campo';
import BotonesFormulario from '../components/BotonesFormulario';
import POSDrawer from '../components/POSDrawer';
import { useAuth } from '../context/AuthContext';
import {
  getPlano,
  getMesas,
  crearMesa,
  crearMesaRemota,
  actualizarMesa,
  cambiarEstadoMesa,
  actualizarPosicionMesa,
  resetearPosicionesMesas,
  eliminarMesa,
  getAreas,
  crearArea,
  actualizarArea,
} from '../utils/mesas';
import { getPedidoPorMesa, pedirCuentaPedido } from '../utils/pedidos';

const COLOR_ESTADO = {
  libre: '#22c55e',
  ocupada: '#ef4444',
  cuenta_pedida: '#eab308',
  reservada: '#3b82f6',
  bloqueada: '#6b7280',
};

const LABEL_ESTADO = {
  libre: 'Libre',
  ocupada: 'Ocupada',
  cuenta_pedida: 'Cuenta pedida',
  reservada: 'Reservada',
  bloqueada: 'Bloqueada',
};

const ESTADOS = Object.keys(COLOR_ESTADO);

const CANVAS_WIDTH = 1200;
const GRID_SIZE = 100;
const CLAVE_MODO_CUADRICULA = 'comandia_mesas_modo_cuadricula';
const LIMITE_MESAS_REMOTAS = 20;

const ALTURAS_CANVAS = { compacto: 300, normal: 500, grande: 700 };
const LABEL_TAMANO_CANVAS = { compacto: 'Compacto', normal: 'Normal', grande: 'Grande' };
const CLAVE_TAMANO_CANVAS = 'comandia_mesas_tamano_canvas';

function clamp(valor, min, max) {
  return Math.min(max, Math.max(min, valor));
}

function redondearACuadricula(valor) {
  return Math.round(valor / GRID_SIZE) * GRID_SIZE;
}

function formatearHora(fechaIso) {
  return new Date(fechaIso).toLocaleTimeString('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// Pitido corto sin depender de un archivo de audio externo. Si el navegador
// bloquea el audio (sin interacción previa del usuario) simplemente no suena.
function reproducirSonidoAviso() {
  try {
    const Contexto = window.AudioContext || window.webkitAudioContext;
    const ctx = new Contexto();
    const osc = ctx.createOscillator();
    const ganancia = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    ganancia.gain.setValueAtTime(0.15, ctx.currentTime);
    ganancia.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(ganancia);
    ganancia.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Sin soporte de audio en este navegador; se ignora silenciosamente.
  }
}

// Compara la lista de mesas recién cargada contra la última conocida (guardada
// en un ref para no disparar renders) y avisa con sonido solo cuando aparece
// un pedido 'listo' que no se había visto antes. En la primera carga de la
// página nunca suena, para no alertar sobre pedidos que ya estaban listos
// antes de abrir la pantalla.
function detectarYAvisarNuevosListos(mesasFlat, conocidosRef, primerCargaRef) {
  const idsListoAhora = new Set();
  for (const mesa of mesasFlat) {
    if (mesa.pedido_estado === 'listo' && mesa.pedido_id) idsListoAhora.add(mesa.pedido_id);
  }
  if (!primerCargaRef.current) {
    const hayNuevo = [...idsListoAhora].some((id) => !conocidosRef.current.has(id));
    if (hayNuevo) reproducirSonidoAviso();
  }
  conocidosRef.current = idsListoAhora;
  primerCargaRef.current = false;
}

function debeMostrarBadgeListo(mesa, pedidosVistos) {
  return mesa.pedido_estado === 'listo' && Boolean(mesa.pedido_id) && !pedidosVistos.has(mesa.pedido_id);
}

function tienePosicionGuardada(mesa) {
  return Number(mesa.posicion_x) > 0 && Number(mesa.posicion_y) > 0;
}

function Mesas() {
  const { usuario } = useAuth();
  const esGestor = usuario?.rol === 'admin' || usuario?.rol === 'gerente';

  const [mesaSeleccionadaId, setMesaSeleccionadaId] = useState(null);

  const [vista, setVista] = useState('plano'); // 'plano' | 'lista'
  const [modoEdicion, setModoEdicion] = useState(false);
  const [modoCuadricula, setModoCuadricula] = useState(() => localStorage.getItem(CLAVE_MODO_CUADRICULA) === 'true');
  const [tamanoCanvas, setTamanoCanvas] = useState(() => {
    const guardado = localStorage.getItem(CLAVE_TAMANO_CANVAS);
    return guardado && ALTURAS_CANVAS[guardado] ? guardado : 'normal';
  });
  const alturaCanvas = ALTURAS_CANVAS[tamanoCanvas];
  const [areas, setAreas] = useState([]);
  const [areaActiva, setAreaActiva] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const [plano, setPlano] = useState([]);
  const [cargandoPlano, setCargandoPlano] = useState(true);

  const [mesas, setMesas] = useState([]);
  const [cargandoMesas, setCargandoMesas] = useState(true);

  const [modalMesaAccion, setModalMesaAccion] = useState(null); // mesa clickeada en el plano
  const [modalMesaForm, setModalMesaForm] = useState(null); // null | 'nueva' | mesa
  const [modalAreas, setModalAreas] = useState(false);

  const [mesasRemotas, setMesasRemotas] = useState([]);
  const [creandoMesaRemota, setCreandoMesaRemota] = useState(false);

  const [pedidosVistos, setPedidosVistos] = useState(() => new Set());
  const pedidosListoPlanoRef = useRef(new Set());
  const primerCargaPlanoRef = useRef(true);
  const pedidosListoRemotasRef = useRef(new Set());
  const primerCargaRemotasRef = useRef(true);

  const cargarAreas = useCallback(async () => {
    try {
      setAreas(await getAreas());
    } catch {
      toast.error('No se pudieron cargar las áreas');
    }
  }, []);

  const cargarPlano = useCallback(async () => {
    try {
      const datos = await getPlano();
      setPlano(datos);
      const mesasFlat = datos.flatMap((area) => area.mesas);
      detectarYAvisarNuevosListos(mesasFlat, pedidosListoPlanoRef, primerCargaPlanoRef);
    } catch {
      toast.error('No se pudo cargar el plano de mesas');
    } finally {
      setCargandoPlano(false);
    }
  }, []);

  const cargarMesas = useCallback(async () => {
    setCargandoMesas(true);
    try {
      setMesas(await getMesas());
    } catch {
      toast.error('No se pudieron cargar las mesas');
    } finally {
      setCargandoMesas(false);
    }
  }, []);

  const areaRemota = areas.find((area) => area.es_remota);
  const areasSeleccionables = areas.filter((area) => !area.es_remota);

  const cargarMesasRemotas = useCallback(async (areaRemotaId) => {
    if (!areaRemotaId) return;
    try {
      const lista = await getMesas(areaRemotaId);
      const conHoraPedido = await Promise.all(
        lista.map(async (mesa) => {
          try {
            const pedido = await getPedidoPorMesa(mesa.id);
            return { ...mesa, horaPedido: pedido.created_at };
          } catch {
            return { ...mesa, horaPedido: null };
          }
        })
      );
      setMesasRemotas(conHoraPedido);
      detectarYAvisarNuevosListos(conHoraPedido, pedidosListoRemotasRef, primerCargaRemotasRef);
    } catch {
      toast.error('No se pudieron cargar las mesas remotas');
    }
  }, []);

  useEffect(() => {
    cargarAreas();
  }, [cargarAreas]);

  useEffect(() => {
    if (vista !== 'plano') return undefined;
    cargarPlano();
    const intervalo = setInterval(cargarPlano, 30000);
    return () => clearInterval(intervalo);
  }, [vista, cargarPlano]);

  useEffect(() => {
    if (vista !== 'plano' || !areaRemota) return undefined;
    cargarMesasRemotas(areaRemota.id);
    const intervalo = setInterval(() => cargarMesasRemotas(areaRemota.id), 60000);
    return () => clearInterval(intervalo);
  }, [vista, areaRemota?.id, cargarMesasRemotas]);

  useEffect(() => {
    if (vista === 'lista') cargarMesas();
  }, [vista, cargarMesas]);

  useEffect(() => {
    if (vista !== 'plano') setModoEdicion(false);
  }, [vista]);

  useEffect(() => {
    localStorage.setItem(CLAVE_MODO_CUADRICULA, String(modoCuadricula));
  }, [modoCuadricula]);

  useEffect(() => {
    localStorage.setItem(CLAVE_TAMANO_CANVAS, tamanoCanvas);
  }, [tamanoCanvas]);

  async function handleCambiarEstado(mesa, estado) {
    try {
      await cambiarEstadoMesa(mesa.id, estado);
      toast.success('Estado actualizado');
      setModalMesaAccion(null);
      cargarPlano();
      if (vista === 'lista') cargarMesas();
      if (areaRemota) cargarMesasRemotas(areaRemota.id);
    } catch {
      toast.error('No se pudo cambiar el estado de la mesa');
    }
  }

  // A diferencia de handleCambiarEstado, "pedir cuenta" no es solo un cambio
  // de estado de la mesa: tiene que pasar por el pedido (pedidoModel.pedirCuenta
  // registra cuenta_pedida_at y ese mismo endpoint ya deja la mesa en
  // 'cuenta_pedida'), para que la precuenta del POS y el cronómetro de la
  // tarjeta de mesa vean el mismo estado.
  async function handlePedirCuentaRapida(mesa) {
    try {
      await pedirCuentaPedido(mesa.pedido_id);
      toast.success('Cuenta pedida');
      setModalMesaAccion(null);
      cargarPlano();
      if (vista === 'lista') cargarMesas();
      if (areaRemota) cargarMesasRemotas(areaRemota.id);
    } catch {
      toast.error('No se pudo pedir la cuenta');
    }
  }

  function handleAbrirPedido(mesa) {
    setModalMesaAccion(null);
    setMesaSeleccionadaId(mesa.id);
    if (mesa.pedido_id) {
      setPedidosVistos((prev) => new Set(prev).add(mesa.pedido_id));
    }
  }

  // Una mesa con la cuenta pedida ya no necesita el menú rápido de
  // acciones: el click va directo al drawer del POS, que al detectar el
  // pedido en estado 'cuenta_pedida' abre la precuenta de inmediato.
  function handleClickMesa(mesa) {
    if (mesa.estado === 'cuenta_pedida') {
      handleAbrirPedido(mesa);
    } else {
      setModalMesaAccion(mesa);
    }
  }

  function handleCerrarDrawer() {
    setMesaSeleccionadaId(null);
    cargarPlano();
    if (vista === 'lista') cargarMesas();
    if (areaRemota) cargarMesasRemotas(areaRemota.id);
  }

  async function handleCrearMesaRemota() {
    setCreandoMesaRemota(true);
    try {
      const mesa = await crearMesaRemota();
      setMesasRemotas((prev) => [...prev, mesa]);
      toast.success(`Mesa ${mesa.numero} creada`);
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo crear la mesa remota');
    } finally {
      setCreandoMesaRemota(false);
    }
  }

  async function handleEliminarMesaRemota(mesa) {
    if (!window.confirm(`¿Eliminar ${mesa.numero}? Si tiene un pedido activo, el pedido no se eliminará.`)) return;
    try {
      await eliminarMesa(mesa.id);
      toast.success('Domicilio eliminado');
      setMesasRemotas((prev) => prev.filter((m) => m.id !== mesa.id));
      cargarPlano();
    } catch {
      toast.error('No se pudo eliminar el domicilio');
    }
  }

  function handleDragEnd(event) {
    const { active, delta } = event;
    if (!delta.x && !delta.y) return;

    const mesa = mesasParaEditar.find((m) => m.id === active.id);
    if (!mesa) return;

    let xPx = (Number(mesa.posicion_x) / 100) * CANVAS_WIDTH + delta.x;
    let yPx = (Number(mesa.posicion_y) / 100) * alturaCanvas + delta.y;

    if (modoCuadricula) {
      xPx = redondearACuadricula(xPx);
      yPx = redondearACuadricula(yPx);
    }

    const nuevaX = clamp((xPx / CANVAS_WIDTH) * 100, 0, 100);
    const nuevaY = clamp((yPx / alturaCanvas) * 100, 0, 100);

    setPlano((prev) =>
      prev.map((area) => ({
        ...area,
        mesas: area.mesas.map((m) => (m.id === mesa.id ? { ...m, posicion_x: nuevaX, posicion_y: nuevaY } : m)),
      }))
    );

    actualizarPosicionMesa(mesa.id, nuevaX, nuevaY)
      .then(() => toast.success('Posición guardada', { duration: 1500 }))
      .catch(() => toast.error('No se pudo guardar la posición'));
  }

  async function handleResetearPosiciones() {
    if (
      !window.confirm('¿Restablecer todas las mesas al orden por defecto? Esto borrará el plano personalizado.')
    ) {
      return;
    }
    try {
      await resetearPosicionesMesas();
      toast.success('Plano restablecido al orden por defecto');
      cargarPlano();
    } catch {
      toast.error('No se pudieron restablecer las posiciones');
    }
  }

  async function handleGuardarMesa(datos) {
    try {
      if (modalMesaForm === 'nueva') {
        await crearMesa(datos);
        toast.success('Mesa creada');
      } else {
        await actualizarMesa(modalMesaForm.id, datos);
        toast.success('Mesa actualizada');
      }
      setModalMesaForm(null);
      cargarMesas();
      cargarPlano();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo guardar la mesa');
    }
  }

  async function handleEliminarMesa(mesa) {
    if (!window.confirm(`¿Eliminar la mesa "${mesa.numero}"?`)) return;
    try {
      await eliminarMesa(mesa.id);
      toast.success('Mesa eliminada');
      cargarMesas();
      cargarPlano();
    } catch {
      toast.error('No se pudo eliminar la mesa');
    }
  }

  async function handleGuardarArea(datos, area) {
    try {
      if (area) {
        await actualizarArea(area.id, datos);
        toast.success('Área actualizada');
      } else {
        await crearArea(datos);
        toast.success('Área creada');
      }
      cargarAreas();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo guardar el área');
    }
  }

  const planoFiltrado = areaActiva ? plano.filter((area) => area.id === areaActiva) : plano;

  // En modo edición se arma un único lienzo con todas las mesas filtradas.
  // Las que aún no tienen posición guardada se reparten en una cuadrícula
  // provisional para que no queden todas apiladas en la misma esquina.
  const mesasParaEditar = planoFiltrado
    .flatMap((area) => area.mesas)
    .map((mesa, index) => {
      if (tienePosicionGuardada(mesa)) return mesa;
      const columnas = 8;
      return {
        ...mesa,
        posicion_x: 8 + (index % columnas) * 11,
        posicion_y: 12 + Math.floor(index / columnas) * 22,
      };
    });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">Mesas</h1>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-1">
            <button
              type="button"
              onClick={() => setVista('plano')}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ${
                vista === 'plano' ? 'bg-[#f97316] text-white' : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              <LayoutGrid size={16} />
              Plano
            </button>
            <button
              type="button"
              onClick={() => setVista('lista')}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ${
                vista === 'lista' ? 'bg-[#f97316] text-white' : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              <List size={16} />
              Lista
            </button>
          </div>

          {esGestor && vista === 'plano' && (
            <button
              type="button"
              onClick={() => setVista('lista')}
              className="flex items-center gap-2 rounded-lg border border-[#2a2a2a] px-3 py-2 text-sm font-medium text-[#a1a1aa] hover:text-white"
            >
              <Settings size={16} />
              Gestionar mesas
            </button>
          )}

          {esGestor && vista === 'plano' && (
            <button
              type="button"
              onClick={() => setModoEdicion((valor) => !valor)}
              className={`hidden items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium md:flex ${
                modoEdicion ? 'border-[#f97316] text-[#f97316]' : 'border-[#2a2a2a] text-[#a1a1aa] hover:text-white'
              }`}
            >
              <Move size={16} />
              {modoEdicion ? 'Salir de edición' : 'Editar plano'}
            </button>
          )}
        </div>
      </div>

      {vista === 'plano' ? (
        <div className="mt-6">
          {areasSeleccionables.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAreaActiva('')}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  areaActiva === '' ? 'bg-[#f97316] text-white' : 'bg-[#1a1a1a] text-[#a1a1aa] hover:text-white'
                }`}
              >
                Todas
              </button>
              {areasSeleccionables.map((area) => (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => setAreaActiva(area.id)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    areaActiva === area.id ? 'bg-[#f97316] text-white' : 'bg-[#1a1a1a] text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  {area.nombre}
                </button>
              ))}
            </div>
          )}

          <div className="mb-4 flex items-center gap-2">
            <span className="text-xs text-[#a1a1aa]">Tamaño del plano:</span>
            <div className="flex rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-1">
              {Object.keys(ALTURAS_CANVAS).map((clave) => (
                <button
                  key={clave}
                  type="button"
                  onClick={() => setTamanoCanvas(clave)}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${
                    tamanoCanvas === clave ? 'bg-[#f97316] text-white' : 'text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  {LABEL_TAMANO_CANVAS[clave]}
                </button>
              ))}
            </div>
          </div>

          {modoEdicion && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm text-[#f97316]">
                <Move size={14} />
                Arrastra las mesas para organizarlas
              </p>

              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-1">
                  <button
                    type="button"
                    onClick={() => setModoCuadricula(false)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                      !modoCuadricula ? 'bg-[#f97316] text-white' : 'text-[#a1a1aa] hover:text-white'
                    }`}
                  >
                    Modo libre
                  </button>
                  <button
                    type="button"
                    onClick={() => setModoCuadricula(true)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                      modoCuadricula ? 'bg-[#f97316] text-white' : 'text-[#a1a1aa] hover:text-white'
                    }`}
                  >
                    Modo cuadrícula
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleResetearPosiciones}
                  className="flex items-center gap-2 rounded-lg border border-[#2a2a2a] px-3 py-2 text-sm font-medium text-[#a1a1aa] hover:text-white"
                >
                  <RotateCcw size={16} />
                  Restablecer orden
                </button>
              </div>
            </div>
          )}

          {cargandoPlano ? (
            <Spinner />
          ) : modoEdicion ? (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <CanvasPlano mesas={mesasParaEditar} editable cuadricula={modoCuadricula} altura={alturaCanvas} />
            </DndContext>
          ) : (
            <div className="space-y-8">
              {planoFiltrado.map((area) => {
                const mesasPosicionadas = area.mesas.filter(tienePosicionGuardada);
                const mesasSinPosicion = area.mesas.filter((mesa) => !tienePosicionGuardada(mesa));

                return (
                  <div key={area.id || 'sin-area'}>
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#a1a1aa]">
                      {area.nombre}
                    </h2>

                    {mesasPosicionadas.length > 0 && (
                      <div className="mb-4">
                        <CanvasPlano
                          mesas={mesasPosicionadas}
                          editable={false}
                          altura={alturaCanvas}
                          pedidosVistos={pedidosVistos}
                          onClickMesa={handleClickMesa}
                        />
                      </div>
                    )}

                    {mesasSinPosicion.length > 0 && (
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                        {mesasSinPosicion.map((mesa) => (
                          <TarjetaMesa
                            key={mesa.id}
                            mesa={mesa}
                            mostrarBadgeListo={debeMostrarBadgeListo(mesa, pedidosVistos)}
                            onClick={() => handleClickMesa(mesa)}
                          />
                        ))}
                      </div>
                    )}

                    {area.mesas.length === 0 && <p className="text-sm text-[#a1a1aa]">No hay mesas en esta área.</p>}
                  </div>
                );
              })}
              {planoFiltrado.length === 0 && (
                <p className="py-8 text-center text-[#a1a1aa]">No hay mesas configuradas todavía.</p>
              )}
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-4 border-t border-[#2a2a2a] pt-4">
            {ESTADOS.map((estado) => (
              <div key={estado} className="flex items-center gap-2 text-sm text-[#a1a1aa]">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: COLOR_ESTADO[estado] }} />
                {LABEL_ESTADO[estado]}
              </div>
            ))}
          </div>

          <div className="mt-8 border-t border-[#2a2a2a] pt-6">
            <div className="mb-3 flex items-center gap-2">
              <Phone size={16} className="text-[#a1a1aa]" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Pedidos remotos</h2>
              <span className="text-xs text-[#a1a1aa]">{mesasRemotas.length} activas</span>
            </div>

            <div className="flex items-center gap-3 overflow-x-auto pb-2">
              {mesasRemotas.map((mesa) => (
                <TarjetaMesaRemota
                  key={mesa.id}
                  mesa={mesa}
                  mostrarBadgeListo={debeMostrarBadgeListo(mesa, pedidosVistos)}
                  esGestor={esGestor}
                  onClick={() => handleClickMesa(mesa)}
                  onEliminar={handleEliminarMesaRemota}
                />
              ))}

              <button
                type="button"
                onClick={handleCrearMesaRemota}
                disabled={creandoMesaRemota || mesasRemotas.length >= LIMITE_MESAS_REMOTAS}
                title="Nueva mesa remota"
                className="flex aspect-square w-[167px] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#333] text-[#a1a1aa] hover:border-[#f97316] hover:text-[#f97316] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus size={24} />
              </button>
            </div>

            {mesasRemotas.length === 0 && (
              <p className="mt-2 text-sm text-[#a1a1aa]">
                No hay mesas remotas todavía. Usa el botón "+" para crear una.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <div className="mb-4 flex flex-wrap justify-end gap-3">
            {esGestor && (
              <button
                type="button"
                onClick={() => setModalAreas(true)}
                className="flex items-center gap-2 rounded-lg border border-[#2a2a2a] px-4 py-2 text-sm font-medium text-[#a1a1aa] hover:text-white"
              >
                Gestionar áreas
              </button>
            )}
            {esGestor && (
              <button
                type="button"
                onClick={() => setModalMesaForm('nueva')}
                className="flex items-center gap-2 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea6a0d]"
              >
                <Plus size={16} />
                Nueva mesa
              </button>
            )}
          </div>

          {cargandoMesas ? (
            <Spinner />
          ) : (
            <div className="overflow-hidden rounded-xl border border-[#2a2a2a]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#1a1a1a] text-[#a1a1aa]">
                  <tr>
                    <th className="px-4 py-3">Número</th>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Área</th>
                    <th className="px-4 py-3">Capacidad</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {mesas.map((mesa) => (
                    <tr key={mesa.id} className="border-t border-[#2a2a2a] bg-[#141414]">
                      <td className="px-4 py-3 font-semibold text-white">{mesa.numero}</td>
                      <td className="px-4 py-3 text-[#a1a1aa]">{mesa.nombre || '-'}</td>
                      <td className="px-4 py-3 text-[#a1a1aa]">{mesa.area_nombre || 'Sin área'}</td>
                      <td className="px-4 py-3 text-[#a1a1aa]">{mesa.capacidad}</td>
                      <td className="px-4 py-3">
                        <span
                          className="rounded-full px-2 py-1 text-xs font-medium"
                          style={{
                            color: COLOR_ESTADO[mesa.estado],
                            backgroundColor: `${COLOR_ESTADO[mesa.estado]}1a`,
                          }}
                        >
                          {LABEL_ESTADO[mesa.estado] || mesa.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {esGestor && (
                            <button
                              type="button"
                              onClick={() => setModalMesaForm(mesa)}
                              className="rounded-lg p-2 text-[#a1a1aa] hover:bg-[#2a2a2a] hover:text-white"
                              title="Editar"
                            >
                              <Pencil size={16} />
                            </button>
                          )}
                          {usuario?.rol === 'admin' && (
                            <button
                              type="button"
                              onClick={() => handleEliminarMesa(mesa)}
                              className="rounded-lg p-2 text-[#a1a1aa] hover:bg-red-500/10 hover:text-red-400"
                              title="Eliminar"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {mesas.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[#a1a1aa]">
                        No hay mesas todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {modalMesaAccion && (
        <ModalAccionMesa
          mesa={modalMesaAccion}
          onClose={() => setModalMesaAccion(null)}
          onCambiarEstado={(estado) => handleCambiarEstado(modalMesaAccion, estado)}
          onPedirCuenta={() => handlePedirCuentaRapida(modalMesaAccion)}
          onAbrirPedido={handleAbrirPedido}
        />
      )}

      {modalMesaForm && (
        <Modal titulo={modalMesaForm === 'nueva' ? 'Nueva mesa' : 'Editar mesa'} onClose={() => setModalMesaForm(null)}>
          <FormularioMesa
            mesa={modalMesaForm === 'nueva' ? null : modalMesaForm}
            areas={areasSeleccionables}
            onGuardar={handleGuardarMesa}
            onCancelar={() => setModalMesaForm(null)}
          />
        </Modal>
      )}

      {modalAreas && (
        <Modal titulo="Gestionar áreas" onClose={() => setModalAreas(false)}>
          <GestionAreas areas={areasSeleccionables} onGuardar={handleGuardarArea} />
        </Modal>
      )}

      <POSDrawer mesaId={mesaSeleccionadaId} onClose={handleCerrarDrawer} />
    </div>
  );
}

const FONDO_PUNTOS = {
  backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1px)',
  backgroundSize: '24px 24px',
};

const FONDO_CUADRICULA = {
  backgroundImage:
    'linear-gradient(to right, #3a3a3a 1px, transparent 1px), linear-gradient(to bottom, #3a3a3a 1px, transparent 1px)',
  backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
};

function CanvasPlano({ mesas, editable, cuadricula, altura, pedidosVistos, onClickMesa }) {
  return (
    <div className="overflow-auto rounded-xl border border-[#2a2a2a]" style={{ maxHeight: altura }}>
      <div
        className="relative"
        style={{
          width: CANVAS_WIDTH,
          height: altura,
          backgroundColor: '#1a1a1a',
          ...(cuadricula ? FONDO_CUADRICULA : FONDO_PUNTOS),
        }}
      >
        {mesas.map((mesa) =>
          editable ? (
            <MesaArrastrable key={mesa.id} mesa={mesa} />
          ) : (
            <MesaPosicionada
              key={mesa.id}
              mesa={mesa}
              mostrarBadgeListo={debeMostrarBadgeListo(mesa, pedidosVistos)}
              onClick={() => onClickMesa(mesa)}
            />
          )
        )}
      </div>
    </div>
  );
}

function MesaArrastrable({ mesa }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: mesa.id });

  const style = {
    position: 'absolute',
    left: `${mesa.posicion_x}%`,
    top: `${mesa.posicion_y}%`,
    transform: transform
      ? `translate(-50%, -50%) translate3d(${transform.x}px, ${transform.y}px, 0)`
      : 'translate(-50%, -50%)',
    zIndex: isDragging ? 20 : 1,
    touchAction: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#f97316] bg-[#1a1a1a] text-white ${
        isDragging ? 'cursor-grabbing opacity-80 shadow-2xl' : 'cursor-grab'
      }`}
    >
      <Move size={14} className="text-[#f97316]" />
      <span className="text-lg font-bold">{mesa.numero}</span>
    </div>
  );
}

function minutosCuentaPedida(cuentaPedidaAt) {
  return Math.max(0, Math.floor((Date.now() - new Date(cuentaPedidaAt).getTime()) / 60000));
}

function colorCronometroCuenta(minutos) {
  if (minutos < 5) return '#22c55e';
  if (minutos < 10) return '#f97316';
  return '#ef4444';
}

// El cronómetro se recalcula en cada render; no necesita timer propio porque
// cargarPlano/cargarMesas ya refrescan la pantalla cada 30 segundos.
function CronometroCuenta({ cuentaPedidaAt }) {
  const minutos = minutosCuentaPedida(cuentaPedidaAt);
  const color = colorCronometroCuenta(minutos);
  return (
    <span className="flex items-center gap-1 text-[9px] font-semibold" style={{ color }}>
      <Clock size={9} />
      {minutos} min
    </span>
  );
}

function BadgeCuentaPedida() {
  return (
    <span className="absolute -left-2 -top-2 z-10 animate-pulse whitespace-nowrap rounded-full bg-[#eab308] px-2 py-1 text-[10px] font-bold text-white shadow-lg shadow-[#eab308]/40">
      💳 Cuenta
    </span>
  );
}

function MesaPosicionada({ mesa, mostrarBadgeListo, onClick }) {
  const color = COLOR_ESTADO[mesa.estado] || '#6b7280';
  const conCuentaPedida = mesa.pedido_estado === 'cuenta_pedida';

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'absolute',
        left: `${mesa.posicion_x}%`,
        top: `${mesa.posicion_y}%`,
        transform: 'translate(-50%, -50%)',
        borderColor: color,
        backgroundColor: `${color}1a`,
      }}
      className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border-2 p-2 transition-transform hover:scale-105"
    >
      {mostrarBadgeListo && <BadgeListo />}
      {conCuentaPedida && <BadgeCuentaPedida />}
      <span className="text-xl font-bold text-white">{mesa.numero}</span>
      <span className="flex items-center gap-1 text-[10px] text-[#a1a1aa]">
        <Users size={10} />
        {mesa.capacidad}
      </span>
      <span
        className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase"
        style={{ color, backgroundColor: `${color}33` }}
      >
        {LABEL_ESTADO[mesa.estado] || mesa.estado}
      </span>
      {conCuentaPedida && mesa.cuenta_pedida_at && <CronometroCuenta cuentaPedidaAt={mesa.cuenta_pedida_at} />}
    </button>
  );
}

function BadgeListo() {
  return (
    <span className="absolute -right-2 -top-2 z-10 animate-pulse whitespace-nowrap rounded-full bg-[#f97316] px-2 py-1 text-[10px] font-bold text-white shadow-lg shadow-[#f97316]/40">
      ¡Listo!
    </span>
  );
}

function TarjetaMesa({ mesa, mostrarBadgeListo, onClick }) {
  const color = COLOR_ESTADO[mesa.estado] || '#6b7280';
  const conCuentaPedida = mesa.pedido_estado === 'cuenta_pedida';

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 p-3 transition-transform hover:scale-105"
      style={{ borderColor: color, backgroundColor: `${color}1a` }}
    >
      {mostrarBadgeListo && <BadgeListo />}
      {conCuentaPedida && <BadgeCuentaPedida />}
      <span className="text-2xl font-bold text-white">{mesa.numero}</span>
      {mesa.nombre && <span className="max-w-full truncate text-xs text-[#a1a1aa]">{mesa.nombre}</span>}
      <span className="flex items-center gap-1 text-xs text-[#a1a1aa]">
        <Users size={12} />
        {mesa.capacidad}
      </span>
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
        style={{ color, backgroundColor: `${color}33` }}
      >
        {LABEL_ESTADO[mesa.estado] || mesa.estado}
      </span>
      {conCuentaPedida && mesa.cuenta_pedida_at && <CronometroCuenta cuentaPedidaAt={mesa.cuenta_pedida_at} />}
    </button>
  );
}

function TarjetaMesaRemota({ mesa, mostrarBadgeListo, esGestor, onClick, onEliminar }) {
  const color = COLOR_ESTADO[mesa.estado] || '#6b7280';
  const conCuentaPedida = mesa.pedido_estado === 'cuenta_pedida';

  return (
    <div className="relative aspect-square w-[167px] shrink-0">
      <button
        type="button"
        onClick={onClick}
        className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-xl border-2 p-3 transition-transform hover:scale-105"
        style={{ borderColor: color, backgroundColor: '#1a1a2e' }}
      >
        {mostrarBadgeListo && <BadgeListo />}
        {conCuentaPedida && <BadgeCuentaPedida />}
        <Phone size={14} className="text-[#a1a1aa]" />
        <span className="max-w-full truncate text-2xl font-bold text-white">{mesa.numero}</span>
        <span className="flex items-center gap-1 text-xs text-[#a1a1aa]">
          <Users size={12} />
          {mesa.capacidad}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
          style={{ color, backgroundColor: `${color}33` }}
        >
          {LABEL_ESTADO[mesa.estado] || mesa.estado}
        </span>
        {conCuentaPedida && mesa.cuenta_pedida_at ? (
          <CronometroCuenta cuentaPedidaAt={mesa.cuenta_pedida_at} />
        ) : (
          <span className="flex items-center gap-1 text-[10px] text-[#a1a1aa]">
            <Clock size={10} />
            {mesa.horaPedido ? formatearHora(mesa.horaPedido) : 'Sin pedido'}
          </span>
        )}
      </button>
      {esGestor && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEliminar(mesa);
          }}
          title="Eliminar domicilio"
          className="absolute -bottom-2 -right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-[#333] bg-[#1a1a1a] text-[#a1a1aa] hover:border-red-500 hover:text-red-400"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}

function ModalAccionMesa({ mesa, onClose, onCambiarEstado, onPedirCuenta, onAbrirPedido }) {
  if (mesa.estado === 'libre') {
    return (
      <Modal titulo={`Mesa ${mesa.numero}`} onClose={onClose}>
        <p className="text-sm text-[#a1a1aa]">¿Abrir esta mesa?</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#333] px-4 py-2 text-sm font-medium text-[#a1a1aa] hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onAbrirPedido(mesa)}
            className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea6a0d]"
          >
            Abrir mesa
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal titulo={`Mesa ${mesa.numero}`} onClose={onClose}>
      <div className="space-y-2">
        {mesa.estado === 'ocupada' && (
          <>
            <button
              type="button"
              onClick={() => onAbrirPedido(mesa)}
              className="w-full rounded-lg border border-[#333] px-4 py-2 text-left text-sm text-white hover:bg-[#2a2a2a]"
            >
              Ver/agregar pedido
            </button>
            <button
              type="button"
              onClick={onPedirCuenta}
              className="w-full rounded-lg border border-[#333] px-4 py-2 text-left text-sm text-white hover:bg-[#2a2a2a]"
            >
              Pedir cuenta
            </button>
          </>
        )}
        {mesa.estado === 'reservada' && (
          <button
            type="button"
            onClick={() => onCambiarEstado('ocupada')}
            className="w-full rounded-lg border border-[#333] px-4 py-2 text-left text-sm text-white hover:bg-[#2a2a2a]"
          >
            Abrir mesa
          </button>
        )}
        <button
          type="button"
          onClick={() => onCambiarEstado('libre')}
          className="w-full rounded-lg border border-[#333] px-4 py-2 text-left text-sm text-white hover:bg-[#2a2a2a]"
        >
          Liberar mesa
        </button>
      </div>
    </Modal>
  );
}

function FormularioMesa({ mesa, areas, onGuardar, onCancelar }) {
  const [numero, setNumero] = useState(mesa?.numero || '');
  const [nombre, setNombre] = useState(mesa?.nombre || '');
  const [capacidad, setCapacidad] = useState(mesa?.capacidad ?? 4);
  const [areaId, setAreaId] = useState(mesa?.area_id || '');
  const [estado, setEstado] = useState(mesa?.estado || 'libre');
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    await onGuardar({
      numero,
      nombre,
      capacidad: Number(capacidad),
      area_id: areaId || null,
      estado,
    });
    setGuardando(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Campo label="Número">
        <input required value={numero} onChange={(e) => setNumero(e.target.value)} className="input" />
      </Campo>
      <Campo label="Nombre">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="input" />
      </Campo>
      <div className="grid grid-cols-2 gap-4">
        <Campo label="Capacidad">
          <input
            type="number"
            min="1"
            value={capacidad}
            onChange={(e) => setCapacidad(e.target.value)}
            className="input"
          />
        </Campo>
        <Campo label="Área">
          <select value={areaId} onChange={(e) => setAreaId(e.target.value)} className="input">
            <option value="">Sin área</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.nombre}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      <Campo label="Estado inicial">
        <select value={estado} onChange={(e) => setEstado(e.target.value)} className="input">
          {ESTADOS.map((valor) => (
            <option key={valor} value={valor}>
              {LABEL_ESTADO[valor]}
            </option>
          ))}
        </select>
      </Campo>

      <BotonesFormulario onCancelar={onCancelar} guardando={guardando} />
    </form>
  );
}

function GestionAreas({ areas, onGuardar }) {
  const [editando, setEditando] = useState(null); // null | area
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setNombre(editando?.nombre || '');
  }, [editando]);

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    await onGuardar({ nombre }, editando);
    setGuardando(false);
    setEditando(null);
    setNombre('');
  }

  return (
    <div>
      <ul className="mb-4 max-h-48 space-y-1 overflow-y-auto">
        {areas.map((area) => (
          <li key={area.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-[#2a2a2a]">
            <span className="text-sm text-white">{area.nombre}</span>
            <button type="button" onClick={() => setEditando(area)} className="text-[#a1a1aa] hover:text-white">
              <Pencil size={14} />
            </button>
          </li>
        ))}
        {areas.length === 0 && <p className="text-sm text-[#a1a1aa]">No hay áreas todavía.</p>}
      </ul>

      <form onSubmit={handleSubmit} className="flex items-end gap-3 border-t border-[#2a2a2a] pt-4">
        <div className="flex-1">
          <Campo label={editando ? `Editando "${editando.nombre}"` : 'Nueva área'}>
            <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="input" />
          </Campo>
        </div>
        {editando && (
          <button
            type="button"
            onClick={() => {
              setEditando(null);
              setNombre('');
            }}
            className="rounded-lg border border-[#333] px-4 py-2 text-sm text-[#a1a1aa] hover:text-white"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={guardando}
          className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea6a0d] disabled:opacity-60"
        >
          {guardando ? 'Guardando...' : editando ? 'Actualizar' : 'Crear'}
        </button>
      </form>
    </div>
  );
}

export default Mesas;
