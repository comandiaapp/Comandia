import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Plus,
  Pencil,
  Trash2,
  PackagePlus,
  TrendingDown,
  SlidersHorizontal,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import Campo from '../components/Campo';
import BotonesFormulario from '../components/BotonesFormulario';
import { useAuth } from '../context/AuthContext';
import { formatearPrecio } from '../utils/formato';
import { getProductos } from '../utils/productos';
import {
  getIngredientes,
  crearIngrediente,
  actualizarIngrediente,
  eliminarIngrediente,
  getAlertas,
  registrarEntrada,
  registrarMerma,
  ajustarStock,
  getMovimientos,
  getRecetaPorProducto,
  crearReceta,
  eliminarReceta,
} from '../utils/inventario';

const UNIDADES = [
  { value: 'unidad', label: 'Unidad' },
  { value: 'kg', label: 'Kilogramo' },
  { value: 'g', label: 'Gramo' },
  { value: 'l', label: 'Litro' },
  { value: 'ml', label: 'Mililitro' },
  { value: 'porcion', label: 'Porción' },
];

const UNIDAD_LABEL = Object.fromEntries(UNIDADES.map((u) => [u.value, u.label]));

const TIPOS_MOVIMIENTO = {
  entrada: { label: 'Entrada', color: 'bg-[var(--success)]/10 text-[var(--success)]' },
  salida: { label: 'Salida', color: 'bg-[var(--error)]/10 text-[var(--error)]' },
  venta: { label: 'Venta', color: 'bg-[var(--error)]/10 text-[var(--error)]' },
  merma: { label: 'Merma', color: 'bg-[var(--warning)]/10 text-[var(--warning)]' },
  ajuste: { label: 'Ajuste', color: 'bg-blue-500/10 text-blue-400' },
};

const MOTIVOS_MERMA = ['Se dañó', 'Se venció', 'Error de cocina', 'Otro'];

const TABS = [
  { id: 'ingredientes', label: 'Ingredientes' },
  { id: 'recetas', label: 'Recetas' },
  { id: 'movimientos', label: 'Movimientos' },
  { id: 'alertas', label: 'Alertas' },
];

function formatearCantidad(valor) {
  return Number(valor).toLocaleString('es-CO', { maximumFractionDigits: 3 });
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

function estadoStock(ingrediente) {
  const actual = Number(ingrediente.stock_actual);
  const minimo = Number(ingrediente.stock_minimo);
  if (actual <= minimo) return 'rojo';
  if (actual > minimo * 1.5) return 'verde';
  return 'amarillo';
}

const ESTADO_COLOR = {
  verde: 'bg-[var(--success)]/10 text-[var(--success)]',
  amarillo: 'bg-[var(--warning)]/10 text-[var(--warning)]',
  rojo: 'bg-[var(--error)]/10 text-[var(--error)]',
};

const ESTADO_LABEL = { verde: 'Bien', amarillo: 'Bajo', rojo: 'Crítico' };

function Inventario() {
  const { usuario } = useAuth();
  const esGestor = usuario?.rol === 'admin' || usuario?.rol === 'gerente';

  const [tab, setTab] = useState(esGestor ? 'ingredientes' : 'alertas');
  const [alertas, setAlertas] = useState([]);

  const cargarAlertas = useCallback(async () => {
    try {
      setAlertas(await getAlertas());
    } catch {
      toast.error('No se pudieron cargar las alertas de inventario');
    }
  }, []);

  useEffect(() => {
    cargarAlertas();
  }, [cargarAlertas]);

  const tabsVisibles = esGestor ? TABS : TABS.filter((t) => t.id === 'alertas');

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Inventario</h1>

      <div className="mt-4 flex flex-wrap gap-2 border-b border-[var(--border)]">
        {tabsVisibles.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? 'border-[var(--accent)] text-[var(--accent)]' : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {t.label}
            {t.id === 'alertas' && alertas.length > 0 && (
              <span className="rounded-full bg-[var(--error)]/20 px-2 py-0.5 text-xs text-[var(--error)]">{alertas.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {esGestor && tab === 'ingredientes' && <TabIngredientes alertas={alertas} recargarAlertas={cargarAlertas} />}
        {esGestor && tab === 'recetas' && <TabRecetas />}
        {esGestor && tab === 'movimientos' && <TabMovimientos />}
        {tab === 'alertas' && <TabAlertas alertas={alertas} recargarAlertas={cargarAlertas} esGestor={esGestor} />}
      </div>
    </div>
  );
}

// --- Tab 1: Ingredientes ---

function TabIngredientes({ alertas, recargarAlertas }) {
  const [ingredientes, setIngredientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [soloStockBajo, setSoloStockBajo] = useState(false);
  const [modalIngrediente, setModalIngrediente] = useState(null); // null | 'nuevo' | ingrediente
  const [modalEntrada, setModalEntrada] = useState(null);
  const [modalMerma, setModalMerma] = useState(null);
  const [modalAjuste, setModalAjuste] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setIngredientes(await getIngredientes());
    } catch {
      toast.error('No se pudieron cargar los ingredientes');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function recargarTodo() {
    await Promise.all([cargar(), recargarAlertas()]);
  }

  async function handleGuardarIngrediente(datos) {
    try {
      if (modalIngrediente === 'nuevo') {
        await crearIngrediente(datos);
        toast.success('Ingrediente creado');
      } else {
        await actualizarIngrediente(modalIngrediente.id, datos);
        toast.success('Ingrediente actualizado');
      }
      setModalIngrediente(null);
      recargarTodo();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo guardar el ingrediente');
    }
  }

  async function handleEliminarIngrediente(ingrediente) {
    if (!window.confirm(`¿Eliminar el ingrediente "${ingrediente.nombre}"?`)) return;
    try {
      await eliminarIngrediente(ingrediente.id);
      toast.success('Ingrediente eliminado');
      recargarTodo();
    } catch {
      toast.error('No se pudo eliminar el ingrediente');
    }
  }

  async function handleGuardarEntrada(datos) {
    try {
      await registrarEntrada(datos);
      toast.success('Entrada registrada');
      setModalEntrada(null);
      recargarTodo();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo registrar la entrada');
    }
  }

  async function handleGuardarMerma(datos) {
    try {
      await registrarMerma(datos);
      toast.success('Merma registrada');
      setModalMerma(null);
      recargarTodo();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo registrar la merma');
    }
  }

  async function handleGuardarAjuste(datos) {
    try {
      await ajustarStock(datos);
      toast.success('Stock ajustado');
      setModalAjuste(null);
      recargarTodo();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo ajustar el stock');
    }
  }

  const listaMostrada = soloStockBajo
    ? ingredientes.filter((i) => Number(i.stock_actual) <= Number(i.stock_minimo))
    : ingredientes;

  if (cargando) return <Spinner />;

  return (
    <div>
      {alertas.length > 0 && (
        <button
          type="button"
          onClick={() => setSoloStockBajo((v) => !v)}
          className="mb-4 flex w-full items-center gap-2 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-4 py-3 text-sm font-medium text-[var(--warning)] hover:bg-[var(--warning)]/20"
        >
          <AlertTriangle size={18} />
          ⚠️ {alertas.length} ingrediente{alertas.length === 1 ? '' : 's'} con stock bajo
          <span className="ml-auto text-xs underline">{soloStockBajo ? 'Ver todos' : 'Ver solo estos'}</span>
        </button>
      )}

      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setModalIngrediente('nuevo')}
          className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
        >
          <Plus size={16} />
          Nuevo ingrediente
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Unidad</th>
              <th className="px-4 py-3 text-right">Stock actual</th>
              <th className="px-4 py-3 text-right">Stock mínimo</th>
              <th className="px-4 py-3 text-right">Costo unitario</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {listaMostrada.map((ing) => {
              const estado = estadoStock(ing);
              const negativo = Number(ing.stock_actual) < 0;
              return (
                <tr key={ing.id} className="border-t border-[var(--border)] bg-[var(--bg-card)]">
                  <td className="px-4 py-3 text-[var(--text-primary)]">{ing.nombre}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{UNIDAD_LABEL[ing.unidad_medida]}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${negativo ? 'text-[var(--error)]' : 'text-[var(--text-primary)]'}`}>
                    {formatearCantidad(ing.stock_actual)}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{formatearCantidad(ing.stock_minimo)}</td>
                  <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{formatearPrecio(ing.costo_unitario)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${ESTADO_COLOR[estado]}`}>
                      {ESTADO_LABEL[estado]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setModalEntrada(ing)}
                        title="Registrar entrada"
                        className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--success)]/10 hover:text-[var(--success)]"
                      >
                        <PackagePlus size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalMerma(ing)}
                        title="Registrar merma"
                        className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--warning)]/10 hover:text-[var(--warning)]"
                      >
                        <TrendingDown size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalAjuste(ing)}
                        title="Ajustar stock"
                        className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-blue-500/10 hover:text-blue-400"
                      >
                        <SlidersHorizontal size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalIngrediente(ing)}
                        title="Editar"
                        className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEliminarIngrediente(ing)}
                        title="Eliminar"
                        className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--error)]/10 hover:text-[var(--error)]"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {listaMostrada.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                  No hay ingredientes registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalIngrediente && (
        <Modal
          titulo={modalIngrediente === 'nuevo' ? 'Nuevo ingrediente' : 'Editar ingrediente'}
          onClose={() => setModalIngrediente(null)}
        >
          <FormularioIngrediente
            ingrediente={modalIngrediente === 'nuevo' ? null : modalIngrediente}
            onGuardar={handleGuardarIngrediente}
            onCancelar={() => setModalIngrediente(null)}
          />
        </Modal>
      )}

      {modalEntrada && (
        <Modal titulo={`Registrar entrada — ${modalEntrada.nombre}`} onClose={() => setModalEntrada(null)}>
          <FormularioEntrada
            ingrediente={modalEntrada}
            onGuardar={handleGuardarEntrada}
            onCancelar={() => setModalEntrada(null)}
          />
        </Modal>
      )}

      {modalMerma && (
        <Modal titulo={`Registrar merma — ${modalMerma.nombre}`} onClose={() => setModalMerma(null)}>
          <FormularioMerma
            ingrediente={modalMerma}
            onGuardar={handleGuardarMerma}
            onCancelar={() => setModalMerma(null)}
          />
        </Modal>
      )}

      {modalAjuste && (
        <Modal titulo={`Ajustar stock — ${modalAjuste.nombre}`} onClose={() => setModalAjuste(null)}>
          <FormularioAjuste
            ingrediente={modalAjuste}
            onGuardar={handleGuardarAjuste}
            onCancelar={() => setModalAjuste(null)}
          />
        </Modal>
      )}
    </div>
  );
}

function FormularioIngrediente({ ingrediente, onGuardar, onCancelar }) {
  const [nombre, setNombre] = useState(ingrediente?.nombre || '');
  const [descripcion, setDescripcion] = useState(ingrediente?.descripcion || '');
  const [unidadMedida, setUnidadMedida] = useState(ingrediente?.unidad_medida || 'unidad');
  const [stockActual, setStockActual] = useState(ingrediente?.stock_actual ?? 0);
  const [stockMinimo, setStockMinimo] = useState(ingrediente?.stock_minimo ?? 0);
  const [stockMaximo, setStockMaximo] = useState(ingrediente?.stock_maximo ?? '');
  const [costoUnitario, setCostoUnitario] = useState(ingrediente?.costo_unitario ?? 0);
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    await onGuardar({
      nombre,
      descripcion,
      unidad_medida: unidadMedida,
      stock_actual: Number(stockActual),
      stock_minimo: Number(stockMinimo),
      stock_maximo: stockMaximo === '' ? null : Number(stockMaximo),
      costo_unitario: Number(costoUnitario),
    });
    setGuardando(false);
  }

  return (
    <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
      <Campo label="Nombre">
        <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="input" />
      </Campo>
      <Campo label="Descripción">
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="input" rows={2} />
      </Campo>
      <Campo label="Unidad de medida">
        <select value={unidadMedida} onChange={(e) => setUnidadMedida(e.target.value)} className="input">
          {UNIDADES.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </Campo>
      <div className="grid grid-cols-2 gap-4">
        <Campo label="Stock actual">
          <input
            type="number"
            step="0.001"
            value={stockActual}
            onChange={(e) => setStockActual(e.target.value)}
            className="input"
          />
        </Campo>
        <Campo label="Costo unitario">
          <input
            type="number"
            step="0.01"
            value={costoUnitario}
            onChange={(e) => setCostoUnitario(e.target.value)}
            className="input"
          />
        </Campo>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Campo label="Stock mínimo">
          <input
            type="number"
            step="0.001"
            value={stockMinimo}
            onChange={(e) => setStockMinimo(e.target.value)}
            className="input"
          />
        </Campo>
        <Campo label="Stock máximo">
          <input
            type="number"
            step="0.001"
            value={stockMaximo}
            onChange={(e) => setStockMaximo(e.target.value)}
            className="input"
          />
        </Campo>
      </div>
      <BotonesFormulario onCancelar={onCancelar} guardando={guardando} />
    </form>
  );
}

function FormularioEntrada({ ingrediente, onGuardar, onCancelar }) {
  const [cantidad, setCantidad] = useState('');
  const [costoUnitario, setCostoUnitario] = useState(ingrediente.costo_unitario ?? '');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    await onGuardar({
      ingrediente_id: ingrediente.id,
      cantidad: Number(cantidad),
      costo_unitario: costoUnitario === '' ? undefined : Number(costoUnitario),
      motivo,
    });
    setGuardando(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">
        Stock actual:{' '}
        <span className="text-[var(--text-primary)]">
          {formatearCantidad(ingrediente.stock_actual)} {UNIDAD_LABEL[ingrediente.unidad_medida]}
        </span>
      </p>
      <Campo label={`Cantidad a ingresar (${UNIDAD_LABEL[ingrediente.unidad_medida]})`}>
        <input
          type="number"
          step="0.001"
          required
          min="0.001"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          className="input"
        />
      </Campo>
      <Campo label="Costo unitario">
        <input
          type="number"
          step="0.01"
          value={costoUnitario}
          onChange={(e) => setCostoUnitario(e.target.value)}
          className="input"
        />
      </Campo>
      <Campo label="Motivo (proveedor, etc.)">
        <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} className="input" rows={2} />
      </Campo>
      <BotonesFormulario onCancelar={onCancelar} guardando={guardando} textoGuardar="Registrar entrada" />
    </form>
  );
}

function FormularioMerma({ ingrediente, onGuardar, onCancelar }) {
  const [cantidad, setCantidad] = useState('');
  const [motivoPreset, setMotivoPreset] = useState(MOTIVOS_MERMA[0]);
  const [motivoDetalle, setMotivoDetalle] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    const motivo = motivoPreset === 'Otro' ? motivoDetalle : motivoPreset;
    await onGuardar({ ingrediente_id: ingrediente.id, cantidad: Number(cantidad), motivo });
    setGuardando(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">
        Stock actual:{' '}
        <span className="text-[var(--text-primary)]">
          {formatearCantidad(ingrediente.stock_actual)} {UNIDAD_LABEL[ingrediente.unidad_medida]}
        </span>
      </p>
      <Campo label={`Cantidad perdida (${UNIDAD_LABEL[ingrediente.unidad_medida]})`}>
        <input
          type="number"
          step="0.001"
          required
          min="0.001"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          className="input"
        />
      </Campo>
      <Campo label="Motivo">
        <select value={motivoPreset} onChange={(e) => setMotivoPreset(e.target.value)} className="input">
          {MOTIVOS_MERMA.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </Campo>
      {motivoPreset === 'Otro' && (
        <Campo label="Detalle">
          <textarea
            required
            value={motivoDetalle}
            onChange={(e) => setMotivoDetalle(e.target.value)}
            className="input"
            rows={2}
          />
        </Campo>
      )}
      <BotonesFormulario onCancelar={onCancelar} guardando={guardando} textoGuardar="Registrar merma" />
    </form>
  );
}

function FormularioAjuste({ ingrediente, onGuardar, onCancelar }) {
  const [nuevoStock, setNuevoStock] = useState(ingrediente.stock_actual);
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    await onGuardar({ ingrediente_id: ingrediente.id, nuevo_stock: Number(nuevoStock), motivo });
    setGuardando(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-[var(--text-secondary)]">
        Stock actual:{' '}
        <span className="text-[var(--text-primary)]">
          {formatearCantidad(ingrediente.stock_actual)} {UNIDAD_LABEL[ingrediente.unidad_medida]}
        </span>
      </p>
      <Campo label={`Nuevo stock (${UNIDAD_LABEL[ingrediente.unidad_medida]})`}>
        <input
          type="number"
          step="0.001"
          required
          min="0"
          value={nuevoStock}
          onChange={(e) => setNuevoStock(e.target.value)}
          className="input"
        />
      </Campo>
      <Campo label="Motivo del ajuste">
        <textarea required value={motivo} onChange={(e) => setMotivo(e.target.value)} className="input" rows={2} />
      </Campo>
      <BotonesFormulario onCancelar={onCancelar} guardando={guardando} textoGuardar="Ajustar stock" />
    </form>
  );
}

// --- Tab 2: Recetas ---

function TabRecetas() {
  const [productos, setProductos] = useState([]);
  const [ingredientes, setIngredientes] = useState([]);
  const [productoId, setProductoId] = useState('');
  const [recetaItems, setRecetaItems] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [modalAgregar, setModalAgregar] = useState(false);

  useEffect(() => {
    getProductos()
      .then(setProductos)
      .catch(() => toast.error('No se pudieron cargar los productos'));
    getIngredientes()
      .then(setIngredientes)
      .catch(() => toast.error('No se pudieron cargar los ingredientes'));
  }, []);

  const cargarReceta = useCallback(async (id) => {
    if (!id) {
      setRecetaItems([]);
      return;
    }
    setCargando(true);
    try {
      setRecetaItems(await getRecetaPorProducto(id));
    } catch {
      toast.error('No se pudo cargar la receta del producto');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarReceta(productoId);
  }, [productoId, cargarReceta]);

  async function handleAgregarIngrediente(datos) {
    try {
      await crearReceta({ ...datos, producto_id: productoId });
      toast.success('Ingrediente agregado a la receta');
      setModalAgregar(false);
      cargarReceta(productoId);
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo agregar el ingrediente');
    }
  }

  async function handleEliminarItem(item) {
    if (!window.confirm(`¿Quitar "${item.ingrediente_nombre}" de la receta?`)) return;
    try {
      await eliminarReceta(item.id);
      toast.success('Ingrediente quitado de la receta');
      cargarReceta(productoId);
    } catch {
      toast.error('No se pudo quitar el ingrediente');
    }
  }

  const costoEstimado = recetaItems.reduce(
    (suma, item) => suma + Number(item.cantidad) * Number(item.costo_unitario),
    0
  );
  const producto = productos.find((p) => p.id === productoId);
  const ingredientesDisponibles = ingredientes.filter(
    (ing) => !recetaItems.some((item) => item.ingrediente_id === ing.id)
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <select value={productoId} onChange={(e) => setProductoId(e.target.value)} className="input w-auto min-w-[240px]">
          <option value="">Selecciona un producto</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>

        {productoId && (
          <button
            type="button"
            onClick={() => setModalAgregar(true)}
            className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            <Plus size={16} />
            Agregar ingrediente a receta
          </button>
        )}
      </div>

      {!productoId ? (
        <p className="py-8 text-center text-[var(--text-secondary)]">Selecciona un producto para ver o editar su receta.</p>
      ) : cargando ? (
        <Spinner />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-[var(--border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                <tr>
                  <th className="px-4 py-3">Ingrediente</th>
                  <th className="px-4 py-3 text-right">Cantidad</th>
                  <th className="px-4 py-3 text-right">Costo unitario</th>
                  <th className="px-4 py-3 text-right">Costo</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {recetaItems.map((item) => (
                  <tr key={item.id} className="border-t border-[var(--border)] bg-[var(--bg-card)]">
                    <td className="px-4 py-3 text-[var(--text-primary)]">{item.ingrediente_nombre}</td>
                    <td className="px-4 py-3 text-right text-[var(--text-secondary)]">
                      {formatearCantidad(item.cantidad)} {UNIDAD_LABEL[item.unidad_medida]}
                    </td>
                    <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{formatearPrecio(item.costo_unitario)}</td>
                    <td className="px-4 py-3 text-right text-[var(--text-primary)]">
                      {formatearPrecio(item.cantidad * item.costo_unitario)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleEliminarItem(item)}
                        className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--error)]/10 hover:text-[var(--error)]"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {recetaItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                      Este producto todavía no tiene receta.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-5 py-4">
            <span className="text-sm text-[var(--text-secondary)]">Costo estimado del plato:</span>
            <span className="font-bold text-[var(--accent)]">{formatearPrecio(costoEstimado)}</span>
          </div>
        </>
      )}

      {modalAgregar && (
        <Modal titulo={`Agregar ingrediente — ${producto?.nombre}`} onClose={() => setModalAgregar(false)}>
          <FormularioRecetaItem
            ingredientes={ingredientesDisponibles}
            onGuardar={handleAgregarIngrediente}
            onCancelar={() => setModalAgregar(false)}
          />
        </Modal>
      )}
    </div>
  );
}

function FormularioRecetaItem({ ingredientes, onGuardar, onCancelar }) {
  const [ingredienteId, setIngredienteId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    await onGuardar({ ingrediente_id: ingredienteId, cantidad: Number(cantidad) });
    setGuardando(false);
  }

  const ingredienteSeleccionado = ingredientes.find((i) => i.id === ingredienteId);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Campo label="Ingrediente">
        <select required value={ingredienteId} onChange={(e) => setIngredienteId(e.target.value)} className="input">
          <option value="">Selecciona un ingrediente</option>
          {ingredientes.map((ing) => (
            <option key={ing.id} value={ing.id}>
              {ing.nombre}
            </option>
          ))}
        </select>
      </Campo>
      <Campo
        label={`Cantidad por porción${
          ingredienteSeleccionado ? ` (${UNIDAD_LABEL[ingredienteSeleccionado.unidad_medida]})` : ''
        }`}
      >
        <input
          type="number"
          step="0.001"
          required
          min="0.001"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          className="input"
        />
      </Campo>
      <BotonesFormulario onCancelar={onCancelar} guardando={guardando} />
    </form>
  );
}

// --- Tab 3: Movimientos ---

function TabMovimientos() {
  const [ingredientes, setIngredientes] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [ingredienteId, setIngredienteId] = useState('');
  const [tipo, setTipo] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  useEffect(() => {
    getIngredientes()
      .then(setIngredientes)
      .catch(() => toast.error('No se pudieron cargar los ingredientes'));
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const filtros = {};
      if (ingredienteId) filtros.ingrediente_id = ingredienteId;
      if (tipo) filtros.tipo = tipo;
      if (fechaInicio) filtros.fecha_inicio = fechaInicio;
      if (fechaFin) filtros.fecha_fin = fechaFin;
      setMovimientos(await getMovimientos(filtros));
    } catch {
      toast.error('No se pudieron cargar los movimientos');
    } finally {
      setCargando(false);
    }
  }, [ingredienteId, tipo, fechaInicio, fechaFin]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <select value={ingredienteId} onChange={(e) => setIngredienteId(e.target.value)} className="input w-auto">
          <option value="">Todos los ingredientes</option>
          {ingredientes.map((ing) => (
            <option key={ing.id} value={ing.id}>
              {ing.nombre}
            </option>
          ))}
        </select>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="input w-auto">
          <option value="">Todos los tipos</option>
          {Object.entries(TIPOS_MOVIMIENTO).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
          className="input w-auto"
        />
        <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="input w-auto" />
      </div>

      {cargando ? (
        <Spinner />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Ingrediente</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 text-right">Cantidad</th>
                <th className="px-4 py-3 text-right">Stock antes → después</th>
                <th className="px-4 py-3">Motivo</th>
                <th className="px-4 py-3">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => (
                <tr key={m.id} className="border-t border-[var(--border)] bg-[var(--bg-card)]">
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{formatearFechaHora(m.created_at)}</td>
                  <td className="px-4 py-3 text-[var(--text-primary)]">{m.ingrediente_nombre}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${TIPOS_MOVIMIENTO[m.tipo]?.color}`}>
                      {TIPOS_MOVIMIENTO[m.tipo]?.label || m.tipo}
                    </span>
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      Number(m.cantidad) < 0 ? 'text-[var(--error)]' : 'text-[var(--success)]'
                    }`}
                  >
                    {Number(m.cantidad) > 0 ? '+' : ''}
                    {formatearCantidad(m.cantidad)}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--text-secondary)]">
                    {formatearCantidad(m.stock_antes)} → {formatearCantidad(m.stock_despues)}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{m.motivo || '-'}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{m.usuario_nombre || '-'}</td>
                </tr>
              ))}
              {movimientos.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                    No hay movimientos registrados.
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

// --- Tab 4: Alertas ---

function TabAlertas({ alertas, recargarAlertas, esGestor }) {
  const [modalEntrada, setModalEntrada] = useState(null);

  async function handleGuardarEntrada(datos) {
    try {
      await registrarEntrada(datos);
      toast.success('Entrada registrada');
      setModalEntrada(null);
      recargarAlertas();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo registrar la entrada');
    }
  }

  if (alertas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] py-16">
        <CheckCircle2 className="text-[var(--success)]" size={40} />
        <p className="text-[var(--text-primary)]">Todo el inventario está bien ✅</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {alertas.map((ing) => {
          const diferencia = Number(ing.stock_actual) - Number(ing.stock_minimo);
          const negativo = Number(ing.stock_actual) < 0;
          return (
            <div key={ing.id} className="rounded-xl border border-[var(--error)]/30 bg-[var(--error)]/5 p-5">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">{ing.nombre}</h3>
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Stock actual</span>
                  <span className={`font-semibold ${negativo ? 'text-[var(--error)]' : 'text-[var(--text-primary)]'}`}>
                    {formatearCantidad(ing.stock_actual)} {UNIDAD_LABEL[ing.unidad_medida]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Stock mínimo</span>
                  <span className="text-[var(--text-primary)]">
                    {formatearCantidad(ing.stock_minimo)} {UNIDAD_LABEL[ing.unidad_medida]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Diferencia</span>
                  <span className="font-semibold text-[var(--error)]">
                    {formatearCantidad(diferencia)} {UNIDAD_LABEL[ing.unidad_medida]}
                  </span>
                </div>
              </div>
              {esGestor && (
                <button
                  type="button"
                  onClick={() => setModalEntrada(ing)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
                >
                  <PackagePlus size={16} />
                  Registrar entrada
                </button>
              )}
            </div>
          );
        })}
      </div>

      {modalEntrada && (
        <Modal titulo={`Registrar entrada — ${modalEntrada.nombre}`} onClose={() => setModalEntrada(null)}>
          <FormularioEntrada
            ingrediente={modalEntrada}
            onGuardar={handleGuardarEntrada}
            onCancelar={() => setModalEntrada(null)}
          />
        </Modal>
      )}
    </div>
  );
}

export default Inventario;
