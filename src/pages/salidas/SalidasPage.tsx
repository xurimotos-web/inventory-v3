import { useEffect, useState } from 'react';
import { Plus, Search, Download, PackageMinus, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Salida } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { formatDate, exportToExcel } from '../../lib/exportExcel';
import SalidaModal from './SalidaModal';
import { PageLoader } from '../../components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

export default function SalidasPage() {
  const { isAdmin, user } = useAuth();
  const [salidas, setSalidas] = useState<Salida[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroDept, setFiltroDept] = useState('todos');
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    let query = supabase
      .from('salidas')
      .select('*, insumo:insumos(nombre, unidad), profile:profiles(nombre, departamento, cargo)')
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      query = query.eq('usuario_id', user!.id);
    }

    const { data } = await query;
    setSalidas(data ?? []);
    setLoading(false);
  }

  function handleExport() {
    if (filtered.length === 0) { toast.error('No hay datos para exportar'); return; }
    const rows = filtered.map((s) => {
      const insumo = s.insumo as unknown as { nombre: string; unidad: string };
      const profile = s.profile as unknown as { nombre: string; departamento: string; cargo: string };
      return {
        Fecha: formatDate(s.created_at),
        Insumo: insumo?.nombre ?? '—',
        Cantidad: s.cantidad,
        Unidad: insumo?.unidad ?? '—',
        Usuario: profile?.nombre ?? '—',
        Departamento: s.departamento,
        Cargo: s.cargo,
        Observaciones: s.observaciones ?? '—',
      };
    });
    exportToExcel(rows, `salidas_${new Date().toISOString().slice(0, 10)}`, 'Salidas');
    toast.success('Archivo Excel descargado');
  }

  const departamentos = ['todos', ...Array.from(new Set(salidas.map((s) => s.departamento).filter(Boolean)))];

  const filtered = salidas.filter((s) => {
    const insumo = s.insumo as unknown as { nombre: string };
    const profile = s.profile as unknown as { nombre: string };
    const matchSearch =
      (insumo?.nombre ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (profile?.nombre ?? '').toLowerCase().includes(search.toLowerCase()) ||
      s.departamento.toLowerCase().includes(search.toLowerCase());
    const matchDept = filtroDept === 'todos' || s.departamento === filtroDept;
    return matchSearch && matchDept;
  });

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Banner para usuario no admin */}
      {!isAdmin && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
          <PackageMinus className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-blue-800 font-semibold text-sm">Registro de Consumo</p>
            <p className="text-blue-600 text-xs mt-0.5">Aquí puedes registrar los insumos que retiras del almacén. Tu nombre, departamento y cargo se registran automáticamente.</p>
          </div>
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
            placeholder="Buscar por insumo, usuario o departamento..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <select
              value={filtroDept}
              onChange={(e) => setFiltroDept(e.target.value)}
              className="px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {departamentos.map((d) => (
                <option key={d} value={d}>{d === 'todos' ? 'Todos los depto.' : d}</option>
              ))}
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
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Fecha</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Insumo</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Cantidad</th>
                {isAdmin && <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Usuario</th>}
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Departamento</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden xl:table-cell">Cargo</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden xl:table-cell">Observaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((salida) => {
                const insumo = salida.insumo as unknown as { nombre: string; unidad: string };
                const profile = salida.profile as unknown as { nombre: string };
                return (
                  <tr key={salida.id} className="hover:bg-blue-50/20 transition-colors">
                    <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{formatDate(salida.created_at)}</td>
                    <td className="px-5 py-3.5 font-medium text-gray-800">{insumo?.nombre ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-red-600">-{salida.cantidad}</span>
                      <span className="text-gray-400 text-xs ml-1">{insumo?.unidad}</span>
                    </td>
                    {isAdmin && <td className="px-5 py-3.5 text-gray-600 hidden md:table-cell">{profile?.nombre ?? '—'}</td>}
                    <td className="px-5 py-3.5 text-gray-600 hidden lg:table-cell">{salida.departamento}</td>
                    <td className="px-5 py-3.5 text-gray-600 hidden xl:table-cell">{salida.cargo}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs hidden xl:table-cell max-w-40 truncate">{salida.observaciones ?? '—'}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center">
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
    </div>
  );
}
