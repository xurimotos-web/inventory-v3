import { Menu, Bell, LogOut, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  onMenuClick: () => void;
  title: string;
}

export default function Header({ onMenuClick, title }: HeaderProps) {
  const { profile, signOut, isAdmin } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-gray-100/80 px-4 md:px-6 py-3.5 flex items-center justify-between sticky top-0 z-10 shadow-[0_1px_12px_rgba(0,0,0,0.06)]">
      {/* Left: Hamburger + Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all duration-150 active:scale-95"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-gray-800 font-semibold text-lg tracking-tight">{title}</h1>
      </div>

      {/* Right: Notifications + User */}
      <div className="flex items-center gap-2">
        {/* Notificación de rol */}
        {!isAdmin && (
          <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full border border-indigo-100">
            Modo: Registro de Salidas
          </span>
        )}

        <button className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all duration-150 relative active:scale-95">
          <Bell size={18} />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-gray-100 transition-all duration-150 active:scale-95"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm shadow-indigo-500/30">
              <span className="text-white text-sm font-semibold">
                {profile?.nombre?.charAt(0).toUpperCase() ?? 'U'}
              </span>
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-gray-800 leading-tight">{profile?.nombre}</p>
              <p className="text-xs text-gray-400 leading-tight capitalize">{profile?.rol}</p>
            </div>
            <ChevronDown size={14} className={`text-gray-400 hidden md:block transition-transform duration-200 ${showMenu ? 'rotate-180' : ''}`} />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-2xl shadow-xl shadow-black/10 border border-gray-100 py-1.5 animate-scale-in z-50">
              <div className="px-4 py-2.5 border-b border-gray-50">
                <p className="text-sm font-semibold text-gray-800">{profile?.nombre}</p>
                <p className="text-xs text-gray-400 mt-0.5">{profile?.cargo}</p>
                <p className="text-xs text-gray-400">{profile?.departamento}</p>
              </div>
              <button
                onClick={() => { setShowMenu(false); signOut(); }}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-colors rounded-b-2xl"
              >
                <LogOut size={14} />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
