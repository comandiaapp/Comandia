import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-primary)] px-4 text-center">
      <h1 className="text-6xl font-extrabold text-[var(--accent)]">404</h1>
      <p className="mt-4 text-lg text-[var(--text-primary)]">Esta página no existe.</p>
      <Link
        to="/"
        className="mt-6 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
      >
        Volver al inicio
      </Link>
    </div>
  );
}

export default NotFound;
