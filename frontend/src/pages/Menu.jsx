import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';

import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import { getCategorias, crearCategoria, actualizarCategoria, eliminarCategoria } from '../utils/categorias';
import { getProductos, crearProducto, actualizarProducto, eliminarProducto } from '../utils/productos';

const TIPOS_PRODUCTO = [
  { value: 'producto', label: 'Producto' },
  { value: 'combo', label: 'Combo' },
  { value: 'modificador', label: 'Modificador' },
];

const DISPONIBLE_PARA = [
  { value: 'todos', label: 'Todos' },
  { value: 'mesa', label: 'Mesa' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'barra', label: 'Barra' },
];

function Menu() {
  const { usuario } = useAuth();
  const puedeVerCosto = usuario?.rol === 'admin' || usuario?.rol === 'gerente';

  const [tab, setTab] = useState('categorias');

  const [categorias, setCategorias] = useState([]);
  const [cargandoCategorias, setCargandoCategorias] = useState(true);
  const [modalCategoria, setModalCategoria] = useState(null); // null | 'nueva' | categoria

  const [productos, setProductos] = useState([]);
  const [cargandoProductos, setCargandoProductos] = useState(true);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [modalProducto, setModalProducto] = useState(null); // null | 'nuevo' | producto

  async function cargarCategorias() {
    setCargandoCategorias(true);
    try {
      setCategorias(await getCategorias());
    } catch {
      toast.error('No se pudieron cargar las categorías');
    } finally {
      setCargandoCategorias(false);
    }
  }

  async function cargarProductos() {
    setCargandoProductos(true);
    try {
      const filtros = filtroCategoria ? { categoria_id: filtroCategoria } : {};
      setProductos(await getProductos(filtros));
    } catch {
      toast.error('No se pudieron cargar los productos');
    } finally {
      setCargandoProductos(false);
    }
  }

  useEffect(() => {
    cargarCategorias();
  }, []);

  useEffect(() => {
    cargarProductos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroCategoria]);

  async function handleGuardarCategoria(datos) {
    try {
      if (modalCategoria === 'nueva') {
        await crearCategoria(datos);
        toast.success('Categoría creada');
      } else {
        await actualizarCategoria(modalCategoria.id, datos);
        toast.success('Categoría actualizada');
      }
      setModalCategoria(null);
      cargarCategorias();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo guardar la categoría');
    }
  }

  async function handleToggleCategoria(categoria) {
    try {
      if (categoria.activa) {
        await eliminarCategoria(categoria.id);
      } else {
        await actualizarCategoria(categoria.id, { activa: true });
      }
      cargarCategorias();
    } catch {
      toast.error('No se pudo cambiar el estado de la categoría');
    }
  }

  async function handleEliminarCategoria(categoria) {
    if (!window.confirm(`¿Eliminar la categoría "${categoria.nombre}"?`)) return;
    try {
      await eliminarCategoria(categoria.id);
      toast.success('Categoría eliminada');
      cargarCategorias();
    } catch {
      toast.error('No se pudo eliminar la categoría');
    }
  }

  async function handleGuardarProducto(datos) {
    try {
      if (modalProducto === 'nuevo') {
        await crearProducto(datos);
        toast.success('Producto creado');
      } else {
        await actualizarProducto(modalProducto.id, datos);
        toast.success('Producto actualizado');
      }
      setModalProducto(null);
      cargarProductos();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo guardar el producto');
    }
  }

  async function handleEliminarProducto(producto) {
    if (!window.confirm(`¿Eliminar el producto "${producto.nombre}"?`)) return;
    try {
      await eliminarProducto(producto.id);
      toast.success('Producto eliminado');
      cargarProductos();
    } catch {
      toast.error('No se pudo eliminar el producto');
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Menú</h1>

      <div className="mt-6 flex gap-2 border-b border-[#2a2a2a]">
        <button
          type="button"
          onClick={() => setTab('categorias')}
          className={`px-4 py-2 text-sm font-medium ${
            tab === 'categorias' ? 'border-b-2 border-[#f97316] text-[#f97316]' : 'text-[#a1a1aa] hover:text-white'
          }`}
        >
          Categorías
        </button>
        <button
          type="button"
          onClick={() => setTab('productos')}
          className={`px-4 py-2 text-sm font-medium ${
            tab === 'productos' ? 'border-b-2 border-[#f97316] text-[#f97316]' : 'text-[#a1a1aa] hover:text-white'
          }`}
        >
          Productos
        </button>
      </div>

      {tab === 'categorias' ? (
        <div className="mt-6">
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={() => setModalCategoria('nueva')}
              className="flex items-center gap-2 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea6a0d]"
            >
              <Plus size={16} />
              Nueva categoría
            </button>
          </div>

          {cargandoCategorias ? (
            <Spinner />
          ) : (
            <div className="overflow-hidden rounded-xl border border-[#2a2a2a]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#1a1a1a] text-[#a1a1aa]">
                  <tr>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Color</th>
                    <th className="px-4 py-3">Orden</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {categorias.map((categoria) => (
                    <tr key={categoria.id} className="border-t border-[#2a2a2a] bg-[#141414]">
                      <td className="px-4 py-3 text-white">{categoria.nombre}</td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block h-4 w-4 rounded-full border border-[#333]"
                          style={{ backgroundColor: categoria.color || '#333' }}
                        />
                      </td>
                      <td className="px-4 py-3 text-[#a1a1aa]">{categoria.orden}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            categoria.activa ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                          }`}
                        >
                          {categoria.activa ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setModalCategoria(categoria)}
                            className="rounded-lg p-2 text-[#a1a1aa] hover:bg-[#2a2a2a] hover:text-white"
                            title="Editar"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleCategoria(categoria)}
                            className="rounded-lg p-2 text-[#a1a1aa] hover:bg-[#2a2a2a] hover:text-white"
                            title={categoria.activa ? 'Desactivar' : 'Activar'}
                          >
                            {categoria.activa ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEliminarCategoria(categoria)}
                            className="rounded-lg p-2 text-[#a1a1aa] hover:bg-red-500/10 hover:text-red-400"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {categorias.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[#a1a1aa]">
                        No hay categorías todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="rounded-lg border border-[#333] bg-[#1a1a1a] px-3 py-2 text-sm text-white outline-none focus:border-[#f97316]"
            >
              <option value="">Todas las categorías</option>
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nombre}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setModalProducto('nuevo')}
              className="flex items-center gap-2 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea6a0d]"
            >
              <Plus size={16} />
              Nuevo producto
            </button>
          </div>

          {cargandoProductos ? (
            <Spinner />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {productos.map((producto) => {
                const categoria = categorias.find((c) => c.id === producto.categoria_id);
                return (
                  <div key={producto.id} className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#141414]">
                    <div className="flex h-32 items-center justify-center bg-[#1a1a1a] text-[#333]">
                      <span className="text-xs">Sin imagen</span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-white">{producto.nombre}</h3>
                        <span className="whitespace-nowrap font-bold text-[#f97316]">
                          ${Number(producto.precio).toFixed(2)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#a1a1aa]">{categoria?.nombre || 'Sin categoría'}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            producto.disponible ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                          }`}
                        >
                          {producto.disponible ? 'Disponible' : 'No disponible'}
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setModalProducto(producto)}
                            className="rounded-lg p-2 text-[#a1a1aa] hover:bg-[#2a2a2a] hover:text-white"
                            title="Editar"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEliminarProducto(producto)}
                            className="rounded-lg p-2 text-[#a1a1aa] hover:bg-red-500/10 hover:text-red-400"
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {productos.length === 0 && (
                <p className="col-span-full py-8 text-center text-[#a1a1aa]">No hay productos todavía.</p>
              )}
            </div>
          )}
        </div>
      )}

      {modalCategoria && (
        <Modal
          titulo={modalCategoria === 'nueva' ? 'Nueva categoría' : 'Editar categoría'}
          onClose={() => setModalCategoria(null)}
        >
          <FormularioCategoria
            categoria={modalCategoria === 'nueva' ? null : modalCategoria}
            onGuardar={handleGuardarCategoria}
            onCancelar={() => setModalCategoria(null)}
          />
        </Modal>
      )}

      {modalProducto && (
        <Modal
          titulo={modalProducto === 'nuevo' ? 'Nuevo producto' : 'Editar producto'}
          onClose={() => setModalProducto(null)}
        >
          <FormularioProducto
            producto={modalProducto === 'nuevo' ? null : modalProducto}
            categorias={categorias}
            puedeVerCosto={puedeVerCosto}
            onGuardar={handleGuardarProducto}
            onCancelar={() => setModalProducto(null)}
          />
        </Modal>
      )}
    </div>
  );
}

function FormularioCategoria({ categoria, onGuardar, onCancelar }) {
  const [nombre, setNombre] = useState(categoria?.nombre || '');
  const [descripcion, setDescripcion] = useState(categoria?.descripcion || '');
  const [color, setColor] = useState(categoria?.color || '#f97316');
  const [orden, setOrden] = useState(categoria?.orden ?? 0);
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    await onGuardar({ nombre, descripcion, color, orden: Number(orden) });
    setGuardando(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Campo label="Nombre">
        <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="input" />
      </Campo>
      <Campo label="Descripción">
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className="input"
          rows={2}
        />
      </Campo>
      <div className="flex gap-4">
        <Campo label="Color">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-16 cursor-pointer rounded-lg border border-[#333] bg-[#0f0f0f]"
          />
        </Campo>
        <Campo label="Orden">
          <input type="number" value={orden} onChange={(e) => setOrden(e.target.value)} className="input" />
        </Campo>
      </div>

      <BotonesFormulario onCancelar={onCancelar} guardando={guardando} />
    </form>
  );
}

function FormularioProducto({ producto, categorias, puedeVerCosto, onGuardar, onCancelar }) {
  const [nombre, setNombre] = useState(producto?.nombre || '');
  const [descripcion, setDescripcion] = useState(producto?.descripcion || '');
  const [precio, setPrecio] = useState(producto?.precio ?? '');
  const [costo, setCosto] = useState(producto?.costo ?? '');
  const [categoriaId, setCategoriaId] = useState(producto?.categoria_id || '');
  const [tipo, setTipo] = useState(producto?.tipo || 'producto');
  const [disponiblePara, setDisponiblePara] = useState(producto?.disponible_para || 'todos');
  const [tiempoPreparacion, setTiempoPreparacion] = useState(producto?.tiempo_preparacion ?? '');
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    await onGuardar({
      nombre,
      descripcion,
      precio: Number(precio),
      ...(puedeVerCosto ? { costo: costo === '' ? null : Number(costo) } : {}),
      categoria_id: categoriaId || null,
      tipo,
      disponible_para: disponiblePara,
      tiempo_preparacion: tiempoPreparacion === '' ? null : Number(tiempoPreparacion),
    });
    setGuardando(false);
  }

  return (
    <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
      <Campo label="Nombre">
        <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="input" />
      </Campo>
      <Campo label="Descripción">
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          className="input"
          rows={2}
        />
      </Campo>

      <div className="grid grid-cols-2 gap-4">
        <Campo label="Precio">
          <input
            type="number"
            step="0.01"
            required
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            className="input"
          />
        </Campo>
        {puedeVerCosto && (
          <Campo label="Costo">
            <input
              type="number"
              step="0.01"
              value={costo}
              onChange={(e) => setCosto(e.target.value)}
              className="input"
            />
          </Campo>
        )}
      </div>

      <Campo label="Categoría">
        <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="input">
          <option value="">Sin categoría</option>
          {categorias.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.nombre}
            </option>
          ))}
        </select>
      </Campo>

      <div className="grid grid-cols-2 gap-4">
        <Campo label="Tipo">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="input">
            {TIPOS_PRODUCTO.map((opcion) => (
              <option key={opcion.value} value={opcion.value}>
                {opcion.label}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Disponible para">
          <select value={disponiblePara} onChange={(e) => setDisponiblePara(e.target.value)} className="input">
            {DISPONIBLE_PARA.map((opcion) => (
              <option key={opcion.value} value={opcion.value}>
                {opcion.label}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo label="Tiempo de preparación (min)">
        <input
          type="number"
          value={tiempoPreparacion}
          onChange={(e) => setTiempoPreparacion(e.target.value)}
          className="input"
        />
      </Campo>

      <BotonesFormulario onCancelar={onCancelar} guardando={guardando} />
    </form>
  );
}

function Campo({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-[#a1a1aa]">{label}</span>
      {children}
    </label>
  );
}

function BotonesFormulario({ onCancelar, guardando }) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button
        type="button"
        onClick={onCancelar}
        className="rounded-lg border border-[#333] px-4 py-2 text-sm font-medium text-[#a1a1aa] hover:text-white"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={guardando}
        className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea6a0d] disabled:opacity-60"
      >
        {guardando ? 'Guardando...' : 'Guardar'}
      </button>
    </div>
  );
}

export default Menu;
