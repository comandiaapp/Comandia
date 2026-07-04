import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle2, XCircle, UtensilsCrossed } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import Spinner from '../components/Spinner';

function VerificarEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [estado, setEstado] = useState('cargando');
  const [reenviando, setReenviando] = useState(false);
  const { estaAutenticado, reenviarVerificacion, refrescarUsuario } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    async function verificar() {
      if (!token) {
        setEstado('error');
        return;
      }

      try {
        await api.get('/api/auth/verificar-email', { params: { token } });
        setEstado('exito');
        if (estaAutenticado) {
          refrescarUsuario().catch(() => {});
        }
      } catch {
        setEstado('error');
      }
    }

    verificar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleReenviar() {
    setReenviando(true);
    try {
      await reenviarVerificacion();
      toast.success('Te enviamos un nuevo email de verificación');
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo reenviar el email');
    } finally {
      setReenviando(false);
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
        </div>

        <div className="rounded-2xl bg-[var(--bg-card)] p-8 text-center shadow-[0_20px_40px_var(--shadow)]">
          {estado === 'cargando' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <Spinner />
              <p className="text-sm text-[var(--text-secondary)]">Verificando tu email...</p>
            </div>
          )}

          {estado === 'exito' && (
            <div className="flex flex-col items-center gap-3">
              <CheckCircle2 className="text-[var(--success)]" size={48} />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                ¡Email verificado! Tu cuenta está lista
              </h2>
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="mt-2 w-full rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
              >
                Ir al dashboard
              </button>
            </div>
          )}

          {estado === 'error' && (
            <div className="flex flex-col items-center gap-3">
              <XCircle className="text-[var(--error)]" size={48} />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Link inválido o expirado</h2>

              {estaAutenticado ? (
                <button
                  type="button"
                  onClick={handleReenviar}
                  disabled={reenviando}
                  className="mt-2 w-full rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:opacity-60"
                >
                  {reenviando ? 'Enviando...' : 'Reenviar verificación'}
                </button>
              ) : (
                <>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Inicia sesión para solicitar un nuevo email de verificación.
                  </p>
                  <Link
                    to="/login"
                    className="mt-2 w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-center font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
                  >
                    Ir al login
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VerificarEmail;
