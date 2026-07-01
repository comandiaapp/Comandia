import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UtensilsCrossed } from 'lucide-react';

import { useAuth } from '../context/AuthContext';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#0f0f0f] via-[#151515] to-[#0f0f0f] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center gap-2">
            <UtensilsCrossed className="text-[#f97316]" size={36} />
            <h1 className="text-3xl font-extrabold text-white">Comandia</h1>
          </div>
          <p className="text-sm text-[#a1a1aa]">El sistema que tu restaurante necesita</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-[#2a2a2a] bg-[#1a1a1a] p-8 shadow-xl">
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-[#a1a1aa]" htmlFor="email">
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
            <label className="mb-1 block text-sm font-medium text-[#a1a1aa]" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full rounded-lg bg-[#f97316] px-4 py-2 font-semibold text-white transition-colors hover:bg-[#ea6a0d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cargando ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>

          <div className="mt-4 text-center">
            <a href="#" className="text-sm text-[#a1a1aa] hover:text-[#f97316]">
              ¿Olvidaste tu contraseña?
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;
