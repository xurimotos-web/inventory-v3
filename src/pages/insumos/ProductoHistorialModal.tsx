import { useEffect, useState } from 'react';
import Modal from '../../components/shared/Modal';
import { supabase } from '../../lib/supabase';
import { PackagePlus, PackageMinus, Download, Clock, User, Package } from 'lucide-react';
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

  function handleExport() {
    if (!insumo) return;
    const hEntradas = entradas.map((e) => ({
      'Tipo': 'Entrada',
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
      'Tipo': 'Salida',
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
    const todos = [
      ...entradas.map((e) => ({
        'Tipo': 'Entrada', 'Fecha / Hora': formatDateTime(e.created_at),
        'Cantidad': `+${e.cantidad}`, 'Unidad': insumo.unidad,
        'Detalle': e.proveedor ?? e.observaciones ?? '—',
        'Registrado por': e.profile?.nombre ?? '—',
      })),
      ...salidas.map((s) => ({
        'Tipo': 'Salida', 'Fecha / Hora': formatDateTime(s.created_at),
        'Cantidad': `-${s.cantidad}`, 'Unidad': insumo.unidad,
        'Detalle': s.entregado_a ?? s.observaciones ?? '—',
        'Registrado por': s.profile?.nombre ?? '—',
      })),
    ].sort((a, b) => b['Fecha / Hora'].localeCompare(a['Fecha / Hora']));

    exportToExcelMultiSheet(
      [
        { name: 'Historial Completo', data: todos },
        { name: 'Entradas', data: hEntradas.length > 0 ? hEntradas : [{ Nota: 'Sin entradas' }] },
        { name: 'Salidas', data: hSalidas.length > 0 ? hSalidas : [{ Nota: 'Sin salidas' }] },
      ],
      `historial_${(insumo.codigo ?? insumo.nombre).replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`,
    );
    toast.success('Historial exportado');
  }

  const totalEntradas = entradas.reduce((s, e) => s + e.cantidad, 0);
  const totalSalidas = salidas.reduce((s, e) => s + e.cantidad, 0);
  const totalCosto = entradas.reduce((s, e) => s + e.cantidad * e.costo_unitario, 0);

  const stockEstado = !insumo ? '' : insumo.stock_actual <= 0 ? 'Agotado' : insumo.stock_actual <= insumo.stock_minimo ? 'Stock bajo' : 'En stock';
  const stockColor = !insumo ? '' : insumo.stock_actual <= 0 ? 'text-rose-600 bg-rose-50 border-rose-200' : insumo.stock_actual <= insumo.stock_minimo ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-emerald-600 bg-emerald-50 border-emerald-200';

  return (
    <Modal open={open} onClose={onClose} title="Historial de Producto" size="xl">
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      )}

      {!loading && insumo && (
        <div className="space-y-5">
          {/* Header del producto */}
          <div className="flex items-start gap-4 p-4 bg-gradient-to-br from-gray-50 to-white border border-gray-100 rounded-2xl">
            {insumo.imagen_url ? (
              <img src={insumo.imagen_url} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0 shadow-sm" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                <Package size={24} className="text-indigo-300" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold text-gray-900 leading-tight">{insumo.nombre}</p>
              {insumo.codigo && (
                <span className="inline-block mt-1 text-xs font-mono bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded-md">
                  {insumo.codigo}
                </span>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${stockColor}`}>{stockEstado}</span>
              <span className="text-sm font-bold text-gray-800">{formatNumber(insumo.stock_actual)} <span className="text-xs text-gray-400 font-normal">{insumo.unidad}</span></span>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-700">{formatNumber(totalEntradas)}</p>
              <p className="text-xs text-emerald-600 mt-0.5">{insumo.unidad} ingresados</p>
              <p className="text-xs text-emerald-500 font-medium">{entradas.length} entradas</p>
            </div>
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-rose-700">{formatNumber(totalSalidas)}</p>
              <p className="text-xs text-rose-600 mt-0.5">{insumo.unidad} despachados</p>
              <p className="text-xs text-rose-500 font-medium">{salidas.length} salidas</p>
            </div>
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-indigo-700 leading-tight">{formatCurrency(totalCosto)}</p>
              <p className="text-xs text-indigo-600 mt-0.5">costo total entradas</p>
              <p className="text-xs text-indigo-500 font-medium">valor invertido</p>
            </div>
          </div>

          {/* Tabs + Export */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-1.5 bg-gray-100 p-1 rounded-xl">
              {([['todos', 'Todos'], ['entradas', `Entradas (${entradas.length})`], ['salidas', `Salidas (${salidas.length})`]] as [Tab, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                    tab === key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-600 text-xs font-medium hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-95"
            >
              <Download size={14} />
              Exportar Excel
            </button>
          </div>

          {/* Tabla historial */}
          <div className="border border-gray-100 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Tipo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Fecha / Hora</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Cantidad</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Registrado por</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Detalle</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {/* ENTRADAS */}
                  {(tab === 'todos' || tab === 'entradas') && entradas.map((e) => (
                    <tr key={`e-${e.id}`} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-50 border border-emerald-200/60 rounded-full text-xs font-semibold text-emerald-700">
                          <PackagePlus size={11} /> Entrada
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Clock size={11} className="text-gray-400 flex-shrink-0" />
                          <span className="text-xs whitespace-nowrap">{formatDateTime(e.created_at)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-emerald-600">+{formatNumber(e.cantidad)}</span>
                        <span className="text-gray-400 text-xs ml-1">{insumo.unidad}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <User size={11} className="text-emerald-600" />
                          </div>
                          <span className="text-gray-700 text-xs">{e.profile?.nombre ?? '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="text-xs text-gray-600 space-y-0.5">
                          {e.proveedor && <p><span className="text-gray-400">Proveedor:</span> {e.proveedor}</p>}
                          {e.numero_factura && <p><span className="text-gray-400">Factura:</span> {e.numero_factura}</p>}
                          {e.costo_unitario > 0 && <p><span className="text-gray-400">Costo:</span> {formatCurrency(e.costo_unitario)} · Total: {formatCurrency(e.cantidad * e.costo_unitario)}</p>}
                          {!e.proveedor && !e.numero_factura && <span className="text-gray-300">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell max-w-40 truncate">{e.observaciones ?? '—'}</td>
                    </tr>
                  ))}

                  {/* SALIDAS */}
                  {(tab === 'todos' || tab === 'salidas') && salidas.map((s) => (
                    <tr key={`s-${s.id}`} className="hover:bg-rose-50/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-rose-50 border border-rose-200/60 rounded-full text-xs font-semibold text-rose-700">
                          <PackageMinus size={11} /> Salida
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-gray-600">
                          <Clock size={11} className="text-gray-400 flex-shrink-0" />
                          <span className="text-xs whitespace-nowrap">{formatDateTime(s.created_at)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-rose-600">-{formatNumber(s.cantidad)}</span>
                        <span className="text-gray-400 text-xs ml-1">{insumo.unidad}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                            <User size={11} className="text-rose-600" />
                          </div>
                          <span className="text-gray-700 text-xs">{s.profile?.nombre ?? '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="text-xs text-gray-600 space-y-0.5">
                          {s.entregado_a && <p><span className="text-gray-400">Entregado a:</span> {s.entregado_a}</p>}
                          {s.area && <p><span className="text-gray-400">Área:</span> {s.area}</p>}
                          {s.destino && <p><span className="text-gray-400">Destino:</span> {s.destino}</p>}
                          {s.departamento && <p><span className="text-gray-400">Depto:</span> {s.departamento}</p>}
                          {!s.entregado_a && !s.area && !s.destino && <span className="text-gray-300">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell max-w-40 truncate">{s.observaciones ?? '—'}</td>
                    </tr>
                  ))}

                  {/* Empty state */}
                  {((tab === 'entradas' && entradas.length === 0) ||
                    (tab === 'salidas' && salidas.length === 0) ||
                    (tab === 'todos' && entradas.length === 0 && salidas.length === 0)) && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                        Sin registros en esta sección
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

