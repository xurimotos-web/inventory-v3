import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, UserCheck, UserX } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types';
import { useAuth } from '../../context/AuthContext';
import UsuarioModal from './UsuarioModal';
import ConfirmDialog from '../../components/shared/ConfirmDialog';
import { PageLoader } from '../../components/shared/LoadingSpinner';
import toast from 'react-hot-toast';
import { formatDate } from '../../lib/exportExcel';

export default function UsuariosPage() {
  const { profile: me } = useAuth();
  const [usuarios, setUsuarios] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Profile | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('profiles').select('*').order('nombre');
    setUsuarios(data ?? []);
    setLoading(false);
  }

  async function handleToggle() {
    if (!toggleTarget) return;
    setToggling(true);
    const { error } = await supabase.from('profiles')
      .update({ activo: !toggleTarget.activo })
      .eq('id', toggleTarget.id);
    if (error) {
      toast.error('Error al cambiar el estado del usuario');
    } else {
      toast.success(toggleTarget.activo ? 'Usuario desactivado' : 'Usuario activado');
      setToggleTarget(null);
      load();
    }
    setToggling(false);
  }

  const filtered = usuarios.filter((u) =>
    u.nombre.toLowerCase().includes(search.toLowerCase()) ||
    u.departamento.toLowerCase().includes(search.toLowerCase()) ||
    u.cargo.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar usuario..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all duration-200"
          />
        </div>
        <button
          onClick={() => { setSelected(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl text-sm font-medium hover:from-indigo-600 hover:to-violet-700 transition-all duration-150 shadow-md shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap"
        >
          <Plus size={16} />
          Nuevo Usuario
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total usuarios', count: usuarios.length, bg: 'from-indigo-500 to-blue-600', shadow: 'shadow-indigo-500/20' },
          { label: 'Activos', count: usuarios.filter(u => u.activo).length, bg: 'from-emerald-400 to-teal-500', shadow: 'shadow-emerald-500/20' },
          { label: 'Administradores', count: usuarios.filter(u => u.rol === 'admin').length, bg: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-500/20' },
        ].map((s) => (
          <div key={s.label} className={`bg-gradient-to-br ${s.bg} rounded-xl px-4 py-3 shadow-md ${s.shadow} hover:-translate-y-0.5 transition-all duration-300`}>
            <p className="text-xl font-bold text-white">{s.count}</p>
            <p className="text-xs font-medium text-white/70">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-300">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Usuario</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Departamento</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Cargo</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Rol</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden xl:table-cell">Registrado</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Estado</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((usuario) => (
                <tr key={usuario.id} className={`hover:bg-indigo-50/20 transition-colors duration-150 ${!usuario.activo ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-indigo-700 text-sm font-semibold">{usuario.nombre.charAt(0).toUpperCase()}</span>
                      </div>
                      <p className="font-medium text-gray-800">{usuario.nombre}</p>
                      {usuario.id === me?.id && (
                        <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">Tú</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">{usuario.departamento}</td>
                  <td className="px-5 py-3.5 text-gray-600">{usuario.cargo}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium
                      ${usuario.rol === 'admin' ? 'bg-violet-100 text-violet-700 border border-violet-200/60' : 'bg-gray-100 text-gray-600 border border-gray-200/60'}`}>
                      {usuario.rol}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs hidden xl:table-cell">{formatDate(usuario.created_at)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
                      ${usuario.activo ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-rose-50 text-rose-700 border border-rose-200/60'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${usuario.activo ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {usuario.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => { setSelected(usuario); setModalOpen(true); }}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all duration-150 active:scale-90">
                        <Edit2 size={15} />
                      </button>
                      {usuario.id !== me?.id && (
                        <button onClick={() => setToggleTarget(usuario)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 active:scale-95 ${
                            usuario.activo
                              ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200/60'
                              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200/60'
                          }`}>
                          {usuario.activo ? <><UserX size={13} /> Desactivar</> : <><UserCheck size={13} /> Activar</>}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-400 text-sm">
                    No se encontraron usuarios
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {filtered.map((usuario) => (
            <div key={usuario.id} className={`p-4 flex items-center gap-3 hover:bg-indigo-50/20 transition-colors ${!usuario.activo ? 'opacity-50' : ''}`}>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center flex-shrink-0">
                <span className="text-indigo-700 font-semibold">{usuario.nombre.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 text-sm">{usuario.nombre}</p>
                <p className="text-xs text-gray-400">{usuario.cargo} — {usuario.departamento}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${usuario.rol === 'admin' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'}`}>
                    {usuario.rol}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${usuario.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    {usuario.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <button onClick={() => { setSelected(usuario); setModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg transition-colors active:scale-90">
                  <Edit2 size={16} />
                </button>
                {usuario.id !== me?.id && (
                  <button onClick={() => setToggleTarget(usuario)}
                    className={`p-1.5 rounded-lg transition-colors active:scale-90 ${
                      usuario.activo ? 'text-rose-400 hover:text-rose-600 hover:bg-rose-50' : 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50'
                    }`}>
                    {usuario.activo ? <UserX size={16} /> : <UserCheck size={16} />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <UsuarioModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelected(null); }}
        onSaved={load}
        usuario={selected}
      />

      <ConfirmDialog
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggle}
        title={toggleTarget?.activo ? 'Desactivar Usuario' : 'Activar Usuario'}
        message={`¿Estás seguro de ${toggleTarget?.activo ? 'desactivar' : 'activar'} al usuario "${toggleTarget?.nombre}"?`}
        confirmLabel={toggleTarget?.activo ? 'Desactivar' : 'Activar'}
        loading={toggling}
      />
    </div>
  );
}
