import { useEffect, useState } from 'react';
import { RefreshCw, Search, Package, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Insumo } from '../../types';
import { formatNumber, formatCurrency } from '../../lib/exportExcel';
import StockBadge from '../../components/shared/StockBadge';
import { PageLoader } from '../../components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

type Rotacion = 'alta' | 'baja' | null;
type Filtro = 'todos' | 'alta' | 'baja' | 'sin';

interface InsumoConMovs extends Insumo {
  movs30: number;
  movs60: number;
}

const LABEL: Record<NonNullable<Rotacion>, { label: string; short: string; bg: string; text: string; border: string; icon: React.ElementType }> = {
  alta: { label: 'Alta Rotación', short: 'Alta', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: TrendingUp },
  baja: { label: 'Baja Rotación', short: 'Baja', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: TrendingDown },
};

export default function RotacionPage() {
  const [insumos, setInsumos] = useState<InsumoConMovs[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [updating, setUpdating] = useState<number | null>(null);
  const [needsMigration, setNeedsMigration] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const now = new Date();
    const hace30 = new Date(now); hace30.setDate(now.getDate() - 30);
    const hace60 = new Date(now); hace60.setDate(now.getDate() - 60);

    const [insRes, sal30Res, sal60Res] = await Promise.all([
      supabase.from('insumos').select('*').eq('activo', true).order('nombre'),
      supabase.from('salidas')
        .select('insumo_id')
        .eq('es_asignacion', false)
        .gte('created_at', hace30.toISOString()),
      supabase.from('salidas')
        .select('insumo_id')
        .eq('es_asignacion', false)
        .gte('created_at', hace60.toISOString())
        .lt('created_at', hace30.toISOString()),
    ]);

    const insumosList = (insRes.data ?? []) as Insumo[];

    // Detect if rotacion column doesn't exist yet
    const firstInsumo = insumosList[0];
    if (firstInsumo && !('rotacion' in firstInsumo)) {
      setNeedsMigration(true);
    }

    const count30: Record<number, number> = {};
    const count60: Record<number, number> = {};
    for (const s of sal30Res.data ?? []) count30[s.insumo_id] = (count30[s.insumo_id] ?? 0) + 1;
    for (const s of sal60Res.data ?? []) count60[s.insumo_id] = (count60[s.insumo_id] ?? 0) + 1;

    setInsumos(insumosList.map((i) => ({
      ...i,
      movs30: count30[i.id] ?? 0,
      movs60: count60[i.id] ?? 0,
    })));
    setLoading(false);
  }

  async function setRotacion(insumo: InsumoConMovs, valor: Rotacion) {
    setUpdating(insumo.id);
    const { error } = await supabase.from('insumos').update({ rotacion: valor }).eq('id', insumo.id);
    if (error) {
      if (error.message.includes('column') || error.code === '42703') {
        setNeedsMigration(true);
        toast.error('Ejecuta la migración SQL primero (ver aviso en pantalla)');
      } else {
        toast.error('Error al guardar: ' + error.message);
      }
      setUpdating(null);
      return;
    }
    setInsumos((prev) => prev.map((i) => i.id === insumo.id ? { ...i, rotacion: valor } : i));
    setUpdating(null);
  }

  function nextRotacion(current: Rotacion): Rotacion {
    if (current === null || current === undefined) return 'alta';
    if (current === 'alta') return 'baja';
    return null;
  }

  const filtered = insumos.filter((i) => {
    const q = search.toLowerCase();
    const matchSearch = i.nombre.toLowerCase().includes(q) || (i.codigo ?? '').toLowerCase().includes(q);
    if (filtro === 'todos') return matchSearch;
    if (filtro === 'sin') return matchSearch && !i.rotacion;
    return matchSearch && i.rotacion === filtro;
  });

  const countAlta = insumos.filter((i) => i.rotacion === 'alta').length;
  const countBaja = insumos.filter((i) => i.rotacion === 'baja').length;
  const countSin = insumos.filter((i) => !i.rotacion).length;

  const filterPills: { key: Filtro; label: string; count: number; active: string; inactive: string }[] = [
    { key: 'todos', label: 'Todos', count: insumos.length,
      active: 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25',
      inactive: 'bg-white text-gray-500 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600' },
    { key: 'alta', label: 'Alta Rotación', count: countAlta,
      active: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25',
      inactive: 'bg-white text-gray-500 border border-gray-200 hover:border-emerald-300 hover:text-emerald-600' },
    { key: 'baja', label: 'Baja Rotación', count: countBaja,
      active: 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/25',
      inactive: 'bg-white text-gray-500 border border-gray-200 hover:border-amber-300 hover:text-amber-600' },
    { key: 'sin', label: 'Sin clasificar', count: countSin,
      active: 'bg-gradient-to-r from-gray-600 to-slate-700 text-white shadow-md shadow-gray-500/25',
      inactive: 'bg-white text-gray-500 border border-gray-200 hover:border-gray-400' },
  ];

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5 animate-fade-in-up">

      {/* Aviso migración */}
      {needsMigration && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-800 font-semibold text-sm">Migración requerida</p>
            <p className="text-amber-700 text-xs mt-0.5 mb-2">
              Para guardar clasificaciones ejecuta este SQL en Supabase → SQL Editor:
            </p>
            <code className="block bg-amber-100 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-900 font-mono select-all">
              ALTER TABLE insumos ADD COLUMN IF NOT EXISTS rotacion TEXT DEFAULT NULL CHECK (rotacion IN ('alta', 'baja'));
            </code>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-4 shadow-lg shadow-indigo-500/25 hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Package size={15} className="text-white" />
            </div>
            <span className="text-white/50 text-xs">Total</span>
          </div>
          <p className="text-3xl font-bold text-white">{insumos.length}</p>
          <p className="text-xs text-white/60 mt-0.5">insumos activos</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl p-4 shadow-lg shadow-emerald-500/25 hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <TrendingUp size={15} className="text-white" />
            </div>
            <span className="text-white/50 text-xs">Frecuentes</span>
          </div>
          <p className="text-3xl font-bold text-white">{countAlta}</p>
          <p className="text-xs text-white/60 mt-0.5">alta rotación</p>
        </div>

        <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-4 shadow-lg shadow-amber-500/25 hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <TrendingDown size={15} className="text-white" />
            </div>
            <span className="text-white/50 text-xs">Poco usados</span>
          </div>
          <p className="text-3xl font-bold text-white">{countBaja}</p>
          <p className="text-xs text-white/60 mt-0.5">baja rotación</p>
        </div>

        <div className="bg-gradient-to-br from-gray-500 to-slate-600 rounded-2xl p-4 shadow-lg shadow-gray-500/20 hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Minus size={15} className="text-white" />
            </div>
            <span className="text-white/50 text-xs">Pendientes</span>
          </div>
          <p className="text-3xl font-bold text-white">{countSin}</p>
          <p className="text-xs text-white/60 mt-0.5">sin clasificar</p>
        </div>
      </div>

      {/* Filter pills + Search */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar insumo o código..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all duration-200"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {filterPills.map((p) => (
            <button
              key={p.key}
              onClick={() => setFiltro(p.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 ${
                filtro === p.key ? p.active : p.inactive
              }`}
            >
              {p.label}
              <span className={`text-[10px] px-1 rounded-full ${filtro === p.key ? 'bg-white/20' : 'bg-gray-100'}`}>{p.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-300">
        <div className="px-5 py-3.5 border-b border-gray-50">
          <p className="text-sm text-gray-500">
            <strong className="text-gray-800">{filtered.length}</strong> insumos
            {filtro !== 'todos' && <span> · filtro activo</span>}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gradient-to-r from-gray-50/80 to-gray-50/40">
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Insumo</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Stock actual</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Valor bodega</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Mov. 30 días</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Mov. 31–60 días</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Clasificación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50/80">
              {filtered.map((insumo) => {
                const rot = insumo.rotacion ?? null;
                const meta = rot ? LABEL[rot] : null;
                const Icon = meta?.icon ?? Minus;
                const isUpdating = updating === insumo.id;
                const trend = insumo.movs30 > insumo.movs60 ? 'sube' : insumo.movs30 < insumo.movs60 ? 'baja' : 'igual';
                return (
                  <tr key={insumo.id} className="hover:bg-indigo-50/10 transition-colors duration-150 group">
                    {/* Insumo */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {insumo.imagen_url ? (
                          <img src={insumo.imagen_url} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100/50 flex items-center justify-center flex-shrink-0">
                            <Package size={16} className="text-indigo-300" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 leading-tight">{insumo.nombre}</p>
                          {insumo.codigo && <p className="text-xs text-gray-400 font-mono mt-0.5">{insumo.codigo}</p>}
                        </div>
                      </div>
                    </td>

                    {/* Stock */}
                    <td className="px-5 py-4 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <div>
                          <span className="font-bold text-gray-800">{formatNumber(insumo.stock_actual)}</span>
                          <span className="text-xs text-gray-400 ml-1">{insumo.unidad}</span>
                        </div>
                        <StockBadge insumo={insumo} />
                      </div>
                    </td>

                    {/* Valor */}
                    <td className="px-5 py-4 hidden lg:table-cell">
                      <span className="text-gray-600 font-medium">{formatCurrency(insumo.stock_actual * insumo.costo_unitario)}</span>
                    </td>

                    {/* Movimientos 30 días */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-bold text-lg leading-none ${insumo.movs30 === 0 ? 'text-gray-300' : insumo.movs30 >= 5 ? 'text-emerald-600' : 'text-gray-700'}`}>
                          {insumo.movs30}
                        </span>
                        <span className="text-xs text-gray-400">salidas</span>
                        {insumo.movs30 > 0 && trend === 'sube' && <TrendingUp size={13} className="text-emerald-500" />}
                        {insumo.movs30 > 0 && trend === 'baja' && <TrendingDown size={13} className="text-rose-400" />}
                      </div>
                    </td>

                    {/* Movimientos 31-60 días */}
                    <td className="px-5 py-4 hidden md:table-cell">
                      <span className={`font-medium ${insumo.movs60 === 0 ? 'text-gray-300' : 'text-gray-500'}`}>
                        {insumo.movs60} <span className="text-xs font-normal text-gray-400">salidas</span>
                      </span>
                    </td>

                    {/* Clasificación — click para cambiar */}
                    <td className="px-5 py-4">
                      <button
                        onClick={() => setRotacion(insumo, nextRotacion(rot))}
                        disabled={isUpdating}
                        title="Click para cambiar clasificación"
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 active:scale-95 disabled:opacity-50 ${
                          meta
                            ? `${meta.bg} ${meta.text} ${meta.border} hover:opacity-80`
                            : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'
                        }`}
                      >
                        {isUpdating ? (
                          <RefreshCw size={11} className="animate-spin" />
                        ) : (
                          <Icon size={11} />
                        )}
                        {isUpdating ? 'Guardando...' : (meta?.label ?? 'Sin clasificar')}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center">
                        <RefreshCw size={22} className="text-gray-300" />
                      </div>
                      <div>
                        <p className="text-gray-500 font-medium text-sm">No se encontraron insumos</p>
                        <p className="text-gray-400 text-xs mt-0.5">Intenta ajustar el filtro o la búsqueda</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Leyenda */}
        <div className="px-5 py-3 border-t border-gray-50 bg-gray-50/30 flex items-center gap-4 flex-wrap">
          <p className="text-xs text-gray-400 font-medium">Clic en la clasificación para cambiarla:</p>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-gray-300" />
            <span className="text-xs text-gray-400">Sin clasificar</span>
            <span className="text-gray-300 mx-1">→</span>
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs text-gray-400">Alta Rotación</span>
            <span className="text-gray-300 mx-1">→</span>
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-xs text-gray-400">Baja Rotación</span>
            <span className="text-gray-300 mx-1">→</span>
            <div className="w-2 h-2 rounded-full bg-gray-300" />
            <span className="text-xs text-gray-400">Sin clasificar</span>
          </div>
        </div>
      </div>
    </div>
  );
}
