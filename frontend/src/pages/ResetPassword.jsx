import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UtensilsCrossed, CheckCircle2 } from 'lucide-react';

import api from '../utils/api';
import CampoPassword from '../components/CampoPassword';
import { passwordEsValida } from '../components/FortalezaPassword';

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [exito, setExito] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();

    if (!token) {
      toast.error('El link no es válido');
      return;
    }

    if (!passwordEsValida(password)) {
      toast.error('La contraseña no cumple los requisitos mínimos');
      return;
    }

    if (password !== confirmarPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    setCargando(true);
    try {
      await api.post('/api/auth/reset-password', { token, nueva_password: password });
      setExito(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo restablecer la contraseña');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[image:var(--login-gradient)] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center gap-2">
            <UtensilsCrossed className="text-[var(--login-text)]" size={36} />
            <h1 className="text-3xl font-extrabold text-[var(--login-text)]">Comandia</h1>
          </div>
          <p className="text-sm text-[var(--login-text)] opacity-85">Crea una nueva contraseña</p>
        </div>

        <div className="rounded-2xl bg-[var(--bg-card)] p-8 shadow-[0_20px_40px_var(--shadow)]">
          {exito ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="text-[var(--success)]" size={44} />
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Contraseña actualizada. Redirigiendo al login...
              </p>
            </div>
          ) : !token ? (
            <p className="text-center text-sm text-[var(--error)]">
              Este link no es válido. Solicita uno nuevo desde "¿Olvidaste tu contraseña?".
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <CampoPassword
                id="password"
                label="Nueva contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                mostrarFortaleza
                autoComplete="new-password"
              />

              <CampoPassword
                id="confirmar_password"
                label="Confirmar contraseña"
                value={confirmarPassword}
                onChange={(e) => setConfirmarPassword(e.target.value)}
                autoComplete="new-password"
              />

              <button
                type="submit"
                disabled={cargando}
                className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cargando ? 'Guardando...' : 'Restablecer contraseña'}
              </button>
            </form>
          )}

          <div className="mt-4 text-center">
            <Link to="/login" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)]">
              Volver al login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
