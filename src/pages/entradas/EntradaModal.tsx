import { useEffect, useState, useRef } from 'react';
import Modal from '../../components/shared/Modal';
import { supabase } from '../../lib/supabase';
import type { Insumo } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { FileUp, X, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import ComboBox from '../../components/shared/ComboBox';
import { formatNumber } from '../../lib/exportExcel';
import { recalcularStock } from '../../lib/stockUtils';

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
  const [proveedores, setProveedores] = useState<string[]>([]);
  const [facturaFile, setFacturaFile] = useState<File | null>(null);
  const [uploadingFactura, setUploadingFactura] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    supabase.from('insumos').select('*, categoria:categorias(nombre)').eq('activo', true).order('nombre')
      .then(({ data }) => setInsumos(data ?? []));
    supabase.from('proveedores').select('nombre').order('nombre')
      .then(({ data }) => setProveedores((data ?? []).map((p: { nombre: string }) => p.nombre)));
  }, [open]);

  useEffect(() => {
    if (open) { setForm({ ...EMPTY }); setFacturaFile(null); }
  }, [open]);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleFacturaFile(file: File) {
    const allowed = ['application/pdf', 'text/html', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    const allowedExt = ['.pdf', '.html', '.htm', '.xlsx', '.xls'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowed.includes(file.type) && !allowedExt.includes(ext)) {
      toast.error('Solo se permiten PDF, HTML o Excel'); return;
    }
    if (file.size > 10 * 1024 * 1024) { toast.error('El archivo no puede superar 10MB'); return; }
    setFacturaFile(file);
  }

  async function uploadFactura(): Promise<string | null> {
    if (!facturaFile) return null;
    setUploadingFactura(true);
    const ext = facturaFile.name.split('.').pop();
    const filename = `facturas/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('facturas').upload(filename, facturaFile, { upsert: true });
    setUploadingFactura(false);
    if (error) { toast.error('Error al subir la factura'); return null; }
    const { data: { publicUrl } } = supabase.storage.from('facturas').getPublicUrl(filename);
    return publicUrl;
  }

  async function handleSave() {
    if (!form.insumo_id) { toast.error('Selecciona un insumo'); return; }
    if (!form.cantidad || Number(form.cantidad) <= 0) { toast.error('La cantidad debe ser mayor a 0'); return; }
    if (!Number.isInteger(Number(form.cantidad))) { toast.error('La cantidad debe ser un número entero, sin decimales'); return; }

    setSaving(true);
    const facturaUrl = await uploadFactura();

    const { error: entradaError } = await supabase.from('entradas').insert({
      insumo_id: Number(form.insumo_id),
      cantidad: Number(form.cantidad),
      costo_unitario: form.costo_unitario ? Number(form.costo_unitario) : null,
      proveedor: form.proveedor.trim() || null,
      numero_factura: form.numero_factura.trim() || null,
      observaciones: form.observaciones.trim() || null,
      factura_url: facturaUrl,
      usuario_id: user!.id,
    });

    if (entradaError) { toast.error('Error al registrar la entrada'); setSaving(false); return; }

    const stockError = await recalcularStock(Number(form.insumo_id));
    if (stockError) {
      toast.error('Entrada guardada, pero error al actualizar stock: ' + stockError, { duration: 8000 });
    } else {
      toast.success('Entrada registrada y stock actualizado');
    }
    onSaved(); onClose();
    setSaving(false);
  }

  const selectedInsumo = insumos.find((i) => i.id === Number(form.insumo_id));

  return (
    <Modal open={open} onClose={onClose} title="Registrar Entrada" size="md">
      <div className="space-y-4">
        {/* Insumo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Insumo *</label>
          <ComboBox
            options={insumos.map((i) => {
              const cat = i.categoria as unknown as { nombre: string };
              return {
                value: String(i.id),
                label: `${i.codigo ? `[${i.codigo}] ` : ''}${i.nombre}`,
                sublabel: `${cat?.nombre ? `${cat.nombre} · ` : ''}stock: ${i.stock_actual} ${i.unidad}`,
              };
            })}
            value={form.insumo_id}
            onChange={(val) => {
              set('insumo_id', val);
              if (val) {
                const insumo = insumos.find(i => String(i.id) === val);
                if (insumo) set('costo_unitario', String(insumo.costo_unitario));
              }
            }}
            placeholder="Buscar insumo..."
            emptyText="No hay insumos"
          />
        </div>

        {selectedInsumo && (
          <div className="bg-green-50 rounded-xl p-3 text-sm">
            <p className="text-green-700 font-medium">Stock actual: <strong>{formatNumber(selectedInsumo.stock_actual)} {selectedInsumo.unidad}</strong></p>
            <p className="text-green-600 text-xs mt-0.5">Stock mínimo: {formatNumber(selectedInsumo.stock_minimo)} {selectedInsumo.unidad}</p>
          </div>
        )}

        {/* Cantidad y Costo */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Cantidad *{selectedInsumo ? ` (${selectedInsumo.unidad})` : ''}</label>
            <input type="number" min="1" step="1" value={form.cantidad} onChange={(e) => set('cantidad', e.target.value)} placeholder="0"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Costo unitario</label>
            <input type="number" min="0" step="0.01" value={form.costo_unitario} onChange={(e) => set('costo_unitario', e.target.value)} placeholder="0"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Proveedor y Factura */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Proveedor</label>
            <ComboBox
              options={proveedores.map((p) => ({ value: p, label: p }))}
              value={form.proveedor}
              onChange={(val) => set('proveedor', val)}
              placeholder="Buscar o seleccionar..."
              freeText
            />
            {/* Chips de selección rápida */}
            {proveedores.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {proveedores.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set('proveedor', p)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all duration-150 active:scale-95 ${
                      form.proveedor === p
                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-500/30'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">N° Factura</label>
            <input type="text" value={form.numero_factura} onChange={(e) => set('numero_factura', e.target.value)} placeholder="000-001"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Adjuntar factura */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Adjuntar factura (PDF, HTML, Excel)</label>
          <input ref={fileRef} type="file" accept=".pdf,.html,.htm,.xlsx,.xls" className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFacturaFile(e.target.files[0])} />
          {facturaFile ? (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
              <FileText size={18} className="text-green-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-800 truncate">{facturaFile.name}</p>
                <p className="text-xs text-green-600">{(facturaFile.size / 1024).toFixed(0)} KB</p>
              </div>
              <button type="button" onClick={() => setFacturaFile(null)} className="p-1 text-green-500 hover:text-red-600 transition-colors">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/30 transition-colors">
              <FileUp size={16} />
              Subir factura (opcional) — PDF, HTML, Excel
            </button>
          )}
        </div>

        {/* Observaciones */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Observaciones</label>
          <textarea value={form.observaciones} onChange={(e) => set('observaciones', e.target.value)} rows={2}
            placeholder="Notas adicionales..."
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving || uploadingFactura}
            className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-60">
            {saving || uploadingFactura ? 'Guardando...' : 'Registrar Entrada'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
