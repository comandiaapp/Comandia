import { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';

import Spinner from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import { verificarPago } from '../utils/pagos';
import { formatearFecha } from '../utils/fecha';

const PLAN_LABELS = {
  basico: 'Básico',
  profesional: 'Profesional',
  empresarial: 'Empresarial',
};

const INTERVALO_POLLING_MS = 3000;
const MAX_INTENTOS_POLLING = 10; // 10 x 3s = 30s de espera máxima

function Tarjeta({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-8 text-center shadow-xl">
        {children}
      </div>
    </div>
  );
}

function BotonAccion({ to, children }) {
  return (
    <Link
      to={to}
      className="mt-6 inline-block rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
    >
      {children}
    </Link>
  );
}

function PagoExitoso() {
  const [searchParams] = useSearchParams();
  const { refrescarUsuario } = useAuth();
  const [cargando, setCargando] = useState(true);
  const [pago, setPago] = useState(null);
  const [error, setError] = useState(null);
  const intentosRef = useRef(0);

  useEffect(() => {
    let cancelado = false;
    let timeoutId;

    async function verificar() {
      try {
        const params = Object.fromEntries(searchParams.entries());
        const datos = await verificarPago(params);
        if (cancelado) return;

        setPago(datos.pago);
        setCargando(false);

        if (datos.pago?.estado === 'aprobado') {
          await refrescarUsuario();
          return;
        }

        if (datos.pago?.estado === 'pendiente' && intentosRef.current < MAX_INTENTOS_POLLING) {
          intentosRef.current += 1;
          timeoutId = setTimeout(verificar, INTERVALO_POLLING_MS);
        }
      } catch (err) {
        if (cancelado) return;
        setError(err.response?.data?.mensaje || 'No se pudo verificar el pago');
        setCargando(false);
      }
    }

    verificar();

    return () => {
      cancelado = true;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (cargando) {
    return <Spinner />;
  }

  if (error || !pago) {
    return (
      <Tarjeta>
        <XCircle className="mx-auto mb-4 text-[var(--error)]" size={48} />
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">No pudimos verificar tu pago</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{error}</p>
        <BotonAccion to="/planes">Volver a planes</BotonAccion>
      </Tarjeta>
    );
  }

  if (pago.estado === 'aprobado') {
    return (
      <Tarjeta>
        <CheckCircle2 className="mx-auto mb-4 text-[var(--success)]" size={48} />
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">¡Pago exitoso!</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Tu plan {PLAN_LABELS[pago.plan] || pago.plan} está activo.
        </p>
        {pago.periodo_fin && (
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Válido hasta: {formatearFecha(pago.periodo_fin)}</p>
        )}
        <BotonAccion to="/dashboard">Ir al dashboard</BotonAccion>
      </Tarjeta>
    );
  }

  if (pago.estado === 'pendiente') {
    if (intentosRef.current < MAX_INTENTOS_POLLING) {
      return (
        <Tarjeta>
          <Spinner />
          <h1 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">
            Verificando tu pago con Mercado Pago...
          </h1>
        </Tarjeta>
      );
    }

    return (
      <Tarjeta>
        <Clock className="mx-auto mb-4 text-[var(--warning)]" size={48} />
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Tu pago está siendo procesado</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Te notificaremos por email cuando se confirme.
        </p>
        <BotonAccion to="/dashboard">Ir al dashboard</BotonAccion>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta>
      <XCircle className="mx-auto mb-4 text-[var(--error)]" size={48} />
      <h1 className="text-lg font-semibold text-[var(--text-primary)]">El pago no se completó</h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">Puedes intentar de nuevo desde la página de planes.</p>
      <BotonAccion to="/planes">Intentar de nuevo</BotonAccion>
    </Tarjeta>
  );
}

export default PagoExitoso;
