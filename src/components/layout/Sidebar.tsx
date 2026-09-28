import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Package, PackagePlus, PackageMinus,
  BarChart3, AlertTriangle, X, Boxes, Settings, Users, Truck, RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../context/PermissionsContext';
import { supabase } from '../../lib/supabase';
import type { PermisoKey } from '../../lib/permisos';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  adminOnly?: boolean;
  permisoKey?: PermisoKey;
}

const mainNavItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', adminOnly: true },
  { to: '/insumos', icon: Package, label: 'Catálogo de Insumos', permisoKey: 'ver_insumos' },
  { to: '/entradas', icon: PackagePlus, label: 'Entradas', adminOnly: true },
  { to: '/salidas', icon: PackageMinus, label: 'Salidas', permisoKey: 'ver_salidas' },
  { to: '/proveedores', icon: Truck, label: 'Proveedores', adminOnly: true },
  { to: '/rotacion', icon: RefreshCw, label: 'Rotación', adminOnly: true },
  { to: '/reportes', icon: BarChart3, label: 'Reportes' },
];

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { isAdmin, profile } = useAuth();
  const { can } = usePermissions();
  const [solicitudesCount, setSolicitudesCount] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from('stock_solicitudes')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente')
      .then(({ count, error }) => { if (!error) setSolicitudesCount(count ?? 0); });
  }, [isAdmin]);


  const visibleMain = mainNavItems.filter((item) => {
    if (item.adminOnly) return isAdmin;
    if (!isAdmin && item.permisoKey) return can(item.permisoKey);
    return true;
  });

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full w-64 z-30
          flex flex-col transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:flex
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ background: 'linear-gradient(160deg, #1e1b4b 0%, #0f172a 55%, #020617 100%)' }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/40">
              <Boxes size={18} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">InventarioV3</p>
              <p className="text-white/35 text-xs">Sistema de Inventarios</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/35 hover:text-white lg:hidden transition-colors p-1 rounded-lg hover:bg-white/10">
            <X size={17} />
          </button>
        </div>

        {/* Perfil */}
        <div className="px-5 py-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/40 to-violet-600/30 ring-1 ring-indigo-400/30 flex items-center justify-center flex-shrink-0">
              <span className="text-indigo-200 text-sm font-semibold">
                {profile?.nombre?.charAt(0).toUpperCase() ?? 'U'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">{profile?.nombre ?? 'Usuario'}</p>
              <p className="text-white/35 text-xs truncate">{profile?.departamento}</p>
            </div>
          </div>
        </div>

        {/* Navigation principal */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <p className="text-white/25 text-xs uppercase font-semibold px-2 mb-3 tracking-widest">Menú</p>
          <ul className="space-y-0.5">
            {visibleMain.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                    ${isActive
                      ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30'
                      : 'text-white/55 hover:text-white hover:bg-white/[0.08] hover:translate-x-0.5'
                    }`
                  }
                >
                  <item.icon size={16} />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Sección ALERTAS — admin */}
        {isAdmin && (
          <div className="px-3 pb-3">
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-2">
              <p className="text-amber-400/70 text-[10px] uppercase font-bold px-2 mb-2 tracking-widest">Alertas</p>
              <ul className="space-y-0.5">
                <li>
                  <NavLink
                    to="/alertas-usuarios"
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150
                      ${isActive
                        ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                        : 'text-amber-200/70 hover:text-white hover:bg-amber-500/30'
                      }`
                    }
                  >
                    <Users size={16} />
                    <span className="flex-1">Alerta Usuarios</span>
                    {solicitudesCount > 0 && (
                      <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-tight">
                        {solicitudesCount > 99 ? '99+' : solicitudesCount}
                      </span>
                    )}
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/alertas"
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150
                      ${isActive
                        ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                        : 'text-amber-200/70 hover:text-white hover:bg-amber-500/30'
                      }`
                    }
                  >
                    <AlertTriangle size={16} />
                    Alertas Stock
                  </NavLink>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Sección ALERTAS — usuario normal */}
        {!isAdmin && (
          <div className="px-3 pb-3">
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-2">
              <p className="text-amber-400/70 text-[10px] uppercase font-bold px-2 mb-2 tracking-widest">Alertas</p>
              <NavLink
                to="/alertas"
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150
                  ${isActive
                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                    : 'text-amber-200/70 hover:text-white hover:bg-amber-500/30'
                  }`
                }
              >
                <AlertTriangle size={16} />
                Alertas Stock
              </NavLink>
            </div>
          </div>
        )}

        {/* Configuración al fondo — solo admin */}
        {isAdmin && (
          <div className="px-3 pb-3 border-t border-white/[0.07] pt-3">
            <NavLink
              to="/configuracion"
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                ${isActive
                  ? 'bg-white/15 text-white'
                  : 'text-white/40 hover:text-white hover:bg-white/[0.08] hover:translate-x-0.5'
                }`
            }
            >
              <Settings size={16} />
              Configuración
            </NavLink>
          </div>
        )}

        <div className="px-5 py-3 border-t border-white/[0.07]">
          <p className="text-white/15 text-xs">v3.0.0 · 2025</p>
        </div>
      </aside>
    </>
  );
}
