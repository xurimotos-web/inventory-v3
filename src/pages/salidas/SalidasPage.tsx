import { useEffect, useState } from 'react';
import { Plus, Search, Download, PackageMinus, Filter, User, ShieldCheck, Trash2, UserCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Salida } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { formatDate, exportToExcel } from '../../lib/exportExcel';
import SalidaModal from './SalidaModal';
import DeleteSalidaModal from './DeleteSalidaModal';
import { PageLoader } from '../../components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export default function SalidasPage() {
  const { isAdmin, user } = useAuth();
  const [salidas, setSalidas] = useState<Salida[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroDept, setFiltroDept] = useState('todos');
  const [filtroMes, setFiltroMes] = useState<number>(-1);
  const [filtroAnio, setFiltroAnio] = useState<number>(new Date().getFullYear());
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Salida[]>([]);

  useEffect(() => { if (user) load(); }, [isAdmin, user?.id]);

  async function load() {
    let query = supabase
      .from('salidas')
      .select('*, insumo:insumos(nombre, unidad, imagen_url), profile:profiles(nombre, departamento, cargo)')
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      query = query.eq('usuario_id', user!.id);
    }

    const { data } = await query;
    setSalidas(data ?? []);
    setSelectedIds(new Set());
    setLoading(false);
  }

  function handleExport() {
    if (filtered.length === 0) { toast.error('No hay datos para exportar'); return; }
    const rows = filtered.map((s) => {
      const insumo = s.insumo as unknown as { nombre: string; unidad: string; codigo?: string };
      const profile = s.profile as unknown as { nombre: string; departamento: string; cargo: string };
      return {
        Fecha: formatDate(s.created_at),
        Código: insumo?.codigo ?? '—',
        Insumo: insumo?.nombre ?? '—',
        Cantidad: s.cantidad,
        Unidad: insumo?.unidad ?? '—',
        'Entregado a': s.entregado_a ?? '—',
        Área: s.area ?? '—',
        Destino: s.destino ?? '—',
        Usuario: profile?.nombre ?? '—',
        Departamento: s.departamento,
        Cargo: s.cargo,
        Observaciones: s.observaciones ?? '—',
      };
    });
    exportToExcel(rows, `salidas_${new Date().toISOString().slice(0, 10)}`, 'Salidas');
    toast.success('Archivo Excel descargado');
  }

  function openDeleteSelected() {
    const toDeleteList = filtered.filter((s) => selectedIds.has(s.id));
    if (toDeleteList.length === 0) return;
    setToDelete(toDeleteList);
    setDeleteModalOpen(true);
  }

  function openDeleteOne(salida: Salida) {
    setToDelete([salida]);
    setDeleteModalOpen(true);
  }

  function handleDeleted() {
    setSelectedIds(new Set());
    load();
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((s) => s.id)));
    }
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const departamentos = ['todos', ...Array.from(new Set(salidas.map((s) => s.departamento).filter(Boolean)))];

  const filtered = salidas.filter((s) => {
    const insumo = s.insumo as unknown as { nombre: string };
    const profile = s.profile as unknown as { nombre: string };
    const q = search.toLowerCase();
    const matchSearch =
      (insumo?.nombre ?? '').toLowerCase().includes(q) ||
      (profile?.nombre ?? '').toLowerCase().includes(q) ||
      s.departamento.toLowerCase().includes(q) ||
      (s.area ?? '').toLowerCase().includes(q) ||
      (s.destino ?? '').toLowerCase().includes(q) ||
      (s.entregado_a ?? '').toLowerCase().includes(q);
    const matchDept = filtroDept === 'todos' || s.departamento === filtroDept;
    const d = new Date(s.created_at);
    const matchMes = filtroMes === -1 || (d.getMonth() === filtroMes && d.getFullYear() === filtroAnio);
    return matchSearch && matchDept && matchMes;
  });

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < filtered.length;
  const adminColSpan = 9;
  const userColSpan = 6;

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Banner */}
      {isAdmin ? (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
          <ShieldCheck className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-amber-800 font-semibold text-sm">Vista de Administrador</p>
            <p className="text-amber-600 text-xs mt-0.5">
              Estás viendo las salidas registradas por todos los usuarios. Usa los filtros para organizar la información. Solo tú puedes eliminar registros.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
          <PackageMinus className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-blue-800 font-semibold text-sm">Registro de Consumo</p>
            <p className="text-blue-600 text-xs mt-0.5">
              Aquí puedes ver todas tus salidas registradas. Tu nombre, departamento y cargo quedan guardados automáticamente en cada movimiento.
            </p>
          </div>
        </div>
      )}

      {/* Barra de eliminación masiva (solo admin con selección activa) */}
      {isAdmin && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          <Trash2 size={16} className="text-red-500 flex-shrink-0" />
          <span className="text-red-700 text-sm font-medium flex-1">
            {selectedIds.size} registro(s) seleccionado(s)
          </span>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={openDeleteSelected}
            className="flex items-center gap-1.5 text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            <Trash2 size={13} />
            Eliminar seleccionados
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por insumo, usuario, departamento o entregado a..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} className="text-gray-400" />
            <select value={filtroDept} onChange={(e) => setFiltroDept(e.target.value)}
              className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {departamentos.map((d) => <option key={d} value={d}>{d === 'todos' ? 'Todos los depto.' : d}</option>)}
            </select>
            <select value={filtroMes} onChange={(e) => setFiltroMes(Number(e.target.value))}
              className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value={-1}>Todos los meses</option>
              {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select value={filtroAnio} onChange={(e) => setFiltroAnio(Number(e.target.value))}
              className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {[new Date().getFullYear(), new Date().getFullYear()-1, new Date().getFullYear()-2].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
        {isAdmin && (
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">
            <Download size={15} />
            Exportar Excel
          </button>
        )}
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/30 whitespace-nowrap"
        >
          <Plus size={16} />
          Nueva Salida
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
          <p className="text-sm text-gray-500"><strong className="text-gray-800">{filtered.length}</strong> registros</p>
          {isAdmin && filtered.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {isAdmin && (
                  <th className="px-4 py-3.5 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected; }}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                )}
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Fecha</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Insumo</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Cantidad</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Entregado a</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Registrado por</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Departamento</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden xl:table-cell">Observaciones</th>
                {isAdmin && (
                  <th className="px-4 py-3.5 w-10"></th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((salida) => {
                const insumo = salida.insumo as unknown as { nombre: string; unidad: string; imagen_url?: string };
                const profile = salida.profile as unknown as { nombre: string; departamento: string; cargo: string };
                const isSelected = selectedIds.has(salida.id);
                return (
                  <tr
                    key={salida.id}
                    className={`hover:bg-blue-50/20 transition-colors ${isSelected ? 'bg-red-50/40' : ''}`}
                  >
                    {isAdmin && (
                      <td className="px-4 py-3.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(salida.id)}
                          className="rounded border-gray-300 text-red-500 focus:ring-red-400 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{formatDate(salida.created_at)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        {insumo?.imagen_url ? (
                          <img src={insumo.imagen_url} alt="" className="w-8 h-8 rounded-lg object-cover bg-gray-100 flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <PackageMinus size={13} className="text-blue-400" />
                          </div>
                        )}
                        <span className="font-medium text-gray-800">{insumo?.nombre ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-red-600">-{salida.cantidad}</span>
                      <span className="text-gray-400 text-xs ml-1">{insumo?.unidad}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {salida.entregado_a ? (
                        <div className="flex items-center gap-1.5">
                          <UserCheck size={13} className="text-green-500 flex-shrink-0" />
                          <span className="text-gray-700 text-sm">{salida.entregado_a}</span>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          {profile?.nombre ? (
                            <span className="text-blue-700 text-xs font-semibold">{profile.nombre.charAt(0).toUpperCase()}</span>
                          ) : (
                            <User size={12} className="text-blue-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{profile?.nombre ?? '—'}</p>
                          <p className="text-xs text-gray-400 truncate hidden sm:block">{salida.cargo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 hidden lg:table-cell">{salida.departamento}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs hidden xl:table-cell max-w-40 truncate">{salida.observaciones ?? '—'}</td>
                    {isAdmin && (
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => openDeleteOne(salida)}
                          title="Eliminar este registro"
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? adminColSpan : userColSpan} className="px-5 py-14 text-center">
                    <PackageMinus size={32} className="mx-auto text-gray-200 mb-3" />
                    <p className="text-gray-400 text-sm">No hay salidas registradas</p>
                    <button onClick={() => setModalOpen(true)} className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium">
                      Registrar primera salida →
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SalidaModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={load} />
      <DeleteSalidaModal
        open={deleteModalOpen}
        salidas={toDelete}
        onClose={() => { setDeleteModalOpen(false); setToDelete([]); }}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
