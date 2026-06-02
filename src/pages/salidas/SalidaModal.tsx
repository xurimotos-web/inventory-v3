import { useEffect, useState } from 'react';
import Modal from '../../components/shared/Modal';
import { supabase } from '../../lib/supabase';
import type { Insumo } from '../../types';
import { useAuth } from '../../context/AuthContext';
import StockBadge from '../../components/shared/StockBadge';
import ImageLightbox from '../../components/shared/ImageLightbox';
import { Package, ZoomIn, CheckCircle, User, Building2, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';

interface SalidaModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY = { insumo_id: '', cantidad: '', area: '', destino: '', observaciones: '' };

export default function SalidaModal({ open, onClose, onSaved }: SalidaModalProps) {
  const { user, profile } = useAuth();
  const [form, setForm] = useState({ ...EMPTY });
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    supabase.from('insumos').select('*').eq('activo', true).gt('stock_actual', 0).order('nombre')
      .then(({ data }) => setInsumos(data ?? []));
  }, [open]);

  useEffect(() => {
    if (open) { setForm({ ...EMPTY }); setSaved(false); }
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
      area: form.area.trim() || null,
      destino: form.destino.trim() || null,
      observaciones: form.observaciones.trim() || null,
    });

    if (error) {
      toast.error('Error al registrar la salida');
      setSaving(false);
      return;
    }

    await supabase.from('insumos').update({
      stock_actual: insumo.stock_actual - cantidad,
      updated_at: new Date().toISOString(),
    }).eq('id', insumo.id);

    setSaving(false);
    setSaved(true);
    onSaved();
  }

  const selectedInsumo = insumos.find((i) => i.id === Number(form.insumo_id));
  const nuevoCantidad = selectedInsumo ? selectedInsumo.stock_actual - Number(form.cantidad || 0) : null;

  // Pantalla de confirmación después de guardar
  if (saved && selectedInsumo) {
    return (
      <Modal open={open} onClose={onClose} title="Salida Registrada" size="md">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="text-green-600" size={32} />
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-800">¡Salida registrada!</p>
            <p className="text-gray-500 text-sm mt-1">El movimiento quedó guardado correctamente</p>
          </div>

          {/* Resumen del movimiento */}
          <div className="w-full bg-gray-50 rounded-2xl p-4 text-left space-y-3">
            <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
              {selectedInsumo.imagen_url ? (
                <img src={selectedInsumo.imagen_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Package size={20} className="text-blue-400" />
                </div>
              )}
              <div>
                <p className="font-semibold text-gray-800">{selectedInsumo.nombre}</p>
                <p className="text-sm text-red-600 font-medium">-{form.cantidad} {selectedInsumo.unidad}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <User size={14} className="text-blue-500 flex-shrink-0" />
                <span className="font-medium text-gray-700">Registrado por:</span>
                <span>{profile?.nombre}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Building2 size={14} className="text-blue-500 flex-shrink-0" />
                <span className="font-medium text-gray-700">Departamento:</span>
                <span>{profile?.departamento}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Briefcase size={14} className="text-blue-500 flex-shrink-0" />
                <span className="font-medium text-gray-700">Cargo:</span>
                <span>{profile?.cargo}</span>
              </div>
            </div>

            {form.observaciones && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-0.5">Observación:</p>
                <p className="text-sm text-gray-700">{form.observaciones}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 w-full">
            <button
              onClick={() => { setSaved(false); setForm({ ...EMPTY }); }}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Nueva salida
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Registrar Salida" size="md">
        <div className="space-y-4">
          {/* Info del usuario registrando */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
            <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide mb-2">Registrado por</p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">{profile?.nombre?.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-900">{profile?.nombre}</p>
                <p className="text-xs text-blue-600">{profile?.cargo} — {profile?.departamento}</p>
              </div>
            </div>
          </div>

          {/* Selector de insumo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Insumo a retirar *</label>
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

          {/* Preview del insumo seleccionado */}
          {selectedInsumo && (
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="flex items-start gap-3">
                {selectedInsumo.imagen_url ? (
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="relative w-16 h-16 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0 group"
                    title="Ver foto del insumo"
                  >
                    <img src={selectedInsumo.imagen_url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                      <ZoomIn size={16} className="text-white opacity-0 group-hover:opacity-100" />
                    </div>
                  </button>
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Package size={22} className="text-blue-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-gray-800 text-sm">{selectedInsumo.nombre}</p>
                    <StockBadge insumo={selectedInsumo} />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Disponible: <strong>{selectedInsumo.stock_actual}</strong> {selectedInsumo.unidad}
                  </p>
                  {nuevoCantidad !== null && form.cantidad && (
                    <p className="text-xs mt-1">
                      Quedará: <strong className={nuevoCantidad < selectedInsumo.stock_minimo ? 'text-red-600' : 'text-green-600'}>
                        {nuevoCantidad} {selectedInsumo.unidad}
                      </strong>
                    </p>
                  )}
                  {selectedInsumo.imagen_url && (
                    <button
                      type="button"
                      onClick={() => setLightboxOpen(true)}
                      className="mt-1.5 text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1"
                    >
                      <ZoomIn size={11} /> Ver foto del insumo
                    </button>
                  )}
                </div>
              </div>
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

          {/* Área y Destino */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Área</label>
              <input type="text" value={form.area} onChange={(e) => set('area', e.target.value)}
                placeholder="Ej: Producción, Cocina"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Destino</label>
              <input type="text" value={form.destino} onChange={(e) => set('destino', e.target.value)}
                placeholder="Ej: Proyecto X, Mantenimiento"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
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

      {selectedInsumo?.imagen_url && (
        <ImageLightbox
          open={lightboxOpen}
          src={selectedInsumo.imagen_url}
          alt={selectedInsumo.nombre}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}
