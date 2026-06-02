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
    <header className="bg-white border-b border-gray-100 px-4 md:px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
      {/* Left: Hamburger + Title */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <Menu size={20} />
        </button>
        <h1 className="text-gray-800 font-semibold text-lg">{title}</h1>
      </div>

      {/* Right: Notifications + User */}
      <div className="flex items-center gap-2">
        {/* Notificación de rol */}
        {!isAdmin && (
          <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-100">
            Modo: Registro de Salidas
          </span>
        )}

        <button className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors relative">
          <Bell size={18} />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
              <span className="text-white text-sm font-semibold">
                {profile?.nombre?.charAt(0).toUpperCase() ?? 'U'}
              </span>
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-gray-800 leading-tight">{profile?.nombre}</p>
              <p className="text-xs text-gray-400 leading-tight capitalize">{profile?.rol}</p>
            </div>
            <ChevronDown size={14} className="text-gray-400 hidden md:block" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 animate-slide-in z-50">
              <div className="px-4 py-2 border-b border-gray-50">
                <p className="text-sm font-medium text-gray-800">{profile?.nombre}</p>
                <p className="text-xs text-gray-400">{profile?.cargo}</p>
                <p className="text-xs text-gray-400">{profile?.departamento}</p>
              </div>
              <button
                onClick={() => { setShowMenu(false); signOut(); }}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
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
