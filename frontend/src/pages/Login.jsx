import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UtensilsCrossed, Eye, EyeOff } from 'lucide-react';

import { useAuth } from '../context/AuthContext';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setCargando(true);

    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      const mensaje = err.response?.data?.mensaje || 'No se pudo iniciar sesión';
      toast.error(mensaje);
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
          <p className="text-sm text-[var(--login-text)] opacity-85">
            El sistema que tu restaurante necesita
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-[var(--bg-card)] p-8 shadow-[0_20px_40px_var(--shadow)]"
        >
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]" htmlFor="email">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="tu@restaurante.com"
            />
          </div>

          <div className="mb-6">
            <label className="mb-1 block text-sm font-medium text-[var(--text-secondary)]" htmlFor="password">
              Contraseña
            </label>
            <div className="relative">
              <input
                id="password"
                type={mostrarPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setMostrarPassword((v) => !v)}
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--accent)]"
              >
                {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cargando ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>

          <div className="mt-4 flex flex-col items-center gap-2 text-center">
            <Link to="/olvide-mi-password" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)]">
              ¿Olvidaste tu contraseña?
            </Link>
            <Link to="/registro" className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)]">
              ¿No tienes cuenta? Regístrate gratis
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;
