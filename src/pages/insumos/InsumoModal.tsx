import { useEffect, useState } from 'react';
import Modal from '../../components/shared/Modal';
import ImageUpload from '../../components/shared/ImageUpload';
import ComboBox from '../../components/shared/ComboBox';
import { supabase } from '../../lib/supabase';
import type { Insumo, Categoria, Unidad } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { recalcularStock } from '../../lib/stockUtils';
import toast from 'react-hot-toast';

interface InsumoModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  insumo?: Insumo | null;
}

const EMPTY = {
  codigo: '', nombre: '', descripcion: '', referencia: '', tienda_referencia: '',
  categoria_id: '', unidad: 'unidad', proveedor: '',
  stock_actual: 0, stock_minimo: 0, costo_unitario: 0, imagen_url: '',
};

async function generateCodigo(): Promise<string> {
  const { count } = await supabase.from('insumos').select('*', { count: 'exact', head: true });
  return `INS-${String((count ?? 0) + 1).padStart(3, '0')}`;
}

export default function InsumoModal({ open, onClose, onSaved, insumo }: InsumoModalProps) {
  const { user } = useAuth();
  const [form, setForm] = useState({ ...EMPTY });
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [proveedores, setProveedores] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const isEdit = !!insumo;

  useEffect(() => {
    if (!open) return;
    supabase.from('categorias').select('*').order('nombre').then(({ data }) => setCategorias(data ?? []));
    supabase.from('unidades').select('*').order('nombre').then(({ data }) => setUnidades(data ?? []));
    supabase.from('proveedores').select('nombre').order('nombre').then(({ data }) => setProveedores((data ?? []).map((p: { nombre: string }) => p.nombre)));
  }, [open]);

  useEffect(() => {
    if (insumo) {
      setForm({
        codigo: insumo.codigo ?? '',
        nombre: insumo.nombre,
        descripcion: insumo.descripcion ?? '',
        referencia: insumo.referencia ?? '',
        tienda_referencia: (insumo as unknown as { tienda_referencia?: string }).tienda_referencia ?? '',
        categoria_id: String(insumo.categoria_id ?? ''),
        unidad: insumo.unidad,
        proveedor: (insumo as unknown as { proveedor?: string }).proveedor ?? '',
        stock_actual: insumo.stock_actual,
        stock_minimo: insumo.stock_minimo,
        costo_unitario: insumo.costo_unitario,
        imagen_url: insumo.imagen_url ?? '',
      });
    } else {
      generateCodigo().then((codigo) => setForm({ ...EMPTY, codigo }));
    }
  }, [insumo, open]);

  function set(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!form.nombre.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);

    const base = {
      codigo: form.codigo.trim() || null,
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      referencia: form.referencia.trim() || null,
      tienda_referencia: form.tienda_referencia.trim() || null,
      categoria_id: form.categoria_id ? Number(form.categoria_id) : null,
      unidad: form.unidad,
      proveedor: form.proveedor.trim() || null,
      stock_minimo: Number(form.stock_minimo),
      costo_unitario: Number(form.costo_unitario),
      imagen_url: form.imagen_url || null,
      updated_at: new Date().toISOString(),
    };

    if (isEdit) {
      // stock_actual is Kardex-derived — never overwrite it directly on edit
      const { error } = await supabase.from('insumos').update(base).eq('id', insumo!.id);
      if (error) { toast.error('Error al guardar el insumo'); setSaving(false); return; }
      toast.success('Insumo actualizado');
      onSaved(); onClose();
    } else {
      // Create with stock_actual = 0; initial stock becomes an entrada so Kardex is consistent
      const stockInicial = Number(form.stock_actual);
      const { data: created, error } = await supabase
        .from('insumos')
        .insert({ ...base, stock_actual: 0 })
        .select('id')
        .single();

      if (error || !created) { toast.error('Error al crear el insumo: ' + (error?.message ?? 'sin respuesta')); setSaving(false); return; }

      if (stockInicial > 0) {
        await supabase.from('entradas').insert({
          insumo_id: created.id,
          cantidad: stockInicial,
          costo_unitario: Number(form.costo_unitario) || 0,
          observaciones: 'Stock inicial al crear el insumo',
          usuario_id: user!.id,
        });
        await recalcularStock(created.id);
      }

      toast.success('Insumo creado correctamente');
      onSaved(); onClose();
    }
    setSaving(false);
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Insumo' : 'Nuevo Insumo'} size="lg">
      <div className="space-y-4">
        {/* Imagen */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Imagen referencial</label>
          <ImageUpload value={form.imagen_url || undefined} onChange={(url) => set('imagen_url', url ?? '')} />
        </div>

        {/* Código y Nombre */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Código</label>
            <input type="text" value={form.codigo} onChange={(e) => set('codigo', e.target.value)}
              placeholder="Auto: INS-001"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre del insumo *</label>
            <input type="text" value={form.nombre} onChange={(e) => set('nombre', e.target.value)}
              placeholder="Ej: Papel bond A4"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Descripción</label>
          <textarea value={form.descripcion} onChange={(e) => set('descripcion', e.target.value)} rows={2}
            placeholder="Descripción opcional..."
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        {/* Referencia y Tienda */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Referencia proveedor</label>
            <input type="text" value={form.referencia} onChange={(e) => set('referencia', e.target.value)}
              placeholder="Ej: REF-001, SKU123"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tienda / Local</label>
            <input type="text" value={form.tienda_referencia} onChange={(e) => set('tienda_referencia', e.target.value)}
              placeholder="Ej: Ferretería Juan"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Proveedor */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Proveedor principal</label>
          <ComboBox
            options={proveedores.map((p) => ({ value: p, label: p }))}
            value={form.proveedor}
            onChange={(val) => set('proveedor', val)}
            placeholder="Buscar o escribir proveedor..."
            freeText
          />
          {proveedores.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {proveedores.map((p) => (
                <button key={p} type="button" onClick={() => set('proveedor', p)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all duration-150 active:scale-95 ${
                    form.proveedor === p
                      ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300'
                  }`}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Categoría y Unidad */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Categoría</label>
            <select value={form.categoria_id} onChange={(e) => set('categoria_id', e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Sin categoría</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Unidad *</label>
            <select value={form.unidad} onChange={(e) => set('unidad', e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {unidades.length > 0
                ? unidades.map((u) => <option key={u.id} value={u.nombre}>{u.nombre}</option>)
                : ['unidad','kg','g','litro','ml','caja','paquete','rollo','metro','par'].map((u) => <option key={u} value={u}>{u}</option>)
              }
            </select>
          </div>
        </div>

        {/* Stock y Costo */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {isEdit ? 'Stock actual (calculado)' : 'Stock inicial'}
            </label>
            <input
              type="number" min="0" step="0.01"
              value={form.stock_actual}
              onChange={(e) => set('stock_actual', e.target.value)}
              disabled={isEdit}
              title={isEdit ? 'El stock se actualiza automáticamente mediante entradas y salidas' : undefined}
              className={`w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${isEdit ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
            />
            {isEdit && (
              <p className="text-xs text-gray-400 mt-1">Modificar desde Entradas o Salidas</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Stock mínimo</label>
            <input type="number" min="0" step="0.01" value={form.stock_minimo} onChange={(e) => set('stock_minimo', e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Costo unitario</label>
            <input type="number" min="0" step="0.01" value={form.costo_unitario} onChange={(e) => set('costo_unitario', e.target.value)}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60">
            {saving ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear Insumo'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
