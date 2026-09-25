import { useEffect, useState } from 'react';
import { Download, BarChart3, TrendingDown, Package, Calendar, FileDown, Printer, PackageMinus, Boxes, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Salida, Entrada, Insumo } from '../../types';
import { formatCurrency, exportToExcel, formatDate, formatNumber } from '../../lib/exportExcel';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { PageLoader } from '../../components/shared/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#06b6d4'];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

interface InsumoStock {
  insumo_id: number;
  nombre: string;
  unidad: string;
  codigo?: string;
  asignado: number;
  consumido: number;
  disponible: number;
}

export default function ReportesPage() {
  const { isAdmin, user, profile } = useAuth();

  // ──────────────── ADMIN STATE ────────────────
  const [salidas, setSalidas] = useState<Salida[]>([]);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [periodo, setPeriodo] = useState<'mes' | '3meses' | 'anio'>('mes');
  const [filtroTipo, setFiltroTipo] = useState<'rango' | 'mes' | 'anio'>('mes');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const now = new Date();
  const [filtroMes, setFiltroMes] = useState(now.getMonth());
  const [filtroAnio, setFiltroAnio] = useState(now.getFullYear());
  const [exportando, setExportando] = useState(false);

  // ──────────────── USER STATE ────────────────
  const [myStock, setMyStock] = useState<InsumoStock[]>([]);
  const [myConsumos, setMyConsumos] = useState<Salida[]>([]);
  const [userPeriodo, setUserPeriodo] = useState<'mes' | '3meses' | 'anio'>('mes');
  const [userFiltroTipo, setUserFiltroTipo] = useState<'rango' | 'mes' | 'anio'>('mes');
  const [userFechaDesde, setUserFechaDesde] = useState('');
  const [userFechaHasta, setUserFechaHasta] = useState('');
  const [userFiltroMes, setUserFiltroMes] = useState(now.getMonth());
  const [userFiltroAnio, setUserFiltroAnio] = useState(now.getFullYear());
  const [exportandoUser, setExportandoUser] = useState(false);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) {
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
    } else if (user) {
      supabase
        .from('salidas')
        .select('*, insumo:insumos(id, nombre, unidad, codigo)')
        .eq('usuario_id', user.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          const all = data ?? [];
          const map: Record<number, InsumoStock> = {};
          for (const s of all) {
            const insumo = s.insumo as unknown as { id: number; nombre: string; unidad: string; codigo?: string } | undefined;
            if (!map[s.insumo_id]) {
              map[s.insumo_id] = {
                insumo_id: s.insumo_id,
                nombre: insumo?.nombre ?? '—',
                unidad: insumo?.unidad ?? '',
                codigo: insumo?.codigo,
                asignado: 0, consumido: 0, disponible: 0,
              };
            }
            if (s.es_asignacion === true) map[s.insumo_id].asignado += s.cantidad;
            else map[s.insumo_id].consumido += s.cantidad;
          }
          for (const v of Object.values(map)) v.disponible = v.asignado - v.consumido;
          setMyStock(Object.values(map).sort((a, b) => b.asignado - a.asignado));
          setMyConsumos(all.filter((s) => s.es_asignacion !== true) as Salida[]);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [isAdmin, user]);

  // ──────────────── ADMIN helpers ────────────────
  function filterByPeriodo<T extends { created_at: string }>(data: T[]): T[] {
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
  salidasFiltradas.forEach((s) => { porDept[s.departamento] = (porDept[s.departamento] ?? 0) + s.cantidad; });
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
      return { Fecha: formatDate(s.created_at), Insumo: insumo?.nombre ?? '—', Cantidad: s.cantidad, Unidad: insumo?.unidad ?? '—', Usuario: profile?.nombre ?? '—', Departamento: s.departamento, Cargo: s.cargo, Observaciones: s.observaciones ?? '—' };
    }), `reporte_salidas_${periodo}`, 'Salidas');
    toast.success('Reporte exportado');
  }

  function exportInventario() {
    exportToExcel(insumos.map((i) => {
      const cat = i.categoria as unknown as { nombre: string };
      return { Nombre: i.nombre, Categoría: cat?.nombre ?? '—', 'Stock Actual': i.stock_actual, 'Stock Mínimo': i.stock_minimo, Unidad: i.unidad, 'Costo Unitario': i.costo_unitario, 'Valor Total': i.stock_actual * i.costo_unitario, Estado: i.stock_actual <= 0 ? 'Agotado' : i.stock_actual <= i.stock_minimo ? 'Bajo' : 'OK' };
    }), 'inventario_actual', 'Inventario');
    toast.success('Inventario exportado');
  }

  function exportSinStock() {
    const sinStock = insumos.filter((i) => i.stock_actual <= 0 || i.stock_actual <= i.stock_minimo);
    if (sinStock.length === 0) { toast.error('No hay insumos bajo mínimo'); return; }
    exportToExcel(sinStock.map((i) => ({ Insumo: i.nombre, Estado: i.stock_actual <= 0 ? 'AGOTADO' : 'STOCK BAJO', 'Stock Actual': i.stock_actual, 'Stock Mínimo': i.stock_minimo, 'A Comprar': Math.max(0, i.stock_minimo - i.stock_actual), Unidad: i.unidad, 'Costo Estimado': Math.max(0, i.stock_minimo - i.stock_actual) * i.costo_unitario })), 'lista_compras', 'Lista de Compras');
    toast.success('Lista de compras exportada');
  }

  async function exportSalidasFecha() {
    setExportando(true);
    let query = supabase.from('salidas').select('*, insumo:insumos(nombre, unidad), profile:profiles(nombre, departamento, cargo)').order('created_at', { ascending: false });
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
      const prof = s.profile as unknown as { nombre: string; departamento: string; cargo: string };
      return { Fecha: formatDate(s.created_at), Insumo: insumo?.nombre ?? '—', Cantidad: s.cantidad, Unidad: insumo?.unidad ?? '—', 'Registrado por': prof?.nombre ?? '—', Departamento: s.departamento, Cargo: s.cargo ?? prof?.cargo ?? '—', Observaciones: s.observaciones ?? '—' };
    }), nombreArchivo, 'Salidas');
    toast.success(`${data.length} registros exportados`);
  }

  // ──────────────── USER helpers ────────────────
  function filterUserConsumos(data: Salida[]): Salida[] {
    return data.filter((s) => {
      const d = new Date(s.created_at);
      if (userPeriodo === 'mes') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (userPeriodo === '3meses') return now.getTime() - d.getTime() <= 90 * 24 * 60 * 60 * 1000;
      return d.getFullYear() === now.getFullYear();
    });
  }

  const consumosFiltrados = filterUserConsumos(myConsumos);

  const topInsumosUser = Object.values(
    consumosFiltrados.reduce<Record<number, { nombre: string; cantidad: number }>>((acc, s) => {
      const insumo = s.insumo as unknown as { nombre: string } | undefined;
      const nombre = insumo?.nombre ?? '—';
      if (!acc[s.insumo_id]) acc[s.insumo_id] = { nombre, cantidad: 0 };
      acc[s.insumo_id].cantidad += s.cantidad;
      return acc;
    }, {})
  ).sort((a, b) => b.cantidad - a.cantidad).slice(0, 6).map((i) => ({ nombre: i.nombre.slice(0, 20), consumido: i.cantidad }));

  function exportMisConsumos() {
    if (consumosFiltrados.length === 0) { toast.error('Sin consumos en ese periodo'); return; }
    exportToExcel(consumosFiltrados.map((s) => {
      const insumo = s.insumo as unknown as { nombre: string; unidad: string } | undefined;
      return { Fecha: formatDate(s.created_at), Hora: new Date(s.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }), Insumo: insumo?.nombre ?? '—', Cantidad: s.cantidad, Unidad: insumo?.unidad ?? '—', Área: (s as unknown as { area?: string }).area ?? '—', Destino: (s as unknown as { destino?: string }).destino ?? '—', 'Entregado a': s.entregado_a ?? '—', Observaciones: s.observaciones ?? '—' };
    }), `mis_consumos_${profile?.nombre?.replace(/\s+/g, '_') ?? 'usuario'}`, 'Mis Consumos');
    toast.success('Excel exportado');
  }

  function exportMiStock() {
    if (myStock.length === 0) { toast.error('Sin stock asignado'); return; }
    exportToExcel(myStock.map((s) => ({
      Insumo: s.nombre,
      Código: s.codigo ?? '—',
      Unidad: s.unidad,
      'Total Asignado': s.asignado,
      'Total Consumido': s.consumido,
      'Disponible': Math.max(0, s.disponible),
      Estado: s.disponible <= 0 ? 'Agotado' : 'Disponible',
    })), `mi_stock_${profile?.nombre?.replace(/\s+/g, '_') ?? 'usuario'}`, 'Mi Stock');
    toast.success('Excel exportado');
  }

  async function exportUserPorFecha() {
    if (!user) return;
    setExportandoUser(true);
    let query = supabase
      .from('salidas')
      .select('*, insumo:insumos(nombre, unidad)')
      .eq('usuario_id', user.id)
      .eq('es_asignacion', false)
      .order('created_at', { ascending: false });
    let nombreArchivo = '';
    if (userFiltroTipo === 'rango') {
      if (!userFechaDesde || !userFechaHasta) { toast.error('Selecciona rango de fechas'); setExportandoUser(false); return; }
      query = query.gte('created_at', userFechaDesde).lte('created_at', userFechaHasta + 'T23:59:59');
      nombreArchivo = `consumos_${userFechaDesde}_${userFechaHasta}`;
    } else if (userFiltroTipo === 'mes') {
      const inicio = new Date(userFiltroAnio, userFiltroMes, 1).toISOString();
      const fin = new Date(userFiltroAnio, userFiltroMes + 1, 0, 23, 59, 59).toISOString();
      query = query.gte('created_at', inicio).lte('created_at', fin);
      nombreArchivo = `consumos_${MESES[userFiltroMes]}_${userFiltroAnio}`;
    } else {
      const inicio = new Date(userFiltroAnio, 0, 1).toISOString();
      const fin = new Date(userFiltroAnio, 11, 31, 23, 59, 59).toISOString();
      query = query.gte('created_at', inicio).lte('created_at', fin);
      nombreArchivo = `consumos_${userFiltroAnio}`;
    }
    const { data, error } = await query;
    setExportandoUser(false);
    if (error || !data || data.length === 0) { toast.error(error ? 'Error' : 'Sin consumos en ese periodo'); return; }
    exportToExcel(data.map((s) => {
      const insumo = s.insumo as unknown as { nombre: string; unidad: string } | undefined;
      return { Fecha: formatDate(s.created_at), Hora: new Date(s.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }), Insumo: insumo?.nombre ?? '—', Cantidad: s.cantidad, Unidad: insumo?.unidad ?? '—', Área: (s as unknown as { area?: string }).area ?? '—', Destino: (s as unknown as { destino?: string }).destino ?? '—', 'Entregado a': s.entregado_a ?? '—', Observaciones: s.observaciones ?? '—' };
    }), nombreArchivo, 'Mis Consumos');
    toast.success(`${data.length} registros exportados`);
  }

  if (loading) return <PageLoader />;

  // ══════════════════════════════════════════════
  //  VISTA USUARIO
  // ══════════════════════════════════════════════
  if (!isAdmin) {
    const totalAsignado = myStock.reduce((a, s) => a + s.asignado, 0);
    const totalConsumido = myStock.reduce((a, s) => a + s.consumido, 0);
    const insumosActivos = myStock.filter((s) => s.disponible > 0).length;

    return (
      <div className="space-y-5 animate-fade-in-up print:space-y-4">
        {/* Encabezado imprimible */}
        <div className="hidden print:block mb-4 border-b pb-3">
          <h1 className="text-xl font-bold text-gray-900">Reporte Personal de Consumos</h1>
          <p className="text-sm text-gray-600 mt-1">{profile?.nombre} · {profile?.departamento} · {profile?.cargo}</p>
          <p className="text-xs text-gray-400">Generado el {new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 print:grid-cols-3">
          <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-4 shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5 transition-all duration-300 print:shadow-none">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <Boxes size={15} className="text-white" />
              </div>
              <span className="text-white/50 text-xs">Stock total</span>
            </div>
            <p className="text-3xl font-bold text-white">{formatNumber(totalAsignado)}</p>
            <p className="text-xs text-white/60 mt-0.5">unidades asignadas</p>
          </div>
          <div className="bg-gradient-to-br from-rose-400 to-red-500 rounded-2xl p-4 shadow-lg shadow-rose-500/20 hover:-translate-y-0.5 transition-all duration-300 print:shadow-none">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <PackageMinus size={15} className="text-white" />
              </div>
              <span className="text-white/50 text-xs">Consumido</span>
            </div>
            <p className="text-3xl font-bold text-white">{formatNumber(totalConsumido)}</p>
            <p className="text-xs text-white/60 mt-0.5">unidades consumidas</p>
          </div>
          <div className="col-span-2 md:col-span-1 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl p-4 shadow-lg shadow-emerald-500/20 hover:-translate-y-0.5 transition-all duration-300 print:shadow-none">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <CheckCircle2 size={15} className="text-white" />
              </div>
              <span className="text-white/50 text-xs">Disponibles</span>
            </div>
            <p className="text-3xl font-bold text-white">{insumosActivos}</p>
            <p className="text-xs text-white/60 mt-0.5">insumos con stock disponible</p>
          </div>
        </div>

        {/* Mi stock asignado por insumo */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-300 print:shadow-none print:border-gray-300">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Package size={14} className="text-indigo-600" />
              </div>
              <h3 className="font-semibold text-gray-800 text-sm">Mi stock asignado</h3>
            </div>
            <span className="text-xs text-gray-400">{myStock.length} insumo{myStock.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Insumo</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Asignado</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Consumido</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Disponible</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {myStock.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-gray-400 text-sm">No tienes stock asignado aún</td>
                  </tr>
                ) : myStock.map((s) => {
                  const disp = Math.max(0, s.disponible);
                  const pct = s.asignado > 0 ? Math.min(100, Math.round((disp / s.asignado) * 100)) : 0;
                  return (
                    <tr key={s.insumo_id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-gray-800 text-sm">{s.nombre}</p>
                        {s.codigo && <p className="text-xs text-gray-400 font-mono">{s.codigo}</p>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-gray-700 font-medium">{formatNumber(s.asignado)}</span>
                        <span className="text-gray-400 text-xs ml-1">{s.unidad}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-rose-600 font-medium">{formatNumber(s.consumido)}</span>
                        <span className="text-gray-400 text-xs ml-1">{s.unidad}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className={`font-bold ${disp <= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatNumber(disp)}</span>
                          <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div className={`h-1.5 rounded-full transition-all ${disp <= 0 ? 'bg-rose-400' : pct < 30 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell">
                        {disp <= 0
                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200/60">Agotado</span>
                          : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">Disponible</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mis consumos recientes */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-300 print:shadow-none print:border-gray-300">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center">
                <PackageMinus size={14} className="text-rose-600" />
              </div>
              <h3 className="font-semibold text-gray-800 text-sm">Mis consumos</h3>
            </div>
            <div className="flex gap-1.5 print:hidden">
              {([['mes', 'Este mes'], ['3meses', '3 meses'], ['anio', 'Este año']] as const).map(([val, label]) => (
                <button key={val} onClick={() => setUserPeriodo(val)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 ${userPeriodo === val ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {topInsumosUser.length > 0 && (
            <div className="px-5 pt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Top insumos consumidos en el periodo</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={topInsumosUser} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis dataKey="nombre" type="category" tick={{ fontSize: 10, fill: '#64748b' }} width={120} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.10)', fontSize: 11, padding: '8px 12px' }} />
                  <Bar dataKey="consumido" fill="#f43f5e" radius={[0, 6, 6, 0]} name="Consumido" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Fecha</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Insumo</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Cantidad</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Área / Destino</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {consumosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-gray-400 text-sm">Sin consumos en este periodo</td>
                  </tr>
                ) : consumosFiltrados.slice(0, 50).map((s) => {
                  const insumo = s.insumo as unknown as { nombre: string; unidad: string } | undefined;
                  const area = (s as unknown as { area?: string }).area;
                  const destino = (s as unknown as { destino?: string }).destino;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-xs font-medium text-gray-700 whitespace-nowrap">{formatDate(s.created_at)}</p>
                        <p className="text-xs text-gray-400">{new Date(s.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-semibold text-gray-800">{insumo?.nombre ?? '—'}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 border border-rose-200/60 rounded-full">
                          <span className="font-bold text-rose-700">-{formatNumber(s.cantidad)}</span>
                          <span className="text-rose-400 text-xs">{insumo?.unidad}</span>
                        </span>
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell text-gray-500 text-xs">
                        {[area, destino].filter(Boolean).join(' / ') || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-5 py-3 hidden lg:table-cell text-gray-500 text-xs max-w-xs truncate">
                        {s.observaciones ?? <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {consumosFiltrados.length > 50 && (
              <p className="px-5 py-3 text-xs text-gray-400 border-t border-gray-50">Mostrando los 50 más recientes. Usa la exportación para ver todos.</p>
            )}
          </div>
        </div>

        {/* Exportar / Imprimir */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow duration-300 print:hidden">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Download size={14} className="text-emerald-600" />
            </div>
            <h3 className="font-semibold text-gray-800 text-sm">Exportar mis reportes</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <button onClick={exportMisConsumos}
              className="flex items-start gap-3 p-4 border border-gray-100 rounded-xl transition-all duration-200 text-left group hover:border-rose-200 hover:bg-rose-50/30 active:scale-[0.98]">
              <Download size={15} className="text-gray-400 group-hover:text-rose-500 mt-0.5 flex-shrink-0 transition-colors" />
              <div>
                <p className="text-sm font-medium text-gray-800">Mis consumos (periodo)</p>
                <p className="text-xs text-gray-400 mt-0.5">Excel del periodo seleccionado</p>
              </div>
            </button>
            <button onClick={exportMiStock}
              className="flex items-start gap-3 p-4 border border-gray-100 rounded-xl transition-all duration-200 text-left group hover:border-indigo-200 hover:bg-indigo-50/30 active:scale-[0.98]">
              <Download size={15} className="text-gray-400 group-hover:text-indigo-500 mt-0.5 flex-shrink-0 transition-colors" />
              <div>
                <p className="text-sm font-medium text-gray-800">Mi stock asignado</p>
                <p className="text-xs text-gray-400 mt-0.5">Resumen total por insumo</p>
              </div>
            </button>
            <button onClick={() => window.print()}
              className="flex items-start gap-3 p-4 border border-gray-100 rounded-xl transition-all duration-200 text-left group hover:border-violet-200 hover:bg-violet-50/30 active:scale-[0.98]">
              <Printer size={15} className="text-gray-400 group-hover:text-violet-500 mt-0.5 flex-shrink-0 transition-colors" />
              <div>
                <p className="text-sm font-medium text-gray-800">Imprimir reporte</p>
                <p className="text-xs text-gray-400 mt-0.5">Vista limpia para imprimir</p>
              </div>
            </button>
          </div>

          {/* Exportar por fecha */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Exportar por fecha específica</p>
            <div className="flex gap-2 mb-3 flex-wrap">
              {([['mes', 'Por mes'], ['anio', 'Por año'], ['rango', 'Rango de fechas']] as const).map(([val, label]) => (
                <button key={val} onClick={() => setUserFiltroTipo(val)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 ${userFiltroTipo === val ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mb-3">
              {userFiltroTipo === 'mes' && (
                <>
                  <select value={userFiltroMes} onChange={(e) => setUserFiltroMes(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white cursor-pointer">
                    {MESES_CORTO.map((m, i) => <option key={i} value={i}>{m}</option>)}
                  </select>
                  <select value={userFiltroAnio} onChange={(e) => setUserFiltroAnio(Number(e.target.value))}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white cursor-pointer">
                    {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </>
              )}
              {userFiltroTipo === 'anio' && (
                <select value={userFiltroAnio} onChange={(e) => setUserFiltroAnio(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 bg-white cursor-pointer">
                  {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              )}
              {userFiltroTipo === 'rango' && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Desde:</span>
                    <input type="date" value={userFechaDesde} onChange={(e) => setUserFechaDesde(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Hasta:</span>
                    <input type="date" value={userFechaHasta} onChange={(e) => setUserFechaHasta(e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40" />
                  </div>
                </>
              )}
            </div>
            <button onClick={exportUserPorFecha} disabled={exportandoUser}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl text-sm font-medium hover:from-indigo-600 hover:to-violet-700 transition-all shadow-md shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60">
              <FileDown size={16} />
              {exportandoUser ? 'Generando...' : 'Exportar Excel'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  //  VISTA ADMIN (sin cambios)
  // ══════════════════════════════════════════════
  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-500 font-medium">Periodo:</span>
        {([['mes', 'Este mes'], ['3meses', 'Últimos 3 meses'], ['anio', 'Este año']] as const).map(([val, label]) => (
          <button key={val} onClick={() => setPeriodo(val)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 active:scale-95 ${periodo === val ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25' : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-200 hover:text-indigo-600'}`}>
            {label}
          </button>
        ))}
      </div>

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
                  {deptData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow duration-300">
        <h3 className="font-semibold text-gray-800 mb-4">Exportar Reportes</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Salidas del periodo', desc: 'Historial filtrado por periodo', action: exportSalidas, color: 'hover:border-indigo-200 hover:bg-indigo-50/30 group-hover:text-indigo-600' },
            { label: 'Inventario actual', desc: 'Todo el stock con costos y estado', action: exportInventario, color: 'hover:border-emerald-200 hover:bg-emerald-50/30 group-hover:text-emerald-600' },
            { label: 'Lista de compras', desc: 'Insumos agotados o bajo mínimo', action: exportSinStock, color: 'hover:border-rose-200 hover:bg-rose-50/30 group-hover:text-rose-600' },
          ].map((exp) => (
            <button key={exp.label} onClick={exp.action}
              className={`flex items-start gap-3 p-4 border border-gray-100 rounded-xl transition-all duration-200 text-left group active:scale-[0.98] ${exp.color}`}>
              <Download size={16} className="text-gray-400 group-hover:scale-110 mt-0.5 flex-shrink-0 transition-all duration-200" />
              <div>
                <p className="text-sm font-medium text-gray-800">{exp.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{exp.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow duration-300">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Calendar size={15} className="text-indigo-600" />
          </div>
          <h3 className="font-semibold text-gray-800">Reporte de Salidas por Fecha</h3>
        </div>
        <div className="flex gap-2 mb-4 flex-wrap">
          {([['mes', 'Por mes'], ['anio', 'Por año'], ['rango', 'Rango de fechas']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setFiltroTipo(val)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 active:scale-95 ${filtroTipo === val ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
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
        <button onClick={exportSalidasFecha} disabled={exportando}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl text-sm font-medium hover:from-indigo-600 hover:to-violet-700 transition-all duration-150 shadow-md shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60">
          <FileDown size={16} />
          {exportando ? 'Generando...' : 'Exportar Excel'}
        </button>
      </div>
    </div>
  );
}
