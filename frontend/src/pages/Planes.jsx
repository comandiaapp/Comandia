import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Check, CreditCard } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { iniciarPago } from '../utils/pagos';
import { formatearPrecio } from '../utils/formato';
import { diasRestantes } from '../utils/fecha';

const PLANES = [
  {
    id: 'basico',
    nombre: 'Básico',
    precio: 89000,
    beneficios: ['1 sucursal', 'Hasta 3 usuarios', 'POS + Cocina + Reportes básicos', 'Soporte por email'],
  },
  {
    id: 'profesional',
    nombre: 'Profesional',
    precio: 179000,
    destacado: true,
    beneficios: [
      '1 sucursal',
      'Hasta 10 usuarios',
      'Todo lo del básico',
      'Inventario + Contaduría',
      'Facturación electrónica',
      'Soporte prioritario',
    ],
  },
  {
    id: 'empresarial',
    nombre: 'Empresarial',
    precio: 299000,
    beneficios: [
      'Hasta 3 sucursales',
      'Usuarios ilimitados',
      'Todo lo anterior',
      'Multi-sucursal',
      'Reportes avanzados',
      'Soporte dedicado',
    ],
  },
];

function TarjetaPlan({ plan, trialActivo, trialExpirado, esPlanActual, esVitalicio, procesando, onSeleccionar, onContinuarTrial }) {
  return (
    <div
      className={`relative flex h-full flex-col rounded-2xl border p-7 transition-transform ${
        plan.destacado
          ? 'border-[var(--accent)] bg-[var(--bg-card)] shadow-[0_16px_36px_var(--shadow)] sm:-translate-y-2'
          : 'border-[var(--border)] bg-[var(--bg-card)]'
      }`}
    >
      {plan.destacado && (
        <span className="absolute -top-3.5 left-1/2 w-fit -translate-x-1/2 rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-md">
          Más popular
        </span>
      )}

      <h3 className="text-lg font-bold text-[var(--text-primary)]">{plan.nombre}</h3>
      <p className="mt-2">
        <span className="text-3xl font-extrabold text-[var(--text-primary)]">{formatearPrecio(plan.precio)}</span>
        <span className="text-sm text-[var(--text-secondary)]">/mes</span>
      </p>

      <ul className="mt-6 flex-1 space-y-3">
        {plan.beneficios.map((beneficio) => (
          <li key={beneficio} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
            <Check size={17} className="mt-0.5 flex-shrink-0 text-[var(--accent)]" />
            {beneficio}
          </li>
        ))}
      </ul>

      {esVitalicio ? (
        <button
          type="button"
          disabled
          className="mt-7 cursor-not-allowed rounded-lg bg-[var(--bg-secondary)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--text-secondary)] disabled:opacity-60"
        >
          Incluido en tu acceso vitalicio
        </button>
      ) : trialActivo ? (
        <div className="mt-7 flex flex-col gap-2">
          <button
            type="button"
            disabled={procesando}
            onClick={() => onSeleccionar(plan.id)}
            className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {procesando ? 'Redirigiendo...' : 'Activar ahora'}
          </button>
          <button
            type="button"
            onClick={onContinuarTrial}
            className="rounded-lg border border-[var(--border)] px-4 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            Continuar prueba gratis
          </button>
        </div>
      ) : trialExpirado ? (
        <button
          type="button"
          disabled={procesando}
          onClick={() => onSeleccionar(plan.id)}
          className="mt-7 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {procesando ? 'Redirigiendo...' : 'Activar plan'}
        </button>
      ) : (
        <button
          type="button"
          disabled={esPlanActual || procesando}
          onClick={() => onSeleccionar(plan.id)}
          className={`mt-7 rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            esPlanActual
              ? 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
              : 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
          }`}
        >
          {procesando ? 'Redirigiendo...' : esPlanActual ? 'Plan actual' : 'Cambiar plan'}
        </button>
      )}
    </div>
  );
}

function Planes() {
  const { restaurante } = useAuth();
  const navigate = useNavigate();
  const [procesando, setProcesando] = useState(null);

  const esVitalicio = restaurante?.suscripcion_plan === 'gratuito_vitalicio';
  const esTrial = restaurante?.suscripcion_plan === 'trial';
  const diasTrial = esTrial ? diasRestantes(restaurante?.trial_expira) : null;
  const trialExpirado = esTrial && diasTrial !== null && diasTrial <= 0;
  const trialActivo = esTrial && !trialExpirado;

  let mensaje = 'Elige el plan que mejor se adapte a tu restaurante.';
  if (trialActivo) {
    mensaje = 'Estás en tu período de prueba gratuita. Puedes activar tu plan en cualquier momento.';
  } else if (trialExpirado) {
    mensaje = 'Tu período de prueba ha terminado. Elige un plan para continuar.';
  }

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

  function handleContinuarTrial() {
    navigate('/dashboard');
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <CreditCard className="text-[var(--accent)]" size={24} />
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Planes</h1>
      </div>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">{mensaje}</p>

      {esVitalicio && (
        <p className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-3 text-sm text-[var(--text-secondary)]">
          Tienes acceso gratuito de por vida a Comandia. No necesitas pagar ningún plan.
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3 sm:items-center">
        {PLANES.map((plan) => (
          <TarjetaPlan
            key={plan.id}
            plan={plan}
            trialActivo={trialActivo}
            trialExpirado={trialExpirado}
            esPlanActual={restaurante?.suscripcion_plan === plan.id && restaurante?.suscripcion_activa}
            esVitalicio={esVitalicio}
            procesando={procesando === plan.id}
            onSeleccionar={handleSeleccionar}
            onContinuarTrial={handleContinuarTrial}
          />
        ))}
      </div>
    </div>
  );
}

export default Planes;
