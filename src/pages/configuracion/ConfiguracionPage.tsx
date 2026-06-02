import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Settings, Tag, Ruler, X, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Categoria, Unidad } from '../../types';
import toast from 'react-hot-toast';

type Tab = 'categorias' | 'unidades';

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<Tab>('categorias');

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setTab('categorias')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${tab === 'categorias' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Tag size={15} />
            Categorías
          </button>
          <button
            onClick={() => setTab('unidades')}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors ${tab === 'unidades' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/30' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Ruler size={15} />
            Unidades de Medida
          </button>
        </div>

        <div className="p-5">
          {tab === 'categorias' ? <CategoriasPanel /> : <UnidadesPanel />}
        </div>
      </div>
    </div>
  );
}

/* ───────────── CATEGORÍAS ───────────── */
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

  function startNew() {
    setEditId(null);
    setNombre('');
    setDescripcion('');
    setShowForm(true);
  }

  function startEdit(c: Categoria) {
    setEditId(c.id);
    setNombre(c.nombre);
    setDescripcion(c.descripcion ?? '');
    setShowForm(true);
  }

  function cancel() {
    setShowForm(false);
    setEditId(null);
    setNombre('');
    setDescripcion('');
  }

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
    cancel();
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta categoría? Los insumos asociados quedarán sin categoría.')) return;
    const { error } = await supabase.from('categorias').delete().eq('id', id);
    if (error) { toast.error('Error al eliminar'); return; }
    toast.success('Categoría eliminada');
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-800">Categorías de Insumos</p>
          <p className="text-xs text-gray-400 mt-0.5">Organiza tus insumos por categoría</p>
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={15} />
          Nueva categoría
        </button>
      </div>

      {showForm && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-blue-800">{editId ? 'Editar categoría' : 'Nueva categoría'}</p>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre de la categoría *"
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            autoFocus
          />
          <input
            type="text"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Descripción (opcional)"
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          <div className="flex gap-2">
            <button onClick={cancel} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <X size={14} /> Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60">
              <Check size={14} /> {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-gray-400 text-sm">Cargando...</div>
      ) : categorias.length === 0 ? (
        <div className="py-10 text-center">
          <Tag size={28} className="mx-auto text-gray-200 mb-2" />
          <p className="text-gray-400 text-sm">No hay categorías. ¡Crea la primera!</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-50 border border-gray-100 rounded-xl overflow-hidden">
          {categorias.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Tag size={14} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{c.nombre}</p>
                {c.descripcion && <p className="text-xs text-gray-400 truncate">{c.descripcion}</p>}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => startEdit(c)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Editar"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Eliminar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────── UNIDADES ───────────── */
function UnidadesPanel() {
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [nombre, setNombre] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from('unidades').select('*').order('nombre');
    setUnidades(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function startNew() {
    setEditId(null);
    setNombre('');
    setShowForm(true);
  }

  function startEdit(u: Unidad) {
    setEditId(u.id);
    setNombre(u.nombre);
    setShowForm(true);
  }

  function cancel() {
    setShowForm(false);
    setEditId(null);
    setNombre('');
  }

  async function handleSave() {
    if (!nombre.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    const payload = { nombre: nombre.trim() };
    const { error } = editId
      ? await supabase.from('unidades').update(payload).eq('id', editId)
      : await supabase.from('unidades').insert(payload);
    setSaving(false);
    if (error) { toast.error(error.code === '23505' ? 'Esa unidad ya existe' : 'Error al guardar'); return; }
    toast.success(editId ? 'Unidad actualizada' : 'Unidad creada');
    cancel();
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar esta unidad de medida?')) return;
    const { error } = await supabase.from('unidades').delete().eq('id', id);
    if (error) { toast.error('Error al eliminar'); return; }
    toast.success('Unidad eliminada');
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-800">Unidades de Medida</p>
          <p className="text-xs text-gray-400 mt-0.5">Unidades disponibles al crear insumos</p>
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={15} />
          Nueva unidad
        </button>
      </div>

      {showForm && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-blue-800">{editId ? 'Editar unidad' : 'Nueva unidad'}</p>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: litro, kg, metro, caja..."
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <div className="flex gap-2">
            <button onClick={cancel} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <X size={14} /> Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60">
              <Check size={14} /> {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-gray-400 text-sm">Cargando...</div>
      ) : unidades.length === 0 ? (
        <div className="py-10 text-center">
          <Ruler size={28} className="mx-auto text-gray-200 mb-2" />
          <p className="text-gray-400 text-sm">No hay unidades. ¡Agrega la primera!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {unidades.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-2 px-3 py-2.5 border border-gray-100 rounded-xl hover:border-blue-100 hover:bg-blue-50/20 transition-colors group">
              <div className="flex items-center gap-2 min-w-0">
                <Settings size={12} className="text-gray-300 flex-shrink-0" />
                <span className="text-sm text-gray-700 font-medium truncate">{u.nombre}</span>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button
                  onClick={() => startEdit(u)}
                  className="p-1 text-gray-400 hover:text-blue-600 rounded transition-colors"
                  title="Editar"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => handleDelete(u.id)}
                  className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                  title="Eliminar"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
