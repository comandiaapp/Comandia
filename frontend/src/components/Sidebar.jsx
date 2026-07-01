import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  UtensilsCrossed,
  Home,
  LayoutGrid,
  ClipboardList,
  ChefHat,
  Package,
  BarChart3,
  Settings,
  LogOut,
  Menu as MenuIcon,
  X,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: Home },
  { to: '/menu', label: 'Menú', icon: UtensilsCrossed },
  { to: '/mesas', label: 'Mesas', icon: LayoutGrid },
  { to: '/pedidos', label: 'Pedidos', icon: ClipboardList },
  { to: '/cocina', label: 'Cocina', icon: ChefHat },
  { to: '/inventario', label: 'Inventario', icon: Package },
  { to: '/reportes', label: 'Reportes', icon: BarChart3 },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
];

function Sidebar() {
  const [abierto, setAbierto] = useState(false);
  const { usuario, restaurante, logout } = useAuth();

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="fixed left-4 top-4 z-30 rounded-lg bg-[#1a1a1a] p-2 text-white md:hidden"
      >
        <MenuIcon size={22} />
      </button>

      {abierto && (
        <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setAbierto(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[#2a2a2a] bg-[#1a1a1a] transition-transform md:static md:translate-x-0 ${
          abierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="text-[#f97316]" size={26} />
            <span className="text-lg font-bold text-white">Comandia</span>
          </div>
          <button type="button" onClick={() => setAbierto(false)} className="text-[#a1a1aa] md:hidden">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setAbierto(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-[#f97316]/10 text-[#f97316]' : 'text-[#a1a1aa] hover:bg-[#2a2a2a] hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-[#2a2a2a] px-4 py-4">
          <p className="truncate text-sm font-semibold text-white">{restaurante?.nombre}</p>
          <p className="truncate text-xs text-[#a1a1aa]">{usuario?.nombre}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#a1a1aa] hover:bg-[#2a2a2a] hover:text-white"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
