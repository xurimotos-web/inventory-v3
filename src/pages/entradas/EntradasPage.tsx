import { useEffect, useState } from 'react';
import { Plus, Search, Download, PackagePlus, FileText, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Entrada } from '../../types';
import { formatCurrency, formatDate, exportToExcel } from '../../lib/exportExcel';
import EntradaModal from './EntradaModal';
import { PageLoader } from '../../components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export default function EntradasPage() {
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroMes, setFiltroMes] = useState<number>(-1);
  const [filtroAnio, setFiltroAnio] = useState<number>(new Date().getFullYear());
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase
      .from('entradas')
      .select('*, insumo:insumos(nombre, unidad), profile:profiles(nombre)')
      .order('created_at', { ascending: false });
    setEntradas(data ?? []);
    setLoading(false);
  }

  function handleExport() {
    if (filtered.length === 0) { toast.error('No hay datos para exportar'); return; }
    const rows = filtered.map((e) => {
      const insumo = e.insumo as unknown as { nombre: string; unidad: string };
      const profile = e.profile as unknown as { nombre: string };
      return {
        Fecha: formatDate(e.created_at),
        Insumo: insumo?.nombre ?? '—',
        Cantidad: e.cantidad,
        Unidad: insumo?.unidad ?? '—',
        'Costo Unitario': e.costo_unitario,
        'Costo Total': e.cantidad * e.costo_unitario,
        Proveedor: e.proveedor ?? '—',
        Factura: e.numero_factura ?? '—',
        'Registrado por': profile?.nombre ?? '—',
        Observaciones: e.observaciones ?? '—',
      };
    });
    exportToExcel(rows, `entradas_${new Date().toISOString().slice(0, 10)}`, 'Entradas');
    toast.success('Archivo Excel descargado');
  }

  const filtered = entradas.filter((e) => {
    const insumo = e.insumo as unknown as { nombre: string };
    const q = search.toLowerCase();
    const matchSearch = (insumo?.nombre ?? '').toLowerCase().includes(q) ||
      (e.proveedor ?? '').toLowerCase().includes(q) ||
      (e.numero_factura ?? '').toLowerCase().includes(q);
    const d = new Date(e.created_at);
    const matchMes = filtroMes === -1 || (d.getMonth() === filtroMes && d.getFullYear() === filtroAnio);
    return matchSearch && matchMes;
  });

  const totalMes = entradas.filter((e) => {
    const d = new Date(e.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((acc, e) => acc + e.cantidad * e.costo_unitario, 0);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-400 font-medium">Total registros</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{entradas.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-400 font-medium">Compras este mes</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(totalMes)}</p>
        </div>
        <div className="hidden md:block bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs text-gray-400 font-medium">Entradas hoy</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">
            {entradas.filter((e) => new Date(e.created_at).toDateString() === new Date().toDateString()).length}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por insumo, proveedor o factura..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {/* Filtro mes */}
        <select value={filtroMes} onChange={(e) => setFiltroMes(Number(e.target.value))}
          className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value={-1}>Todos los meses</option>
          {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select value={filtroAnio} onChange={(e) => setFiltroAnio(Number(e.target.value))}
          className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {[new Date().getFullYear(), new Date().getFullYear()-1, new Date().getFullYear()-2].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">
          <Download size={15} /> Exportar Excel
        </button>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors shadow-sm shadow-green-600/30"
        >
          <Plus size={16} />
          Nueva Entrada
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Fecha</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Insumo</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide">Cantidad</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Costo Unit.</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Proveedor</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Factura</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden xl:table-cell">Registrado por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((entrada) => {
                const insumo = entrada.insumo as unknown as { nombre: string; unidad: string };
                const profile = entrada.profile as unknown as { nombre: string };
                return (
                  <tr key={entrada.id} className="hover:bg-green-50/20 transition-colors">
                    <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{formatDate(entrada.created_at)}</td>
                    <td className="px-5 py-3.5 font-medium text-gray-800">{insumo?.nombre ?? '—'}</td>
                    <td className="px-5 py-3.5 text-gray-700">
                      <span className="font-semibold text-green-700">+{entrada.cantidad}</span>
                      <span className="text-gray-400 text-xs ml-1">{insumo?.unidad}</span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 hidden md:table-cell">{formatCurrency(entrada.costo_unitario)}</td>
                    <td className="px-5 py-3.5 text-gray-600 hidden lg:table-cell">{entrada.proveedor ?? '—'}</td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">{entrada.numero_factura ?? '—'}</span>
                        {entrada.factura_url && (
                          <a href={entrada.factura_url} target="_blank" rel="noreferrer"
                            className="text-blue-500 hover:text-blue-700 flex items-center gap-0.5 text-xs" title="Ver factura adjunta">
                            <FileText size={13} /><ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 hidden xl:table-cell">{profile?.nombre ?? '—'}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center">
                    <PackagePlus size={32} className="mx-auto text-gray-200 mb-3" />
                    <p className="text-gray-400 text-sm">No hay entradas registradas</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EntradaModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={load} />
    </div>
  );
}
