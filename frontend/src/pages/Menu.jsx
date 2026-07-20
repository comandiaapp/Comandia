import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';

import Modal from '../components/Modal';
import Spinner from '../components/Spinner';
import Campo from '../components/Campo';
import BotonesFormulario from '../components/BotonesFormulario';
import InputDinero from '../components/InputDinero';
import { useAuth } from '../context/AuthContext';
import { getCategorias, crearCategoria, actualizarCategoria, eliminarCategoria } from '../utils/categorias';
import { getProductos, crearProducto, actualizarProducto, eliminarProducto } from '../utils/productos';
import { formatearPrecio } from '../utils/formato';
import { redimensionarImagen } from '../utils/imagenLocal';

const TIPOS_PRODUCTO = [
  { value: 'producto', label: 'Producto' },
  { value: 'combo', label: 'Combo' },
  { value: 'adicionales', label: 'Adicionales' },
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
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Menú</h1>

      <div className="mt-6 flex gap-2 border-b border-[var(--border)]">
        <button
          type="button"
          onClick={() => setTab('categorias')}
          className={`px-4 py-2 text-sm font-medium ${
            tab === 'categorias'
              ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Categorías
        </button>
        <button
          type="button"
          onClick={() => setTab('productos')}
          className={`px-4 py-2 text-sm font-medium ${
            tab === 'productos'
              ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
              className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              <Plus size={16} />
              Nueva categoría
            </button>
          </div>

          {cargandoCategorias ? (
            <Spinner />
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
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
                    <tr key={categoria.id} className="border-t border-[var(--border)] bg-[var(--bg-card)]">
                      <td className="px-4 py-3 text-[var(--text-primary)]">{categoria.nombre}</td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-block h-4 w-4 rounded-full border border-[var(--border)]"
                          style={{ backgroundColor: categoria.color || '#333' }}
                        />
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{categoria.orden}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            categoria.activa
                              ? 'bg-[var(--success)]/10 text-[var(--success)]'
                              : 'bg-[var(--error)]/10 text-[var(--error)]'
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
                            className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
                            title="Editar"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleCategoria(categoria)}
                            className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
                            title={categoria.activa ? 'Desactivar' : 'Activar'}
                          >
                            {categoria.activa ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEliminarCategoria(categoria)}
                            className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--error)]/10 hover:text-[var(--error)]"
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
                      <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-secondary)]">
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
              className="rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
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
              className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
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
                  <div
                    key={producto.id}
                    className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-card)]"
                  >
                    <div className="flex h-32 items-center justify-center overflow-hidden bg-[var(--bg-secondary)] text-[var(--text-secondary)]">
                      {producto.imagen_url ? (
                        <img src={producto.imagen_url} alt={producto.nombre} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs">Sin imagen</span>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-[var(--text-primary)]">{producto.nombre}</h3>
                        <span className="whitespace-nowrap font-bold text-[var(--accent)]">
                          {formatearPrecio(producto.precio)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{categoria?.nombre || 'Sin categoría'}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            producto.disponible
                              ? 'bg-[var(--success)]/10 text-[var(--success)]'
                              : 'bg-[var(--error)]/10 text-[var(--error)]'
                          }`}
                        >
                          {producto.disponible ? 'Disponible' : 'No disponible'}
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => setModalProducto(producto)}
                            className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
                            title="Editar"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEliminarProducto(producto)}
                            className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--error)]/10 hover:text-[var(--error)]"
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
                <p className="col-span-full py-8 text-center text-[var(--text-secondary)]">No hay productos todavía.</p>
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
            className="h-10 w-16 cursor-pointer rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)]"
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
  // 'modificador' es el valor heredado de productos creados antes de
  // renombrar esta opción a "Adicionales"; se normaliza para que el
  // select siempre muestre la opción vigente.
  const [tipo, setTipo] = useState(
    producto?.tipo === 'modificador' ? 'adicionales' : producto?.tipo || 'producto'
  );
  const [disponiblePara, setDisponiblePara] = useState(producto?.disponible_para || 'todos');
  const [tiempoPreparacion, setTiempoPreparacion] = useState(producto?.tiempo_preparacion ?? '');
  const [guardando, setGuardando] = useState(false);
  const [imagenUrl, setImagenUrl] = useState(producto?.imagen_url || '');
  const [imagenBase64, setImagenBase64] = useState(null); // null = sin cambios; '' = quitar; string = nueva foto
  const [procesandoImagen, setProcesandoImagen] = useState(false);

  async function handleArchivoImagen(e) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setProcesandoImagen(true);
    try {
      const dataUrl = await redimensionarImagen(archivo);
      setImagenBase64(dataUrl);
      setImagenUrl(dataUrl);
    } catch {
      toast.error('No se pudo procesar la imagen');
    } finally {
      setProcesandoImagen(false);
    }
  }

  function handleQuitarImagen() {
    setImagenBase64('');
    setImagenUrl('');
  }

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
      ...(imagenBase64 !== null ? { imagen_base64: imagenBase64 } : {}),
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

      <Campo label="Foto">
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]">
            {imagenUrl ? (
              <img src={imagenUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[10px] text-[var(--text-secondary)]">Sin imagen</span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="cursor-pointer text-sm font-medium text-[var(--accent)]">
              {procesandoImagen ? 'Procesando...' : imagenUrl ? 'Cambiar foto' : 'Subir foto'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleArchivoImagen}
                disabled={procesandoImagen}
                className="hidden"
              />
            </label>
            {imagenUrl && (
              <button type="button" onClick={handleQuitarImagen} className="text-left text-xs text-[var(--error)]">
                Quitar foto
              </button>
            )}
          </div>
        </div>
      </Campo>

      <div className="grid grid-cols-2 gap-4">
        <Campo label="Precio">
          <InputDinero required value={precio} onChange={setPrecio} className="input" />
        </Campo>
        {puedeVerCosto && (
          <Campo label="Costo">
            <InputDinero value={costo} onChange={setCosto} className="input" />
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

export default Menu;
