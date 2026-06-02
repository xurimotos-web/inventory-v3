import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Package, Eye, ZoomIn, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Insumo } from '../../types';
import { useAuth } from '../../context/AuthContext';
import StockBadge from '../../components/shared/StockBadge';
import InsumoModal from './InsumoModal';
import ImportInsumosModal from './ImportInsumosModal';
import ConfirmDialog from '../../components/shared/ConfirmDialog';
import { PageLoader } from '../../components/shared/LoadingSpinner';
import Modal from '../../components/shared/Modal';
import ImageLightbox from '../../components/shared/ImageLightbox';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../lib/exportExcel';

export default function InsumosPage() {
  const { isAdmin } = useAuth();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'ok' | 'bajo' | 'agotado'>('todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Insumo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Insumo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewInsumo, setViewInsumo] = useState<Insumo | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase
      .from('insumos')
      .select('*, categoria:categorias(nombre)')
      .eq('activo', true)
      .order('nombre');
    setInsumos(data ?? []);
    setLoading(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('insumos').update({ activo: false }).eq('id', deleteTarget.id);
    if (error) {
      toast.error('Error al eliminar el insumo');
    } else {
      toast.success('Insumo eliminado');
      setDeleteTarget(null);
      load();
    }
    setDeleting(false);
  }

  function openLightbox(src: string, alt: string) {
    setLightbox({ src, alt });
  }

  const filtered = insumos.filter((i) => {
    const q = search.toLowerCase();
    const matchSearch = i.nombre.toLowerCase().includes(q) ||
      (i.descripcion ?? '').toLowerCase().includes(q) ||
      (i.codigo ?? '').toLowerCase().includes(q) ||
      (i.referencia ?? '').toLowerCase().includes(q);
    if (filtroEstado === 'todos') return matchSearch;
    const estado = i.stock_actual <= 0 ? 'agotado' : i.stock_actual <= i.stock_minimo ? 'bajo' : 'ok';
    return matchSearch && estado === filtroEstado;
  });

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, código, referencia..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)}
          className="px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="todos">Todos</option>
          <option value="ok">En stock</option>
          <option value="bajo">Stock bajo</option>
          <option value="agotado">Agotado</option>
        </select>
        {isAdmin && (
          <>
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap"
            >
              <Upload size={15} />
              Importar Excel
            </button>
            <button
              onClick={() => { setSelected(null); setModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/30 whitespace-nowrap"
            >
              <Plus size={16} />
              Nuevo Insumo
            </button>
          </>
        )}
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', count: insumos.length, color: 'bg-blue-50 text-blue-700' },
          { label: 'Stock bajo', count: insumos.filter(i => i.stock_actual > 0 && i.stock_actual <= i.stock_minimo).length, color: 'bg-amber-50 text-amber-700' },
          { label: 'Agotado', count: insumos.filter(i => i.stock_actual <= 0).length, color: 'bg-red-50 text-red-700' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl px-4 py-3 ${s.color}`}>
            <p className="text-xl font-bold">{s.count}</p>
            <p className="text-xs font-medium opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Insumo</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Categoría</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Stock</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Mínimo</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Costo</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Estado</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((insumo) => {
                const cat = insumo.categoria as unknown as { nombre: string };
                return (
                  <tr key={insumo.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {insumo.imagen_url ? (
                          <button
                            onClick={() => openLightbox(insumo.imagen_url!, insumo.nombre)}
                            className="relative w-9 h-9 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 group"
                            title="Ver imagen ampliada"
                          >
                            <img src={insumo.imagen_url} alt="" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                              <ZoomIn size={12} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </button>
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <Package size={14} className="text-blue-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-800">{insumo.nombre}</p>
                          {insumo.codigo && <p className="text-xs text-gray-400 font-mono">{insumo.codigo}</p>}
                          {!insumo.codigo && insumo.descripcion && <p className="text-xs text-gray-400 truncate max-w-48">{insumo.descripcion}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{cat?.nombre ?? '—'}</td>
                    <td className="px-5 py-3.5 font-semibold text-gray-800">{insumo.stock_actual} <span className="font-normal text-gray-400 text-xs">{insumo.unidad}</span></td>
                    <td className="px-5 py-3.5 text-gray-600">{insumo.stock_minimo} {insumo.unidad}</td>
                    <td className="px-5 py-3.5 text-gray-600">{formatCurrency(insumo.costo_unitario)}</td>
                    <td className="px-5 py-3.5"><StockBadge insumo={insumo} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setViewInsumo(insumo)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ver detalle">
                          <Eye size={15} />
                        </button>
                        {insumo.imagen_url && (
                          <button onClick={() => openLightbox(insumo.imagen_url!, insumo.nombre)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Ver foto">
                            <ZoomIn size={15} />
                          </button>
                        )}
                        {isAdmin && (
                          <>
                            <button onClick={() => { setSelected(insumo); setModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                              <Edit2 size={15} />
                            </button>
                            <button onClick={() => setDeleteTarget(insumo)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-gray-400 text-sm">
                    No se encontraron insumos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {filtered.map((insumo) => {
            const cat = insumo.categoria as unknown as { nombre: string };
            return (
              <div key={insumo.id} className="p-4 flex items-center gap-3">
                {insumo.imagen_url ? (
                  <button
                    onClick={() => openLightbox(insumo.imagen_url!, insumo.nombre)}
                    className="relative w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 group"
                  >
                    <img src={insumo.imagen_url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                      <ZoomIn size={14} className="text-white opacity-0 group-hover:opacity-100" />
                    </div>
                  </button>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Package size={18} className="text-blue-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 text-sm">{insumo.nombre}</p>
                  <p className="text-xs text-gray-400">{cat?.nombre ?? 'Sin categoría'}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <StockBadge insumo={insumo} />
                    <span className="text-xs text-gray-500">{insumo.stock_actual} {insumo.unidad}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => setViewInsumo(insumo)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg">
                    <Eye size={16} />
                  </button>
                  {isAdmin && (
                    <button onClick={() => { setSelected(insumo); setModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg">
                      <Edit2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-12 text-center text-gray-400 text-sm">No se encontraron insumos</div>
          )}
        </div>
      </div>

      <ImportInsumosModal open={importOpen} onClose={() => setImportOpen(false)} onSaved={load} />

      <InsumoModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelected(null); }}
        onSaved={load}
        insumo={selected}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar Insumo"
        message={`¿Estás seguro de eliminar "${deleteTarget?.nombre}"? Esta acción no se puede deshacer.`}
        loading={deleting}
      />

      {/* Modal detalle */}
      <Modal open={!!viewInsumo} onClose={() => setViewInsumo(null)} title="Detalle del Insumo" size="md">
        {viewInsumo && (
          <div className="space-y-4">
            {viewInsumo.imagen_url ? (
              <div className="relative rounded-xl overflow-hidden bg-gray-100 h-52 group cursor-zoom-in"
                onClick={() => openLightbox(viewInsumo.imagen_url!, viewInsumo.nombre)}>
                <img src={viewInsumo.imagen_url} alt={viewInsumo.nombre} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-xl px-3 py-2 flex items-center gap-2 text-sm font-medium text-gray-800">
                    <ZoomIn size={16} />
                    Ver en tamaño completo
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-32 rounded-xl bg-gray-50 flex items-center justify-center border-2 border-dashed border-gray-200">
                <div className="text-center">
                  <Package size={28} className="text-gray-300 mx-auto mb-1" />
                  <p className="text-xs text-gray-400">Sin imagen</p>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Nombre', value: viewInsumo.nombre },
                { label: 'Unidad', value: viewInsumo.unidad },
                { label: 'Stock actual', value: `${viewInsumo.stock_actual} ${viewInsumo.unidad}` },
                { label: 'Stock mínimo', value: `${viewInsumo.stock_minimo} ${viewInsumo.unidad}` },
                { label: 'Costo unitario', value: formatCurrency(viewInsumo.costo_unitario) },
                { label: 'Valor total', value: formatCurrency(viewInsumo.stock_actual * viewInsumo.costo_unitario) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 font-medium">{label}</p>
                  <p className="text-gray-800 font-semibold mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            {viewInsumo.descripcion && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 font-medium mb-1">Descripción</p>
                <p className="text-sm text-gray-700">{viewInsumo.descripcion}</p>
              </div>
            )}
            <StockBadge insumo={viewInsumo} />
          </div>
        )}
      </Modal>

      {/* Lightbox */}
      <ImageLightbox
        open={!!lightbox}
        src={lightbox?.src ?? ''}
        alt={lightbox?.alt ?? ''}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}
