import { useAuth } from '../context/AuthContext';

function saludoSegunHora() {
  const hora = new Date().getHours();
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const TARJETAS = [
  { titulo: 'Ventas hoy', valor: '$0' },
  { titulo: 'Pedidos activos', valor: '0' },
  { titulo: 'Mesas ocupadas', valor: '0/0' },
  { titulo: 'Producto más vendido', valor: '-' },
];

function Dashboard() {
  const { usuario } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">
        {saludoSegunHora()}, {usuario?.nombre?.split(' ')[0] || ''}
      </h1>
      <p className="mt-1 text-sm text-[#a1a1aa]">Este es el resumen de tu restaurante hoy.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TARJETAS.map((tarjeta) => (
          <div key={tarjeta.titulo} className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-5">
            <p className="text-sm text-[#a1a1aa]">{tarjeta.titulo}</p>
            <p className="mt-2 text-2xl font-bold text-white">{tarjeta.valor}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <h2 className="text-lg font-semibold text-white">Jornada actual</h2>
        <p className="mt-1 text-sm text-[#a1a1aa]">No hay una jornada abierta.</p>
        <button
          type="button"
          className="mt-4 rounded-lg bg-[#f97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ea6a0d]"
        >
          Abrir jornada
        </button>
      </div>
    </div>
  );
}

export default Dashboard;
