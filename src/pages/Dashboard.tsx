import { useEffect, useState } from 'react';
import { Package, PackageMinus, AlertTriangle, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Insumo, Salida } from '../types';
import { getStockEstado } from '../types';
import { formatCurrency, formatDate } from '../lib/exportExcel';
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

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">{kpi.label}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{kpi.value}</p>
                <p className="text-xs text-gray-400 mt-1">{kpi.sub}</p>
              </div>
              <div className={`p-3 rounded-xl ${colorMap[kpi.color]}`}>
                <kpi.icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart + Alertas */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Gráfico */}
        <div className="xl:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-800">Salidas del mes por insumo</h2>
            <Link to="/salidas" className="text-sm text-blue-600 hover:text-blue-700 font-medium">Ver todas →</Link>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="nombre" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
                <Bar dataKey="salidas" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Salidas" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center">
              <p className="text-gray-400 text-sm">Sin datos para este mes</p>
            </div>
          )}
        </div>

        {/* Alertas */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Alertas de Stock</h2>
            <Link to="/alertas" className="text-sm text-blue-600 hover:text-blue-700 font-medium">Ver todas →</Link>
          </div>
          {alertas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
                <Package className="text-green-500" size={20} />
              </div>
              <p className="text-sm text-gray-400 text-center">Todo el inventario está en niveles correctos</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {alertas.map((insumo) => (
                <li key={insumo.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{insumo.nombre}</p>
                    <p className="text-xs text-gray-400">{insumo.stock_actual} / mín {insumo.stock_minimo} {insumo.unidad}</p>
                  </div>
                  <StockBadge insumo={insumo} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Últimas salidas */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <h2 className="font-semibold text-gray-800">Últimas Salidas</h2>
          <Link to="/salidas" className="text-sm text-blue-600 hover:text-blue-700 font-medium">Ver historial →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
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
                  <tr key={salida.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-800">{insumo?.nombre ?? '—'}</td>
                    <td className="px-5 py-3.5 text-gray-600">{salida.cantidad} {insumo?.unidad ?? ''}</td>
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
