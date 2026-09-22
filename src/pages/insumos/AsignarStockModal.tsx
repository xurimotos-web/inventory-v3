import { useEffect, useState } from 'react';
import Modal from '../../components/shared/Modal';
import { supabase } from '../../lib/supabase';
import type { Insumo, Profile } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Package, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatNumber } from '../../lib/exportExcel';

interface AsignarStockModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  insumo: Insumo | null;
}

export default function AsignarStockModal({ open, onClose, onSaved, insumo }: AsignarStockModalProps) {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState<Profile[]>([]);
  const [colaboradores, setColaboradores] = useState<{ id: number; nombre: string }[]>([]);
  const [usuarioId, setUsuarioId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [entregado_a, setEntregadoA] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCantidad(''); setUsuarioId(''); setEntregadoA(''); setObservaciones(''); setDone(false);
    supabase.from('profiles').select('*').eq('activo', true).neq('id', user!.id).order('nombre')
      .then(({ data }) => setUsuarios(data ?? []));
    supabase.from('colaboradores').select('id, nombre').eq('activo', true).order('nombre')
      .then(({ data }) => setColaboradores(data ?? []));
  }, [open]);

  const targetUser = usuarios.find((u) => u.id === usuarioId);
  const cantidadNum = Number(cantidad);
  const stockOk = insumo && cantidadNum > 0 && cantidadNum <= insumo.stock_actual;

  async function handleAsignar() {
    if (!insumo || !targetUser) { toast.error('Selecciona un usuario destino'); return; }
    if (!cantidadNum || cantidadNum <= 0) { toast.error('La cantidad debe ser mayor a 0'); return; }
    if (cantidadNum > insumo.stock_actual) {
      toast.error(`Stock insuficiente. Disponible: ${insumo.stock_actual} ${insumo.unidad}`);
      return;
    }
    setSaving(true);

    const { error } = await supabase.from('salidas').insert({
      insumo_id: insumo.id,
      cantidad: cantidadNum,
      usuario_id: targetUser.id,
      departamento: targetUser.departamento,
      cargo: targetUser.cargo,
      entregado_a: entregado_a.trim() || targetUser.nombre,
      observaciones: observaciones.trim() || null,
      es_asignacion: true,
    });

    if (error) { toast.error('Error al asignar: ' + error.message); setSaving(false); return; }

    setSaving(false);
    setDone(true);
    onSaved();
  }

  if (!insumo) return null;

  return (
    <Modal open={open} onClose={onClose} title="Asignar Stock a Usuario" size="md">
      {done ? (
        <div className="flex flex-col items-center text-center gap-4 py-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle size={32} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-800">¡Stock asignado!</p>
            <p className="text-gray-500 text-sm mt-1">
              <strong>{cantidadNum} {insumo.unidad}</strong> de <strong>{insumo.nombre}</strong> asignados a <strong>{targetUser?.nombre}</strong>
            </p>
            <p className="text-xs text-gray-400 mt-2 bg-blue-50 rounded-xl px-3 py-2">
              El stock general no se modificó. Solo se reducirá cuando el usuario registre consumos reales.
            </p>
          </div>
          <button onClick={onClose} className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-sm font-medium hover:from-emerald-600 hover:to-teal-700 transition-all active:scale-95">
            Cerrar
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-3 border border-gray-100">
            {insumo.imagen_url ? (
              <img src={insumo.imagen_url} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <Package size={20} className="text-indigo-400" />
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-800 text-sm">{insumo.nombre}</p>
              {insumo.codigo && <p className="text-xs text-gray-400 font-mono">{insumo.codigo}</p>}
              <p className="text-xs text-gray-500 mt-0.5">
                Stock disponible: <strong className="text-emerald-700">{formatNumber(insumo.stock_actual)} {insumo.unidad}</strong>
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
            <p className="text-xs text-amber-700">
              Esta asignación es <strong>contable</strong>: el stock general no cambiará. El usuario podrá ver su cupo y registrar consumos desde él.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Asignar a usuario *</label>
            <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 bg-white transition-all">
              <option value="">Seleccionar usuario...</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>{u.nombre} — {u.departamento}</option>
              ))}
            </select>
            {targetUser && (
              <p className="text-xs text-indigo-600 mt-1">
                Depto: <strong>{targetUser.departamento}</strong> · Cargo: {targetUser.cargo}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Cantidad a asignar * ({insumo.unidad})
            </label>
            <input
              type="number" min="0.01" step="0.01" max={insumo.stock_actual}
              value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="0"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all"
            />
            {cantidadNum > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                Stock general después de asignar: <strong className="text-emerald-700">{formatNumber(insumo.stock_actual)} {insumo.unidad}</strong> (sin cambio)
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Persona que recibe</label>
            <input
              type="text"
              list="colab-asign-list"
              value={entregado_a}
              onChange={(e) => setEntregadoA(e.target.value)}
              placeholder={targetUser ? `Por defecto: ${targetUser.nombre}` : 'Nombre de quien recibe'}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all"
            />
            <datalist id="colab-asign-list">
              {colaboradores.map((c) => <option key={c.id} value={c.nombre} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Observaciones</label>
            <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2}
              placeholder="Motivo de la asignación (opcional)"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 resize-none transition-all" />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors active:scale-95">
              Cancelar
            </button>
            <button onClick={handleAsignar} disabled={saving || !usuarioId || !stockOk}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl text-sm font-medium hover:from-indigo-600 hover:to-violet-700 transition-all disabled:opacity-60 active:scale-95 shadow-md shadow-indigo-500/25">
              {saving ? 'Asignando...' : 'Confirmar Asignación'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
