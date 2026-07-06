import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Flame,
  Minus,
  Plus,
  Search,
  Trash2,
  UtensilsCrossed,
  Smartphone,
  Building2,
} from 'lucide-react';

import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import Campo from '../components/Campo';
import VisorFactura from '../components/VisorFactura';
import { useAuth } from '../context/AuthContext';
import { getMesa } from '../utils/mesas';
import { getCategorias } from '../utils/categorias';
import { getProductos } from '../utils/productos';
import { formatearPrecio } from '../utils/formato';
import {
  crearPedido,
  getPedidoPorMesa,
  agregarItemPedido,
  actualizarItemPedido,
  eliminarItemPedido,
  enviarCocinaPedido,
  pedirCuentaPedido,
  reabrirCuentaPedido,
  cobrarPedido,
  cancelarPedido,
} from '../utils/pedidos';
import { generarFactura, obtenerPrecuentaHTML } from '../utils/facturas';

const LABEL_ESTADO_PEDIDO = {
  abierto: 'Abierto',
  enviado_cocina: 'Enviado a cocina',
  listo: 'Listo',
  cuenta_pedida: 'Cuenta pedida',
  pagado: 'Pagado',
  cancelado: 'Cancelado',
};

const ESTADOS_PEDIDO_ACTIVOS = ['abierto', 'enviado_cocina', 'listo', 'cuenta_pedida'];

const COLOR_ESTADO_PEDIDO = {
  abierto: '#6b7280',
  enviado_cocina: '#3b82f6',
  listo: 'var(--success)',
  cuenta_pedida: 'var(--warning)',
  pagado: 'var(--success)',
  cancelado: 'var(--error)',
};

const COLOR_ESTADO_ITEM = {
  pendiente: '#71717a',
  en_preparacion: 'var(--accent)',
  listo: 'var(--success)',
  entregado: '#71717a',
};

const METODOS_PAGO = [
  { value: 'efectivo', label: 'Efectivo', color: 'var(--accent)' },
  { value: 'tarjeta', label: 'Tarjeta', color: 'var(--accent)' },
  { value: 'qr', label: 'QR', color: 'var(--accent)' },
  { value: 'nequi', label: 'Nequi', color: '#8B5CF6', icono: Smartphone },
  { value: 'transferencia', label: 'Transferencia', color: '#3B82F6', icono: Building2 },
  { value: 'mixto', label: 'Mixto', color: 'var(--accent)' },
];

const METODOS_MIXTO = METODOS_PAGO.filter((m) => m.value !== 'mixto');

// Los colores de estado pueden ser var(--...) o hex directo; color-mix
// permite obtener un fondo translúcido a partir de cualquiera de los dos.
function fondoConAlpha(color) {
  return `color-mix(in srgb, ${color} 10%, transparent)`;
}

function tiempoTranscurrido(fechaIso) {
  const ms = Date.now() - new Date(fechaIso).getTime();
  const minutosTotales = Math.max(0, Math.floor(ms / 60000));
  const horas = Math.floor(minutosTotales / 60);
  const minutos = minutosTotales % 60;
  if (horas === 0) return `${minutos} min`;
  return `${horas}h ${minutos}min`;
}

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
  const [modalPrecuenta, setModalPrecuenta] = useState(false);
  const [agregandoProducto, setAgregandoProducto] = useState(false);
  const [visorFactura, setVisorFactura] = useState(null); // { titulo, html, alCerrar }

  const [descuentoModo, setDescuentoModo] = useState('monto'); // 'monto' | 'porcentaje'
  const [descuentoValor, setDescuentoValor] = useState(0);
  const [impuesto, setImpuesto] = useState(0);
  const [propina, setPropina] = useState(0);

  useEffect(() => {
    // React StrictMode monta el efecto dos veces en desarrollo; sin esta
    // bandera, la instancia vieja puede resolver su fetch después de que el
    // usuario ya agregó un producto y pisar el pedido con datos previos al
    // agregado (mucho más visible offline, donde la escritura local es
    // instantánea y casi siempre "gana" a un fetch de red en vuelo).
    let cancelado = false;

    async function iniciar() {
      setCargando(true);
      try {
        const [mesaData, categoriasData, productosData] = await Promise.all([
          getMesa(mesaId),
          getCategorias(),
          getProductos({ disponible: true }),
        ]);
        if (cancelado) return;
        setMesa(mesaData);
        setCategorias(categoriasData);
        setProductos(productosData);

        // Primero se busca un pedido activo existente para la mesa. Solo se
        // reutiliza si sigue en curso; uno pagado o cancelado se ignora y
        // se abre uno nuevo (el backend ya filtra esto, pero se valida acá
        // también para no depender únicamente de esa garantía).
        let pedidoData = null;
        try {
          pedidoData = await getPedidoPorMesa(mesaId);
        } catch {
          pedidoData = null;
        }

        if (!pedidoData || !ESTADOS_PEDIDO_ACTIVOS.includes(pedidoData.estado)) {
          pedidoData = await crearPedido({ mesa_id: mesaId, tipo: 'mesa' });
        }
        if (cancelado) return;

        setPedido({ ...pedidoData, items: pedidoData.items || [] });
        setDescuentoValor(Number(pedidoData.descuento) || 0);
        setImpuesto(Number(pedidoData.impuesto) || 0);
        setPropina(Number(pedidoData.propina) || 0);

        // Si la mesa ya tenía la cuenta pedida (p. ej. se abrió el drawer
        // desde la tarjeta de mesa en estado "cuenta_pedida"), la precuenta
        // se muestra de inmediato en vez del POS normal.
        if (pedidoData.estado === 'cuenta_pedida') {
          setModalPrecuenta(true);
        }
      } catch {
        if (!cancelado) toast.error('No se pudo cargar el pedido de esta mesa');
      } finally {
        if (!cancelado) setCargando(false);
      }
    }
    iniciar();

    return () => {
      cancelado = true;
    };
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
        // Solo se fusiona con una línea que todavía no se envió a cocina.
        // Si ya está en preparación/lista/entregada, sumar cantidad ahí la
        // escondería del contador de "pendientes" y cocina nunca se
        // enteraría de la porción extra; se crea una línea nueva en su lugar.
        const itemExistente = pedido.items.find(
          (item) =>
            item.producto_id === producto.id &&
            !item.notas &&
            (item.modificadores || []).length === 0 &&
            item.estado === 'pendiente'
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
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo enviar el pedido a cocina');
    } finally {
      setEnviandoCocina(false);
    }
  }

  async function handlePedirCuenta() {
    try {
      const pedidoActualizado = await pedirCuentaPedido(pedido.id);
      setPedido((prev) => ({ ...prev, ...pedidoActualizado }));
      setModalPrecuenta(true);
    } catch {
      toast.error('No se pudo pedir la cuenta');
    }
  }

  async function handleReabrirCuenta() {
    try {
      const pedidoActualizado = await reabrirCuentaPedido(pedido.id);
      setPedido((prev) => ({ ...prev, ...pedidoActualizado }));
      setModalPrecuenta(false);
      toast.success('Cuenta reabierta, ya puedes seguir agregando productos');
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo reabrir la cuenta');
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
      const pedidoCobrado = await cobrarPedido(pedido.id, {
        ...datosPago,
        descuento: descuentoMonto,
        impuesto: Number(impuesto || 0),
        propina: Number(propina || 0),
      });
      toast.success('¡Pedido cobrado!');
      setModalCobro(false);

      // El backend ya intenta generar la factura en background al cobrar;
      // se llama de nuevo aquí porque generarFactura es idempotente (si ya
      // existe, la devuelve) y así el cajero la ve de inmediato sin esperar
      // a que termine esa tarea en segundo plano.
      try {
        const { html } = await generarFactura(pedidoCobrado.id);
        setVisorFactura({
          titulo: 'Factura',
          html,
          textoCerrar: 'Omitir',
          alCerrar: onCerrar,
          guardadoAutomaticamente: true,
        });
      } catch {
        toast.error('El pedido se cobró, pero no se pudo generar la factura. Puedes generarla luego desde Pedidos.');
        onCerrar();
      }
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo cobrar el pedido');
    }
  }

  async function handleImprimirPrecuenta() {
    try {
      const html = await obtenerPrecuentaHTML(pedido.id, {
        descuento: descuentoMonto,
        impuesto: Number(impuesto || 0),
        propina: Number(propina || 0),
      });
      setVisorFactura({ titulo: 'Pre-cuenta', html, textoCerrar: 'Cerrar', alCerrar: () => {} });
    } catch {
      toast.error('No se pudo generar la pre-cuenta');
    }
  }

  if (cargando) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--bg-primary)]">
        <Spinner />
      </div>
    );
  }

  const subtotal = Number(pedido?.subtotal || 0);
  const itemsPendientes = pedido?.items?.filter((item) => item.estado === 'pendiente').length || 0;
  const descuentoMonto =
    descuentoModo === 'porcentaje' ? (subtotal * Number(descuentoValor || 0)) / 100 : Number(descuentoValor || 0);
  const totalCalculado = Math.max(0, subtotal - descuentoMonto + Number(impuesto || 0) + Number(propina || 0));

  const productosFiltrados = productos.filter((producto) => {
    const coincideCategoria = !categoriaActiva || producto.categoria_id === categoriaActiva;
    const coincideBusqueda = !busqueda || producto.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return coincideCategoria && coincideBusqueda;
  });

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--bg-primary)] md:flex-row">
      {/* Panel izquierdo: pedido actual */}
      <div className="flex w-full flex-col border-b border-[var(--border)] md:w-[40%] md:border-b-0 md:border-r">
        <div className="border-b border-[var(--border)] p-4">
          <button
            type="button"
            onClick={onCerrar}
            className="mb-2 flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeft size={14} />
            Volver a mesas
          </button>
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-bold text-[var(--text-primary)]">
              Mesa {mesa?.numero} — Pedido #{String(pedido?.numero_jornada ?? 0).padStart(2, '0')}
            </h1>
            <span
              className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold"
              style={{
                color: COLOR_ESTADO_PEDIDO[pedido?.estado],
                backgroundColor: fondoConAlpha(COLOR_ESTADO_PEDIDO[pedido?.estado]),
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
            <p className="py-12 text-center text-sm text-[var(--text-secondary)]">Agrega productos del menú →</p>
          )}
        </div>

        <div className="space-y-3 border-t border-[var(--border)] p-4">
          <div className="flex justify-between text-sm text-[var(--text-secondary)]">
            <span>Subtotal</span>
            <span>{formatearPrecio(subtotal)}</span>
          </div>

          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-[var(--text-secondary)]">Descuento</span>
            <div className="flex items-center gap-1">
              <select
                value={descuentoModo}
                onChange={(e) => setDescuentoModo(e.target.value)}
                className="rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-1 py-1 text-xs text-[var(--text-primary)]"
              >
                <option value="monto">$</option>
                <option value="porcentaje">%</option>
              </select>
              <input
                type="number"
                min="0"
                value={descuentoValor}
                onChange={(e) => setDescuentoValor(e.target.value)}
                className="w-20 rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-right text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-[var(--text-secondary)]">Impuesto</span>
            <input
              type="number"
              min="0"
              value={impuesto}
              onChange={(e) => setImpuesto(e.target.value)}
              className="w-24 rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-right text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-[var(--text-secondary)]">Propina</span>
            <input
              type="number"
              min="0"
              value={propina}
              onChange={(e) => setPropina(e.target.value)}
              className="w-24 rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-right text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
            <span className="text-base font-semibold text-[var(--text-primary)]">TOTAL</span>
            <span className="text-2xl font-bold text-[var(--accent)]">{formatearPrecio(totalCalculado)}</span>
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={handleEnviarCocina}
              disabled={itemsPendientes === 0 || enviandoCocina}
              title={itemsPendientes === 0 ? 'No hay items nuevos para enviar' : undefined}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviandoCocina
                ? 'Enviando...'
                : itemsPendientes > 0
                  ? `Enviar a cocina (${itemsPendientes})`
                  : 'Enviar a cocina'}
            </button>
            <button
              type="button"
              onClick={pedido?.estado === 'cuenta_pedida' ? () => setModalPrecuenta(true) : handlePedirCuenta}
              disabled={!pedido?.items?.length}
              className="w-full rounded-lg bg-[var(--warning)] px-4 py-2.5 text-sm font-semibold text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pedido?.estado === 'cuenta_pedida' ? 'Ver precuenta' : 'Pedir cuenta'}
            </button>
            {puedeCancelar && (
              <button
                type="button"
                onClick={handleCancelarPedido}
                className="w-full rounded-lg border border-[var(--error)]/40 px-4 py-2.5 text-sm font-semibold text-[var(--error)] hover:bg-[var(--error)]/10"
              >
                Cancelar pedido
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Panel derecho: menú */}
      <div className="flex w-full flex-1 flex-col overflow-hidden md:w-[60%]">
        {pedido?.estado === 'cuenta_pedida' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="text-lg text-[var(--text-primary)]">La mesa solicitó la cuenta.</p>
            <p className="text-sm text-[var(--text-secondary)]">¿Reabrir cuenta para seguir agregando productos?</p>
            <button
              type="button"
              onClick={handleReabrirCuenta}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              Reabrir cuenta
            </button>
          </div>
        ) : (
          <>
            <div className="border-b border-[var(--border)] p-4">
              <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar productos..."
                  className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setCategoriaActiva('')}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
                    categoriaActiva === ''
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                        ? 'bg-[var(--accent)] text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                  <p className="col-span-full py-12 text-center text-sm text-[var(--text-secondary)]">
                    No se encontraron productos.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
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

      {modalPrecuenta && (
        <ModalPrecuenta
          mesa={mesa}
          pedido={pedido}
          subtotal={subtotal}
          descuentoMonto={descuentoMonto}
          impuesto={Number(impuesto || 0)}
          propina={Number(propina || 0)}
          total={totalCalculado}
          onAplicarPropinaSugerida={(monto) => setPropina(monto)}
          onImprimir={handleImprimirPrecuenta}
          onCobrarAhora={() => {
            setModalPrecuenta(false);
            setModalCobro(true);
          }}
          onCancelar={() => setModalPrecuenta(false)}
        />
      )}

      {modalCobro && (
        <ModalCobro
          pedido={pedido}
          total={totalCalculado}
          baseParaPropina={Math.max(0, subtotal - descuentoMonto + Number(impuesto || 0))}
          propina={Number(propina || 0)}
          onCambiarPropina={setPropina}
          onCobrar={handleCobrar}
          onCancelar={() => setModalCobro(false)}
        />
      )}

      {visorFactura && (
        <VisorFactura
          titulo={visorFactura.titulo}
          html={visorFactura.html}
          textoCerrar={visorFactura.textoCerrar}
          guardadoAutomaticamente={visorFactura.guardadoAutomaticamente}
          onClose={() => {
            const { alCerrar } = visorFactura;
            setVisorFactura(null);
            alCerrar?.();
          }}
        />
      )}
    </div>
  );
}

function ItemPedido({ item, onCantidad, onEliminar }) {
  const estado = item.estado || 'pendiente';
  const entregado = estado === 'entregado';
  const listo = estado === 'listo';
  const enPreparacion = estado === 'en_preparacion';
  const colorEstado = COLOR_ESTADO_ITEM[estado] || COLOR_ESTADO_ITEM.pendiente;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorEstado }} />
            {enPreparacion && <Flame size={12} className="shrink-0 text-[var(--accent)]" />}
            <p
              className={`truncate font-medium ${
                entregado
                  ? 'text-[var(--text-secondary)] line-through'
                  : listo
                    ? 'text-[var(--success)]'
                    : enPreparacion
                      ? 'text-[var(--accent)]'
                      : 'text-[var(--text-primary)]'
              }`}
            >
              {item.nombre_producto}
            </p>
          </div>
          {item.modificadores?.length > 0 && (
            <p className="mt-0.5 pl-3.5 text-xs text-[var(--text-secondary)]">{item.modificadores.map((m) => m.nombre_opcion).join(', ')}</p>
          )}
          {item.notas && <p className="mt-0.5 pl-3.5 text-xs italic text-[var(--text-secondary)]">"{item.notas}"</p>}
        </div>
        <button type="button" onClick={onEliminar} className="shrink-0 text-[var(--text-secondary)] hover:text-[var(--error)]">
          <Trash2 size={16} />
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onCantidad(item.cantidad - 1)}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
          >
            <Minus size={12} />
          </button>
          <span className="w-6 text-center text-sm text-[var(--text-primary)]">{item.cantidad}</span>
          <button
            type="button"
            onClick={() => onCantidad(item.cantidad + 1)}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
          >
            <Plus size={12} />
          </button>
        </div>
        <div className="text-right text-sm">
          <p className="text-[var(--text-secondary)]">{formatearPrecio(item.precio_unitario)} c/u</p>
          <p className="font-semibold text-[var(--text-primary)]">{formatearPrecio(item.subtotal)}</p>
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
      className="flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)] text-left transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <div className="flex h-20 items-center justify-center bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
        {producto.imagen_url ? (
          <img src={producto.imagen_url} alt={producto.nombre} className="h-full w-full object-cover" />
        ) : (
          <UtensilsCrossed size={24} />
        )}
      </div>
      <div className="p-2.5">
        <p className="truncate text-sm font-medium text-[var(--text-primary)]">{producto.nombre}</p>
        <p className="mt-0.5 text-sm font-semibold text-[var(--accent)]">{formatearPrecio(producto.precio)}</p>
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
            <p className="mb-2 text-sm font-medium text-[var(--text-primary)]">
              {grupo.nombre} {grupo.requerido && <span className="text-[var(--accent)]">*</span>}
            </p>
            <div className="space-y-1.5">
              {grupo.opciones.map((opcion) => (
                <label
                  key={opcion.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)]"
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
                      className="accent-[var(--accent)]"
                    />
                    {opcion.nombre}
                  </span>
                  {Number(opcion.precio_extra) > 0 && (
                    <span className="text-[var(--text-secondary)]">+{formatearPrecio(opcion.precio_extra)}</span>
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
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
            >
              <Minus size={14} />
            </button>
            <span className="w-6 text-center text-[var(--text-primary)]">{cantidad}</span>
            <button
              type="button"
              onClick={() => setCantidad((c) => c + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
            >
              <Plus size={14} />
            </button>
          </div>
        </Campo>

        <button type="submit" className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]">
          Agregar al pedido — {formatearPrecio(totalItem)}
        </button>
      </form>
    </Modal>
  );
}

const PORCENTAJE_PROPINA_SUGERIDA = 0.1;

function ModalPrecuenta({
  mesa,
  pedido,
  subtotal,
  descuentoMonto,
  impuesto,
  propina,
  total,
  onAplicarPropinaSugerida,
  onImprimir,
  onCobrarAhora,
  onCancelar,
}) {
  const propinaSugerida = Math.round(subtotal * PORCENTAJE_PROPINA_SUGERIDA);

  return (
    <Modal titulo={`${mesa ? `Mesa ${mesa.numero}` : 'Pedido'} — Precuenta`} onClose={onCancelar}>
      <div className="space-y-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Mesa ocupada hace <span className="font-semibold text-[var(--text-primary)]">{tiempoTranscurrido(pedido.created_at)}</span>
        </p>

        <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] p-3">
          {(pedido.items || []).map((item) => (
            <div key={item.id} className="flex justify-between text-sm text-[var(--text-secondary)]">
              <span>
                {item.cantidad}× {item.nombre_producto}
              </span>
              <span>{formatearPrecio(item.subtotal)}</span>
            </div>
          ))}
          {(pedido.items || []).length === 0 && <p className="text-sm text-[var(--text-secondary)]">Sin productos.</p>}
        </div>

        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-[var(--text-secondary)]">
            <span>Subtotal</span>
            <span>{formatearPrecio(subtotal)}</span>
          </div>
          <div className="flex justify-between text-[var(--text-secondary)]">
            <span>Descuento</span>
            <span>-{formatearPrecio(descuentoMonto)}</span>
          </div>
          <div className="flex justify-between text-[var(--text-secondary)]">
            <span>Impuesto</span>
            <span>{formatearPrecio(impuesto)}</span>
          </div>
          <div className="flex items-center justify-between text-[var(--text-secondary)]">
            <span>Propina</span>
            <span className="flex items-center gap-2">
              {formatearPrecio(propina)}
              {propina !== propinaSugerida && (
                <button
                  type="button"
                  onClick={() => onAplicarPropinaSugerida(propinaSugerida)}
                  className="rounded-md border border-[var(--border)] px-2 py-0.5 text-xs text-[var(--accent)] hover:bg-[var(--accent)]/10"
                >
                  Sugerida 10%: {formatearPrecio(propinaSugerida)}
                </button>
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
          <span className="text-base font-semibold text-[var(--text-primary)]">TOTAL</span>
          <span className="text-2xl font-bold text-[var(--accent)]">{formatearPrecio(total)}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onImprimir}
            className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
          >
            Imprimir precuenta
          </button>
          <button
            type="button"
            onClick={onCobrarAhora}
            className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            Cobrar ahora
          </button>
          <button
            type="button"
            disabled
            title="Próximamente"
            className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] opacity-60 disabled:cursor-not-allowed"
          >
            Dividir cuenta
          </button>
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Cancelar
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ModalCobro({ pedido, total, baseParaPropina, propina, onCambiarPropina, onCobrar, onCancelar }) {
  const [metodo, setMetodo] = useState('efectivo');
  const [montoRecibido, setMontoRecibido] = useState('');
  const [montosMixto, setMontosMixto] = useState({});
  const [guardando, setGuardando] = useState(false);

  const montoRecibidoNumero = Number(montoRecibido || 0);
  const faltanteEfectivo = metodo === 'efectivo' && montoRecibido !== '' ? Math.max(0, total - montoRecibidoNumero) : 0;
  const cambio =
    metodo === 'efectivo' && montoRecibido !== '' && montoRecibidoNumero >= total
      ? montoRecibidoNumero - total
      : 0;
  const totalMixto = METODOS_MIXTO.reduce((suma, m) => suma + Number(montosMixto[m.value] || 0), 0);
  const faltanteMixto = metodo === 'mixto' ? Math.max(0, total - totalMixto) : 0;

  const montoInsuficiente =
    (metodo === 'efectivo' && montoRecibidoNumero < total) || (metodo === 'mixto' && totalMixto < total);

  function handleCambiarMontoMixto(metodoValue, valor) {
    setMontosMixto((prev) => ({ ...prev, [metodoValue]: valor }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (montoInsuficiente) return;
    setGuardando(true);
    const monto = metodo === 'mixto' ? totalMixto : metodo === 'efectivo' ? montoRecibidoNumero : total;
    await onCobrar({ pagado_con: metodo, monto_recibido: monto });
    setGuardando(false);
  }

  return (
    <Modal titulo="Cobrar pedido" onClose={onCancelar}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] p-3">
          {(pedido.items || []).map((item) => (
            <div key={item.id} className="flex justify-between text-sm text-[var(--text-secondary)]">
              <span>
                {item.cantidad}× {item.nombre_producto}
              </span>
              <span>{formatearPrecio(item.subtotal)}</span>
            </div>
          ))}
        </div>

        <Campo label="¿El cliente deja propina?">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onCambiarPropina(0)}
              className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${
                Number(propina) === 0
                  ? 'bg-[var(--border)] text-[var(--text-primary)]'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Sin propina
            </button>
            <button
              type="button"
              onClick={() => onCambiarPropina(Math.round(baseParaPropina * 0.1))}
              className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${
                Number(propina) === Math.round(baseParaPropina * 0.1)
                  ? 'bg-[var(--success)] text-white'
                  : 'bg-[var(--success)]/10 text-[var(--success)] hover:bg-[var(--success)]/20'
              }`}
            >
              Con propina 10%
            </button>
          </div>
          <input
            type="number"
            min="0"
            value={propina}
            onChange={(e) => onCambiarPropina(e.target.value)}
            placeholder="Monto de propina personalizado"
            className="input mt-2"
          />
        </Campo>

        <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
          <span className="text-base font-semibold text-[var(--text-primary)]">Total a cobrar</span>
          <span className="text-2xl font-bold text-[var(--accent)]">{formatearPrecio(total)}</span>
        </div>

        <Campo label="Método de pago">
          <div className="grid grid-cols-3 gap-2">
            {METODOS_PAGO.map((opcion) => {
              const Icono = opcion.icono;
              const seleccionado = metodo === opcion.value;
              return (
                <button
                  key={opcion.value}
                  type="button"
                  onClick={() => setMetodo(opcion.value)}
                  className="flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium"
                  style={
                    seleccionado
                      ? { borderColor: opcion.color, backgroundColor: fondoConAlpha(opcion.color), color: opcion.color }
                      : { borderColor: 'var(--border)', color: 'var(--text-secondary)' }
                  }
                >
                  {Icono && <Icono size={16} />}
                  {opcion.label}
                </button>
              );
            })}
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
              faltanteEfectivo > 0 ? (
                <p className="text-sm font-semibold text-[var(--error)]">
                  Falta {formatearPrecio(faltanteEfectivo)} para completar el pago
                </p>
              ) : (
                <p className="text-sm text-[var(--text-secondary)]">
                  Cambio: <span className="font-semibold text-[var(--text-primary)]">{formatearPrecio(cambio)}</span>
                </p>
              )
            )}
          </>
        )}

        {metodo === 'mixto' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              {METODOS_MIXTO.map((m) => (
                <Campo key={m.value} label={`Monto en ${m.label.toLowerCase()}`}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={montosMixto[m.value] || ''}
                    onChange={(e) => handleCambiarMontoMixto(m.value, e.target.value)}
                    className="input"
                  />
                </Campo>
              ))}
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              Total ingresado: <span className="font-semibold text-[var(--text-primary)]">{formatearPrecio(totalMixto)}</span> /{' '}
              {formatearPrecio(total)}
            </p>
            {faltanteMixto > 0 && (
              <p className="text-sm font-semibold text-[var(--error)]">
                Falta {formatearPrecio(faltanteMixto)} para completar el pago
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={guardando || montoInsuficiente}
          className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {guardando ? 'Cobrando...' : 'Cobrar'}
        </button>
      </form>
    </Modal>
  );
}

export default POS;
