import { useEffect, useState } from 'react';
import { AlertTriangle, Package, Bell, RefreshCw } from 'lucide-react';
import { formatNumber } from '../../lib/exportExcel';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import StockBadge from '../../components/shared/StockBadge';
import { PageLoader } from '../../components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

interface CupoItem {
  insumoId: number;
  nombre: string;
  unidad: string;
  imagen_url?: string;
  asignado: number;
  consumido: number;
  saldo: number;
  pct: number;
  estado: 'agotado' | 'bajo' | 'ok';
}

export default function AlertasMisInsumosPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<CupoItem[]>([]);
  const [solicitudesEnviadas, setSolicitudesEnviadas] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: asignadas }, { data: consumidas }, { data: solData }] = await Promise.all([
      supabase
        .from('salidas')
        .select('insumo_id, cantidad, insumo:insumos(nombre, unidad, imagen_url)')
        .eq('usuario_id', user!.id)
        .eq('es_asignacion', true),
      supabase
        .from('salidas')
        .select('insumo_id, cantidad')
        .eq('usuario_id', user!.id)
        .eq('es_asignacion', false),
      supabase
        .from('stock_solicitudes')
        .select('insumo_id')
        .eq('usuario_id', user!.id)
        .eq('estado', 'pendiente'),
    ]);

    setSolicitudesEnviadas(new Set((solData ?? []).map((s) => s.insumo_id)));

    const map: Record<number, { nombre: string; unidad: string; imagen_url?: string; asignado: number; consumido: number }> = {};
    for (const a of asignadas ?? []) {
      const insumo = a.insumo as unknown as { nombre: string; unidad: string; imagen_url?: string } | null;
      if (!insumo) continue;
      if (!map[a.insumo_id]) map[a.insumo_id] = { nombre: insumo.nombre, unidad: insumo.unidad, imagen_url: insumo.imagen_url, asignado: 0, consumido: 0 };
      map[a.insumo_id].asignado += a.cantidad;
    }
    for (const c of consumidas ?? []) {
      if (map[c.insumo_id]) map[c.insumo_id].consumido += c.cantidad;
    }

    const result: CupoItem[] = Object.entries(map)
      .filter(([, v]) => v.asignado > 0)
      .map(([id, v]) => {
        const saldo = Math.max(0, v.asignado - v.consumido);
        const pct = v.asignado > 0 ? Math.round((saldo / v.asignado) * 100) : 0;
        const estado: CupoItem['estado'] = saldo === 0 ? 'agotado' : pct < 30 ? 'bajo' : 'ok';
        return { insumoId: Number(id), ...v, saldo, pct, estado };
      })
      .sort((a, b) => a.saldo - b.saldo);

    setItems(result);
    setLoading(false);
  }

  async function handleSolicitarStock(insumoId: number, nombre: string) {
    const { data, error: checkError } = await supabase
      .from('stock_solicitudes')
      .select('id')
      .eq('usuario_id', user!.id)
      .eq('insumo_id', insumoId)
      .eq('estado', 'pendiente');
    if (!checkError && (data ?? []).length > 0) {
      toast.error('Ya tienes una solicitud pendiente para este insumo');
      setSolicitudesEnviadas((prev) => new Set([...prev, insumoId]));
      return;
    }
    const { error } = await supabase.from('stock_solicitudes').insert({
      usuario_id: user!.id,
      insumo_id: insumoId,
      estado: 'pendiente',
    });
    if (error) { toast.error('Error al enviar la solicitud'); return; }
    toast.success(`Solicitud de "${nombre}" enviada al administrador`);
    setSolicitudesEnviadas((prev) => new Set([...prev, insumoId]));
  }

  if (loading) return <PageLoader />;

  const agotados = items.filter((i) => i.estado === 'agotado');
  const bajos = items.filter((i) => i.estado === 'bajo');
  const conStock = items.filter((i) => i.estado === 'ok');

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-rose-400 to-red-500 rounded-2xl p-5 shadow-lg shadow-rose-500/25 hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
              <AlertTriangle size={14} className="text-white" />
            </div>
            <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Agotados</p>
          </div>
          <p className="text-4xl font-bold text-white">{agotados.length}</p>
          <p className="text-xs text-white/60 mt-1">insumos sin cupo</p>
        </div>
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-5 shadow-lg shadow-amber-500/25 hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
              <AlertTriangle size={14} className="text-white" />
            </div>
            <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Cupo Bajo</p>
          </div>
          <p className="text-4xl font-bold text-white">{bajos.length}</p>
          <p className="text-xs text-white/60 mt-1">menos del 30%</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl p-5 shadow-lg shadow-emerald-500/25 hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
              <Package size={14} className="text-white" />
            </div>
            <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Con Stock</p>
          </div>
          <p className="text-4xl font-bold text-white">{conStock.length}</p>
          <p className="text-xs text-white/60 mt-1">insumos disponibles</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Alertas de <strong>tu cupo asignado</strong></p>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-all duration-150 active:scale-95"
        >
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <Package className="text-indigo-400" size={28} />
          </div>
          <p className="text-gray-700 font-semibold">No tienes insumos asignados</p>
          <p className="text-gray-400 text-sm mt-1">El administrador aún no te ha asignado cupos</p>
        </div>
      ) : (
        <>
          {agotados.length > 0 && (
            <div className="bg-white rounded-2xl border border-rose-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300">
              <div className="px-5 py-3.5 border-b border-rose-50 bg-gradient-to-r from-rose-50 to-red-50 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                <h2 className="text-sm font-semibold text-rose-700">Cupo Agotado ({agotados.length})</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {agotados.map((item) => (
                  <CupoRow key={item.insumoId} item={item} solicitudesEnviadas={solicitudesEnviadas} onSolicitar={handleSolicitarStock} />
                ))}
              </div>
            </div>
          )}

          {bajos.length > 0 && (
            <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300">
              <div className="px-5 py-3.5 border-b border-amber-50 bg-gradient-to-r from-amber-50 to-orange-50 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <h2 className="text-sm font-semibold text-amber-700">Cupo Bajo ({bajos.length})</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {bajos.map((item) => (
                  <CupoRow key={item.insumoId} item={item} solicitudesEnviadas={solicitudesEnviadas} onSolicitar={handleSolicitarStock} />
                ))}
              </div>
            </div>
          )}

          {conStock.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300">
              <div className="px-5 py-3.5 border-b border-gray-50 bg-gray-50/50 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <h2 className="text-sm font-semibold text-gray-600">Con Disponibilidad ({conStock.length})</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {conStock.map((item) => (
                  <CupoRow key={item.insumoId} item={item} solicitudesEnviadas={solicitudesEnviadas} onSolicitar={handleSolicitarStock} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CupoRow({
  item,
  solicitudesEnviadas,
  onSolicitar,
}: {
  item: CupoItem;
  solicitudesEnviadas: Set<number>;
  onSolicitar: (id: number, nombre: string) => void;
}) {
  const enviada = solicitudesEnviadas.has(item.insumoId);
  const barColor = item.estado === 'agotado' ? 'bg-rose-400' : item.estado === 'bajo' ? 'bg-amber-400' : 'bg-emerald-400';
  const fakeInsumo = { stock_actual: item.saldo, stock_minimo: 0 };

  return (
    <div className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50/60 transition-colors duration-150">
      {item.imagen_url ? (
        <img src={item.imagen_url} alt="" className="w-10 h-10 rounded-xl object-cover bg-gray-100 flex-shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
          <Package size={16} className="text-gray-400" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 text-sm">{item.nombre}</p>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-xs text-gray-500">
            Cupo: <strong className={item.estado === 'agotado' ? 'text-rose-600' : item.estado === 'bajo' ? 'text-amber-600' : 'text-emerald-700'}>{formatNumber(item.saldo)}</strong>/{formatNumber(item.asignado)} {item.unidad}
          </p>
          <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden max-w-24">
            <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${item.pct}%` }} />
          </div>
          <span className="text-xs text-gray-400">{item.pct}%</span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <StockBadge insumo={fakeInsumo as Parameters<typeof StockBadge>[0]['insumo']} />
        {item.estado === 'agotado' && !enviada && (
          <button
            onClick={() => onSolicitar(item.insumoId, item.nombre)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-xs font-semibold hover:from-amber-600 hover:to-orange-600 transition-all duration-150 active:scale-95"
          >
            <Bell size={11} /> Solicitar
          </button>
        )}
        {item.estado === 'agotado' && enviada && (
          <span className="text-xs text-amber-600 font-medium px-2">Enviado ✓</span>
        )}
      </div>
    </div>
  );
}
