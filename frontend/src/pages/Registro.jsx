import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UtensilsCrossed, ChevronDown, ChevronUp, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import Campo from '../components/Campo';
import CampoPassword from '../components/CampoPassword';
import { passwordEsValida } from '../components/FortalezaPassword';
import api from '../utils/api';

const ESTADO_INICIAL = {
  nombre_restaurante: '',
  ciudad: '',
  telefono_restaurante: '',
  nombre_usuario: '',
  email_usuario: '',
  password: '',
  confirmar_password: '',
};

const DEBOUNCE_CODIGO_MS = 500;

function Registro() {
  const [form, setForm] = useState(ESTADO_INICIAL);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [cargando, setCargando] = useState(false);
  const { registro } = useAuth();
  const navigate = useNavigate();

  const [mostrarCodigo, setMostrarCodigo] = useState(false);
  const [codigoAcceso, setCodigoAcceso] = useState('');
  const [estadoCodigo, setEstadoCodigo] = useState('idle');
  const [mensajeCodigo, setMensajeCodigo] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);

    const codigo = codigoAcceso.trim();
    if (!codigo) {
      setEstadoCodigo('idle');
      setMensajeCodigo('');
      return undefined;
    }

    setEstadoCodigo('validando');
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.post('/api/auth/validar-codigo', { codigo });
        setEstadoCodigo('valido');
        setMensajeCodigo(data.datos.beneficio);
      } catch (err) {
        setEstadoCodigo('invalido');
        setMensajeCodigo(err.response?.data?.mensaje || 'Código inválido');
      }
    }, DEBOUNCE_CODIGO_MS);

    return () => clearTimeout(debounceRef.current);
  }, [codigoAcceso]);

  function actualizar(campo) {
    return (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  }

  const contrasenasCoinciden = form.confirmar_password.length === 0 || form.password === form.confirmar_password;

  async function handleSubmit(e) {
    e.preventDefault();

    if (!passwordEsValida(form.password)) {
      toast.error('La contraseña no cumple los requisitos mínimos');
      return;
    }

    if (form.password !== form.confirmar_password) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    if (!aceptaTerminos) {
      toast.error('Debes aceptar los términos y condiciones');
      return;
    }

    setCargando(true);
    try {
      await registro({
        nombre_restaurante: form.nombre_restaurante,
        ciudad: form.ciudad,
        telefono_restaurante: form.telefono_restaurante,
        nombre_usuario: form.nombre_usuario,
        email_usuario: form.email_usuario,
        password: form.password,
        codigo_acceso: codigoAcceso.trim() || undefined,
      });
      toast.success('¡Cuenta creada! Verifica tu email para activar todas las funciones.');
      navigate('/dashboard');
    } catch (err) {
      const mensaje = err.response?.data?.mensaje || 'No se pudo completar el registro';
      toast.error(mensaje);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[image:var(--login-gradient)] px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center gap-2">
            <UtensilsCrossed className="text-[var(--login-text)]" size={36} />
            <h1 className="text-3xl font-extrabold text-[var(--login-text)]">Comandia</h1>
          </div>
          <p className="text-sm text-[var(--login-text)] opacity-85">Crea tu cuenta gratis en minutos</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-[var(--bg-card)] p-8 shadow-[0_20px_40px_var(--shadow)]"
        >
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
                Datos del restaurante
              </h2>

              <Campo label="Nombre del restaurante">
                <input
                  type="text"
                  required
                  value={form.nombre_restaurante}
                  onChange={actualizar('nombre_restaurante')}
                  className="input"
                  placeholder="Restaurante El Buen Sabor"
                />
              </Campo>

              <Campo label="Ciudad">
                <input
                  type="text"
                  required
                  value={form.ciudad}
                  onChange={actualizar('ciudad')}
                  className="input"
                  placeholder="Cali"
                />
              </Campo>

              <Campo label="Teléfono del restaurante">
                <input
                  type="tel"
                  required
                  value={form.telefono_restaurante}
                  onChange={actualizar('telefono_restaurante')}
                  className="input"
                  placeholder="300 123 4567"
                />
              </Campo>
            </div>

            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
                Datos del administrador
              </h2>

              <Campo label="Tu nombre completo">
                <input
                  type="text"
                  required
                  value={form.nombre_usuario}
                  onChange={actualizar('nombre_usuario')}
                  className="input"
                  placeholder="Ana Cabrera"
                />
              </Campo>

              <Campo label="Email">
                <input
                  type="email"
                  required
                  value={form.email_usuario}
                  onChange={actualizar('email_usuario')}
                  className="input"
                  placeholder="tu@restaurante.com"
                />
              </Campo>

              <CampoPassword
                id="password"
                label="Contraseña"
                value={form.password}
                onChange={actualizar('password')}
                mostrarFortaleza
                autoComplete="new-password"
              />

              <div>
                <CampoPassword
                  id="confirmar_password"
                  label="Confirmar contraseña"
                  value={form.confirmar_password}
                  onChange={actualizar('confirmar_password')}
                  autoComplete="new-password"
                />
                {!contrasenasCoinciden && (
                  <p className="mt-1 text-xs text-[var(--error)]">Las contraseñas no coinciden</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              onClick={() => setMostrarCodigo((v) => !v)}
              className="flex items-center gap-1 text-sm font-medium text-[var(--accent)]"
            >
              {mostrarCodigo ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              ¿Tienes un código especial?
            </button>

            {mostrarCodigo && (
              <div className="mt-3">
                <input
                  type="text"
                  value={codigoAcceso}
                  onChange={(e) => setCodigoAcceso(e.target.value.toUpperCase())}
                  className="input"
                  placeholder="CMDA-XXXX-XXXX-XXXX"
                />

                {estadoCodigo === 'validando' && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                    <Loader2 size={13} className="animate-spin" />
                    Validando código...
                  </p>
                )}
                {estadoCodigo === 'valido' && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[var(--success)]">
                    <CheckCircle2 size={14} />
                    Código válido — {mensajeCodigo}
                  </p>
                )}
                {estadoCodigo === 'invalido' && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[var(--error)]">
                    <XCircle size={14} />
                    {mensajeCodigo}
                  </p>
                )}
              </div>
            )}
          </div>

          <label className="mt-4 flex items-start gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={aceptaTerminos}
              onChange={(e) => setAceptaTerminos(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[var(--input-border)] accent-[var(--accent)]"
            />
            Acepto los términos y condiciones
          </label>

          <button
            type="submit"
            disabled={cargando}
            className="mt-6 w-full rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cargando ? 'Creando cuenta...' : 'Crear cuenta gratis — 14 días de prueba'}
          </button>

          <div className="mt-4 text-center">
            <Link to="/login" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)]">
              ¿Ya tienes cuenta? Inicia sesión
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Registro;
