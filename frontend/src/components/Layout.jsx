import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Mail, Clock, AlertTriangle, Lock } from 'lucide-react';

import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { diasRestantes } from '../utils/fecha';
import { formatearPrecio } from '../utils/formato';
import { iniciarPago } from '../utils/pagos';

const PLANES_MODAL = [
  { id: 'basico', nombre: 'Básico', precio: 89000 },
  { id: 'profesional', nombre: 'Profesional', precio: 179000 },
  { id: 'empresarial', nombre: 'Empresarial', precio: 299000 },
];

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
      {urgente ? <AlertTriangle size={16} /> : <Clock size={16} />}
      <span>
        {urgente
          ? dias === 1
            ? 'Tu prueba termina mañana'
            : `Tu prueba termina en ${dias} días`
          : `Tu prueba termina en ${dias} días`}
      </span>
      <Link to="/planes" className="underline decoration-2 underline-offset-2 hover:opacity-80">
        {urgente ? 'Elige tu plan ahora' : 'Ver planes'}
      </Link>
    </div>
  );
}

function ModalTrialExpirado() {
  const { logout } = useAuth();
  const [procesando, setProcesando] = useState(null);

  async function handleSeleccionar(planId) {
    setProcesando(planId);
    try {
      const { url } = await iniciarPago(planId);
      window.open(url, '_blank', 'noopener,noreferrer');
      toast.success('Completa el pago en Mercado Pago. Tu plan se activará automáticamente.');
    } catch (err) {
      toast.error(err.response?.data?.mensaje || 'No se pudo iniciar el pago');
    } finally {
      setProcesando(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[var(--overlay)] px-4 py-8">
      <div className="w-full max-w-4xl rounded-2xl border border-[var(--border)] bg-[var(--bg-modal)] p-8 shadow-xl">
        <div className="text-center">
          <Lock className="mx-auto mb-3 text-[var(--error)]" size={40} />
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Tu período de prueba ha terminado</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Elige un plan para continuar usando Comandia</p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {PLANES_MODAL.map((plan) => (
            <div
              key={plan.id}
              className="flex flex-col rounded-xl border border-[var(--border)] p-5 text-center"
            >
              <h3 className="font-bold text-[var(--text-primary)]">{plan.nombre}</h3>
              <p className="mt-1">
                <span className="text-2xl font-extrabold text-[var(--text-primary)]">
                  {formatearPrecio(plan.precio)}
                </span>
                <span className="text-xs text-[var(--text-secondary)]">/mes</span>
              </p>
              <button
                type="button"
                disabled={procesando === plan.id}
                onClick={() => handleSeleccionar(plan.id)}
                className="mt-4 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {procesando === plan.id ? 'Redirigiendo...' : 'Elegir plan'}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={logout}
            className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
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
