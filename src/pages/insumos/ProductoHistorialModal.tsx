import { useEffect, useState } from 'react';
import Modal from '../../components/shared/Modal';
import { supabase } from '../../lib/supabase';
import { PackagePlus, PackageMinus, Download, Clock, User, Package, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { formatCurrency, formatNumber, exportToExcelMultiSheet } from '../../lib/exportExcel';
import toast from 'react-hot-toast';

interface Props {
  insumoId: number | null;
  onClose: () => void;
}

interface Entrada {
  id: number;
  created_at: string;
  cantidad: number;
  costo_unitario: number;
  proveedor: string | null;
  numero_factura: string | null;
  observaciones: string | null;
  factura_url: string | null;
  profile: { nombre: string } | null;
}

interface Salida {
  id: number;
  created_at: string;
  cantidad: number;
  entregado_a: string | null;
  area: string | null;
  destino: string | null;
  departamento: string;
  cargo: string;
  observaciones: string | null;
  profile: { nombre: string } | null;
}

interface InsumoInfo {
  id: number;
  nombre: string;
  codigo: string | null;
  unidad: string;
  stock_actual: number;
  stock_minimo: number;
  imagen_url: string | null;
}

type MovType = 'entrada' | 'salida';
interface Mov {
  key: string;
  type: MovType;
  created_at: string;
  cantidad: number;
  registrado_por: string;
  detalle: string;
  detalle2: string;
  observaciones: string;
  extra: string;
  area: string;
  destino: string;
  saldo: number;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit' })
    + ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

type Tab = 'todos' | 'entradas' | 'salidas';

export default function ProductoHistorialModal({ insumoId, onClose }: Props) {
  const open = insumoId !== null;
  const [insumo, setInsumo] = useState<InsumoInfo | null>(null);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [salidas, setSalidas] = useState<Salida[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('todos');

  useEffect(() => {
    if (!insumoId) return;
    setLoading(true);
    setTab('todos');
    Promise.all([
      supabase.from('insumos').select('id,nombre,codigo,unidad,stock_actual,stock_minimo,imagen_url').eq('id', insumoId).single(),
      supabase.from('entradas').select('id,created_at,cantidad,costo_unitario,proveedor,numero_factura,observaciones,factura_url,profile:profiles(nombre)').eq('insumo_id', insumoId).order('created_at', { ascending: false }),
      supabase.from('salidas').select('id,created_at,cantidad,entregado_a,area,destino,departamento,cargo,observaciones,profile:profiles(nombre)').eq('insumo_id', insumoId).order('created_at', { ascending: false }),
    ]).then(([{ data: ins }, { data: ents }, { data: sals }]) => {
      setInsumo(ins as InsumoInfo);
      setEntradas((ents ?? []) as unknown as Entrada[]);
      setSalidas((sals ?? []) as unknown as Salida[]);
      setLoading(false);
    });
  }, [insumoId]);

  // Build unified chronological timeline with running balance
  const timeline: Mov[] = (() => {
    const all: Omit<Mov, 'saldo'>[] = [
      ...entradas.map((e) => ({
        key: `e-${e.id}`,
        type: 'entrada' as MovType,
        created_at: e.created_at,
        cantidad: e.cantidad,
        registrado_por: e.profile?.nombre ?? '—',
        detalle: e.proveedor ? `Proveedor: ${e.proveedor}` : '',
        detalle2: e.numero_factura ? `Factura: ${e.numero_factura}` : '',
        observaciones: e.observaciones ?? '',
        extra: e.costo_unitario > 0 ? formatCurrency(e.costo_unitario) + ' c/u' : '',
        area: '',
        destino: '',
      })),
      ...salidas.map((s) => ({
        key: `s-${s.id}`,
        type: 'salida' as MovType,
        created_at: s.created_at,
        cantidad: s.cantidad,
        registrado_por: s.profile?.nombre ?? '—',
        detalle: s.entregado_a ? `Entregado a: ${s.entregado_a}` : '',
        detalle2: '',
        observaciones: s.observaciones ?? '',
        extra: s.departamento ?? '',
        area: s.area ?? '',
        destino: s.destino ?? '',
      })),
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Build running balance oldest→newest, then reverse for display
    let balance = 0;
    const withSaldo = all.map((m) => {
      balance += m.type === 'entrada' ? m.cantidad : -m.cantidad;
      return { ...m, saldo: Math.max(0, balance) };
    });
    return withSaldo.reverse();
  })();

  function handleExport() {
    if (!insumo) return;
    const hEntradas = entradas.map((e) => ({
      'Fecha / Hora': formatDateTime(e.created_at),
      'Cantidad': e.cantidad,
      'Unidad': insumo.unidad,
      'Costo Unitario': e.costo_unitario,
      'Costo Total': e.cantidad * e.costo_unitario,
      'Proveedor': e.proveedor ?? '—',
      'Factura': e.numero_factura ?? '—',
      'Registrado por': e.profile?.nombre ?? '—',
      'Observaciones': e.observaciones ?? '—',
    }));
    const hSalidas = salidas.map((s) => ({
      'Fecha / Hora': formatDateTime(s.created_at),
      'Cantidad': s.cantidad,
      'Unidad': insumo.unidad,
      'Entregado a': s.entregado_a ?? '—',
      'Área': s.area ?? '—',
      'Destino': s.destino ?? '—',
      'Departamento': s.departamento,
      'Cargo': s.cargo,
      'Registrado por': s.profile?.nombre ?? '—',
      'Observaciones': s.observaciones ?? '—',
    }));
    const hTodos = [...timeline].reverse().map((m) => ({
      'Tipo': m.type === 'entrada' ? 'Entrada' : 'Salida',
      'Fecha / Hora': formatDateTime(m.created_at),
      'Cantidad': m.type === 'entrada' ? `+${m.cantidad}` : `-${m.cantidad}`,
      'Unidad': insumo.unidad,
      'Saldo Acumulado': m.saldo,
      'Registrado por': m.registrado_por,
      'Detalle': [m.detalle, m.detalle2].filter(Boolean).join(' · ') || '—',
      'Área': m.area || '—',
      'Destino': m.destino || '—',
      'Observaciones': m.observaciones || '—',
    }));

    exportToExcelMultiSheet(
      [
        { name: 'Kardex Completo', data: hTodos.length > 0 ? hTodos : [{ Nota: 'Sin movimientos' }] },
        { name: 'Entradas', data: hEntradas.length > 0 ? hEntradas : [{ Nota: 'Sin entradas' }] },
        { name: 'Salidas', data: hSalidas.length > 0 ? hSalidas : [{ Nota: 'Sin salidas' }] },
      ],
      `kardex_${(insumo.codigo ?? insumo.nombre).replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`,
    );
    toast.success('Kardex exportado a Excel (3 hojas)');
  }

  const totalEntradas = entradas.reduce((s, e) => s + e.cantidad, 0);
  const totalSalidas = salidas.reduce((s, e) => s + e.cantidad, 0);
  const totalCosto = entradas.reduce((s, e) => s + e.cantidad * e.costo_unitario, 0);

  const stockColor = !insumo ? '' : insumo.stock_actual <= 0
    ? 'text-rose-700 bg-rose-50 border-rose-200'
    : insumo.stock_actual <= insumo.stock_minimo
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-emerald-700 bg-emerald-50 border-emerald-200';
  const stockLabel = !insumo ? '' : insumo.stock_actual <= 0 ? 'Agotado' : insumo.stock_actual <= insumo.stock_minimo ? 'Stock bajo' : 'En stock';

  const rows = tab === 'todos' ? timeline : tab === 'entradas'
    ? timeline.filter((m) => m.type === 'entrada')
    : timeline.filter((m) => m.type === 'salida');

  return (
    <Modal open={open} onClose={onClose} title="Kardex / Historial de Producto" size="2xl">
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      )}

      {!loading && insumo && (
        <div className="space-y-5">

          {/* ── Header producto ── */}
          <div className="flex items-center gap-5 p-4 bg-gradient-to-r from-slate-50 to-white border border-slate-100 rounded-2xl">
            {insumo.imagen_url ? (
              <img src={insumo.imagen_url} alt="" className="w-20 h-20 rounded-2xl object-cover flex-shrink-0 shadow-md" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 border border-indigo-200/60 flex items-center justify-center flex-shrink-0">
                <Package size={30} className="text-indigo-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xl font-bold text-gray-900 leading-tight">{insumo.nombre}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {insumo.codigo && (
                  <span className="text-xs font-mono font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200 px-2.5 py-0.5 rounded-lg">
                    {insumo.codigo}
                  </span>
                )}
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-lg border ${stockColor}`}>
                  {stockLabel}
                </span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-3xl font-bold text-gray-800">{formatNumber(insumo.stock_actual)}</p>
              <p className="text-sm text-gray-400">{insumo.unidad} en bodega</p>
              <p className="text-xs text-gray-300 mt-0.5">mín. {formatNumber(insumo.stock_minimo)}</p>
            </div>
          </div>

          {/* ── KPIs ── */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-lg shadow-emerald-500/20">
              <div className="flex items-center justify-between mb-1.5">
                <TrendingUp size={16} className="text-white/70" />
                <span className="text-white/60 text-xs">Ingresos</span>
              </div>
              <p className="text-2xl font-bold">{formatNumber(totalEntradas)}</p>
              <p className="text-xs text-white/70 mt-0.5">{insumo.unidad} · {entradas.length} registros</p>
            </div>
            <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl p-4 text-white shadow-lg shadow-rose-500/20">
              <div className="flex items-center justify-between mb-1.5">
                <TrendingDown size={16} className="text-white/70" />
                <span className="text-white/60 text-xs">Despachos</span>
              </div>
              <p className="text-2xl font-bold">{formatNumber(totalSalidas)}</p>
              <p className="text-xs text-white/70 mt-0.5">{insumo.unidad} · {salidas.length} registros</p>
            </div>
            <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-4 text-white shadow-lg shadow-indigo-500/20">
              <div className="flex items-center justify-between mb-1.5">
                <Activity size={16} className="text-white/70" />
                <span className="text-white/60 text-xs">Movimientos</span>
              </div>
              <p className="text-2xl font-bold">{entradas.length + salidas.length}</p>
              <p className="text-xs text-white/70 mt-0.5">total histórico</p>
            </div>
            <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-4 text-white shadow-lg shadow-amber-500/20">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-white/60 text-[10px] font-semibold uppercase tracking-wide">Inversión</span>
              </div>
              <p className="text-lg font-bold leading-tight">{formatCurrency(totalCosto)}</p>
              <p className="text-xs text-white/70 mt-0.5">costo total entradas</p>
            </div>
          </div>

          {/* ── Tabs + Export ── */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-1 bg-gray-100/80 p-1 rounded-xl">
              {([
                ['todos', `Kardex (${entradas.length + salidas.length})`],
                ['entradas', `Entradas (${entradas.length})`],
                ['salidas', `Salidas (${salidas.length})`],
              ] as [Tab, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap ${
                    tab === key
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl text-xs font-medium hover:from-indigo-600 hover:to-violet-700 transition-all shadow-md shadow-indigo-500/25 active:scale-95"
            >
              <Download size={14} />
              Exportar Kardex (Excel)
            </button>
          </div>

          {/* ── Tabla ── */}
          <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto" style={{ maxHeight: '460px', overflowY: 'auto' }}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gradient-to-r from-gray-50 to-gray-50/60 border-b border-gray-100">
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-24">Tipo</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-36">Fecha / Hora</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-24">Cantidad</th>
                    {tab === 'todos' && <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-20">Saldo</th>}
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Registrado por</th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Detalle</th>
                    {(tab === 'salidas' || tab === 'todos') && <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-28">Área</th>}
                    {(tab === 'salidas' || tab === 'todos') && <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-28">Destino</th>}
                    <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50/80">
                  {rows.map((m) => (
                    <tr
                      key={m.key}
                      className={`transition-colors duration-100 ${m.type === 'entrada' ? 'hover:bg-emerald-50/40' : 'hover:bg-rose-50/40'}`}
                    >
                      <td className="px-4 py-3">
                        {m.type === 'entrada' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200/70 rounded-full text-xs font-semibold text-emerald-700">
                            <PackagePlus size={11} /> Entrada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 border border-rose-200/70 rounded-full text-xs font-semibold text-rose-700">
                            <PackageMinus size={11} /> Salida
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Clock size={11} className="text-gray-300 flex-shrink-0" />
                          <span className="text-xs text-gray-600 whitespace-nowrap">{formatDateTime(m.created_at)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-bold ${m.type === 'entrada' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {m.type === 'entrada' ? '+' : '-'}{formatNumber(m.cantidad)}
                        </span>
                        <span className="text-gray-400 text-xs ml-1">{insumo.unidad}</span>
                      </td>
                      {tab === 'todos' && (
                        <td className="px-4 py-3">
                          <span className="text-sm font-semibold text-gray-700">{formatNumber(m.saldo)}</span>
                          <span className="text-gray-400 text-xs ml-1">{insumo.unidad}</span>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${m.type === 'entrada' ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                            <User size={11} className={m.type === 'entrada' ? 'text-emerald-600' : 'text-rose-600'} />
                          </div>
                          <span className="text-gray-700 text-xs font-medium">{m.registrado_por}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-600 space-y-0.5 max-w-[180px]">
                          {m.detalle && <p className="truncate" title={m.detalle}>{m.detalle}</p>}
                          {m.detalle2 && <p className="truncate text-gray-400" title={m.detalle2}>{m.detalle2}</p>}
                          {m.extra && <p className="text-indigo-500 text-[11px]">{m.extra}</p>}
                          {!m.detalle && !m.detalle2 && <span className="text-gray-300">—</span>}
                        </div>
                      </td>
                      {(tab === 'salidas' || tab === 'todos') && (
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-[120px]">
                          <p className="truncate" title={m.area || '—'}>{m.area || <span className="text-gray-300">—</span>}</p>
                        </td>
                      )}
                      {(tab === 'salidas' || tab === 'todos') && (
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-[120px]">
                          <p className="truncate" title={m.destino || '—'}>{m.destino || <span className="text-gray-300">—</span>}</p>
                        </td>
                      )}
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-[160px]">
                        <p className="truncate" title={m.observaciones || '—'}>{m.observaciones || '—'}</p>
                      </td>
                    </tr>
                  ))}

                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={tab === 'todos' ? 9 : tab === 'salidas' ? 8 : 6} className="px-4 py-14 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center">
                            <Package size={20} className="text-gray-300" />
                          </div>
                          <p className="text-gray-400 text-sm">Sin registros en esta sección</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </Modal>
  );
}
