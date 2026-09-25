import { useEffect, useState } from 'react';
import Modal from '../../components/shared/Modal';
import { supabase } from '../../lib/supabase';
import type { Insumo } from '../../types';
import { useAuth } from '../../context/AuthContext';
import StockBadge from '../../components/shared/StockBadge';
import ImageLightbox from '../../components/shared/ImageLightbox';
import { Package, ZoomIn, CheckCircle, User, Building2, Briefcase, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import ComboBox from '../../components/shared/ComboBox';
import { formatNumber } from '../../lib/exportExcel';
import { recalcularStock } from '../../lib/stockUtils';

interface SalidaModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY = { insumo_id: '', cantidad: '', entregado_a: '', area: '', destino: '', observaciones: '' };

export default function SalidaModal({ open, onClose, onSaved }: SalidaModalProps) {
  const { user, profile, isAdmin } = useAuth();
  const [form, setForm] = useState({ ...EMPTY });
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [userStockMap, setUserStockMap] = useState<Record<number, number>>({});
  const [colaboradores, setColaboradores] = useState<{ id: number; nombre: string; area?: string }[]>([]);
  const [areas, setAreas] = useState<{ id: number; nombre: string }[]>([]);
  const [destinos, setDestinos] = useState<{ id: number; nombre: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    supabase.from('insumos').select('*').eq('activo', true).order('nombre')
      .then(async ({ data }) => {
        const all = data ?? [];
        if (isAdmin) {
          setInsumos(all.filter((i) => i.stock_actual > 0));
        } else if (user) {
          const { data: salidas } = await supabase
            .from('salidas')
            .select('insumo_id, cantidad, es_asignacion')
            .eq('usuario_id', user.id);
          const map: Record<number, number> = {};
          for (const s of salidas ?? []) {
            map[s.insumo_id] = (map[s.insumo_id] ?? 0) + (s.es_asignacion ? s.cantidad : -s.cantidad);
          }
          setUserStockMap(map);
          setInsumos(all.filter((i) => (map[i.id] ?? 0) > 0));
        }
      });
    supabase.from('colaboradores').select('id, nombre, area').eq('activo', true).order('nombre')
      .then(({ data }) => setColaboradores(data ?? []));
    supabase.from('areas').select('id, nombre').order('nombre')
      .then(({ data }) => setAreas(data ?? []));
    supabase.from('destinos').select('id, nombre').order('nombre')
      .then(({ data }) => setDestinos(data ?? []));
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

    const disponible = isAdmin ? insumo.stock_actual : Math.max(0, userStockMap[insumo.id] ?? 0);
    if (cantidad > disponible) {
      toast.error(`Stock insuficiente. Disponible: ${disponible} ${insumo.unidad}`);
      return;
    }

    setSaving(true);

    const { error } = await supabase.from('salidas').insert({
      insumo_id: Number(form.insumo_id),
      cantidad,
      usuario_id: user!.id,
      departamento: profile!.departamento,
      cargo: profile!.cargo,
      entregado_a: form.entregado_a || null,
      area: form.area || null,
      destino: form.destino || null,
      observaciones: form.observaciones.trim() || null,
      es_asignacion: false,
    });

    if (error) {
      console.error('Error al registrar salida:', error);
      toast.error(`Error al registrar la salida: ${error.message}`);
      setSaving(false);
      return;
    }

    await recalcularStock(Number(form.insumo_id));

    setSaving(false);
    setSaved(true);
    onSaved();
  }

  const selectedInsumo = insumos.find((i) => i.id === Number(form.insumo_id));
  const disponibleSeleccionado = selectedInsumo
    ? (isAdmin ? selectedInsumo.stock_actual : Math.max(0, userStockMap[selectedInsumo.id] ?? 0))
    : 0;
  const nuevoCantidad = selectedInsumo ? disponibleSeleccionado - Number(form.cantidad || 0) : null;

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
              {form.entregado_a && (
                <div className="flex items-center gap-2 text-gray-600">
                  <UserCheck size={14} className="text-green-500 flex-shrink-0" />
                  <span className="font-medium text-gray-700">Entregado a:</span>
                  <span>{form.entregado_a}</span>
                </div>
              )}
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
            <ComboBox
              options={insumos.map((i) => {
                const disp = isAdmin ? i.stock_actual : Math.max(0, userStockMap[i.id] ?? 0);
                return { value: String(i.id), label: i.nombre, sublabel: `${disp} ${i.unidad} disponibles` };
              })}
              value={form.insumo_id}
              onChange={(val) => set('insumo_id', val)}
              placeholder="Buscar insumo..."
              emptyText="No hay insumos disponibles"
            />
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
                    <StockBadge insumo={isAdmin ? selectedInsumo : { stock_actual: disponibleSeleccionado, stock_minimo: selectedInsumo.stock_minimo }} />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Disponible: <strong>{formatNumber(disponibleSeleccionado)}</strong> {selectedInsumo.unidad}
                  </p>
                  {nuevoCantidad !== null && form.cantidad && (
                    <p className="text-xs mt-1">
                      Quedará: <strong className={nuevoCantidad < 0 ? 'text-red-600' : 'text-green-600'}>
                        {formatNumber(Math.max(0, nuevoCantidad))} {selectedInsumo.unidad}
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
              max={disponibleSeleccionado || undefined}
              value={form.cantidad}
              onChange={(e) => set('cantidad', e.target.value)}
              placeholder="0"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Entregado a — dropdown de colaboradores */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <span className="flex items-center gap-1.5">
                <UserCheck size={14} className="text-blue-500" /> Entregado a (persona que recibe)
              </span>
            </label>
            <ComboBox
              options={colaboradores.map((c) => ({ value: c.nombre, label: c.nombre, sublabel: c.area ?? undefined }))}
              value={form.entregado_a}
              onChange={(val) => set('entregado_a', val)}
              placeholder="Buscar o escribir nombre..."
              freeText
            />
            {colaboradores.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No hay colaboradores. Ve a Configuración &gt; Colaboradores.</p>
            )}
          </div>

          {/* Área y Destino — dropdowns */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Área</label>
              <ComboBox
                options={areas.map((a) => ({ value: a.nombre, label: a.nombre }))}
                value={form.area}
                onChange={(val) => set('area', val)}
                placeholder="Buscar o escribir área..."
                freeText
              />
              {areas.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">Sin áreas. Ve a Configuración &gt; Áreas.</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Destino</label>
              <ComboBox
                options={destinos.map((d) => ({ value: d.nombre, label: d.nombre }))}
                value={form.destino}
                onChange={(val) => set('destino', val)}
                placeholder="Buscar o escribir destino..."
                freeText
              />
              {destinos.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">Sin destinos. Ve a Configuración &gt; Destinos.</p>
              )}
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
