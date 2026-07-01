import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeft, Minus, Plus, Search, Trash2, UtensilsCrossed } from 'lucide-react';

import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import Campo from '../components/Campo';
import { useAuth } from '../context/AuthContext';
import { getMesa } from '../utils/mesas';
import { getCategorias } from '../utils/categorias';
import { getProductos } from '../utils/productos';
import { formatearPrecio } from '../utils/formato';
import {
  crearPedido,
  agregarItemPedido,
  actualizarItemPedido,
  eliminarItemPedido,
  enviarCocinaPedido,
  pedirCuentaPedido,
  cobrarPedido,
  cancelarPedido,
} from '../utils/pedidos';

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

const METODOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'qr', label: 'QR' },
  { value: 'mixto', label: 'Mixto' },
];

function POS({ mesaId, onCerrar = () => {} }) {
  const { usuario } = useAuth();
  const puedeCancelar = usuario?.rol === 'admin' || usuario?.rol === 'gerente';

  const [mesa, setMesa] = useState(null);
  const [pedido, setPedido] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [enviandoCocina, setEnviandoCocina] = useState(false);

  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const [modalProducto, setModalProducto] = useState(null);
  const [modalCobro, setModalCobro] = useState(false);
  const [agregandoProducto, setAgregandoProducto] = useState(false);

  const [descuentoModo, setDescuentoModo] = useState('monto'); // 'monto' | 'porcentaje'
  const [descuentoValor, setDescuentoValor] = useState(0);
  const [impuesto, setImpuesto] = useState(0);
  const [propina, setPropina] = useState(0);

  useEffect(() => {
    async function iniciar() {
      setCargando(true);
      try {
        const [mesaData, pedidoData, categoriasData, productosData] = await Promise.all([
          getMesa(mesaId),
          crearPedido({ mesa_id: mesaId, tipo: 'mesa' }),
          getCategorias(),
          getProductos({ disponible: true }),
        ]);
        setMesa(mesaData);
        setPedido({ ...pedidoData, items: pedidoData.items || [] });
        setDescuentoValor(Number(pedidoData.descuento) || 0);
        setImpuesto(Number(pedidoData.impuesto) || 0);
        setPropina(Number(pedidoData.propina) || 0);
        setCategorias(categoriasData);
        setProductos(productosData);
      } catch {
        toast.error('No se pudo cargar el pedido de esta mesa');
      } finally {
        setCargando(false);
      }
    }
    iniciar();
  }, [mesaId]);

  async function handleAgregarProducto(producto, opciones = {}) {
    // Evita que dos clicks rápidos sobre el mismo o distinto producto lean
    // el mismo `pedido.items` desactualizado y disparen altas duplicadas
    // o pierdan el merge de cantidad.
    if (agregandoProducto) return;
    setAgregandoProducto(true);

    try {
      const cantidad = opciones.cantidad ?? 1;
      const modificadores = opciones.modificadores ?? [];
      const notas = opciones.notas ?? '';

      if (modificadores.length === 0 && !notas) {
        const itemExistente = pedido.items.find(
          (item) => item.producto_id === producto.id && !item.notas && (item.modificadores || []).length === 0
        );
        if (itemExistente) {
          await handleActualizarCantidad(itemExistente, itemExistente.cantidad + cantidad);
          return;
        }
      }

      const { item, pedido: pedidoActualizado } = await agregarItemPedido(pedido.id, {
        producto_id: producto.id,
        nombre_producto: producto.nombre,
        precio_unitario: producto.precio,
        cantidad,
        notas: notas || undefined,
        modificadores,
      });
      setPedido((prev) => ({
        ...prev,
        ...pedidoActualizado,
        items: [...prev.items, { ...item, modificadores }],
      }));
      toast.success('Producto agregado');
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo agregar el producto');
    } finally {
      setAgregandoProducto(false);
    }
  }

  async function handleActualizarCantidad(item, nuevaCantidad) {
    if (nuevaCantidad < 1) {
      await handleEliminarItem(item);
      return;
    }
    try {
      const { item: itemActualizado, pedido: pedidoActualizado } = await actualizarItemPedido(pedido.id, item.id, {
        cantidad: nuevaCantidad,
      });
      setPedido((prev) => ({
        ...prev,
        ...pedidoActualizado,
        items: prev.items.map((i) => (i.id === item.id ? { ...i, ...itemActualizado } : i)),
      }));
    } catch {
      toast.error('No se pudo actualizar la cantidad');
    }
  }

  async function handleEliminarItem(item) {
    try {
      const { pedido: pedidoActualizado } = await eliminarItemPedido(pedido.id, item.id);
      setPedido((prev) => ({
        ...prev,
        ...pedidoActualizado,
        items: prev.items.filter((i) => i.id !== item.id),
      }));
    } catch {
      toast.error('No se pudo eliminar el producto');
    }
  }

  function handleClickProducto(producto) {
    if (producto.modificadores?.length > 0) {
      setModalProducto(producto);
    } else {
      handleAgregarProducto(producto);
    }
  }

  async function handleEnviarCocina() {
    setEnviandoCocina(true);
    try {
      const pedidoActualizado = await enviarCocinaPedido(pedido.id);
      setPedido((prev) => ({
        ...prev,
        ...pedidoActualizado,
        items: prev.items.map((item) => (item.estado === 'pendiente' ? { ...item, estado: 'en_preparacion' } : item)),
      }));
      toast.success('Pedido enviado a cocina');
    } catch {
      toast.error('No se pudo enviar el pedido a cocina');
    } finally {
      setEnviandoCocina(false);
    }
  }

  async function handlePedirCuenta() {
    try {
      const pedidoActualizado = await pedirCuentaPedido(pedido.id);
      setPedido((prev) => ({ ...prev, ...pedidoActualizado }));
      setModalCobro(true);
    } catch {
      toast.error('No se pudo pedir la cuenta');
    }
  }

  async function handleCancelarPedido() {
    if (!window.confirm('¿Cancelar este pedido? Esta acción no se puede deshacer.')) return;
    try {
      await cancelarPedido(pedido.id);
      toast.success('Pedido cancelado');
      onCerrar();
    } catch {
      toast.error('No se pudo cancelar el pedido');
    }
  }

  async function handleCobrar(datosPago) {
    try {
      await cobrarPedido(pedido.id, {
        ...datosPago,
        descuento: descuentoMonto,
        impuesto: Number(impuesto || 0),
        propina: Number(propina || 0),
      });
      toast.success('¡Pedido cobrado!');
      onCerrar();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo cobrar el pedido');
    }
  }

  if (cargando) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0f0f0f]">
        <Spinner />
      </div>
    );
  }

  const subtotal = Number(pedido?.subtotal || 0);
  const descuentoMonto =
    descuentoModo === 'porcentaje' ? (subtotal * Number(descuentoValor || 0)) / 100 : Number(descuentoValor || 0);
  const totalCalculado = Math.max(0, subtotal - descuentoMonto + Number(impuesto || 0) + Number(propina || 0));

  const productosFiltrados = productos.filter((producto) => {
    const coincideCategoria = !categoriaActiva || producto.categoria_id === categoriaActiva;
    const coincideBusqueda = !busqueda || producto.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return coincideCategoria && coincideBusqueda;
  });

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0f0f0f] md:flex-row">
      {/* Panel izquierdo: pedido actual */}
      <div className="flex w-full flex-col border-b border-[#2a2a2a] md:w-[40%] md:border-b-0 md:border-r">
        <div className="border-b border-[#2a2a2a] p-4">
          <button
            type="button"
            onClick={onCerrar}
            className="mb-2 flex items-center gap-1 text-sm text-[#a1a1aa] hover:text-white"
          >
            <ArrowLeft size={14} />
            Volver a mesas
          </button>
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-bold text-white">
              Mesa {mesa?.numero} — Pedido #{String(pedido?.numero ?? 0).padStart(3, '0')}
            </h1>
            <span
              className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold"
              style={{
                color: COLOR_ESTADO_PEDIDO[pedido?.estado],
                backgroundColor: `${COLOR_ESTADO_PEDIDO[pedido?.estado]}1a`,
              }}
            >
              {LABEL_ESTADO_PEDIDO[pedido?.estado] || pedido?.estado}
            </span>
          </div>
        </div>

        <div className="max-h-64 flex-1 overflow-y-auto p-4 md:max-h-none">
          {pedido?.items?.length ? (
            <div className="space-y-3">
              {pedido.items.map((item) => (
                <ItemPedido
                  key={item.id}
                  item={item}
                  onCantidad={(c) => handleActualizarCantidad(item, c)}
                  onEliminar={() => handleEliminarItem(item)}
                />
              ))}
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-[#a1a1aa]">Agrega productos del menú →</p>
          )}
        </div>

        <div className="space-y-3 border-t border-[#2a2a2a] p-4">
          <div className="flex justify-between text-sm text-[#a1a1aa]">
            <span>Subtotal</span>
            <span>{formatearPrecio(subtotal)}</span>
          </div>

          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-[#a1a1aa]">Descuento</span>
            <div className="flex items-center gap-1">
              <select
                value={descuentoModo}
                onChange={(e) => setDescuentoModo(e.target.value)}
                className="rounded-md border border-[#333] bg-[#0f0f0f] px-1 py-1 text-xs text-white"
              >
                <option value="monto">$</option>
                <option value="porcentaje">%</option>
              </select>
              <input
                type="number"
                min="0"
                value={descuentoValor}
                onChange={(e) => setDescuentoValor(e.target.value)}
                className="w-20 rounded-md border border-[#333] bg-[#0f0f0f] px-2 py-1 text-right text-white outline-none focus:border-[#f97316]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-[#a1a1aa]">Impuesto</span>
            <input
              type="number"
              min="0"
              value={impuesto}
              onChange={(e) => setImpuesto(e.target.value)}
              className="w-24 rounded-md border border-[#333] bg-[#0f0f0f] px-2 py-1 text-right text-white outline-none focus:border-[#f97316]"
            />
          </div>

          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-[#a1a1aa]">Propina</span>
            <input
              type="number"
              min="0"
              value={propina}
              onChange={(e) => setPropina(e.target.value)}
              className="w-24 rounded-md border border-[#333] bg-[#0f0f0f] px-2 py-1 text-right text-white outline-none focus:border-[#f97316]"
            />
          </div>

          <div className="flex items-center justify-between border-t border-[#2a2a2a] pt-3">
            <span className="text-base font-semibold text-white">TOTAL</span>
            <span className="text-2xl font-bold text-[#f97316]">{formatearPrecio(totalCalculado)}</span>
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleEnviarCocina}
              disabled={!pedido?.items?.length || enviandoCocina}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviandoCocina ? 'Enviando...' : 'Enviar a cocina'}
            </button>
            <button
              type="button"
              onClick={handlePedirCuenta}
              disabled={!pedido?.items?.length}
              className="w-full rounded-lg bg-[#eab308] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#ca9a06] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Pedir cuenta
            </button>
            {puedeCancelar && (
              <button
                type="button"
                onClick={handleCancelarPedido}
                className="w-full rounded-lg border border-red-500/40 px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/10"
              >
                Cancelar pedido
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Panel derecho: menú */}
      <div className="flex w-full flex-1 flex-col overflow-hidden md:w-[60%]">
        <div className="border-b border-[#2a2a2a] p-4">
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a1a1aa]" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar productos..."
              className="w-full rounded-lg border border-[#333] bg-[#0f0f0f] py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-[#f97316]"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCategoriaActiva('')}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
                categoriaActiva === '' ? 'bg-[#f97316] text-white' : 'bg-[#1a1a1a] text-[#a1a1aa] hover:text-white'
              }`}
            >
              Todas
            </button>
            {categorias.map((categoria) => (
              <button
                key={categoria.id}
                type="button"
                onClick={() => setCategoriaActiva(categoria.id)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
                  categoriaActiva === categoria.id
                    ? 'bg-[#f97316] text-white'
                    : 'bg-[#1a1a1a] text-[#a1a1aa] hover:text-white'
                }`}
              >
                {categoria.nombre}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {productosFiltrados.map((producto) => (
              <TarjetaProducto
                key={producto.id}
                producto={producto}
                deshabilitado={agregandoProducto}
                onClick={() => handleClickProducto(producto)}
              />
            ))}
            {productosFiltrados.length === 0 && (
              <p className="col-span-full py-12 text-center text-sm text-[#a1a1aa]">No se encontraron productos.</p>
            )}
          </div>
        </div>
      </div>

      {modalProducto && (
        <ModalModificadores
          producto={modalProducto}
          onAgregar={(opciones) => {
            handleAgregarProducto(modalProducto, opciones);
            setModalProducto(null);
          }}
          onCancelar={() => setModalProducto(null)}
        />
      )}

      {modalCobro && (
        <ModalCobro
          pedido={pedido}
          total={totalCalculado}
          onCobrar={handleCobrar}
          onCancelar={() => setModalCobro(false)}
        />
      )}
    </div>
  );
}

function ItemPedido({ item, onCantidad, onEliminar }) {
  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-white">{item.nombre_producto}</p>
          {item.modificadores?.length > 0 && (
            <p className="mt-0.5 text-xs text-[#a1a1aa]">{item.modificadores.map((m) => m.nombre_opcion).join(', ')}</p>
          )}
          {item.notas && <p className="mt-0.5 text-xs italic text-[#a1a1aa]">"{item.notas}"</p>}
        </div>
        <button type="button" onClick={onEliminar} className="shrink-0 text-[#a1a1aa] hover:text-red-400">
          <Trash2 size={16} />
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onCantidad(item.cantidad - 1)}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-[#333] text-white hover:bg-[#2a2a2a]"
          >
            <Minus size={12} />
          </button>
          <span className="w-6 text-center text-sm text-white">{item.cantidad}</span>
          <button
            type="button"
            onClick={() => onCantidad(item.cantidad + 1)}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-[#333] text-white hover:bg-[#2a2a2a]"
          >
            <Plus size={12} />
          </button>
        </div>
        <div className="text-right text-sm">
          <p className="text-[#a1a1aa]">{formatearPrecio(item.precio_unitario)} c/u</p>
          <p className="font-semibold text-white">{formatearPrecio(item.subtotal)}</p>
        </div>
      </div>
    </div>
  );
}

function TarjetaProducto({ producto, onClick, deshabilitado }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!producto.disponible || deshabilitado}
      className="flex flex-col overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] text-left transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <div className="flex h-20 items-center justify-center bg-[#141414] text-[#333]">
        {producto.imagen_url ? (
          <img src={producto.imagen_url} alt={producto.nombre} className="h-full w-full object-cover" />
        ) : (
          <UtensilsCrossed size={24} />
        )}
      </div>
      <div className="p-2.5">
        <p className="truncate text-sm font-medium text-white">{producto.nombre}</p>
        <p className="mt-0.5 text-sm font-semibold text-[#f97316]">{formatearPrecio(producto.precio)}</p>
      </div>
    </button>
  );
}

function ModalModificadores({ producto, onAgregar, onCancelar }) {
  const [seleccion, setSeleccion] = useState({});
  const [notas, setNotas] = useState('');
  const [cantidad, setCantidad] = useState(1);

  function handleSeleccionUnica(grupoId, opcionId) {
    setSeleccion((prev) => ({ ...prev, [grupoId]: opcionId }));
  }

  function handleSeleccionMultiple(grupoId, opcionId, checked) {
    setSeleccion((prev) => {
      const actuales = Array.isArray(prev[grupoId]) ? prev[grupoId] : [];
      const nuevas = checked ? [...actuales, opcionId] : actuales.filter((id) => id !== opcionId);
      return { ...prev, [grupoId]: nuevas };
    });
  }

  const modificadoresElegidos = [];
  for (const grupo of producto.modificadores || []) {
    const valor = seleccion[grupo.id];
    const idsElegidos = grupo.seleccion_multiple ? valor || [] : valor ? [valor] : [];
    for (const opcionId of idsElegidos) {
      const opcion = grupo.opciones.find((o) => o.id === opcionId);
      if (opcion) {
        modificadoresElegidos.push({
          modificador_opcion_id: opcion.id,
          nombre_opcion: opcion.nombre,
          precio_extra: opcion.precio_extra,
        });
      }
    }
  }

  const precioExtra = modificadoresElegidos.reduce((suma, m) => suma + Number(m.precio_extra), 0);
  const totalItem = (Number(producto.precio) + precioExtra) * cantidad;

  function handleSubmit(e) {
    e.preventDefault();
    const grupoIncompleto = (producto.modificadores || []).find((grupo) => {
      if (!grupo.requerido) return false;
      const valor = seleccion[grupo.id];
      const cantidadElegida = grupo.seleccion_multiple ? (valor || []).length : valor ? 1 : 0;
      return cantidadElegida < (grupo.minimo || 1);
    });
    if (grupoIncompleto) {
      toast.error(`Selecciona una opción de "${grupoIncompleto.nombre}"`);
      return;
    }
    onAgregar({ cantidad, notas, modificadores: modificadoresElegidos });
  }

  return (
    <Modal titulo={producto.nombre} onClose={onCancelar}>
      <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
        {(producto.modificadores || []).map((grupo) => (
          <div key={grupo.id}>
            <p className="mb-2 text-sm font-medium text-white">
              {grupo.nombre} {grupo.requerido && <span className="text-[#f97316]">*</span>}
            </p>
            <div className="space-y-1.5">
              {grupo.opciones.map((opcion) => (
                <label
                  key={opcion.id}
                  className="flex items-center justify-between rounded-lg border border-[#333] px-3 py-2 text-sm text-white"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type={grupo.seleccion_multiple ? 'checkbox' : 'radio'}
                      name={grupo.id}
                      checked={
                        grupo.seleccion_multiple
                          ? (seleccion[grupo.id] || []).includes(opcion.id)
                          : seleccion[grupo.id] === opcion.id
                      }
                      onChange={(e) =>
                        grupo.seleccion_multiple
                          ? handleSeleccionMultiple(grupo.id, opcion.id, e.target.checked)
                          : handleSeleccionUnica(grupo.id, opcion.id)
                      }
                      className="accent-[#f97316]"
                    />
                    {opcion.nombre}
                  </span>
                  {Number(opcion.precio_extra) > 0 && (
                    <span className="text-[#a1a1aa]">+{formatearPrecio(opcion.precio_extra)}</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}

        <Campo label="Nota especial">
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            className="input"
            placeholder="Ej: sin cebolla, extra picante"
          />
        </Campo>

        <Campo label="Cantidad">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setCantidad((c) => Math.max(1, c - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[#333] text-white hover:bg-[#2a2a2a]"
            >
              <Minus size={14} />
            </button>
            <span className="w-6 text-center text-white">{cantidad}</span>
            <button
              type="button"
              onClick={() => setCantidad((c) => c + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[#333] text-white hover:bg-[#2a2a2a]"
            >
              <Plus size={14} />
            </button>
          </div>
        </Campo>

        <button type="submit" className="w-full rounded-lg bg-[#f97316] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#ea6a0d]">
          Agregar al pedido — {formatearPrecio(totalItem)}
        </button>
      </form>
    </Modal>
  );
}

function ModalCobro({ pedido, total, onCobrar, onCancelar }) {
  const [metodo, setMetodo] = useState('efectivo');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [montoEfectivo, setMontoEfectivo] = useState('');
  const [montoTarjeta, setMontoTarjeta] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cambio = metodo === 'efectivo' && montoRecibido !== '' ? Math.max(0, Number(montoRecibido) - total) : 0;

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    const monto =
      metodo === 'mixto'
        ? Number(montoEfectivo || 0) + Number(montoTarjeta || 0)
        : metodo === 'efectivo'
          ? Number(montoRecibido || 0)
          : total;
    await onCobrar({ pagado_con: metodo, monto_recibido: monto });
    setGuardando(false);
  }

  return (
    <Modal titulo="Cobrar pedido" onClose={onCancelar}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-[#2a2a2a] p-3">
          {(pedido.items || []).map((item) => (
            <div key={item.id} className="flex justify-between text-sm text-[#a1a1aa]">
              <span>
                {item.cantidad}× {item.nombre_producto}
              </span>
              <span>{formatearPrecio(item.subtotal)}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-[#2a2a2a] pt-3">
          <span className="text-base font-semibold text-white">Total a cobrar</span>
          <span className="text-2xl font-bold text-[#f97316]">{formatearPrecio(total)}</span>
        </div>

        <Campo label="Método de pago">
          <div className="grid grid-cols-4 gap-2">
            {METODOS_PAGO.map((opcion) => (
              <button
                key={opcion.value}
                type="button"
                onClick={() => setMetodo(opcion.value)}
                className={`rounded-lg border px-2 py-2 text-xs font-medium ${
                  metodo === opcion.value
                    ? 'border-[#f97316] bg-[#f97316]/10 text-[#f97316]'
                    : 'border-[#333] text-[#a1a1aa] hover:text-white'
                }`}
              >
                {opcion.label}
              </button>
            ))}
          </div>
        </Campo>

        {metodo === 'efectivo' && (
          <>
            <Campo label="Monto recibido">
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={montoRecibido}
                onChange={(e) => setMontoRecibido(e.target.value)}
                className="input"
              />
            </Campo>
            {montoRecibido !== '' && (
              <p className="text-sm text-[#a1a1aa]">
                Cambio: <span className="font-semibold text-white">{formatearPrecio(cambio)}</span>
              </p>
            )}
          </>
        )}

        {metodo === 'mixto' && (
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Monto en efectivo">
              <input
                type="number"
                step="0.01"
                min="0"
                value={montoEfectivo}
                onChange={(e) => setMontoEfectivo(e.target.value)}
                className="input"
              />
            </Campo>
            <Campo label="Monto en tarjeta">
              <input
                type="number"
                step="0.01"
                min="0"
                value={montoTarjeta}
                onChange={(e) => setMontoTarjeta(e.target.value)}
                className="input"
              />
            </Campo>
          </div>
        )}

        <button
          type="submit"
          disabled={guardando}
          className="w-full rounded-lg bg-[#f97316] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#ea6a0d] disabled:opacity-60"
        >
          {guardando ? 'Cobrando...' : 'Cobrar'}
        </button>
      </form>
    </Modal>
  );
}

export default POS;
