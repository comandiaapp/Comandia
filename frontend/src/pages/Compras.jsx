import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Sparkles, Eye, XCircle, Trash2, AlertTriangle } from 'lucide-react';

import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import Campo from '../components/Campo';
import BotonesFormulario from '../components/BotonesFormulario';
import { formatearPrecio } from '../utils/formato';
import { getIngredientes, getAlertas } from '../utils/inventario';
import { getOrdenes, getSugeridas, getOrden, crearOrden, actualizarOrden, recibirOrden, cancelarOrden } from '../utils/compras';

const ESTADOS = {
  borrador: { label: 'Borrador', color: 'bg-gray-500/10 text-gray-400' },
  enviada: { label: 'Enviada', color: 'bg-blue-500/10 text-blue-400' },
  recibida: { label: 'Recibida', color: 'bg-green-500/10 text-green-400' },
  cancelada: { label: 'Cancelada', color: 'bg-red-500/10 text-red-400' },
};

const UNIDAD_LABEL = { unidad: 'Unidad', kg: 'kg', g: 'g', l: 'L', ml: 'mL', porcion: 'porción' };

function formatearFecha(fechaISO) {
  if (!fechaISO) return '-';
  return new Date(`${fechaISO}T00:00:00`).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatearCantidad(valor) {
  return Number(valor).toLocaleString('es-CO', { maximumFractionDigits: 3 });
}

function Compras() {
  const [ordenes, setOrdenes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [alertas, setAlertas] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('');

  const [modalGenerar, setModalGenerar] = useState(false);
  const [modalNueva, setModalNueva] = useState(false);
  const [modalVer, setModalVer] = useState(null); // id de la orden

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const filtros = {};
      if (filtroEstado) filtros.estado = filtroEstado;
      setOrdenes(await getOrdenes(filtros));
    } catch {
      toast.error('No se pudieron cargar las órdenes de compra');
    } finally {
      setCargando(false);
    }
  }, [filtroEstado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cargarAlertas = useCallback(async () => {
    try {
      setAlertas(await getAlertas());
    } catch {
      // silencioso: el banner simplemente no aparece
    }
  }, []);

  useEffect(() => {
    cargarAlertas();
  }, [cargarAlertas]);

  async function handleCrearOrden(datos) {
    try {
      await crearOrden(datos);
      toast.success('Orden de compra creada');
      setModalNueva(false);
      setModalGenerar(false);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo crear la orden de compra');
    }
  }

  async function handleCancelar(orden) {
    if (!window.confirm(`¿Cancelar la orden de compra #${orden.numero}?`)) return;
    try {
      await cancelarOrden(orden.id);
      toast.success('Orden cancelada');
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo cancelar la orden');
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Compras</h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setModalGenerar(true)}
            className="flex items-center gap-2 rounded-lg bg-[var(--accent)]/10 px-4 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/20"
          >
            <Sparkles size={16} />
            Generar desde alertas
          </button>
          <button
            type="button"
            onClick={() => setModalNueva(true)}
            className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            <Plus size={16} />
            Nueva orden de compra
          </button>
        </div>
      </div>

      {alertas.length > 0 && (
        <button
          type="button"
          onClick={() => setModalGenerar(true)}
          className="mt-4 flex w-full items-center gap-2 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-3 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent)]/20"
        >
          <AlertTriangle size={18} />
          ⚠️ {alertas.length} ingrediente{alertas.length === 1 ? '' : 's'} necesita{alertas.length === 1 ? '' : 'n'} reposición
          <span className="ml-auto text-xs underline">Generar orden automática</span>
        </button>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} className="input w-auto">
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {cargando ? (
        <Spinner />
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--bg-card)] text-[var(--text-secondary)]">
              <tr>
                <th className="px-4 py-3">N.º</th>
                <th className="px-4 py-3">Proveedor</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Items</th>
                <th className="px-4 py-3 text-right">Total estimado</th>
                <th className="px-4 py-3">Fecha esperada</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ordenes.map((orden) => (
                <tr key={orden.id} className="border-t border-[var(--border)] bg-[var(--bg-secondary)]">
                  <td className="px-4 py-3 text-[var(--text-primary)]">#{orden.numero}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{orden.proveedor || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${ESTADOS[orden.estado]?.color}`}>
                      {ESTADOS[orden.estado]?.label || orden.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{orden.items_count}</td>
                  <td className="px-4 py-3 text-right text-[var(--text-primary)]">{formatearPrecio(orden.total_estimado)}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{formatearFecha(orden.fecha_esperada)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setModalVer(orden.id)}
                        title="Ver orden"
                        className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--border)] hover:text-[var(--text-primary)]"
                      >
                        <Eye size={16} />
                      </button>
                      {orden.estado !== 'recibida' && orden.estado !== 'cancelada' && (
                        <button
                          type="button"
                          onClick={() => handleCancelar(orden)}
                          title="Cancelar orden"
                          className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-400"
                        >
                          <XCircle size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {ordenes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                    No hay órdenes de compra registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalGenerar && (
        <Modal titulo="Generar orden desde alertas" onClose={() => setModalGenerar(false)}>
          <FormularioGenerarDesdeAlertas onGuardar={handleCrearOrden} onCancelar={() => setModalGenerar(false)} />
        </Modal>
      )}

      {modalNueva && (
        <Modal titulo="Nueva orden de compra" onClose={() => setModalNueva(false)}>
          <FormularioNuevaOrden onGuardar={handleCrearOrden} onCancelar={() => setModalNueva(false)} />
        </Modal>
      )}

      {modalVer && (
        <ModalVerOrden
          ordenId={modalVer}
          onClose={() => setModalVer(null)}
          onCambio={() => {
            cargar();
            cargarAlertas();
          }}
        />
      )}
    </div>
  );
}

// --- Modal: generar desde alertas ---

function FormularioGenerarDesdeAlertas({ onGuardar, onCancelar }) {
  const [sugeridas, setSugeridas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [seleccion, setSeleccion] = useState({});
  const [proveedor, setProveedor] = useState('');
  const [fechaEsperada, setFechaEsperada] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    getSugeridas()
      .then((datos) => {
        setSugeridas(datos);
        const inicial = {};
        for (const item of datos) {
          inicial[item.ingrediente_id] = { incluido: true, cantidad: item.cantidad_sugerida };
        }
        setSeleccion(inicial);
      })
      .catch(() => toast.error('No se pudieron cargar los ingredientes sugeridos'))
      .finally(() => setCargando(false));
  }, []);

  function actualizarSeleccion(id, cambios) {
    setSeleccion((prev) => ({ ...prev, [id]: { ...prev[id], ...cambios } }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const items = sugeridas
      .filter((s) => seleccion[s.ingrediente_id]?.incluido && Number(seleccion[s.ingrediente_id]?.cantidad) > 0)
      .map((s) => ({
        ingrediente_id: s.ingrediente_id,
        nombre_ingrediente: s.nombre,
        cantidad_solicitada: Number(seleccion[s.ingrediente_id].cantidad),
        costo_unitario: s.costo_unitario,
        unidad_medida: s.unidad_medida,
      }));

    if (items.length === 0) {
      toast.error('Selecciona al menos un ingrediente');
      return;
    }

    setGuardando(true);
    await onGuardar({ proveedor: proveedor || null, fecha_esperada: fechaEsperada || null, items });
    setGuardando(false);
  }

  if (cargando) return <Spinner />;

  if (sugeridas.length === 0) {
    return <p className="py-6 text-center text-[var(--text-secondary)]">No hay ingredientes con stock bajo en este momento.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
      <div className="space-y-2">
        {sugeridas.map((item) => {
          const incluido = seleccion[item.ingrediente_id]?.incluido ?? true;
          return (
            <div
              key={item.ingrediente_id}
              className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-3"
            >
              <input
                type="checkbox"
                checked={incluido}
                onChange={(e) => actualizarSeleccion(item.ingrediente_id, { incluido: e.target.checked })}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--text-primary)]">{item.nombre}</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Actual: {formatearCantidad(item.stock_actual)} · Mínimo: {formatearCantidad(item.stock_minimo)}{' '}
                  {UNIDAD_LABEL[item.unidad_medida] || item.unidad_medida}
                </p>
              </div>
              <input
                type="number"
                step="0.001"
                min="0"
                value={seleccion[item.ingrediente_id]?.cantidad ?? item.cantidad_sugerida}
                onChange={(e) => actualizarSeleccion(item.ingrediente_id, { cantidad: e.target.value })}
                disabled={!incluido}
                className="input w-28"
              />
            </div>
          );
        })}
      </div>
      <Campo label="Proveedor">
        <input value={proveedor} onChange={(e) => setProveedor(e.target.value)} className="input" placeholder="Nombre del proveedor" />
      </Campo>
      <Campo label="Fecha esperada">
        <input type="date" value={fechaEsperada} onChange={(e) => setFechaEsperada(e.target.value)} className="input" />
      </Campo>
      <BotonesFormulario onCancelar={onCancelar} guardando={guardando} textoGuardar="Crear orden de compra" />
    </form>
  );
}

// --- Modal: nueva orden manual ---

function FormularioNuevaOrden({ onGuardar, onCancelar }) {
  const [ingredientes, setIngredientes] = useState([]);
  const [proveedor, setProveedor] = useState('');
  const [fechaEsperada, setFechaEsperada] = useState('');
  const [notas, setNotas] = useState('');
  const [items, setItems] = useState([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    getIngredientes()
      .then(setIngredientes)
      .catch(() => toast.error('No se pudieron cargar los ingredientes'));
  }, []);

  function agregarItem() {
    setItems((prev) => [...prev, { ingrediente_id: '', cantidad_solicitada: '', costo_unitario: '' }]);
  }

  function actualizarItem(index, cambios) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...cambios } : item)));
  }

  function quitarItem(index) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSeleccionIngrediente(index, ingredienteId) {
    const ingrediente = ingredientes.find((i) => i.id === ingredienteId);
    actualizarItem(index, { ingrediente_id: ingredienteId, costo_unitario: ingrediente?.costo_unitario ?? '' });
  }

  const totalEstimado = items.reduce(
    (suma, item) => suma + Number(item.cantidad_solicitada || 0) * Number(item.costo_unitario || 0),
    0
  );

  async function handleSubmit(e) {
    e.preventDefault();
    if (items.length === 0) {
      toast.error('Agrega al menos un item');
      return;
    }

    const itemsValidos = items.map((item) => {
      const ingrediente = ingredientes.find((i) => i.id === item.ingrediente_id);
      return {
        ingrediente_id: item.ingrediente_id || null,
        nombre_ingrediente: ingrediente?.nombre || '',
        cantidad_solicitada: Number(item.cantidad_solicitada),
        costo_unitario: item.costo_unitario === '' ? 0 : Number(item.costo_unitario),
        unidad_medida: ingrediente?.unidad_medida || null,
      };
    });

    if (itemsValidos.some((item) => !item.nombre_ingrediente || !(item.cantidad_solicitada > 0))) {
      toast.error('Selecciona un ingrediente y una cantidad válida en cada item');
      return;
    }

    setGuardando(true);
    await onGuardar({
      proveedor: proveedor || null,
      fecha_esperada: fechaEsperada || null,
      notas: notas || null,
      items: itemsValidos,
    });
    setGuardando(false);
  }

  return (
    <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
      <div className="grid grid-cols-2 gap-4">
        <Campo label="Proveedor">
          <input value={proveedor} onChange={(e) => setProveedor(e.target.value)} className="input" />
        </Campo>
        <Campo label="Fecha esperada">
          <input type="date" value={fechaEsperada} onChange={(e) => setFechaEsperada(e.target.value)} className="input" />
        </Campo>
      </div>
      <Campo label="Notas">
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} className="input" rows={2} />
      </Campo>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--text-secondary)]">Items</span>
          <button
            type="button"
            onClick={agregarItem}
            className="flex items-center gap-1 text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]"
          >
            <Plus size={14} />
            Agregar item
          </button>
        </div>

        <div className="space-y-2">
          {items.map((item, index) => {
            const subtotal = Number(item.cantidad_solicitada || 0) * Number(item.costo_unitario || 0);
            return (
              <div
                key={index}
                className="grid grid-cols-12 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-2"
              >
                <select
                  value={item.ingrediente_id}
                  onChange={(e) => handleSeleccionIngrediente(index, e.target.value)}
                  className="input col-span-4"
                >
                  <option value="">Ingrediente</option>
                  {ingredientes.map((ing) => (
                    <option key={ing.id} value={ing.id}>
                      {ing.nombre}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="Cantidad"
                  value={item.cantidad_solicitada}
                  onChange={(e) => actualizarItem(index, { cantidad_solicitada: e.target.value })}
                  className="input col-span-3"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Costo unit."
                  value={item.costo_unitario}
                  onChange={(e) => actualizarItem(index, { costo_unitario: e.target.value })}
                  className="input col-span-3"
                />
                <span className="col-span-1 text-right text-xs text-[var(--text-secondary)]">{formatearPrecio(subtotal)}</span>
                <button
                  type="button"
                  onClick={() => quitarItem(index)}
                  className="col-span-1 flex justify-end text-[var(--text-secondary)] hover:text-red-400"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
          {items.length === 0 && <p className="py-4 text-center text-sm text-[var(--text-secondary)]">Agrega al menos un item.</p>}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3">
        <span className="text-sm text-[var(--text-secondary)]">Total estimado:</span>
        <span className="font-bold text-[var(--accent)]">{formatearPrecio(totalEstimado)}</span>
      </div>

      <BotonesFormulario onCancelar={onCancelar} guardando={guardando} />
    </form>
  );
}

// --- Modal: ver / recibir orden ---

function ModalVerOrden({ ordenId, onClose, onCambio }) {
  const [orden, setOrden] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [cantidades, setCantidades] = useState({});
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const datos = await getOrden(ordenId);
      setOrden(datos);
      const iniciales = {};
      for (const item of datos.items) {
        iniciales[item.id] = Number(item.cantidad_recibida) > 0 ? item.cantidad_recibida : item.cantidad_solicitada;
      }
      setCantidades(iniciales);
    } catch {
      toast.error('No se pudo cargar la orden de compra');
    } finally {
      setCargando(false);
    }
  }, [ordenId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function handleMarcarEnviada() {
    try {
      await actualizarOrden(orden.id, { estado: 'enviada' });
      toast.success('Orden marcada como enviada');
      cargar();
      onCambio();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo actualizar la orden');
    }
  }

  async function handleRecibir() {
    const items = orden.items
      .map((item) => ({ id: item.id, cantidad_recibida: Number(cantidades[item.id] || 0) }))
      .filter((item) => item.cantidad_recibida > 0);

    if (items.length === 0) {
      toast.error('Ingresa al menos una cantidad recibida');
      return;
    }

    setGuardando(true);
    try {
      await recibirOrden(orden.id, items);
      toast.success('Recepción registrada, inventario actualizado');
      await cargar();
      onCambio();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo registrar la recepción');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={orden ? `Orden de compra #${orden.numero}` : 'Orden de compra'} onClose={onClose}>
      {cargando || !orden ? (
        <Spinner />
      ) : (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${ESTADOS[orden.estado]?.color}`}>
              {ESTADOS[orden.estado]?.label}
            </span>
            <span className="text-sm text-[var(--text-secondary)]">
              Proveedor: <span className="text-[var(--text-primary)]">{orden.proveedor || '-'}</span>
            </span>
          </div>

          {orden.notas && <p className="text-sm text-[var(--text-secondary)]">{orden.notas}</p>}

          <div className="overflow-hidden rounded-xl border border-[var(--border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--bg-card)] text-[var(--text-secondary)]">
                <tr>
                  <th className="px-3 py-2">Ingrediente</th>
                  <th className="px-3 py-2 text-right">Solicitado</th>
                  <th className="px-3 py-2 text-right">Recibido</th>
                  <th className="px-3 py-2 text-right">Costo unit.</th>
                  <th className="px-3 py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {orden.items.map((item) => (
                  <tr key={item.id} className="border-t border-[var(--border)] bg-[var(--bg-secondary)]">
                    <td className="px-3 py-2 text-[var(--text-primary)]">{item.nombre_ingrediente}</td>
                    <td className="px-3 py-2 text-right text-[var(--text-secondary)]">
                      {formatearCantidad(item.cantidad_solicitada)} {UNIDAD_LABEL[item.unidad_medida] || item.unidad_medida}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {orden.estado === 'enviada' ? (
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={cantidades[item.id] ?? ''}
                          onChange={(e) => setCantidades((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          className="input w-24 py-1 text-right"
                        />
                      ) : (
                        <span className="text-[var(--text-secondary)]">{formatearCantidad(item.cantidad_recibida)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-[var(--text-secondary)]">{formatearPrecio(item.costo_unitario || 0)}</td>
                    <td className="px-3 py-2 text-right text-[var(--text-primary)]">{formatearPrecio(item.subtotal || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3">
            <span className="text-sm text-[var(--text-secondary)]">Total estimado</span>
            <span className="font-bold text-[var(--accent)]">{formatearPrecio(orden.total_estimado)}</span>
          </div>

          {orden.estado === 'recibida' && (
            <p className="text-sm text-[var(--text-secondary)]">Recibida el {formatearFecha(orden.fecha_recibida)}</p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            {orden.estado === 'borrador' && (
              <button
                type="button"
                onClick={handleMarcarEnviada}
                className="rounded-lg bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-400 hover:bg-blue-500/20"
              >
                Marcar como enviada
              </button>
            )}
            {orden.estado === 'enviada' && (
              <button
                type="button"
                onClick={handleRecibir}
                disabled={guardando}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                {guardando ? 'Guardando...' : 'Marcar como recibida'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default Compras;
