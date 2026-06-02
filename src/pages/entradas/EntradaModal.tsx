import { useEffect, useState } from 'react';
import Modal from '../../components/shared/Modal';
import { supabase } from '../../lib/supabase';
import type { Insumo } from '../../types';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

interface EntradaModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY = {
  insumo_id: '', cantidad: '', costo_unitario: '',
  proveedor: '', numero_factura: '', observaciones: '',
};

export default function EntradaModal({ open, onClose, onSaved }: EntradaModalProps) {
  const { user } = useAuth();
  const [form, setForm] = useState({ ...EMPTY });
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('insumos').select('*').eq('activo', true).order('nombre').then(({ data }) => setInsumos(data ?? []));
  }, []);

  useEffect(() => {
    if (open) setForm({ ...EMPTY });
  }, [open]);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!form.insumo_id) { toast.error('Selecciona un insumo'); return; }
    if (!form.cantidad || Number(form.cantidad) <= 0) { toast.error('La cantidad debe ser mayor a 0'); return; }

    setSaving(true);

    // Registrar entrada
    const { error: entradaError } = await supabase.from('entradas').insert({
      insumo_id: Number(form.insumo_id),
      cantidad: Number(form.cantidad),
      costo_unitario: form.costo_unitario ? Number(form.costo_unitario) : null,
      proveedor: form.proveedor.trim() || null,
      numero_factura: form.numero_factura.trim() || null,
      observaciones: form.observaciones.trim() || null,
      usuario_id: user!.id,
    });

    if (entradaError) {
      toast.error('Error al registrar la entrada');
      setSaving(false);
      return;
    }

    // Actualizar stock
    const insumo = insumos.find((i) => i.id === Number(form.insumo_id));
    if (insumo) {
      await supabase.from('insumos').update({
        stock_actual: insumo.stock_actual + Number(form.cantidad),
        updated_at: new Date().toISOString(),
      }).eq('id', insumo.id);
    }

    toast.success('Entrada registrada y stock actualizado');
    onSaved();
    onClose();
    setSaving(false);
  }

  const selectedInsumo = insumos.find((i) => i.id === Number(form.insumo_id));

  return (
    <Modal open={open} onClose={onClose} title="Registrar Entrada" size="md">
      <div className="space-y-4">
        {/* Insumo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Insumo *</label>
          <select
            value={form.insumo_id}
            onChange={(e) => {
              const insumo = insumos.find(i => i.id === Number(e.target.value));
              set('insumo_id', e.target.value);
              if (insumo) set('costo_unitario', String(insumo.costo_unitario));
            }}
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Seleccionar insumo...</option>
            {insumos.map((i) => (
              <option key={i.id} value={i.id}>{i.nombre} (stock: {i.stock_actual} {i.unidad})</option>
            ))}
          </select>
        </div>

        {/* Stock info */}
        {selectedInsumo && (
          <div className="bg-blue-50 rounded-xl p-3 text-sm">
            <p className="text-blue-700 font-medium">Stock actual: <strong>{selectedInsumo.stock_actual} {selectedInsumo.unidad}</strong></p>
            <p className="text-blue-600 text-xs mt-0.5">Stock mínimo: {selectedInsumo.stock_minimo} {selectedInsumo.unidad}</p>
          </div>
        )}

        {/* Cantidad y Costo */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Cantidad *{selectedInsumo ? ` (${selectedInsumo.unidad})` : ''}
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.cantidad}
              onChange={(e) => set('cantidad', e.target.value)}
              placeholder="0"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Costo unitario</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.costo_unitario}
              onChange={(e) => set('costo_unitario', e.target.value)}
              placeholder="0"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Proveedor y Factura */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Proveedor</label>
            <input
              type="text"
              value={form.proveedor}
              onChange={(e) => set('proveedor', e.target.value)}
              placeholder="Nombre del proveedor"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">N° Factura</label>
            <input
              type="text"
              value={form.numero_factura}
              onChange={(e) => set('numero_factura', e.target.value)}
              placeholder="000-001"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Observaciones */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Observaciones</label>
          <textarea
            value={form.observaciones}
            onChange={(e) => set('observaciones', e.target.value)}
            rows={2}
            placeholder="Notas adicionales..."
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-60">
            {saving ? 'Guardando...' : 'Registrar Entrada'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
