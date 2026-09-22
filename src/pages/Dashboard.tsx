import { useEffect, useState } from 'react';
import { Package, PackageMinus, AlertTriangle, TrendingUp, BarChart3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Insumo, Salida } from '../types';
import { getStockEstado } from '../types';
import { formatCurrency, formatDate, formatNumber } from '../lib/exportExcel';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PageLoader } from '../components/shared/LoadingSpinner';
import StockBadge from '../components/shared/StockBadge';
import { Link } from 'react-router-dom';

interface Stats {
  totalInsumos: number;
  valorInventario: number;
  salidasMes: number;
  alertasStock: number;
}

interface ChartData {
  nombre: string;
  salidas: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [alertas, setAlertas] = useState<Insumo[]>([]);
  const [ultimasSalidas, setUltimasSalidas] = useState<Salida[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const [insumosRes, salidasRes] = await Promise.all([
      supabase.from('insumos').select('*, categoria:categorias(nombre)').eq('activo', true),
      supabase.from('salidas').select('*, insumo:insumos(nombre, unidad), profile:profiles(nombre, departamento)').order('created_at', { ascending: false }).limit(50),
    ]);

    const insumos: Insumo[] = insumosRes.data ?? [];
    const salidas: Salida[] = salidasRes.data ?? [];

    const now = new Date();
    const mesActual = now.getMonth();
    const anioActual = now.getFullYear();

    const salidasMes = salidas.filter((s) => {
      const d = new Date(s.created_at);
      return d.getMonth() === mesActual && d.getFullYear() === anioActual;
    });

    const conAlerta = insumos.filter((i) => getStockEstado(i) !== 'ok');
    const valorTotal = insumos.reduce((acc, i) => acc + i.stock_actual * i.costo_unitario, 0);

    // Agrupar salidas por insumo para el gráfico
    const porInsumo: Record<string, number> = {};
    salidasMes.forEach((s) => {
      const nombre = (s.insumo as unknown as { nombre: string })?.nombre ?? 'Desconocido';
      porInsumo[nombre] = (porInsumo[nombre] ?? 0) + s.cantidad;
    });
    const chart = Object.entries(porInsumo)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([nombre, salidas]) => ({ nombre: nombre.slice(0, 15), salidas }));

    setStats({
      totalInsumos: insumos.length,
      valorInventario: valorTotal,
      salidasMes: salidasMes.length,
      alertasStock: conAlerta.length,
    });
    setAlertas(conAlerta.slice(0, 5));
    setUltimasSalidas(salidas.slice(0, 6));
    setChartData(chart);
    setLoading(false);
  }

  if (loading) return <PageLoader />;

  const kpis = [
    { label: 'Total Insumos', value: stats!.totalInsumos, icon: Package, color: 'blue', sub: 'productos activos' },
    { label: 'Valor Inventario', value: formatCurrency(stats!.valorInventario), icon: TrendingUp, color: 'green', sub: 'valor total en stock' },
    { label: 'Salidas este mes', value: stats!.salidasMes, icon: PackageMinus, color: 'purple', sub: 'movimientos registrados' },
    { label: 'Alertas Stock', value: stats!.alertasStock, icon: AlertTriangle, color: 'red', sub: 'productos bajo mínimo' },
  ];

  const cardGradient: Record<string, { bg: string; shadow: string }> = {
    blue:   { bg: 'from-indigo-500 to-blue-600',    shadow: 'shadow-indigo-500/25' },
    green:  { bg: 'from-emerald-400 to-teal-500',   shadow: 'shadow-emerald-500/25' },
    purple: { bg: 'from-violet-500 to-purple-600',  shadow: 'shadow-violet-500/25' },
    red:    { bg: 'from-rose-400 to-red-500',        shadow: 'shadow-rose-500/25' },
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const grad = cardGradient[kpi.color];
          return (
            <div
              key={kpi.label}
              className={`bg-gradient-to-br ${grad.bg} rounded-2xl p-5 shadow-lg ${grad.shadow} hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 cursor-default`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-white/70 font-medium">{kpi.label}</p>
                  <p className="text-3xl font-bold text-white mt-1.5 leading-none">{kpi.value}</p>
                  <p className="text-xs text-white/55 mt-1.5">{kpi.sub}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm flex-shrink-0 ml-2">
                  <kpi.icon size={22} className="text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart + Alertas */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Gráfico */}
        <div className="xl:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-800">Salidas del mes por insumo</h2>
            <Link to="/salidas" className="text-sm text-indigo-500 hover:text-indigo-700 font-medium transition-colors">Ver todas →</Link>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="nombre" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ borderRadius: 14, border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', fontSize: 12, padding: '10px 14px' }}
                  cursor={{ fill: '#f1f5f9', radius: 6 }}
                />
                <Bar dataKey="salidas" fill="url(#barGradient)" radius={[7, 7, 0, 0]} name="Salidas">
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
                <BarChart3 size={20} className="text-gray-300" />
              </div>
              <p className="text-gray-400 text-sm">Sin datos para este mes</p>
            </div>
          )}
        </div>

        {/* Alertas */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Alertas de Stock</h2>
            <Link to="/alertas" className="text-sm text-indigo-500 hover:text-indigo-700 font-medium transition-colors">Ver todas →</Link>
          </div>
          {alertas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                <Package className="text-emerald-500" size={20} />
              </div>
              <p className="text-sm text-gray-400 text-center">Todo el inventario está en niveles correctos</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {alertas.map((insumo) => (
                <li key={insumo.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{insumo.nombre}</p>
                    <p className="text-xs text-gray-400">{formatNumber(insumo.stock_actual)} / mín {formatNumber(insumo.stock_minimo)} {insumo.unidad}</p>
                  </div>
                  <StockBadge insumo={insumo} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Últimas salidas */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-300">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <h2 className="font-semibold text-gray-800">Últimas Salidas</h2>
          <Link to="/salidas" className="text-sm text-indigo-500 hover:text-indigo-700 font-medium transition-colors">Ver historial →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/40">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Insumo</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Cantidad</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell">Usuario</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden lg:table-cell">Departamento</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ultimasSalidas.map((salida) => {
                const insumo = salida.insumo as unknown as { nombre: string; unidad: string };
                const profile = salida.profile as unknown as { nombre: string; departamento: string };
                return (
                  <tr key={salida.id} className="hover:bg-indigo-50/30 transition-colors duration-150">
                    <td className="px-5 py-3.5 font-medium text-gray-800">{insumo?.nombre ?? '—'}</td>
                    <td className="px-5 py-3.5 text-gray-600">{formatNumber(salida.cantidad)} {insumo?.unidad ?? ''}</td>
                    <td className="px-5 py-3.5 text-gray-600 hidden md:table-cell">{profile?.nombre ?? '—'}</td>
                    <td className="px-5 py-3.5 text-gray-600 hidden lg:table-cell">{salida.departamento}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{formatDate(salida.created_at)}</td>
                  </tr>
                );
              })}
              {ultimasSalidas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-gray-400 text-sm">
                    Sin salidas registradas aún
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
