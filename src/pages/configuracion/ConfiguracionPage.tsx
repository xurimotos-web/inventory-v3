import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Settings, Tag, Ruler, X, Check, Users, Search, Edit2, UserCheck, UserX, MapPin, Navigation, UserPlus, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Categoria, Unidad, Profile, Area, Destino, Colaborador } from '../../types';
import ImportColaboradoresModal from './ImportColaboradoresModal';
import { useAuth } from '../../context/AuthContext';
import UsuarioModal from '../usuarios/UsuarioModal';
import ConfirmDialog from '../../components/shared/ConfirmDialog';
import { formatDate } from '../../lib/exportExcel';
import toast from 'react-hot-toast';

type Tab = 'categorias' | 'unidades' | 'usuarios' | 'areas' | 'destinos' | 'colaboradores';

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<Tab>('categorias');

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'categorias', label: 'Categorías', icon: Tag },
    { id: 'unidades', label: 'Unidades', icon: Ruler },
    { id: 'usuarios', label: 'Usuarios', icon: Users },
    { id: 'areas', label: 'Áreas', icon: MapPin },
    { id: 'destinos', label: 'Destinos', icon: Navigation },
    { id: 'colaboradores', label: 'Colaboradores', icon: UserPlus },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${tab === t.id ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <t.icon size={15} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'categorias' && <CategoriasPanel />}
          {tab === 'unidades' && <UnidadesPanel />}
          {tab === 'usuarios' && <UsuariosPanel />}
          {tab === 'areas' && <AreasPanel />}
          {tab === 'destinos' && <DestinosPanel />}
          {tab === 'colaboradores' && <ColaboradoresPanel />}
        </div>
      </div>
    </div>
  );
}

/* ───────── CATEGORÍAS ───────── */
function CategoriasPanel() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from('categorias').select('*').order('nombre');
    setCategorias(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startNew() { setEditId(null); setNombre(''); setDescripcion(''); setShowForm(true); }
  function startEdit(c: Categoria) { setEditId(c.id); setNombre(c.nombre); setDescripcion(c.descripcion ?? ''); setShowForm(true); }
  function cancel() { setShowForm(false); setEditId(null); setNombre(''); setDescripcion(''); }

  async function handleSave() {
    if (!nombre.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    const payload = { nombre: nombre.trim(), descripcion: descripcion.trim() || null };
    const { error } = editId
      ? await supabase.from('categorias').update(payload).eq('id', editId)
      : await supabase.from('categorias').insert(payload);
    setSaving(false);
    if (error) { toast.error('Error al guardar'); return; }
    toast.success(editId ? 'Categoría actualizada' : 'Categoría creada');
    cancel(); load();
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta categoría?')) return;
    const { error } = await supabase.from('categorias').delete().eq('id', id);
    if (error) { toast.error('Error al eliminar'); return; }
    toast.success('Categoría eliminada'); load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-800">Categorías de Insumos</p>
          <p className="text-xs text-gray-400 mt-0.5">Organiza tus insumos por categoría</p>
        </div>
        <button onClick={startNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={15} /> Nueva categoría
        </button>
      </div>

      {showForm && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-blue-800">{editId ? 'Editar categoría' : 'Nueva categoría'}</p>
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre *"
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" autoFocus />
          <input type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción (opcional)"
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
          <div className="flex gap-2">
            <button onClick={cancel} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"><X size={14} /> Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60"><Check size={14} /> {saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      )}

      {loading ? <div className="py-8 text-center text-gray-400 text-sm">Cargando...</div> : categorias.length === 0 ? (
        <div className="py-10 text-center"><Tag size={28} className="mx-auto text-gray-200 mb-2" /><p className="text-gray-400 text-sm">No hay categorías aún</p></div>
      ) : (
        <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
          {categorias.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0"><Tag size={14} className="text-blue-600" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{c.nombre}</p>
                {c.descripcion && <p className="text-xs text-gray-400 truncate">{c.descripcion}</p>}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => startEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(c.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────── UNIDADES ───────── */
function UnidadesPanel() {
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [nombre, setNombre] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from('unidades').select('*').order('nombre');
    setUnidades(data ?? []); setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startNew() { setEditId(null); setNombre(''); setShowForm(true); }
  function startEdit(u: Unidad) { setEditId(u.id); setNombre(u.nombre); setShowForm(true); }
  function cancel() { setShowForm(false); setEditId(null); setNombre(''); }

  async function handleSave() {
    if (!nombre.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    const { error } = editId
      ? await supabase.from('unidades').update({ nombre: nombre.trim() }).eq('id', editId)
      : await supabase.from('unidades').insert({ nombre: nombre.trim() });
    setSaving(false);
    if (error) { toast.error(error.code === '23505' ? 'Esa unidad ya existe' : 'Error al guardar'); return; }
    toast.success(editId ? 'Unidad actualizada' : 'Unidad creada');
    cancel(); load();
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta unidad?')) return;
    const { error } = await supabase.from('unidades').delete().eq('id', id);
    if (error) { toast.error('Error al eliminar'); return; }
    toast.success('Unidad eliminada'); load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-800">Unidades de Medida</p>
          <p className="text-xs text-gray-400 mt-0.5">Unidades disponibles al crear insumos</p>
        </div>
        <button onClick={startNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={15} /> Nueva unidad
        </button>
      </div>

      {showForm && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: litro, kg, metro..."
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSave()} />
          <div className="flex gap-2">
            <button onClick={cancel} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"><X size={14} /> Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60"><Check size={14} /> {saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      )}

      {loading ? <div className="py-8 text-center text-gray-400 text-sm">Cargando...</div> : unidades.length === 0 ? (
        <div className="py-10 text-center"><Ruler size={28} className="mx-auto text-gray-200 mb-2" /><p className="text-gray-400 text-sm">No hay unidades aún</p></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {unidades.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-2 px-3 py-2.5 border border-gray-100 rounded-xl hover:border-blue-100 hover:bg-blue-50/20 transition-colors group">
              <div className="flex items-center gap-2 min-w-0">
                <Settings size={12} className="text-gray-300 flex-shrink-0" />
                <span className="text-sm text-gray-700 font-medium truncate">{u.nombre}</span>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={() => startEdit(u)} className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"><Pencil size={12} /></button>
                <button onClick={() => handleDelete(u.id)} className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────── USUARIOS ───────── */
function UsuariosPanel() {
  const { profile: me } = useAuth();
  const [usuarios, setUsuarios] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Profile | null>(null);
  const [toggling, setToggling] = useState(false);

  async function load() {
    const { data } = await supabase.from('profiles').select('*').order('nombre');
    setUsuarios(data ?? []); setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleToggle() {
    if (!toggleTarget) return;
    setToggling(true);
    const { error } = await supabase.from('profiles').update({ activo: !toggleTarget.activo }).eq('id', toggleTarget.id);
    if (error) { toast.error('Error al cambiar el estado'); } else {
      toast.success(toggleTarget.activo ? 'Usuario desactivado' : 'Usuario activado');
      setToggleTarget(null); load();
    }
    setToggling(false);
  }

  const filtered = usuarios.filter((u) =>
    u.nombre.toLowerCase().includes(search.toLowerCase()) ||
    u.departamento.toLowerCase().includes(search.toLowerCase()) ||
    u.cargo.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-semibold text-gray-800">Gestión de Usuarios</p>
          <p className="text-xs text-gray-400 mt-0.5">{usuarios.length} usuarios registrados</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..."
              className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={() => { setSelected(null); setModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus size={15} /> Nuevo usuario
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', count: usuarios.length, color: 'bg-blue-50 text-blue-700' },
          { label: 'Activos', count: usuarios.filter(u => u.activo).length, color: 'bg-green-50 text-green-700' },
          { label: 'Admins', count: usuarios.filter(u => u.rol === 'admin').length, color: 'bg-purple-50 text-purple-700' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl px-4 py-3 ${s.color}`}>
            <p className="text-xl font-bold">{s.count}</p>
            <p className="text-xs font-medium opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? <div className="py-8 text-center text-gray-400 text-sm">Cargando...</div> : (
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Usuario</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Departamento</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Cargo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Rol</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Registrado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((usuario) => (
                  <tr key={usuario.id} className={`hover:bg-gray-50/50 transition-colors ${!usuario.activo ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-700 text-xs font-semibold">{usuario.nombre.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 text-sm truncate">{usuario.nombre}</p>
                          {usuario.id === me?.id && <span className="text-xs text-blue-600">Tú</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm hidden sm:table-cell">{usuario.departamento}</td>
                    <td className="px-4 py-3 text-gray-600 text-sm hidden md:table-cell">{usuario.cargo}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${usuario.rol === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                        {usuario.rol}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">{formatDate(usuario.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${usuario.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${usuario.activo ? 'bg-green-500' : 'bg-red-500'}`} />
                        {usuario.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setSelected(usuario); setModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit2 size={14} />
                        </button>
                        {usuario.id !== me?.id && (
                          <button onClick={() => setToggleTarget(usuario)} className={`p-1.5 rounded-lg transition-colors ${usuario.activo ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}>
                            {usuario.activo ? <UserX size={14} /> : <UserCheck size={14} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">No se encontraron usuarios</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <UsuarioModal open={modalOpen} onClose={() => { setModalOpen(false); setSelected(null); }} onSaved={load} usuario={selected} />
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

/* ───────── ÁREAS ───────── */
function AreasPanel() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [nombre, setNombre] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from('areas').select('*').order('nombre');
    setAreas(data ?? []); setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startNew() { setEditId(null); setNombre(''); setShowForm(true); }
  function startEdit(a: Area) { setEditId(a.id); setNombre(a.nombre); setShowForm(true); }
  function cancel() { setShowForm(false); setEditId(null); setNombre(''); }

  async function handleSave() {
    if (!nombre.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    const { error } = editId
      ? await supabase.from('areas').update({ nombre: nombre.trim() }).eq('id', editId)
      : await supabase.from('areas').insert({ nombre: nombre.trim() });
    setSaving(false);
    if (error) { toast.error(error.code === '23505' ? 'Esa área ya existe' : 'Error al guardar'); return; }
    toast.success(editId ? 'Área actualizada' : 'Área creada');
    cancel(); load();
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta área?')) return;
    const { error } = await supabase.from('areas').delete().eq('id', id);
    if (error) { toast.error('Error al eliminar'); return; }
    toast.success('Área eliminada'); load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-800">Áreas</p>
          <p className="text-xs text-gray-400 mt-0.5">Áreas disponibles al registrar salidas</p>
        </div>
        <button onClick={startNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={15} /> Nueva área
        </button>
      </div>

      {showForm && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Producción, Cocina, Bodega..."
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSave()} />
          <div className="flex gap-2">
            <button onClick={cancel} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"><X size={14} /> Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60"><Check size={14} /> {saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      )}

      {loading ? <div className="py-8 text-center text-gray-400 text-sm">Cargando...</div> : areas.length === 0 ? (
        <div className="py-10 text-center"><MapPin size={28} className="mx-auto text-gray-200 mb-2" /><p className="text-gray-400 text-sm">No hay áreas aún</p></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {areas.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 px-3 py-2.5 border border-gray-100 rounded-xl hover:border-blue-100 hover:bg-blue-50/20 transition-colors group">
              <div className="flex items-center gap-2 min-w-0">
                <MapPin size={12} className="text-gray-300 flex-shrink-0" />
                <span className="text-sm text-gray-700 font-medium truncate">{a.nombre}</span>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={() => startEdit(a)} className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"><Pencil size={12} /></button>
                <button onClick={() => handleDelete(a.id)} className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────── DESTINOS ───────── */
function DestinosPanel() {
  const [destinos, setDestinos] = useState<Destino[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [nombre, setNombre] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from('destinos').select('*').order('nombre');
    setDestinos(data ?? []); setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startNew() { setEditId(null); setNombre(''); setShowForm(true); }
  function startEdit(d: Destino) { setEditId(d.id); setNombre(d.nombre); setShowForm(true); }
  function cancel() { setShowForm(false); setEditId(null); setNombre(''); }

  async function handleSave() {
    if (!nombre.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    const { error } = editId
      ? await supabase.from('destinos').update({ nombre: nombre.trim() }).eq('id', editId)
      : await supabase.from('destinos').insert({ nombre: nombre.trim() });
    setSaving(false);
    if (error) { toast.error(error.code === '23505' ? 'Ese destino ya existe' : 'Error al guardar'); return; }
    toast.success(editId ? 'Destino actualizado' : 'Destino creado');
    cancel(); load();
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este destino?')) return;
    const { error } = await supabase.from('destinos').delete().eq('id', id);
    if (error) { toast.error('Error al eliminar'); return; }
    toast.success('Destino eliminado'); load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-800">Destinos</p>
          <p className="text-xs text-gray-400 mt-0.5">Destinos disponibles al registrar salidas</p>
        </div>
        <button onClick={startNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={15} /> Nuevo destino
        </button>
      </div>

      {showForm && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Proyecto X, Mantenimiento, Ventas..."
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSave()} />
          <div className="flex gap-2">
            <button onClick={cancel} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"><X size={14} /> Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60"><Check size={14} /> {saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      )}

      {loading ? <div className="py-8 text-center text-gray-400 text-sm">Cargando...</div> : destinos.length === 0 ? (
        <div className="py-10 text-center"><Navigation size={28} className="mx-auto text-gray-200 mb-2" /><p className="text-gray-400 text-sm">No hay destinos aún</p></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {destinos.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 px-3 py-2.5 border border-gray-100 rounded-xl hover:border-blue-100 hover:bg-blue-50/20 transition-colors group">
              <div className="flex items-center gap-2 min-w-0">
                <Navigation size={12} className="text-gray-300 flex-shrink-0" />
                <span className="text-sm text-gray-700 font-medium truncate">{d.nombre}</span>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={() => startEdit(d)} className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"><Pencil size={12} /></button>
                <button onClick={() => handleDelete(d.id)} className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────── COLABORADORES ───────── */
function ColaboradoresPanel() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<Colaborador | null>(null);
  const [nombre, setNombre] = useState('');
  const [area, setArea] = useState('');
  const [cargo, setCargo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  async function load() {
    const { data } = await supabase.from('colaboradores').select('*').order('nombre');
    setColaboradores(data ?? []); setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startNew() { setEditTarget(null); setNombre(''); setArea(''); setCargo(''); setShowForm(true); }
  function startEdit(c: Colaborador) { setEditTarget(c); setNombre(c.nombre); setArea(c.area ?? ''); setCargo(c.cargo ?? ''); setShowForm(true); }
  function cancel() { setShowForm(false); setEditTarget(null); setNombre(''); setArea(''); setCargo(''); }

  async function handleSave() {
    if (!nombre.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    const payload = { nombre: nombre.trim(), area: area.trim() || null, cargo: cargo.trim() || null };
    const { error } = editTarget
      ? await supabase.from('colaboradores').update(payload).eq('id', editTarget.id)
      : await supabase.from('colaboradores').insert({ ...payload, activo: true });
    setSaving(false);
    if (error) { toast.error('Error al guardar'); return; }
    toast.success(editTarget ? 'Colaborador actualizado' : 'Colaborador creado');
    cancel(); load();
  }

  async function handleToggle(c: Colaborador) {
    const { error } = await supabase.from('colaboradores').update({ activo: !c.activo }).eq('id', c.id);
    if (error) { toast.error('Error al cambiar el estado'); return; }
    toast.success(c.activo ? 'Colaborador desactivado' : 'Colaborador activado');
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este colaborador?')) return;
    const { error } = await supabase.from('colaboradores').delete().eq('id', id);
    if (error) { toast.error('Error al eliminar'); return; }
    toast.success('Colaborador eliminado'); load();
  }

  const activos = colaboradores.filter((c) => c.activo).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-semibold text-gray-800">Colaboradores</p>
          <p className="text-xs text-gray-400 mt-0.5">{activos} activos de {colaboradores.length} registrados</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">
            <Upload size={15} /> Importar Excel
          </button>
          <button onClick={startNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus size={15} /> Nuevo colaborador
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-blue-800">{editTarget ? 'Editar colaborador' : 'Nuevo colaborador'}</p>
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre completo *"
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <input type="text" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Área (opcional)"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
            <input type="text" value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Cargo (opcional)"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
          </div>
          <div className="flex gap-2">
            <button onClick={cancel} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50"><X size={14} /> Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-60"><Check size={14} /> {saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-gray-400 text-sm">Cargando...</div>
      ) : colaboradores.length === 0 ? (
        <div className="py-10 text-center">
          <UserPlus size={28} className="mx-auto text-gray-200 mb-2" />
          <p className="text-gray-400 text-sm">No hay colaboradores registrados</p>
          <p className="text-gray-300 text-xs mt-1">Agrégalos uno por uno o importa desde Excel</p>
        </div>
      ) : (
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Nombre</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Área</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Cargo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {colaboradores.map((c) => (
                  <tr key={c.id} className={`hover:bg-gray-50/50 transition-colors ${!c.activo ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-green-700 text-xs font-semibold">{c.nombre.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="font-medium text-gray-800">{c.nombre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{c.area ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{c.cargo ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.activo ? 'bg-green-500' : 'bg-red-500'}`} />
                        {c.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => startEdit(c)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleToggle(c)} title={c.activo ? 'Desactivar' : 'Activar'}
                          className={`p-1.5 rounded-lg transition-colors ${c.activo ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}>
                          {c.activo ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ImportColaboradoresModal open={importOpen} onClose={() => setImportOpen(false)} onSaved={load} />
    </div>
  );
}
