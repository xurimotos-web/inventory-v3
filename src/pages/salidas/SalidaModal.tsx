import { useEffect, useState } from 'react';
import Modal from '../../components/shared/Modal';
import { supabase } from '../../lib/supabase';
import type { Insumo } from '../../types';
import { useAuth } from '../../context/AuthContext';
import StockBadge from '../../components/shared/StockBadge';
import toast from 'react-hot-toast';

interface SalidaModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY = { insumo_id: '', cantidad: '', observaciones: '' };

export default function SalidaModal({ open, onClose, onSaved }: SalidaModalProps) {
  const { user, profile } = useAuth();
  const [form, setForm] = useState({ ...EMPTY });
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('insumos').select('*').eq('activo', true).gt('stock_actual', 0).order('nombre')
      .then(({ data }) => setInsumos(data ?? []));
  }, [open]);

  useEffect(() => {
    if (open) setForm({ ...EMPTY });
  }, [open]);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!form.insumo_id) { toast.error('Selecciona un insumo'); return; }
    const cantidad = Number(form.cantidad);
    if (!cantidad || cantidad <= 0) { toast.error('La cantidad debe ser mayor a 0'); return; }

    const insumo = insumos.find((i) => i.id === Number(form.insumo_id));
    if (!insumo) return;

    if (cantidad > insumo.stock_actual) {
      toast.error(`Stock insuficiente. Disponible: ${insumo.stock_actual} ${insumo.unidad}`);
      return;
    }

    setSaving(true);

    const { error } = await supabase.from('salidas').insert({
      insumo_id: Number(form.insumo_id),
      cantidad,
      usuario_id: user!.id,
      departamento: profile!.departamento,
      cargo: profile!.cargo,
      observaciones: form.observaciones.trim() || null,
    });

    if (error) {
      toast.error('Error al registrar la salida');
      setSaving(false);
      return;
    }

    // Actualizar stock
    await supabase.from('insumos').update({
      stock_actual: insumo.stock_actual - cantidad,
      updated_at: new Date().toISOString(),
    }).eq('id', insumo.id);

    toast.success('Salida registrada correctamente');
    onSaved();
    onClose();
    setSaving(false);
  }

  const selectedInsumo = insumos.find((i) => i.id === Number(form.insumo_id));
  const nuevoCantidad = selectedInsumo ? selectedInsumo.stock_actual - Number(form.cantidad || 0) : null;

  return (
    <Modal open={open} onClose={onClose} title="Registrar Salida" size="md">
      <div className="space-y-4">
        {/* Info del usuario */}
        <div className="bg-blue-50 rounded-xl p-3 text-sm">
          <p className="text-blue-700 font-medium">{profile?.nombre}</p>
          <p className="text-blue-600 text-xs">{profile?.cargo} — {profile?.departamento}</p>
        </div>

        {/* Insumo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Insumo a solicitar *</label>
          <select
            value={form.insumo_id}
            onChange={(e) => set('insumo_id', e.target.value)}
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Seleccionar insumo...</option>
            {insumos.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre} — {i.stock_actual} {i.unidad} disponibles
              </option>
            ))}
          </select>
        </div>

        {/* Stock info + badge */}
        {selectedInsumo && (
          <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">{selectedInsumo.nombre}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Disponible: <strong>{selectedInsumo.stock_actual} {selectedInsumo.unidad}</strong>
              </p>
              {nuevoCantidad !== null && form.cantidad && (
                <p className="text-xs mt-0.5">
                  Quedará: <strong className={nuevoCantidad < selectedInsumo.stock_minimo ? 'text-red-600' : 'text-green-600'}>
                    {nuevoCantidad} {selectedInsumo.unidad}
                  </strong>
                </p>
              )}
            </div>
            <StockBadge insumo={selectedInsumo} />
          </div>
        )}

        {/* Cantidad */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Cantidad a retirar *{selectedInsumo ? ` (${selectedInsumo.unidad})` : ''}
          </label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            max={selectedInsumo?.stock_actual}
            value={form.cantidad}
            onChange={(e) => set('cantidad', e.target.value)}
            placeholder="0"
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Observaciones */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Motivo / Observaciones</label>
          <textarea
            value={form.observaciones}
            onChange={(e) => set('observaciones', e.target.value)}
            rows={2}
            placeholder="¿Para qué se usa este insumo?"
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60">
            {saving ? 'Guardando...' : 'Confirmar Salida'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
