import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  UtensilsCrossed,
  Home,
  LayoutGrid,
  ClipboardList,
  ChefHat,
  Package,
  ShoppingCart,
  BarChart3,
  BookOpen,
  Settings,
  CreditCard,
  LogOut,
  Menu as MenuIcon,
  X,
  Sun,
  Moon,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import EstadoConexion from './EstadoConexion';

// La app de escritorio (Tauri) no tiene pestañas de navegador: un target="_blank"
// no abre nada, así que ahí navegamos en la misma ventana con react-router.
const isTauri = typeof window !== 'undefined' && window.__TAURI__ !== undefined;

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: Home },
  { to: '/menu', label: 'Menú', icon: UtensilsCrossed },
  { to: '/mesas', label: 'Mesas', icon: LayoutGrid },
  { to: '/pedidos', label: 'Pedidos', icon: ClipboardList },
  { to: '/cocina', label: 'Cocina', icon: ChefHat },
  { to: '/inventario', label: 'Inventario', icon: Package },
  { to: '/compras', label: 'Compras', icon: ShoppingCart, soloGestor: true },
  { to: '/reportes', label: 'Reportes', icon: BarChart3 },
  { to: '/contaduria', label: 'Contaduría', icon: BookOpen, soloGestor: true },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
  { to: '/planes', label: 'Mi plan', icon: CreditCard, soloAdmin: true },
];

function Sidebar() {
  const [abierto, setAbierto] = useState(false);
  const { usuario, restaurante, logout } = useAuth();
  const { tema, setTema } = useTheme();
  const esGestor = usuario?.rol === 'admin' || usuario?.rol === 'gerente';
  const esAdmin = usuario?.rol === 'admin';
  const itemsVisibles = NAV_ITEMS.filter(
    (item) => (!item.soloGestor || esGestor) && (!item.soloAdmin || esAdmin)
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="fixed left-4 top-4 z-30 rounded-lg bg-[var(--bg-sidebar)] p-2 text-[var(--text-sidebar)] md:hidden"
      >
        <MenuIcon size={22} />
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-30 bg-[var(--overlay)] md:hidden"
          onClick={() => setAbierto(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-[var(--bg-sidebar)] transition-transform md:static md:translate-x-0 ${
          abierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="text-[var(--text-sidebar)]" size={26} />
            <span className="text-lg font-bold text-[var(--text-sidebar)]">Comandia</span>
          </div>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="text-[var(--text-sidebar)] md:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {itemsVisibles.map(({ to, label, icon: Icon }) =>
            to === '/cocina' && !isTauri ? (
              <a
                key={to}
                href={to}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-sidebar)] transition-colors hover:bg-[var(--bg-sidebar-hover)]"
              >
                <Icon size={18} />
                {label}
              </a>
            ) : (
              <NavLink
                key={to}
                to={to}
                onClick={() => setAbierto(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[var(--bg-sidebar-active)] text-[var(--text-sidebar-active)]'
                      : 'text-[var(--text-sidebar)] hover:bg-[var(--bg-sidebar-hover)]'
                  }`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            )
          )}
        </nav>

        <div className="space-y-3 border-t border-[var(--border-sidebar)] px-4 py-4">
          <EstadoConexion />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTema('claro')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                tema === 'claro'
                  ? 'bg-[var(--bg-sidebar-active)] text-[var(--text-sidebar-active)]'
                  : 'bg-[var(--bg-sidebar-hover)] text-[var(--text-sidebar)]'
              }`}
            >
              <Sun size={14} />
              Claro
            </button>
            <button
              type="button"
              onClick={() => setTema('oscuro')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                tema === 'oscuro'
                  ? 'bg-[var(--bg-sidebar-active)] text-[var(--text-sidebar-active)]'
                  : 'bg-[var(--bg-sidebar-hover)] text-[var(--text-sidebar)]'
              }`}
            >
              <Moon size={14} />
              Oscuro
            </button>
          </div>

          <p className="truncate text-sm font-semibold text-[var(--text-sidebar)]">{restaurante?.nombre}</p>
          <p className="truncate text-xs text-[var(--text-sidebar-muted)]">{usuario?.nombre}</p>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--text-sidebar)] transition-colors hover:bg-[var(--bg-sidebar-hover)]"
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
