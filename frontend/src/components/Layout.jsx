import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Mail, Clock, Lock } from 'lucide-react';

import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { diasRestantes } from '../utils/fecha';

function BannerVerificacion() {
  const { reenviarVerificacion } = useAuth();
  const [enviando, setEnviando] = useState(false);

  async function handleReenviar() {
    setEnviando(true);
    try {
      await reenviarVerificacion();
      toast.success('Te enviamos un nuevo email de verificación');
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo reenviar el email');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 bg-[var(--accent)] px-4 py-2 text-center text-sm font-medium text-white">
      <Mail size={16} />
      <span>Verifica tu email para activar todas las funciones.</span>
      <button
        type="button"
        onClick={handleReenviar}
        disabled={enviando}
        className="underline decoration-2 underline-offset-2 hover:opacity-80 disabled:opacity-60"
      >
        {enviando ? 'Enviando...' : 'Reenviar email de verificación'}
      </button>
    </div>
  );
}

function BannerTrial({ dias }) {
  const urgente = dias <= 3;

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-2 px-4 py-2 text-center text-sm font-medium text-white ${
        urgente ? 'bg-[var(--error)]' : 'bg-[var(--warning)]'
      }`}
    >
      <Clock size={16} />
      <span>
        Tu trial termina en {dias} {dias === 1 ? 'día' : 'días'}.
      </span>
      <Link to="/configuracion" className="underline decoration-2 underline-offset-2 hover:opacity-80">
        Ver planes
      </Link>
    </div>
  );
}

function ModalTrialExpirado() {
  const { logout } = useAuth();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-modal)] p-8 text-center shadow-xl">
        <Lock className="mx-auto mb-4 text-[var(--error)]" size={40} />
        <h2 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">Tu trial ha expirado</h2>
        <p className="mb-6 text-sm text-[var(--text-secondary)]">
          Elige un plan para continuar usando Comandia.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            to="/configuracion"
            className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
          >
            Ver planes
          </Link>
          <button
            type="button"
            onClick={logout}
            className="w-full rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}

function Layout({ children }) {
  const { usuario, restaurante } = useAuth();

  const esTrial = restaurante?.suscripcion_plan === 'trial';
  const dias = esTrial ? diasRestantes(restaurante?.trial_expira) : null;
  const trialExpirado = esTrial && dias !== null && dias <= 0;

  return (
    <div className="flex min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />
      <div className="flex flex-1 flex-col pt-16 md:pt-0">
        {usuario?.email_verificado === false && <BannerVerificacion />}
        {esTrial && !trialExpirado && dias !== null && <BannerTrial dias={dias} />}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">{children}</main>
      </div>
      {trialExpirado && <ModalTrialExpirado />}
    </div>
  );
}

export default Layout;
