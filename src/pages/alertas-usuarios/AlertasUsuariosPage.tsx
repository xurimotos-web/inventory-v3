import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import type { Salida } from '../../types';
import {
  Users, Package, Bell, RefreshCw, AlertTriangle,
  CheckCircle2, ChevronRight, Building2,
} from 'lucide-react';
import { formatDate, formatNumber } from '../../lib/exportExcel';
import toast from 'react-hot-toast';
import Modal from '../../components/shared/Modal';
import { PageLoader } from '../../components/shared/LoadingSpinner';

interface Solicitud {
  id: number;
  usuario_id: string;
  insumo_id: number;
  estado: string;
  created_at: string;
  profile: { nombre: string; departamento: string } | null;
  insumo: { nombre: string; unidad: string } | null;
}

interface InsumoBalance {
  insumoId: number;
  insumoNombre: string;
  insumoUnidad: string;
  asignado: number;
  consumido: number;
  saldo: number;
}

interface UserGroup {
  userId: string;
  userName: string;
  departamento: string;
  cargo: string;
  items: InsumoBalance[];
  sinStock: number;
}

interface ReasignarTarget {
  userId: string;
  userName: string;
  departamento: string;
  cargo: string;
  insumoId: number;
  insumoNombre: string;
  insumoUnidad: string;
  stockGlobal: number;
  saldoActual: number;
}

function StockBar({ saldo, asignado }: { saldo: number; asignado: number }) {
  const pct = asignado > 0 ? Math.round((saldo / asignado) * 100) : 0;
  const color = saldo === 0 ? 'bg-rose-400' : pct < 30 ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-semibold w-8 text-right ${saldo === 0 ? 'text-rose-600' : pct < 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
        {pct}%
      </span>
    </div>
  );
}

export default function AlertasUsuariosPage() {
  const [salidas, setSalidas] = useState<Salida[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [insumos, setInsumos] = useState<{ id: number; stock_actual: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [reasignarTarget, setReasignarTarget] = useState<ReasignarTarget | null>(null);
  const [reasignarCantidad, setReasignarCantidad] = useState('');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [salidasRes, solicitudesRes, insumosRes] = await Promise.all([
      supabase
        .from('salidas')
        .select('*, profile:profiles(id, nombre, departamento, cargo), insumo:insumos(id, nombre, unidad)')
        .order('created_at', { ascending: false }),
      supabase
        .from('stock_solicitudes')
        .select('*, profile:profiles(nombre, departamento), insumo:insumos(nombre, unidad)')
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false }),
      supabase.from('insumos').select('id, stock_actual').eq('activo', true),
    ]);

    setSalidas((salidasRes.data ?? []) as Salida[]);
    setSolicitudes((solicitudesRes.data ?? []) as unknown as Solicitud[]);
    setInsumos(insumosRes.data ?? []);
    setLoading(false);
  }

  const userGroups = useMemo<UserGroup[]>(() => {
    const map: Record<string, { userName: string; departamento: string; cargo: string; items: Record<number, InsumoBalance> }> = {};

    for (const s of salidas) {
      const profile = s.profile as unknown as { id: string; nombre: string; departamento: string; cargo: string } | null;
      const insumo = s.insumo as unknown as { nombre: string; unidad: string } | null;
      if (!profile?.id || !insumo) continue;

      if (!map[s.usuario_id]) {
        map[s.usuario_id] = { userName: profile.nombre, departamento: profile.departamento, cargo: profile.cargo, items: {} };
      }
      const items = map[s.usuario_id].items;
      if (!items[s.insumo_id]) {
        items[s.insumo_id] = { insumoId: s.insumo_id, insumoNombre: insumo.nombre, insumoUnidad: insumo.unidad, asignado: 0, consumido: 0, saldo: 0 };
      }
      const esAsignacion = (s as unknown as { es_asignacion?: boolean }).es_asignacion;
      if (esAsignacion === true) items[s.insumo_id].asignado += s.cantidad;
      else if (esAsignacion === false) items[s.insumo_id].consumido += s.cantidad;
    }

    return Object.entries(map)
      .map(([userId, data]) => {
        const items = Object.values(data.items)
          .filter((i) => i.asignado > 0)
          .map((i) => ({ ...i, saldo: Math.max(0, i.asignado - i.consumido) }))
          .sort((a, b) => a.saldo - b.saldo);
        return { userId, userName: data.userName, departamento: data.departamento, cargo: data.cargo, items, sinStock: items.filter((i) => i.saldo === 0).length };
      })
      .filter((g) => g.items.length > 0)
      .sort((a, b) => b.sinStock - a.sinStock || a.userName.localeCompare(b.userName));
  }, [salidas]);

  function toggleExpand(userId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  }

  function openReasignar(group: UserGroup, item: InsumoBalance) {
    const global = insumos.find((i) => i.id === item.insumoId);
    setReasignarTarget({
      userId: group.userId,
      userName: group.userName,
      departamento: group.departamento,
      cargo: group.cargo,
      insumoId: item.insumoId,
      insumoNombre: item.insumoNombre,
      insumoUnidad: item.insumoUnidad,
      stockGlobal: global?.stock_actual ?? 0,
      saldoActual: item.saldo,
    });
    setReasignarCantidad('');
  }

  async function handleReasignar() {
    if (!reasignarTarget) return;
    const cantidad = Number(reasignarCantidad);
    if (!cantidad || cantidad <= 0) { toast.error('La cantidad debe ser mayor a 0'); return; }
    if (cantidad > reasignarTarget.stockGlobal) {
      toast.error(`Stock insuficiente. Disponible: ${reasignarTarget.stockGlobal} ${reasignarTarget.insumoUnidad}`);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('salidas').insert({
      insumo_id: reasignarTarget.insumoId,
      cantidad,
      usuario_id: reasignarTarget.userId,
      departamento: reasignarTarget.departamento,
      cargo: reasignarTarget.cargo,
      es_asignacion: true,
    });
    if (error) { toast.error('Error al reasignar: ' + error.message); setSaving(false); return; }
    toast.success(`${cantidad} ${reasignarTarget.insumoUnidad} asignados a ${reasignarTarget.userName}`);
    setReasignarTarget(null);
    setSaving(false);
    load();
  }

  async function handleAtender(id: number) {
    const { error } = await supabase
      .from('stock_solicitudes')
      .update({ estado: 'atendido', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast.error('Error al marcar la solicitud'); return; }
    toast.success('Solicitud atendida');
    load();
  }

  if (loading) return <PageLoader />;

  const totalSinStock = userGroups.reduce((s, g) => s + g.sinStock, 0);
  const totalConStock = userGroups.reduce((s, g) => s + (g.items.length - g.sinStock), 0);

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Alerta Usuarios</h1>
          <p className="text-sm text-gray-500 mt-0.5">Stock personal por usuario y solicitudes pendientes</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-all duration-150 active:scale-95"
        >
          <RefreshCw size={14} /> Actualizar
        </button>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl px-4 py-4 shadow-lg shadow-amber-500/20 hover:-translate-y-0.5 transition-all duration-300">
          <p className="text-2xl font-bold text-white">{solicitudes.length}</p>
          <p className="text-xs font-medium text-white/70 mt-0.5">Solicitudes pendientes</p>
        </div>
        <div className="bg-gradient-to-br from-rose-400 to-red-500 rounded-2xl px-4 py-4 shadow-lg shadow-rose-500/20 hover:-translate-y-0.5 transition-all duration-300">
          <p className="text-2xl font-bold text-white">{totalSinStock}</p>
          <p className="text-xs font-medium text-white/70 mt-0.5">Insumos sin stock</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl px-4 py-4 shadow-lg shadow-emerald-500/20 hover:-translate-y-0.5 transition-all duration-300">
          <p className="text-2xl font-bold text-white">{totalConStock}</p>
          <p className="text-xs font-medium text-white/70 mt-0.5">Insumos con stock</p>
        </div>
      </div>

      {/* Solicitudes pendientes */}
      {solicitudes.length > 0 && (
        <div className="bg-white border border-amber-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-50 bg-gradient-to-r from-amber-50 to-orange-50">
            <Bell size={15} className="text-amber-600" />
            <h2 className="font-semibold text-amber-800 text-sm">Solicitudes pendientes ({solicitudes.length})</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {solicitudes.map((sol) => {
              const profile = sol.profile as unknown as { nombre: string; departamento: string } | null;
              const insumo = sol.insumo as unknown as { nombre: string; unidad: string } | null;
              return (
                <div key={sol.id} className="flex items-center justify-between px-4 py-3 gap-3 hover:bg-amber-50/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-amber-800 text-xs font-bold">{profile?.nombre?.charAt(0).toUpperCase() ?? '?'}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{profile?.nombre ?? '—'}</p>
                      <p className="text-xs text-gray-500">
                        {profile?.departamento} · solicita <span className="font-medium text-gray-700">{insumo?.nombre}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-400 hidden sm:block">{formatDate(sol.created_at)}</span>
                    <button
                      onClick={() => handleAtender(sol.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-xs font-medium hover:from-amber-600 hover:to-orange-600 transition-all duration-150 active:scale-95"
                    >
                      <CheckCircle2 size={12} /> Atender
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lista de usuarios */}
      {userGroups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <Users size={28} className="text-indigo-400" />
          </div>
          <p className="text-gray-700 font-semibold">No hay asignaciones registradas aún</p>
          <p className="text-gray-400 text-sm mt-1">Asigna insumos a usuarios desde el catálogo</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{userGroups.length} usuarios con insumos asignados</p>
          {userGroups.map((group) => {
            const isOpen = expanded.has(group.userId);
            return (
              <div key={group.userId} className={`bg-white rounded-2xl border overflow-hidden transition-all duration-200 hover:shadow-md ${group.sinStock > 0 ? 'border-rose-100' : 'border-gray-100'}`}>
                <button
                  onClick={() => toggleExpand(group.userId)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/60 transition-colors text-left"
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${group.sinStock > 0 ? 'bg-gradient-to-br from-rose-100 to-red-100' : 'bg-gradient-to-br from-indigo-100 to-violet-100'}`}>
                    <span className={`text-sm font-bold ${group.sinStock > 0 ? 'text-rose-700' : 'text-indigo-700'}`}>
                      {group.userName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800">{group.userName}</p>
                      {group.sinStock > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full text-xs font-semibold">
                          <AlertTriangle size={10} /> {group.sinStock} sin stock
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Building2 size={11} className="text-gray-400" />
                      <p className="text-xs text-gray-500">{group.departamento} · {group.items.length} insumo(s)</p>
                    </div>
                  </div>
                  <ChevronRight size={15} className={`text-gray-300 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                </button>

                {isOpen && (
                  <div className="border-t border-gray-50 divide-y divide-gray-50">
                    {group.items.map((item) => (
                      <div key={item.insumoId} className="flex items-center gap-3 px-4 py-3">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                          <Package size={12} className="text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-gray-800 truncate">{item.insumoNombre}</p>
                            <span className={`flex-shrink-0 text-xs font-semibold ${item.saldo === 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {formatNumber(item.saldo)}/{formatNumber(item.asignado)} {item.insumoUnidad}
                            </span>
                          </div>
                          <StockBar saldo={item.saldo} asignado={item.asignado} />
                        </div>
                        <button
                          onClick={() => openReasignar(group, item)}
                          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-lg text-xs font-semibold hover:from-indigo-600 hover:to-violet-700 transition-all duration-150 active:scale-95"
                        >
                          <ChevronRight size={11} /> Asignar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Re-asignar */}
      <Modal open={!!reasignarTarget} onClose={() => setReasignarTarget(null)} title="Re-asignar Stock" size="sm">
        {reasignarTarget && (
          <div className="space-y-4">
            <div className="bg-indigo-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1">Asignar a</p>
              <p className="text-sm font-semibold text-indigo-900">{reasignarTarget.userName}</p>
              <p className="text-xs text-indigo-600">{reasignarTarget.departamento}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 space-y-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Insumo</p>
              <p className="text-sm font-semibold text-gray-800">{reasignarTarget.insumoNombre}</p>
              <div className="flex gap-4 text-xs text-gray-500 mt-1">
                <span>Cupo actual: <strong className={reasignarTarget.saldoActual === 0 ? 'text-rose-600' : 'text-emerald-700'}>{formatNumber(reasignarTarget.saldoActual)} {reasignarTarget.insumoUnidad}</strong></span>
                <span>En bodega: <strong className={reasignarTarget.stockGlobal === 0 ? 'text-rose-600' : 'text-emerald-700'}>{formatNumber(reasignarTarget.stockGlobal)} {reasignarTarget.insumoUnidad}</strong></span>
              </div>
            </div>
            {reasignarTarget.stockGlobal === 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700">
                Sin stock en bodega. Registra una entrada para reponer el inventario primero.
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Cantidad a asignar ({reasignarTarget.insumoUnidad}) *
              </label>
              <input
                type="number" min="0.01" step="0.01" max={reasignarTarget.stockGlobal}
                value={reasignarCantidad}
                onChange={(e) => setReasignarCantidad(e.target.value)}
                placeholder="0"
                disabled={reasignarTarget.stockGlobal === 0}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 disabled:bg-gray-50 disabled:text-gray-400 transition-all duration-200"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setReasignarTarget(null)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-all duration-150 active:scale-95"
              >
                Cancelar
              </button>
              <button
                onClick={handleReasignar}
                disabled={saving || reasignarTarget.stockGlobal === 0}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl text-sm font-medium hover:from-indigo-600 hover:to-violet-700 transition-all duration-150 disabled:opacity-60 active:scale-95"
              >
                {saving ? 'Asignando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
