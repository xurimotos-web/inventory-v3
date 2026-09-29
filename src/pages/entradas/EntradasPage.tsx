import { useEffect, useState } from 'react';
import { Plus, Search, Download, Upload, PackagePlus, FileText, ExternalLink, TrendingUp, Calendar, ShoppingCart } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Entrada } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../context/PermissionsContext';
import { formatCurrency, formatDate, exportToExcel, formatNumber } from '../../lib/exportExcel';
import EntradaModal from './EntradaModal';
import ImportEntradasModal from './ImportEntradasModal';
import ProductoHistorialModal from '../insumos/ProductoHistorialModal';
import { PageLoader } from '../../components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export default function EntradasPage() {
  const { isAdmin } = useAuth();
  const { can } = usePermissions();
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroMes, setFiltroMes] = useState<number>(-1);
  const [filtroAnio, setFiltroAnio] = useState<number>(new Date().getFullYear());
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [historialInsumoId, setHistorialInsumoId] = useState<number | null>(null);

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
    <div className="space-y-4 animate-fade-in-up">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl p-4 shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <ShoppingCart size={15} className="text-white" />
            </div>
            <span className="text-white/50 text-xs">Total</span>
          </div>
          <p className="text-3xl font-bold text-white">{entradas.length}</p>
          <p className="text-xs text-white/60 mt-0.5">registros en total</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl p-4 shadow-lg shadow-emerald-500/20 hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <TrendingUp size={15} className="text-white" />
            </div>
            <span className="text-white/50 text-xs">Este mes</span>
          </div>
          <p className="text-xl font-bold text-white leading-tight">{formatCurrency(totalMes)}</p>
          <p className="text-xs text-white/60 mt-0.5">compras del mes</p>
        </div>
        <div className="hidden md:block bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-4 shadow-lg shadow-violet-500/20 hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Calendar size={15} className="text-white" />
            </div>
            <span className="text-white/50 text-xs">Hoy</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {entradas.filter((e) => new Date(e.created_at).toDateString() === new Date().toDateString()).length}
          </p>
          <p className="text-xs text-white/60 mt-0.5">entradas registradas hoy</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por insumo, proveedor o factura..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all duration-200" />
        </div>
        <select value={filtroMes} onChange={(e) => setFiltroMes(Number(e.target.value))}
          className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all duration-200 cursor-pointer">
          <option value={-1}>Todos los meses</option>
          {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select value={filtroAnio} onChange={(e) => setFiltroAnio(Number(e.target.value))}
          className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all duration-200 cursor-pointer">
          {[new Date().getFullYear(), new Date().getFullYear()-1, new Date().getFullYear()-2].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        {(isAdmin || can('entradas_exportar')) && (
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-all duration-150 active:scale-95">
            <Download size={15} /> Exportar Excel
          </button>
        )}
        {isAdmin && (
          <button onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-emerald-200 rounded-xl text-emerald-700 text-sm font-medium hover:bg-emerald-50 hover:border-emerald-300 transition-all duration-150 active:scale-95">
            <Upload size={15} /> Importar Excel
          </button>
        )}
        {(isAdmin || can('entradas_crear')) && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-sm font-medium hover:from-emerald-600 hover:to-teal-700 transition-all duration-150 shadow-md shadow-emerald-500/30 hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap"
          >
            <Plus size={16} />
            Nueva Entrada
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gradient-to-r from-gray-50/80 to-gray-50/40">
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Fecha</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Insumo</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Cantidad</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Costo Unit.</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Total</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Proveedor</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Factura</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden xl:table-cell">Registrado por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50/80">
              {filtered.map((entrada) => {
                const insumo = entrada.insumo as unknown as { nombre: string; unidad: string };
                const profile = entrada.profile as unknown as { nombre: string };
                return (
                  <tr key={entrada.id} className="hover:bg-emerald-50/20 transition-colors duration-150 group">
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-gray-700 text-xs font-medium whitespace-nowrap">{formatDate(entrada.created_at)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => setHistorialInsumoId(entrada.insumo_id)}
                        className="flex items-center gap-3 group text-left"
                        title="Ver historial del producto"
                      >
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100/50 flex items-center justify-center flex-shrink-0 group-hover:from-indigo-50 group-hover:to-violet-50 group-hover:border-indigo-200 transition-all">
                          <PackagePlus size={14} className="text-emerald-400 group-hover:text-indigo-500 transition-colors" />
                        </div>
                        <span className="font-semibold text-gray-800 group-hover:text-indigo-600 transition-colors underline-offset-2 group-hover:underline">
                          {insumo?.nombre ?? '—'}
                        </span>
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200/60 rounded-full">
                        <span className="font-bold text-emerald-700">+{formatNumber(entrada.cantidad)}</span>
                        <span className="text-emerald-500 text-xs">{insumo?.unidad}</span>
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-600 hidden md:table-cell">
                      <span className="font-medium">{formatCurrency(entrada.costo_unitario)}</span>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell">
                      <span className="font-semibold text-gray-700">{formatCurrency(entrada.cantidad * entrada.costo_unitario)}</span>
                    </td>
                    <td className="px-5 py-4 text-gray-600 hidden lg:table-cell">
                      {entrada.proveedor ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200/60">
                          {entrada.proveedor}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600 text-sm">{entrada.numero_factura ?? <span className="text-gray-300 text-xs">—</span>}</span>
                        {entrada.factura_url && (
                          <a href={entrada.factura_url} target="_blank" rel="noreferrer"
                            className="text-indigo-500 hover:text-indigo-700 flex items-center gap-0.5 text-xs transition-colors hover:bg-indigo-50 p-1 rounded-lg" title="Ver factura adjunta">
                            <FileText size={13} /><ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-600 hidden xl:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-indigo-700 text-xs font-semibold">{(profile?.nombre ?? '?').charAt(0).toUpperCase()}</span>
                        </div>
                        <span className="text-sm">{profile?.nombre ?? '—'}</span>
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
                        <PackagePlus size={24} className="text-gray-300" />
                      </div>
                      <div>
                        <p className="text-gray-500 font-medium text-sm">No hay entradas registradas</p>
                        <p className="text-gray-400 text-xs mt-0.5">Registra la primera entrada con el botón de arriba</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EntradaModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={load} />
      <ImportEntradasModal open={importOpen} onClose={() => setImportOpen(false)} onImported={load} />
      <ProductoHistorialModal insumoId={historialInsumoId} onClose={() => setHistorialInsumoId(null)} />
    </div>
  );
}
