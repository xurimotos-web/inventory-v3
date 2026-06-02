import { useEffect, useState } from 'react';
import { Download, BarChart3, TrendingDown, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Salida, Entrada, Insumo } from '../../types';
import { formatCurrency, exportToExcel, formatDate } from '../../lib/exportExcel';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { PageLoader } from '../../components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function ReportesPage() {
  const [salidas, setSalidas] = useState<Salida[]>([]);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<'mes' | '3meses' | 'anio'>('mes');

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

  // Consumo por departamento
  const porDept: Record<string, number> = {};
  salidasFiltradas.forEach((s) => {
    porDept[s.departamento] = (porDept[s.departamento] ?? 0) + s.cantidad;
  });
  const deptData = Object.entries(porDept).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // Top insumos más usados
  const porInsumo: Record<string, { nombre: string; cantidad: number }> = {};
  salidasFiltradas.forEach((s) => {
    const nombre = (s.insumo as unknown as { nombre: string })?.nombre ?? 'Desconocido';
    if (!porInsumo[s.insumo_id]) porInsumo[s.insumo_id] = { nombre, cantidad: 0 };
    porInsumo[s.insumo_id].cantidad += s.cantidad;
  });
  const topInsumos = Object.values(porInsumo).sort((a, b) => b.cantidad - a.cantidad).slice(0, 8).map((i) => ({ nombre: i.nombre.slice(0, 18), salidas: i.cantidad }));

  // Stats
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

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Periodo selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-500 font-medium">Periodo:</span>
        {([['mes', 'Este mes'], ['3meses', 'Últimos 3 meses'], ['anio', 'Este año']] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setPeriodo(val)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${periodo === val ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Salidas en periodo', value: salidasFiltradas.length, icon: TrendingDown, color: 'text-blue-600 bg-blue-50' },
          { label: 'Entradas en periodo', value: entradasFiltradas.length, icon: BarChart3, color: 'text-green-600 bg-green-50' },
          { label: 'Costo compras', value: formatCurrency(costoPeriodo), icon: BarChart3, color: 'text-purple-600 bg-purple-50' },
          { label: 'Valor inventario', value: formatCurrency(valorInventario), icon: Package, color: 'text-indigo-600 bg-indigo-50' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${kpi.color}`}>
              <kpi.icon size={16} />
            </div>
            <p className="text-xl font-bold text-gray-800">{kpi.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">Top insumos más utilizados</h3>
          {topInsumos.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topInsumos} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis dataKey="nombre" type="category" tick={{ fontSize: 11, fill: '#64748b' }} width={100} />
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
                <Bar dataKey="salidas" fill="#3b82f6" radius={[0, 6, 6, 0]} name="Salidas" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Sin datos en este periodo</div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-4">Consumo por departamento</h3>
          {deptData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={deptData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value" nameKey="name">
                  {deptData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
                <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 12, color: '#64748b' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Sin datos en este periodo</div>
          )}
        </div>
      </div>

      {/* Exportaciones */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Exportar Reportes</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Salidas del periodo', desc: 'Historial filtrado por periodo', action: exportSalidas, color: 'blue' },
            { label: 'Inventario actual', desc: 'Todo el stock con costos y estado', action: exportInventario, color: 'green' },
            { label: 'Lista de compras', desc: 'Insumos agotados o bajo mínimo', action: exportSinStock, color: 'orange' },
          ].map((exp) => (
            <button
              key={exp.label}
              onClick={exp.action}
              className="flex items-start gap-3 p-4 border border-gray-100 rounded-xl hover:border-blue-200 hover:bg-blue-50/30 transition-all text-left group"
            >
              <Download size={16} className="text-gray-400 group-hover:text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-800">{exp.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{exp.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
