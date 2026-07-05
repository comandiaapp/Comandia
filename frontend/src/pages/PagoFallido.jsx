import { Link } from 'react-router-dom';
import { XCircle } from 'lucide-react';

function PagoFallido() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-8 text-center shadow-xl">
        <XCircle className="mx-auto mb-4 text-[var(--error)]" size={48} />
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">El pago no se completó</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          No se pudo procesar tu pago en Mercado Pago. Puedes intentarlo de nuevo cuando quieras.
        </p>
        <Link
          to="/planes"
          className="mt-6 inline-block rounded-lg bg-[var(--accent)] px-4 py-2 font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
        >
          Intentar de nuevo
        </Link>
      </div>
    </div>
  );
}

export default PagoFallido;
