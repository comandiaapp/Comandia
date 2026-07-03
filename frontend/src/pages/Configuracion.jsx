import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Building2, Receipt, SlidersHorizontal, Users, UserPlus, UserX, UserCheck, Pencil } from 'lucide-react';

import Spinner from '../components/Spinner';
import Campo from '../components/Campo';
import Modal from '../components/Modal';
import BotonesFormulario from '../components/BotonesFormulario';
import { useAuth } from '../context/AuthContext';
import {
  getConfiguracion,
  actualizarConfiguracion,
  getUsuarios,
  invitarUsuario,
  actualizarRolUsuario,
  cambiarEstadoUsuario,
} from '../utils/configuracion';

const TABS = [
  { id: 'info', label: 'Información', icon: Building2 },
  { id: 'fiscal', label: 'Fiscal', icon: Receipt },
  { id: 'preferencias', label: 'Preferencias', icon: SlidersHorizontal },
  { id: 'usuarios', label: 'Usuarios y roles', icon: Users },
];

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'cajero', label: 'Cajero' },
  { value: 'mesero', label: 'Mesero' },
  { value: 'cocina', label: 'Cocina' },
];

const ROL_LABEL = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));

function Configuracion() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === 'admin';

  const [tab, setTab] = useState('info');
  const [restaurante, setRestaurante] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setRestaurante(await getConfiguracion());
    } catch {
      toast.error('No se pudo cargar la configuración del restaurante');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function handleGuardar(datos) {
    try {
      const actualizado = await actualizarConfiguracion(datos);
      setRestaurante(actualizado);
      toast.success('Configuración actualizada');
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo guardar la configuración');
    }
  }

  if (cargando || !restaurante) return <Spinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Configuración</h1>

      <div className="mt-4 flex flex-wrap gap-2 border-b border-[#2a2a2a]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? 'border-[#f97316] text-[#f97316]' : 'border-transparent text-[#a1a1aa] hover:text-white'
            }`}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 max-w-2xl">
        {!esAdmin && tab !== 'usuarios' && (
          <p className="mb-4 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-sm text-orange-400">
            Solo un administrador puede modificar la configuración. Puedes ver los valores actuales.
          </p>
        )}
        {tab === 'info' && <TabInformacion restaurante={restaurante} onGuardar={handleGuardar} esAdmin={esAdmin} />}
        {tab === 'fiscal' && <TabFiscal restaurante={restaurante} onGuardar={handleGuardar} esAdmin={esAdmin} />}
        {tab === 'preferencias' && <TabPreferencias restaurante={restaurante} onGuardar={handleGuardar} esAdmin={esAdmin} />}
        {tab === 'usuarios' && <TabUsuarios esAdmin={esAdmin} />}
      </div>
    </div>
  );
}

// --- Tab 1: Información del restaurante ---

function TabInformacion({ restaurante, onGuardar, esAdmin }) {
  const [nombre, setNombre] = useState(restaurante.nombre || '');
  const [logoUrl, setLogoUrl] = useState(restaurante.logo_url || '');
  const [nit, setNit] = useState(restaurante.nit || '');
  const [regimen, setRegimen] = useState(restaurante.regimen || 'simplificado');
  const [telefono, setTelefono] = useState(restaurante.telefono || '');
  const [direccion, setDireccion] = useState(restaurante.direccion || '');
  const [ciudad, setCiudad] = useState(restaurante.ciudad || '');
  const [departamento, setDepartamento] = useState(restaurante.departamento || '');
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    await onGuardar({
      nombre,
      logo_url: logoUrl || null,
      nit: nit || null,
      regimen,
      telefono: telefono || null,
      direccion: direccion || null,
      ciudad: ciudad || null,
      departamento: departamento || null,
    });
    setGuardando(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Campo label="Logo (URL)">
        <input
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          disabled={!esAdmin}
          className="input"
          placeholder="https://..."
        />
      </Campo>
      <Campo label="Nombre del restaurante">
        <input required value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={!esAdmin} className="input" />
      </Campo>
      <div className="grid grid-cols-2 gap-4">
        <Campo label="NIT">
          <input value={nit} onChange={(e) => setNit(e.target.value)} disabled={!esAdmin} className="input" />
        </Campo>
        <Campo label="Régimen tributario">
          <select value={regimen} onChange={(e) => setRegimen(e.target.value)} disabled={!esAdmin} className="input">
            <option value="simplificado">Simplificado</option>
            <option value="comun">Común</option>
          </select>
        </Campo>
      </div>
      <Campo label="Teléfono">
        <input value={telefono} onChange={(e) => setTelefono(e.target.value)} disabled={!esAdmin} className="input" />
      </Campo>
      <Campo label="Dirección">
        <input value={direccion} onChange={(e) => setDireccion(e.target.value)} disabled={!esAdmin} className="input" />
      </Campo>
      <div className="grid grid-cols-2 gap-4">
        <Campo label="Ciudad">
          <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} disabled={!esAdmin} className="input" />
        </Campo>
        <Campo label="Departamento">
          <input value={departamento} onChange={(e) => setDepartamento(e.target.value)} disabled={!esAdmin} className="input" />
        </Campo>
      </div>
      {esAdmin && (
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={guardando}
            className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea6a0d] disabled:opacity-60"
          >
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      )}
    </form>
  );
}

// --- Tab 2: Configuración fiscal ---

const OPCIONES_IVA = [0, 8, 19];

function TabFiscal({ restaurante, onGuardar, esAdmin }) {
  const ivaInicial = Number(restaurante.porcentaje_impuesto);
  const [ivaPreset, setIvaPreset] = useState(OPCIONES_IVA.includes(ivaInicial) ? String(ivaInicial) : 'personalizado');
  const [ivaPersonalizado, setIvaPersonalizado] = useState(OPCIONES_IVA.includes(ivaInicial) ? '' : String(ivaInicial));
  const [regimen, setRegimen] = useState(restaurante.regimen || 'simplificado');
  const [nit, setNit] = useState(restaurante.nit || '');
  const [mensajeTicket, setMensajeTicket] = useState(restaurante.mensaje_ticket || '');
  const [guardando, setGuardando] = useState(false);

  const ivaEfectivo = ivaPreset === 'personalizado' ? Number(ivaPersonalizado || 0) : Number(ivaPreset);

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    await onGuardar({
      porcentaje_impuesto: ivaEfectivo,
      regimen,
      nit: nit || null,
      mensaje_ticket: mensajeTicket || null,
    });
    setGuardando(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Campo label="Porcentaje de IVA">
        <div className="flex flex-wrap gap-2">
          {OPCIONES_IVA.map((valor) => (
            <button
              key={valor}
              type="button"
              disabled={!esAdmin}
              onClick={() => setIvaPreset(String(valor))}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                ivaPreset === String(valor) ? 'bg-[#f97316] text-white' : 'bg-[#1a1a1a] text-[#a1a1aa] hover:text-white'
              }`}
            >
              {valor}%
            </button>
          ))}
          <button
            type="button"
            disabled={!esAdmin}
            onClick={() => setIvaPreset('personalizado')}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              ivaPreset === 'personalizado' ? 'bg-[#f97316] text-white' : 'bg-[#1a1a1a] text-[#a1a1aa] hover:text-white'
            }`}
          >
            Personalizado
          </button>
        </div>
        {ivaPreset === 'personalizado' && (
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={ivaPersonalizado}
            onChange={(e) => setIvaPersonalizado(e.target.value)}
            disabled={!esAdmin}
            className="input mt-2 w-32"
          />
        )}
      </Campo>
      <Campo label="Régimen tributario">
        <select value={regimen} onChange={(e) => setRegimen(e.target.value)} disabled={!esAdmin} className="input">
          <option value="simplificado">Simplificado</option>
          <option value="comun">Común</option>
        </select>
      </Campo>
      <Campo label="NIT">
        <input value={nit} onChange={(e) => setNit(e.target.value)} disabled={!esAdmin} className="input" />
      </Campo>
      <Campo label="Mensaje al pie del ticket/factura">
        <textarea
          value={mensajeTicket}
          onChange={(e) => setMensajeTicket(e.target.value)}
          disabled={!esAdmin}
          className="input"
          rows={2}
          placeholder="Ej: ¡Gracias por su compra!"
        />
      </Campo>

      <div className="rounded-xl border border-[#2a2a2a] bg-[#141414] p-4">
        <p className="mb-2 text-xs uppercase tracking-wide text-[#a1a1aa]">Vista previa del encabezado de factura</p>
        <div className="rounded-lg bg-white p-4 text-center text-black">
          <p className="font-bold">{restaurante.nombre}</p>
          {nit && <p className="text-xs">NIT: {nit}</p>}
          <p className="text-xs">Régimen {regimen === 'comun' ? 'Común' : 'Simplificado'}</p>
          <p className="text-xs">IVA: {ivaEfectivo}%</p>
        </div>
      </div>

      {esAdmin && (
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={guardando}
            className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea6a0d] disabled:opacity-60"
          >
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      )}
    </form>
  );
}

// --- Tab 3: Preferencias del sistema ---

function TabPreferencias({ restaurante, onGuardar, esAdmin }) {
  const [propina, setPropina] = useState(restaurante.porcentaje_propina_sugerida ?? 10);
  const [modoOperacion, setModoOperacion] = useState(restaurante.modo_operacion || 'todo_en_uno');
  const [permitePedidosSinJornada, setPermitePedidosSinJornada] = useState(
    restaurante.permite_pedidos_sin_jornada ?? true
  );
  const [zonaHoraria, setZonaHoraria] = useState(restaurante.zona_horaria || 'America/Bogota');
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    await onGuardar({
      porcentaje_propina_sugerida: Number(propina),
      modo_operacion: modoOperacion,
      permite_pedidos_sin_jornada: permitePedidosSinJornada,
      zona_horaria: zonaHoraria,
    });
    setGuardando(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Campo label="Propina sugerida (%)">
        <input
          type="number"
          step="0.5"
          min="0"
          max="100"
          value={propina}
          onChange={(e) => setPropina(e.target.value)}
          disabled={!esAdmin}
          className="input w-32"
        />
      </Campo>
      <Campo label="Modo de operación">
        <select value={modoOperacion} onChange={(e) => setModoOperacion(e.target.value)} disabled={!esAdmin} className="input">
          <option value="todo_en_uno">Todo en uno</option>
          <option value="multi_estacion">Multi-estación</option>
        </select>
      </Campo>
      <label className="flex items-center justify-between rounded-lg border border-[#2a2a2a] bg-[#141414] px-4 py-3">
        <span className="text-sm text-white">Permitir pedidos sin jornada abierta</span>
        <input
          type="checkbox"
          checked={permitePedidosSinJornada}
          onChange={(e) => setPermitePedidosSinJornada(e.target.checked)}
          disabled={!esAdmin}
          className="h-5 w-5 accent-[#f97316]"
        />
      </label>
      <Campo label="Zona horaria">
        <select value={zonaHoraria} onChange={(e) => setZonaHoraria(e.target.value)} disabled={!esAdmin} className="input">
          <option value="America/Bogota">America/Bogota</option>
          <option value="America/Mexico_City">America/Mexico_City</option>
          <option value="America/Lima">America/Lima</option>
          <option value="America/Santiago">America/Santiago</option>
        </select>
      </Campo>
      {esAdmin && (
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={guardando}
            className="rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea6a0d] disabled:opacity-60"
          >
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      )}
    </form>
  );
}

// --- Tab 4: Usuarios y roles ---

function TabUsuarios({ esAdmin }) {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalInvitar, setModalInvitar] = useState(false);
  const [modalRol, setModalRol] = useState(null); // usuario

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setUsuarios(await getUsuarios());
    } catch {
      toast.error('No se pudieron cargar los usuarios');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (esAdmin) cargar();
  }, [esAdmin, cargar]);

  async function handleInvitar(datos) {
    try {
      const resultado = await invitarUsuario(datos);
      toast.success(`Usuario invitado. Password temporal: ${resultado.password_temporal}`, { duration: 8000 });
      setModalInvitar(false);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo invitar al usuario');
    }
  }

  async function handleActualizarRol(id, rol) {
    try {
      await actualizarRolUsuario(id, rol);
      toast.success('Rol actualizado');
      setModalRol(null);
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo actualizar el rol');
    }
  }

  async function handleCambiarEstado(usuario) {
    try {
      await cambiarEstadoUsuario(usuario.id, !usuario.activo);
      toast.success(usuario.activo ? 'Usuario desactivado' : 'Usuario activado');
      cargar();
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo cambiar el estado del usuario');
    }
  }

  if (!esAdmin) {
    return (
      <p className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6 text-center text-[#a1a1aa]">
        Solo un administrador puede gestionar usuarios y roles.
      </p>
    );
  }

  if (cargando) return <Spinner />;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setModalInvitar(true)}
          className="flex items-center gap-2 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea6a0d]"
        >
          <UserPlus size={16} />
          Invitar nuevo usuario
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#2a2a2a]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#1a1a1a] text-[#a1a1aa]">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-t border-[#2a2a2a] bg-[#141414]">
                <td className="px-4 py-3 text-white">{u.nombre}</td>
                <td className="px-4 py-3 text-[#a1a1aa]">{u.email}</td>
                <td className="px-4 py-3 text-[#a1a1aa]">{ROL_LABEL[u.rol] || u.rol}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      u.activo ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}
                  >
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setModalRol(u)}
                      title="Editar rol"
                      className="rounded-lg p-2 text-[#a1a1aa] hover:bg-[#2a2a2a] hover:text-white"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCambiarEstado(u)}
                      title={u.activo ? 'Desactivar' : 'Activar'}
                      className={`rounded-lg p-2 text-[#a1a1aa] ${
                        u.activo ? 'hover:bg-red-500/10 hover:text-red-400' : 'hover:bg-green-500/10 hover:text-green-400'
                      }`}
                    >
                      {u.activo ? <UserX size={16} /> : <UserCheck size={16} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#a1a1aa]">
                  No hay usuarios registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalInvitar && (
        <Modal titulo="Invitar nuevo usuario" onClose={() => setModalInvitar(false)}>
          <FormularioInvitar onGuardar={handleInvitar} onCancelar={() => setModalInvitar(false)} />
        </Modal>
      )}

      {modalRol && (
        <Modal titulo={`Editar rol — ${modalRol.nombre}`} onClose={() => setModalRol(null)}>
          <FormularioRol
            usuario={modalRol}
            onGuardar={(rol) => handleActualizarRol(modalRol.id, rol)}
            onCancelar={() => setModalRol(null)}
          />
        </Modal>
      )}
    </div>
  );
}

function FormularioInvitar({ onGuardar, onCancelar }) {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState('mesero');
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    await onGuardar({ nombre, email, rol });
    setGuardando(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Campo label="Nombre">
        <input required value={nombre} onChange={(e) => setNombre(e.target.value)} className="input" />
      </Campo>
      <Campo label="Email">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
      </Campo>
      <Campo label="Rol">
        <select value={rol} onChange={(e) => setRol(e.target.value)} className="input">
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </Campo>
      <p className="text-xs text-[#a1a1aa]">
        Se creará con la contraseña temporal <span className="font-semibold text-white">Comandia2024</span>. El usuario
        deberá cambiarla en su primer inicio de sesión.
      </p>
      <BotonesFormulario onCancelar={onCancelar} guardando={guardando} textoGuardar="Invitar" />
    </form>
  );
}

function FormularioRol({ usuario, onGuardar, onCancelar }) {
  const [rol, setRol] = useState(usuario.rol);
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    await onGuardar(rol);
    setGuardando(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Campo label="Rol">
        <select value={rol} onChange={(e) => setRol(e.target.value)} className="input">
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </Campo>
      <BotonesFormulario onCancelar={onCancelar} guardando={guardando} textoGuardar="Actualizar rol" />
    </form>
  );
}

export default Configuracion;
