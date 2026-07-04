import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { UtensilsCrossed, MailCheck } from 'lucide-react';

import api from '../utils/api';

function OlvideMiPassword() {
  const [email, setEmail] = useState('');
  const [cargando, setCargando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setCargando(true);

    try {
      await api.post('/api/auth/olvide-password', { email });
      setEnviado(true);
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo procesar la solicitud');
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
          <p className="text-sm text-[var(--login-text)] opacity-85">Recupera el acceso a tu cuenta</p>
        </div>

        <div className="rounded-2xl bg-[var(--bg-card)] p-8 shadow-[0_20px_40px_var(--shadow)]">
          {enviado ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <MailCheck className="text-[var(--success)]" size={44} />
              <p className="text-sm text-[var(--text-primary)]">
                Si el email existe, recibirás instrucciones para restablecer tu contraseña.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
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

              <button
                type="submit"
                disabled={cargando}
                className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cargando ? 'Enviando...' : 'Enviar instrucciones'}
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

export default OlvideMiPassword;
