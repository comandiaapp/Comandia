import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0f0f0f] px-4 text-center">
      <h1 className="text-6xl font-extrabold text-[#f97316]">404</h1>
      <p className="mt-4 text-lg text-white">Esta página no existe.</p>
      <Link
        to="/"
        className="mt-6 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea6a0d]"
      >
        Volver al inicio
      </Link>
    </div>
  );
}

export default NotFound;
