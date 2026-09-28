import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Salida } from '../../types';
import { Building2, Search, Edit2, Trash2, Package, Calendar, CheckCircle2, User } from 'lucide-react';
import { formatDate, formatNumber } from '../../lib/exportExcel';
import toast from 'react-hot-toast';
import Modal from '../../components/shared/Modal';
import { PageLoader } from '../../components/shared/LoadingSpinner';

interface EditForm { entregado_a: string; observaciones: string; }

export default function AsignacionesPage() {
  const [salidas, setSalidas] = useState<Salida[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroDept, setFiltroDept] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState<Salida | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ entregado_a: '', observaciones: '' });
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [filtroAsignador, setFiltroAsignador] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data, error }, { data: profilesData }] = await Promise.all([
      supabase
        .from('salidas')
        .select('*, insumo:insumos(id, nombre, unidad, codigo, imagen_url), profile:profiles(nombre, departamento)')
        .eq('es_asignacion', true)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, nombre'),
    ]);
    if (error) { toast.error('Error al cargar asignaciones: ' + error.message); setLoading(false); return; }
    const map: Record<string, string> = {};
    for (const p of profilesData ?? []) map[p.id] = p.nombre;
    setProfilesMap(map);
    setSalidas((data ?? []) as Salida[]);
    setSelectedIds(new Set());
    setLoading(false);
  }

  async function handleDelete(salida: Salida) {
    if (!confirm('¿Eliminar esta asignación?')) return;
    setDeleting(true);
    const { error } = await supabase.from('salidas').delete().eq('id', salida.id);
    if (error) { toast.error('Error al eliminar: ' + error.message); setDeleting(false); return; }
    toast.success('Asignación eliminada');
    setDeleting(false);
    load();
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`¿Eliminar ${selectedIds.size} asignación(es) seleccionada(s)?`)) return;
    setDeleting(true);
    const toDelete = salidas.filter((s) => selectedIds.has(s.id));
    const { error } = await supabase.from('salidas').delete().in('id', [...selectedIds]);
    if (error) { toast.error('Error al eliminar: ' + error.message); setDeleting(false); return; }
    toast.success(`${toDelete.length} asignaciones eliminadas`);
    setDeleting(false);
    load();
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function toggleSelectAll() {
    if (selectedIds.size === filtered.length && filtered.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((s) => s.id)));
  }
  function openEdit(salida: Salida) {
    setEditTarget(salida);
    setEditForm({ entregado_a: salida.entregado_a ?? '', observaciones: salida.observaciones ?? '' });
  }
  async function handleSave() {
    if (!editTarget) return;
    setSaving(true);
    const { error } = await supabase.from('salidas').update({
      entregado_a: editForm.entregado_a.trim() || null,
      observaciones: editForm.observaciones.trim() || null,
    }).eq('id', editTarget.id);
    setSaving(false);
    if (error) { toast.error('Error al guardar: ' + error.message); return; }
    toast.success('Asignación actualizada');
    setEditTarget(null);
    load();
  }

  const departamentos = [...new Set(salidas.map((s) => s.departamento))].sort();

  const asignadoPorId = (s: Salida) => (s as unknown as { asignado_por?: string }).asignado_por ?? '';
  const asignadoresList = [...new Set(
    salidas.map(s => asignadoPorId(s)).filter(id => id && profilesMap[id])
  )].sort((a, b) => (profilesMap[a] ?? '').localeCompare(profilesMap[b] ?? ''));

  const filtered = salidas.filter((s) => {
    const insumo = s.insumo as unknown as { nombre: string } | undefined;
    const q = search.toLowerCase();
    const receptor = s.profile as unknown as { nombre: string } | undefined;
    const asignadoPorNombre = profilesMap[asignadoPorId(s)] ?? '';
    const matchSearch =
      (insumo?.nombre ?? '').toLowerCase().includes(q) ||
      (s.entregado_a ?? '').toLowerCase().includes(q) ||
      s.departamento.toLowerCase().includes(q) ||
      (receptor?.nombre ?? '').toLowerCase().includes(q) ||
      asignadoPorNombre.toLowerCase().includes(q);
    const matchDept = !filtroDept || s.departamento === filtroDept;
    const matchFecha = !filtroFecha || s.created_at.slice(0, 10) === filtroFecha;
    const matchAsignador = !filtroAsignador || asignadoPorId(s) === filtroAsignador;
    return matchSearch && matchDept && matchFecha && matchAsignador;
  });

  const allSelected = filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id));
  const byDept: Record<string, number> = {};
  for (const s of salidas) byDept[s.departamento] = (byDept[s.departamento] ?? 0) + 1;

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* KPI cards por departamento */}
      {departamentos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <div
            onClick={() => setFiltroDept('')}
            className={`cursor-pointer text-left p-4 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 ${
              !filtroDept
                ? 'bg-gradient-to-br from-indigo-500 to-violet-600 border-transparent shadow-lg shadow-indigo-500/25'
                : 'bg-white border-gray-100 hover:border-indigo-200 hover:shadow-md'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={14} className={!filtroDept ? 'text-white/80' : 'text-indigo-400'} />
              <p className={`text-xs font-semibold truncate ${!filtroDept ? 'text-white/90' : 'text-gray-500'}`}>Todos</p>
            </div>
            <p className={`text-2xl font-bold ${!filtroDept ? 'text-white' : 'text-gray-800'}`}>{salidas.length}</p>
            <p className={`text-xs mt-0.5 ${!filtroDept ? 'text-white/70' : 'text-gray-400'}`}>registros</p>
          </div>
          {departamentos.map((dept) => (
            <div
              key={dept}
              onClick={() => setFiltroDept(filtroDept === dept ? '' : dept)}
              className={`cursor-pointer text-left p-4 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 ${
                filtroDept === dept
                  ? 'bg-gradient-to-br from-indigo-500 to-violet-600 border-transparent shadow-lg shadow-indigo-500/25'
                  : 'bg-white border-gray-100 hover:border-indigo-200 hover:shadow-md'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Building2 size={14} className={filtroDept === dept ? 'text-white/80' : 'text-indigo-400'} />
                <p className={`text-xs font-semibold truncate ${filtroDept === dept ? 'text-white/90' : 'text-gray-500'}`}>{dept}</p>
              </div>
              <p className={`text-2xl font-bold ${filtroDept === dept ? 'text-white' : 'text-gray-800'}`}>{byDept[dept] ?? 0}</p>
              <p className={`text-xs mt-0.5 ${filtroDept === dept ? 'text-white/70' : 'text-gray-400'}`}>registros</p>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por insumo, receptor, entregado a o departamento..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all duration-200"
          />
        </div>
        <select
          value={filtroDept}
          onChange={(e) => setFiltroDept(e.target.value)}
          className="px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
        >
          <option value="">Todos los departamentos</option>
          {departamentos.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        {asignadoresList.length > 0 && (
          <select
            value={filtroAsignador}
            onChange={(e) => setFiltroAsignador(e.target.value)}
            className="px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 cursor-pointer"
          >
            <option value="">Todos los asignadores</option>
            {asignadoresList.map((id) => (
              <option key={id} value={id}>{profilesMap[id]}</option>
            ))}
          </select>
        )}
        <div className="relative">
          <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="date"
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
            className="pl-8 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>
        {(filtroFecha || filtroAsignador) && (
          <button onClick={() => { setFiltroFecha(''); setFiltroAsignador(''); }}
            className="px-3 py-2.5 border border-gray-200 rounded-xl text-xs text-gray-500 hover:bg-gray-50 transition-colors active:scale-95">
            Limpiar filtros
          </button>
        )}
        {selectedIds.size > 0 && (
          <button onClick={handleDeleteSelected} disabled={deleting}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-red-600 text-white rounded-xl text-sm font-medium hover:from-rose-600 hover:to-red-700 transition-all disabled:opacity-60 active:scale-95">
            <Trash2 size={15} />
            Eliminar {selectedIds.size} sel.
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-300">
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
          <p className="text-sm text-gray-500"><strong className="text-gray-800">{filtered.length}</strong> asignaciones</p>
          {filtered.length > 0 && (
            <button onClick={toggleSelectAll} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors">
              {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gradient-to-r from-gray-50/80 to-gray-50/40">
                <th className="px-4 py-3.5 w-10">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                </th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Insumo</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Asignado a</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Cantidad</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Entregado a</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Asignado por</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Fecha</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50/80">
              {filtered.map((salida) => {
                const insumo = salida.insumo as unknown as { nombre: string; unidad: string; codigo?: string; imagen_url?: string } | undefined;
                const receptor = salida.profile as unknown as { nombre: string; departamento: string } | undefined;
                const asignadoPor = profilesMap[(salida as unknown as { asignado_por?: string }).asignado_por ?? ''] ?? null;
                const isSelected = selectedIds.has(salida.id);
                return (
                  <tr key={salida.id}
                    className={`hover:bg-indigo-50/20 transition-colors duration-150 ${isSelected ? 'bg-indigo-50/30' : ''}`}>
                    <td className="px-4 py-3.5">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(salida.id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {insumo?.imagen_url ? (
                          <img src={insumo.imagen_url} alt="" className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100/50 flex items-center justify-center flex-shrink-0">
                            <Package size={14} className="text-indigo-300" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-800">{insumo?.nombre ?? '—'}</p>
                          {insumo?.codigo && <p className="text-xs text-gray-400 font-mono">{insumo.codigo}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-indigo-700 text-xs font-semibold">
                            {receptor?.nombre?.charAt(0)?.toUpperCase() ?? '?'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{receptor?.nombre ?? '—'}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Building2 size={10} className="text-indigo-400" />
                            <p className="text-xs text-gray-400">{salida.departamento}</p>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-50 border border-violet-200/60 rounded-full">
                        <span className="font-bold text-violet-700">{formatNumber(salida.cantidad)}</span>
                        <span className="text-violet-400 text-xs">{insumo?.unidad}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 hidden md:table-cell">{salida.entregado_a ?? <span className="text-gray-300 text-xs">—</span>}</td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      {asignadoPor ? (
                        <div className="flex items-center gap-1.5">
                          <User size={13} className="text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-600">{asignadoPor}</span>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <p className="text-xs text-gray-600 font-medium">{formatDate(salida.created_at)}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(salida.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(salida)}
                          className="p-1.5 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all duration-150 active:scale-90"
                          title="Editar asignación">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(salida)} disabled={deleting}
                          className="p-1.5 text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all duration-150 active:scale-90 disabled:opacity-40"
                          title="Eliminar asignación">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center">
                        <Building2 size={22} className="text-gray-300" />
                      </div>
                      <div>
                        <p className="text-gray-500 font-medium text-sm">
                          {search || filtroDept ? 'No se encontraron resultados' : 'No hay asignaciones registradas'}
                        </p>
                        <p className="text-gray-400 text-xs mt-0.5">Las asignaciones se crean desde el Catálogo de Insumos</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal editar */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Editar Asignación" size="sm">
        {editTarget && (
          <div className="space-y-4">
            <div className="bg-indigo-50 rounded-xl p-3 flex items-center gap-3 border border-indigo-100/60">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Package size={16} className="text-indigo-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-indigo-900">
                  {(editTarget.insumo as unknown as { nombre: string } | undefined)?.nombre ?? '—'}
                </p>
                <p className="text-xs text-indigo-600">
                  {formatNumber(editTarget.cantidad)} {(editTarget.insumo as unknown as { unidad: string } | undefined)?.unidad} → {editTarget.departamento}
                </p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Persona que recibe</label>
              <input
                type="text"
                value={editForm.entregado_a}
                onChange={(e) => setEditForm((f) => ({ ...f, entregado_a: e.target.value }))}
                placeholder="Nombre de quien recibe"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Observaciones</label>
              <textarea
                value={editForm.observaciones}
                onChange={(e) => setEditForm((f) => ({ ...f, observaciones: e.target.value }))}
                rows={3}
                placeholder="Notas sobre esta asignación"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 resize-none transition-all"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditTarget(null)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors active:scale-95">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl text-sm font-medium hover:from-indigo-600 hover:to-violet-700 transition-all disabled:opacity-60 active:scale-95">
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
