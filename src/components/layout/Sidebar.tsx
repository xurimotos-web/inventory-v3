import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Package, PackagePlus, PackageMinus,
  BarChart3, Users, AlertTriangle, X, Boxes,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', adminOnly: true },
  { to: '/insumos', icon: Package, label: 'Catálogo de Insumos' },
  { to: '/entradas', icon: PackagePlus, label: 'Entradas', adminOnly: true },
  { to: '/salidas', icon: PackageMinus, label: 'Salidas' },
  { to: '/alertas', icon: AlertTriangle, label: 'Alertas Stock', adminOnly: true },
  { to: '/reportes', icon: BarChart3, label: 'Reportes', adminOnly: true },
  { to: '/usuarios', icon: Users, label: 'Usuarios', adminOnly: true },
];

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { isAdmin, profile } = useAuth();

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-sidebar-DEFAULT z-30
        flex flex-col transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:flex
        ${open ? 'translate-x-0' : '-translate-x-full'}
      `}
        style={{ backgroundColor: '#0f172a' }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
              <Boxes size={18} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">InventarioV3</p>
              <p className="text-white/40 text-xs">Sistema de Inventarios</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white lg:hidden transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Perfil del usuario */}
        <div className="px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-300 text-sm font-semibold">
                {profile?.nombre?.charAt(0).toUpperCase() ?? 'U'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">{profile?.nombre ?? 'Usuario'}</p>
              <p className="text-white/40 text-xs truncate">{profile?.departamento}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p className="text-white/30 text-xs uppercase font-semibold px-2 mb-3 tracking-wider">Menú</p>
          <ul className="space-y-1">
            {visibleItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                    ${isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <item.icon size={17} />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer version */}
        <div className="px-5 py-3 border-t border-white/10">
          <p className="text-white/20 text-xs">v3.0.0 — 2024</p>
        </div>
      </aside>
    </>
  );
}
