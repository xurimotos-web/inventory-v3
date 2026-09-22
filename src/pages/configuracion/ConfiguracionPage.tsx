import { useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, Settings, Tag, Ruler, X, Check, Users, Search, Edit2, UserCheck, UserX, Upload, Package, Lock, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Categoria, Unidad, Profile, Area, Destino, Colaborador } from '../../types';
import ImportColaboradoresModal from './ImportColaboradoresModal';
import { useAuth } from '../../context/AuthContext';
import UsuarioModal from '../usuarios/UsuarioModal';
import ConfirmDialog from '../../components/shared/ConfirmDialog';
import { formatDate } from '../../lib/exportExcel';
import toast from 'react-hot-toast';
import { CONFIG_PIN, checkPinSession, setPinSession } from '../../lib/permisos';
import PermisosPanel from './PermisosPanel';

type Tab = 'categorias' | 'unidades' | 'usuarios' | 'areas' | 'destinos' | 'colaboradores' | 'permisos';

/* ── PIN Gate ── */
function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [show, setShow] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  function handleSubmit() {
    if (pin === CONFIG_PIN) {
      setPinSession();
      onUnlock();
    } else {
      setError(true);
      setPin('');
      setTimeout(() => setError(false), 1500);
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center animate-fade-in-up">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-500 to-violet-600 px-8 py-8 flex flex-col items-center gap-3">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${error ? 'bg-rose-500/30 scale-95' : 'bg-white/20'}`}>
              <Lock size={28} className="text-white" />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg">Acceso Restringido</p>
              <p className="text-white/60 text-sm">Ingresa el PIN de administrador</p>
            </div>
          </div>

          <div className="p-8 space-y-4">
            <div className="relative">
              <input
                ref={inputRef}
                type={show ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="● ● ● ● ● ●"
                className={`w-full text-center text-2xl tracking-[0.5em] font-bold py-4 px-4 border-2 rounded-2xl outline-none transition-all duration-200
                  ${error
                    ? 'border-rose-400 bg-rose-50 text-rose-600 animate-shake'
                    : 'border-gray-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10'
                  }`}
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && (
              <p className="text-center text-sm text-rose-500 font-medium">PIN incorrecto. Intenta de nuevo.</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={pin.length < 6}
              className="w-full py-3 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-2xl font-semibold text-sm hover:from-indigo-600 hover:to-violet-700 transition-all shadow-lg shadow-indigo-500/30 disabled:opacity-40 disabled:cursor-not-allowed active:scale-98"
            >
              Ingresar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConfiguracionPage() {
  const [unlocked, setUnlocked] = useState(() => checkPinSession());
  const [tab, setTab] = useState<Tab>('categorias');

  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />;

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'categorias', label: 'Categorías', icon: Tag },
    { id: 'unidades', label: 'Unidades', icon: Ruler },
    { id: 'usuarios', label: 'Usuarios', icon: Users },
    { id: 'areas', label: 'Áreas', icon: Tag },
    { id: 'destinos', label: 'Destinos', icon: Package },
    { id: 'colaboradores', label: 'Colaboradores', icon: Users },
    { id: 'permisos', label: 'Permisos', icon: ShieldCheck },
  ];

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-violet-600 rounded-2xl p-5 shadow-lg shadow-indigo-500/25">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Settings size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-base">Configuración</p>
            <p className="text-white/60 text-xs">Gestiona categorías, unidades, usuarios y más</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-100 overflow-x-auto scrollbar-hide">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium transition-all duration-200 whitespace-nowrap relative flex-shrink-0 ${
                tab === t.id
                  ? t.id === 'permisos' ? 'text-violet-600' : 'text-indigo-600'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50/50'
              }`}
            >
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                tab === t.id
                  ? t.id === 'permisos' ? 'bg-violet-100' : 'bg-indigo-100'
                  : 'bg-gray-100'
              }`}>
                <t.icon size={12} className={tab === t.id ? (t.id === 'permisos' ? 'text-violet-600' : 'text-indigo-600') : 'text-gray-400'} />
              </div>
              {t.label}
              {tab === t.id && (
                <span className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-full ${t.id === 'permisos' ? 'bg-gradient-to-r from-violet-500 to-purple-600' : 'bg-gradient-to-r from-indigo-500 to-violet-600'}`} />
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'categorias' && <CategoriasPanel />}
          {tab === 'unidades' && <UnidadesPanel />}
          {tab === 'usuarios' && <UsuariosPanel />}
          {tab === 'areas' && <AreasPanel />}
          {tab === 'destinos' && <DestinosPanel />}
          {tab === 'colaboradores' && <ColaboradoresPanel />}
          {tab === 'permisos' && <PermisosPanel />}
        </div>
      </div>
    </div>
  );
}

/* ── Estilos compartidos ── */
const inputCls = 'w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all duration-200 bg-white';
const btnPrimary = 'flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl text-sm font-medium hover:from-indigo-600 hover:to-violet-700 transition-all duration-150 disabled:opacity-60 active:scale-95 shadow-sm shadow-indigo-500/20';
const btnSecondary = 'flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 hover:border-gray-300 transition-all duration-150 active:scale-95';
const formBg = 'bg-gradient-to-br from-indigo-50/60 to-violet-50/40 border border-indigo-100/60 rounded-xl p-4 space-y-3';
const chipCls = (active: boolean) =>
  `flex items-center justify-between gap-2 px-3 py-2.5 border rounded-xl transition-all duration-150 group cursor-default ${
    active ? 'border-indigo-100 bg-indigo-50/30' : 'border-gray-100 hover:border-indigo-100 hover:bg-indigo-50/20'
  }`;

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
        <button onClick={startNew} className={btnPrimary}><Plus size={15} /> Nueva categoría</button>
      </div>

      {showForm && (
        <div className={formBg}>
          <p className="text-sm font-semibold text-indigo-800">{editId ? 'Editar categoría' : 'Nueva categoría'}</p>
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre *" className={inputCls} autoFocus />
          <input type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción (opcional)" className={inputCls} />
          <div className="flex gap-2">
            <button onClick={cancel} className={btnSecondary}><X size={14} /> Cancelar</button>
            <button onClick={handleSave} disabled={saving} className={btnPrimary}><Check size={14} /> {saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      )}

      {loading ? <div className="py-8 text-center text-gray-400 text-sm">Cargando...</div> : categorias.length === 0 ? (
        <div className="py-10 text-center"><Tag size={28} className="mx-auto text-gray-200 mb-2" /><p className="text-gray-400 text-sm">No hay categorías aún</p></div>
      ) : (
        <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
          {categorias.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-indigo-50/20 transition-colors duration-150">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center flex-shrink-0">
                <Tag size={14} className="text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{c.nombre}</p>
                {c.descripcion && <p className="text-xs text-gray-400 truncate">{c.descripcion}</p>}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => startEdit(c)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all duration-150 active:scale-90"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(c.id)} className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all duration-150 active:scale-90"><Trash2 size={14} /></button>
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
        <button onClick={startNew} className={btnPrimary}><Plus size={15} /> Nueva unidad</button>
      </div>

      {showForm && (
        <div className={formBg}>
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: litro, kg, metro..."
            className={inputCls} autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSave()} />
          <div className="flex gap-2">
            <button onClick={cancel} className={btnSecondary}><X size={14} /> Cancelar</button>
            <button onClick={handleSave} disabled={saving} className={btnPrimary}><Check size={14} /> {saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      )}

      {loading ? <div className="py-8 text-center text-gray-400 text-sm">Cargando...</div> : unidades.length === 0 ? (
        <div className="py-10 text-center"><Ruler size={28} className="mx-auto text-gray-200 mb-2" /><p className="text-gray-400 text-sm">No hay unidades aún</p></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {unidades.map((u) => (
            <div key={u.id} className={chipCls(false)}>
              <div className="flex items-center gap-2 min-w-0">
                <Settings size={12} className="text-gray-300 flex-shrink-0" />
                <span className="text-sm text-gray-700 font-medium truncate">{u.nombre}</span>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={() => startEdit(u)} className="p-1 text-gray-400 hover:text-indigo-600 rounded transition-colors active:scale-90"><Pencil size={12} /></button>
                <button onClick={() => handleDelete(u.id)} className="p-1 text-gray-400 hover:text-rose-600 rounded transition-colors active:scale-90"><Trash2 size={12} /></button>
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
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..."
              className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all" />
          </div>
          <button onClick={() => { setSelected(null); setModalOpen(true); }} className={btnPrimary}>
            <Plus size={15} /> Nuevo usuario
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', count: usuarios.length, bg: 'from-indigo-500 to-blue-600', shadow: 'shadow-indigo-500/20' },
          { label: 'Activos', count: usuarios.filter(u => u.activo).length, bg: 'from-emerald-400 to-teal-500', shadow: 'shadow-emerald-500/20' },
          { label: 'Admins', count: usuarios.filter(u => u.rol === 'admin').length, bg: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-500/20' },
        ].map((s) => (
          <div key={s.label} className={`bg-gradient-to-br ${s.bg} rounded-xl px-4 py-3 shadow-md ${s.shadow}`}>
            <p className="text-xl font-bold text-white">{s.count}</p>
            <p className="text-xs font-medium text-white/70">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? <div className="py-8 text-center text-gray-400 text-sm">Cargando...</div> : (
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
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
                  <tr key={usuario.id} className={`hover:bg-indigo-50/20 transition-colors duration-150 ${!usuario.activo ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-indigo-700 text-xs font-semibold">{usuario.nombre.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 text-sm truncate">{usuario.nombre}</p>
                          {usuario.id === me?.id && <span className="text-xs text-indigo-600">Tú</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm hidden sm:table-cell">{usuario.departamento}</td>
                    <td className="px-4 py-3 text-gray-600 text-sm hidden md:table-cell">{usuario.cargo}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${usuario.rol === 'admin' ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'}`}>
                        {usuario.rol}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">{formatDate(usuario.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${usuario.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${usuario.activo ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {usuario.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setSelected(usuario); setModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all active:scale-90">
                          <Edit2 size={14} />
                        </button>
                        {usuario.id !== me?.id && (
                          <button onClick={() => setToggleTarget(usuario)} className={`p-1.5 rounded-lg transition-all active:scale-90 ${usuario.activo ? 'text-gray-400 hover:text-rose-600 hover:bg-rose-50' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`}>
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
        <button onClick={startNew} className={btnPrimary}><Plus size={15} /> Nueva área</button>
      </div>

      {showForm && (
        <div className={formBg}>
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Producción, Cocina, Bodega..."
            className={inputCls} autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSave()} />
          <div className="flex gap-2">
            <button onClick={cancel} className={btnSecondary}><X size={14} /> Cancelar</button>
            <button onClick={handleSave} disabled={saving} className={btnPrimary}><Check size={14} /> {saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      )}

      {loading ? <div className="py-8 text-center text-gray-400 text-sm">Cargando...</div> : areas.length === 0 ? (
        <div className="py-10 text-center"><Tag size={28} className="mx-auto text-gray-200 mb-2" /><p className="text-gray-400 text-sm">No hay áreas aún</p></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {areas.map((a) => (
            <div key={a.id} className={chipCls(false)}>
              <div className="flex items-center gap-2 min-w-0">
                <Tag size={12} className="text-indigo-300 flex-shrink-0" />
                <span className="text-sm text-gray-700 font-medium truncate">{a.nombre}</span>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={() => startEdit(a)} className="p-1 text-gray-400 hover:text-indigo-600 rounded transition-colors active:scale-90"><Pencil size={12} /></button>
                <button onClick={() => handleDelete(a.id)} className="p-1 text-gray-400 hover:text-rose-600 rounded transition-colors active:scale-90"><Trash2 size={12} /></button>
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
        <button onClick={startNew} className={btnPrimary}><Plus size={15} /> Nuevo destino</button>
      </div>

      {showForm && (
        <div className={formBg}>
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Proyecto X, Mantenimiento, Ventas..."
            className={inputCls} autoFocus onKeyDown={(e) => e.key === 'Enter' && handleSave()} />
          <div className="flex gap-2">
            <button onClick={cancel} className={btnSecondary}><X size={14} /> Cancelar</button>
            <button onClick={handleSave} disabled={saving} className={btnPrimary}><Check size={14} /> {saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      )}

      {loading ? <div className="py-8 text-center text-gray-400 text-sm">Cargando...</div> : destinos.length === 0 ? (
        <div className="py-10 text-center"><Package size={28} className="mx-auto text-gray-200 mb-2" /><p className="text-gray-400 text-sm">No hay destinos aún</p></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {destinos.map((d) => (
            <div key={d.id} className={chipCls(false)}>
              <div className="flex items-center gap-2 min-w-0">
                <Package size={12} className="text-violet-300 flex-shrink-0" />
                <span className="text-sm text-gray-700 font-medium truncate">{d.nombre}</span>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={() => startEdit(d)} className="p-1 text-gray-400 hover:text-indigo-600 rounded transition-colors active:scale-90"><Pencil size={12} /></button>
                <button onClick={() => handleDelete(d.id)} className="p-1 text-gray-400 hover:text-rose-600 rounded transition-colors active:scale-90"><Trash2 size={12} /></button>
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
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-600 text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-all duration-150 active:scale-95">
            <Upload size={15} /> Importar Excel
          </button>
          <button onClick={startNew} className={btnPrimary}>
            <Plus size={15} /> Nuevo colaborador
          </button>
        </div>
      </div>

      {showForm && (
        <div className={formBg}>
          <p className="text-sm font-semibold text-indigo-800">{editTarget ? 'Editar colaborador' : 'Nuevo colaborador'}</p>
          <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre completo *" className={inputCls} autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <input type="text" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Área (opcional)" className={inputCls} />
            <input type="text" value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Cargo (opcional)" className={inputCls} />
          </div>
          <div className="flex gap-2">
            <button onClick={cancel} className={btnSecondary}><X size={14} /> Cancelar</button>
            <button onClick={handleSave} disabled={saving} className={btnPrimary}><Check size={14} /> {saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-gray-400 text-sm">Cargando...</div>
      ) : colaboradores.length === 0 ? (
        <div className="py-10 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
            <Users size={24} className="text-gray-300" />
          </div>
          <p className="text-gray-400 text-sm">No hay colaboradores registrados</p>
          <p className="text-gray-300 text-xs mt-1">Agrégalos uno por uno o importa desde Excel</p>
        </div>
      ) : (
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Nombre</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden sm:table-cell">Área</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Cargo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {colaboradores.map((c) => (
                  <tr key={c.id} className={`hover:bg-indigo-50/20 transition-colors duration-150 ${!c.activo ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-emerald-700 text-xs font-semibold">{c.nombre.charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="font-medium text-gray-800">{c.nombre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{c.area ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{c.cargo ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.activo ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {c.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => startEdit(c)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all active:scale-90">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleToggle(c)}
                          className={`p-1.5 rounded-lg transition-all active:scale-90 ${c.activo ? 'text-gray-400 hover:text-rose-600 hover:bg-rose-50' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`}>
                          {c.activo ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all active:scale-90">
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
