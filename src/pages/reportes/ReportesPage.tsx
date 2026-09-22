import { useEffect, useState } from 'react';
import { Download, BarChart3, TrendingDown, Package, Calendar, FileDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Salida, Entrada, Insumo } from '../../types';
import { formatCurrency, exportToExcel, formatDate } from '../../lib/exportExcel';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { PageLoader } from '../../components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4'];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function ReportesPage() {
  const [salidas, setSalidas] = useState<Salida[]>([]);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<'mes' | '3meses' | 'anio'>('mes');

  const now = new Date();
  const [filtroTipo, setFiltroTipo] = useState<'rango' | 'mes' | 'anio'>('mes');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [filtroMes, setFiltroMes] = useState(now.getMonth());
  const [filtroAnio, setFiltroAnio] = useState(now.getFullYear());
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('salidas').select('*, insumo:insumos(nombre, unidad), profile:profiles(nombre, departamento)').order('created_at', { ascending: false }),
      supabase.from('entradas').select('*').order('created_at', { ascending: false }),
      supabase.from('insumos').select('*').eq('activo', true),
    ]).then(([s, e, i]) => {
      setSalidas(s.data ?? []);
      setEntradas(e.data ?? []);
      setInsumos(i.data ?? []);
      setLoading(false);
    });
  }, []);

  function filterByPeriodo<T extends { created_at: string }>(data: T[]): T[] {
    const now = new Date();
    return data.filter((item) => {
      const d = new Date(item.created_at);
      if (periodo === 'mes') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (periodo === '3meses') return now.getTime() - d.getTime() <= 90 * 24 * 60 * 60 * 1000;
      return d.getFullYear() === now.getFullYear();
    });
  }

  const salidasFiltradas = filterByPeriodo(salidas);
  const entradasFiltradas = filterByPeriodo(entradas);

  const porDept: Record<string, number> = {};
  salidasFiltradas.forEach((s) => {
    porDept[s.departamento] = (porDept[s.departamento] ?? 0) + s.cantidad;
  });
  const deptData = Object.entries(porDept).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const porInsumo: Record<string, { nombre: string; cantidad: number }> = {};
  salidasFiltradas.forEach((s) => {
    const nombre = (s.insumo as unknown as { nombre: string })?.nombre ?? 'Desconocido';
    if (!porInsumo[s.insumo_id]) porInsumo[s.insumo_id] = { nombre, cantidad: 0 };
    porInsumo[s.insumo_id].cantidad += s.cantidad;
  });
  const topInsumos = Object.values(porInsumo).sort((a, b) => b.cantidad - a.cantidad).slice(0, 8).map((i) => ({ nombre: i.nombre.slice(0, 18), salidas: i.cantidad }));

  const valorInventario = insumos.reduce((acc, i) => acc + i.stock_actual * i.costo_unitario, 0);
  const costoPeriodo = entradasFiltradas.reduce((acc, e) => acc + e.cantidad * e.costo_unitario, 0);

  function exportSalidas() {
    if (salidasFiltradas.length === 0) { toast.error('Sin datos'); return; }
    exportToExcel(salidasFiltradas.map((s) => {
      const insumo = s.insumo as unknown as { nombre: string; unidad: string };
      const profile = s.profile as unknown as { nombre: string; departamento: string };
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
    }), `reporte_salidas_${periodo}`, 'Salidas');
    toast.success('Reporte exportado');
  }

  function exportInventario() {
    exportToExcel(insumos.map((i) => {
      const cat = i.categoria as unknown as { nombre: string };
      return {
        Nombre: i.nombre,
        Categoría: cat?.nombre ?? '—',
        'Stock Actual': i.stock_actual,
        'Stock Mínimo': i.stock_minimo,
        Unidad: i.unidad,
        'Costo Unitario': i.costo_unitario,
        'Valor Total': i.stock_actual * i.costo_unitario,
        Estado: i.stock_actual <= 0 ? 'Agotado' : i.stock_actual <= i.stock_minimo ? 'Bajo' : 'OK',
      };
    }), 'inventario_actual', 'Inventario');
    toast.success('Inventario exportado');
  }

  function exportSinStock() {
    const sinStock = insumos.filter((i) => i.stock_actual <= 0 || i.stock_actual <= i.stock_minimo);
    if (sinStock.length === 0) { toast.error('No hay insumos bajo mínimo'); return; }
    exportToExcel(sinStock.map((i) => ({
      Insumo: i.nombre,
      Estado: i.stock_actual <= 0 ? 'AGOTADO' : 'STOCK BAJO',
      'Stock Actual': i.stock_actual,
      'Stock Mínimo': i.stock_minimo,
      'A Comprar': Math.max(0, i.stock_minimo - i.stock_actual),
      Unidad: i.unidad,
      'Costo Estimado': Math.max(0, i.stock_minimo - i.stock_actual) * i.costo_unitario,
    })), 'lista_compras', 'Lista de Compras');
    toast.success('Lista de compras exportada');
  }

  async function exportSalidasFecha() {
    setExportando(true);
    let query = supabase
      .from('salidas')
      .select('*, insumo:insumos(nombre, unidad), profile:profiles(nombre, departamento, cargo)')
      .order('created_at', { ascending: false });

    let nombreArchivo = '';
    if (filtroTipo === 'rango') {
      if (!fechaDesde || !fechaHasta) { toast.error('Selecciona rango de fechas'); setExportando(false); return; }
      query = query.gte('created_at', fechaDesde).lte('created_at', fechaHasta + 'T23:59:59');
      nombreArchivo = `salidas_${fechaDesde}_${fechaHasta}`;
    } else if (filtroTipo === 'mes') {
      const inicio = new Date(filtroAnio, filtroMes, 1).toISOString();
      const fin = new Date(filtroAnio, filtroMes + 1, 0, 23, 59, 59).toISOString();
      query = query.gte('created_at', inicio).lte('created_at', fin);
      nombreArchivo = `salidas_${MESES[filtroMes]}_${filtroAnio}`;
    } else {
      const inicio = new Date(filtroAnio, 0, 1).toISOString();
      const fin = new Date(filtroAnio, 11, 31, 23, 59, 59).toISOString();
      query = query.gte('created_at', inicio).lte('created_at', fin);
      nombreArchivo = `salidas_${filtroAnio}`;
    }

    const { data, error } = await query;
    setExportando(false);
    if (error || !data || data.length === 0) { toast.error(error ? 'Error al obtener datos' : 'Sin salidas en ese periodo'); return; }

    exportToExcel(data.map((s) => {
      const insumo = s.insumo as unknown as { nombre: string; unidad: string };
      const profile = s.profile as unknown as { nombre: string; departamento: string; cargo: string };
      return {
        Fecha: formatDate(s.created_at),
        Insumo: insumo?.nombre ?? '—',
        Cantidad: s.cantidad,
        Unidad: insumo?.unidad ?? '—',
        'Registrado por': profile?.nombre ?? '—',
        Departamento: s.departamento,
        Cargo: s.cargo ?? profile?.cargo ?? '—',
        Observaciones: s.observaciones ?? '—',
      };
    }), nombreArchivo, 'Salidas');
    toast.success(`${data.length} registros exportados`);
  }

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Periodo selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-500 font-medium">Periodo:</span>
        {([['mes', 'Este mes'], ['3meses', 'Últimos 3 meses'], ['anio', 'Este año']] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setPeriodo(val)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 active:scale-95 ${
              periodo === val
                ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-200 hover:text-indigo-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Salidas en periodo', value: salidasFiltradas.length, icon: TrendingDown, bg: 'from-indigo-500 to-blue-600', shadow: 'shadow-indigo-500/25' },
          { label: 'Entradas en periodo', value: entradasFiltradas.length, icon: BarChart3, bg: 'from-emerald-400 to-teal-500', shadow: 'shadow-emerald-500/25' },
          { label: 'Costo compras', value: formatCurrency(costoPeriodo), icon: BarChart3, bg: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-500/25' },
          { label: 'Valor inventario', value: formatCurrency(valorInventario), icon: Package, bg: 'from-rose-400 to-red-500', shadow: 'shadow-rose-500/25' },
        ].map((kpi) => (
          <div key={kpi.label} className={`bg-gradient-to-br ${kpi.bg} rounded-2xl p-4 shadow-lg ${kpi.shadow} hover:-translate-y-0.5 transition-all duration-300`}>
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center mb-3">
              <kpi.icon size={16} className="text-white" />
            </div>
            <p className="text-xl font-bold text-white">{kpi.value}</p>
            <p className="text-xs text-white/60 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300">
          <h3 className="font-semibold text-gray-800 mb-4">Top insumos más utilizados</h3>
          {topInsumos.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topInsumos} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis dataKey="nombre" type="category" tick={{ fontSize: 11, fill: '#64748b' }} width={100} />
                <Tooltip contentStyle={{ borderRadius: 14, border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', fontSize: 12, padding: '10px 14px' }} />
                <Bar dataKey="salidas" fill="#6366f1" radius={[0, 7, 7, 0]} name="Salidas" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Sin datos en este periodo</div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300">
          <h3 className="font-semibold text-gray-800 mb-4">Consumo por departamento</h3>
          {deptData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={deptData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value" nameKey="name">
                  {deptData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 14, border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', fontSize: 12, padding: '10px 14px' }} />
                <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 12, color: '#64748b' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Sin datos en este periodo</div>
          )}
        </div>
      </div>

      {/* Exportaciones rápidas */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow duration-300">
        <h3 className="font-semibold text-gray-800 mb-4">Exportar Reportes</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Salidas del periodo', desc: 'Historial filtrado por periodo', action: exportSalidas, color: 'hover:border-indigo-200 hover:bg-indigo-50/30 group-hover:text-indigo-600' },
            { label: 'Inventario actual', desc: 'Todo el stock con costos y estado', action: exportInventario, color: 'hover:border-emerald-200 hover:bg-emerald-50/30 group-hover:text-emerald-600' },
            { label: 'Lista de compras', desc: 'Insumos agotados o bajo mínimo', action: exportSinStock, color: 'hover:border-rose-200 hover:bg-rose-50/30 group-hover:text-rose-600' },
          ].map((exp) => (
            <button
              key={exp.label}
              onClick={exp.action}
              className={`flex items-start gap-3 p-4 border border-gray-100 rounded-xl transition-all duration-200 text-left group active:scale-[0.98] ${exp.color}`}
            >
              <Download size={16} className="text-gray-400 group-hover:scale-110 mt-0.5 flex-shrink-0 transition-all duration-200" />
              <div>
                <p className="text-sm font-medium text-gray-800">{exp.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{exp.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Reporte de salidas por fecha */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow duration-300">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Calendar size={15} className="text-indigo-600" />
          </div>
          <h3 className="font-semibold text-gray-800">Reporte de Salidas por Fecha</h3>
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {([['mes', 'Por mes'], ['anio', 'Por año'], ['rango', 'Rango de fechas']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFiltroTipo(val)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 active:scale-95 ${
                filtroTipo === val
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          {filtroTipo === 'mes' && (
            <>
              <select value={filtroMes} onChange={(e) => setFiltroMes(Number(e.target.value))}
                className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 bg-white cursor-pointer">
                {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select value={filtroAnio} onChange={(e) => setFiltroAnio(Number(e.target.value))}
                className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 bg-white cursor-pointer">
                {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </>
          )}
          {filtroTipo === 'anio' && (
            <select value={filtroAnio} onChange={(e) => setFiltroAnio(Number(e.target.value))}
              className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 bg-white cursor-pointer">
              {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          )}
          {filtroTipo === 'rango' && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Desde:</span>
                <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
                  className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Hasta:</span>
                <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
                  className="px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400" />
              </div>
            </>
          )}
        </div>

        <div className="bg-indigo-50/60 border border-indigo-100/60 rounded-xl p-3 mb-4 text-xs text-indigo-700">
          El Excel incluirá: Fecha, Insumo, Cantidad, Unidad, Registrado por, Departamento, Cargo, Observaciones.
        </div>

        <button
          onClick={exportSalidasFecha}
          disabled={exportando}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl text-sm font-medium hover:from-indigo-600 hover:to-violet-700 transition-all duration-150 shadow-md shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
        >
          <FileDown size={16} />
          {exportando ? 'Generando...' : 'Exportar Excel'}
        </button>
      </div>
    </div>
  );
}
