import { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Phone, Mail, MapPin, CreditCard, Building2, User, Hash, Search, Truck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Modal from '../../components/shared/Modal';
import { PageLoader } from '../../components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

interface Proveedor {
  id: number;
  nombre_local: string;
  ruc_ci: string | null;
  ubicacion: string | null;
  telefono: string | null;
  banco_cooperativa: string | null;
  tipo_cuenta: string | null;
  numero_cuenta: string | null;
  correo: string | null;
  nombre_titular: string | null;
  activo: boolean;
  created_at: string;
}

const EMPTY: Omit<Proveedor, 'id' | 'activo' | 'created_at'> = {
  nombre_local: '',
  ruc_ci: null,
  ubicacion: null,
  telefono: null,
  banco_cooperativa: null,
  tipo_cuenta: null,
  numero_cuenta: null,
  correo: null,
  nombre_titular: null,
};

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Proveedor | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.from('proveedores').select('*').eq('activo', true).order('nombre_local');
    setProveedores(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditTarget(null);
    setForm({ ...EMPTY });
    setModalOpen(true);
  }

  function openEdit(p: Proveedor) {
    setEditTarget(p);
    setForm({
      nombre_local: p.nombre_local,
      ruc_ci: p.ruc_ci,
      ubicacion: p.ubicacion,
      telefono: p.telefono,
      banco_cooperativa: p.banco_cooperativa,
      tipo_cuenta: p.tipo_cuenta,
      numero_cuenta: p.numero_cuenta,
      correo: p.correo,
      nombre_titular: p.nombre_titular,
    });
    setModalOpen(true);
  }

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value || null }));
  }

  async function handleSave() {
    if (!form.nombre_local?.trim()) { toast.error('El nombre del local es obligatorio'); return; }
    setSaving(true);
    const payload = {
      nombre_local: form.nombre_local.trim(),
      ruc_ci: form.ruc_ci?.trim() || null,
      ubicacion: form.ubicacion?.trim() || null,
      telefono: form.telefono?.trim() || null,
      banco_cooperativa: form.banco_cooperativa?.trim() || null,
      tipo_cuenta: form.tipo_cuenta || null,
      numero_cuenta: form.numero_cuenta?.trim() || null,
      correo: form.correo?.trim() || null,
      nombre_titular: form.nombre_titular?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = editTarget
      ? await supabase.from('proveedores').update(payload).eq('id', editTarget.id)
      : await supabase.from('proveedores').insert({ ...payload, activo: true });
    setSaving(false);
    if (error) { toast.error('Error al guardar: ' + error.message); return; }
    toast.success(editTarget ? 'Proveedor actualizado' : 'Proveedor creado');
    setModalOpen(false);
    load();
  }

  async function handleDelete(p: Proveedor) {
    if (!confirm(`¿Eliminar al proveedor "${p.nombre_local}"?`)) return;
    const { error } = await supabase.from('proveedores').update({ activo: false }).eq('id', p.id);
    if (error) { toast.error('Error al eliminar'); return; }
    toast.success('Proveedor eliminado');
    load();
  }

  const filtered = proveedores.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.nombre_local.toLowerCase().includes(q) ||
      (p.ruc_ci ?? '').toLowerCase().includes(q) ||
      (p.telefono ?? '').toLowerCase().includes(q) ||
      (p.correo ?? '').toLowerCase().includes(q)
    );
  });

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* KPI + toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, RUC/CI, teléfono, correo..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all duration-200"
          />
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl text-sm font-medium hover:from-indigo-600 hover:to-violet-700 transition-all duration-150 shadow-md shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap"
        >
          <Plus size={16} /> Nuevo Proveedor
        </button>
      </div>

      {/* Stat */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Truck size={15} className="text-gray-400" />
        <span><strong className="text-gray-800">{filtered.length}</strong> proveedor(es)</span>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <Truck size={28} className="text-gray-300" />
          </div>
          <p className="text-gray-500 font-medium text-sm">
            {search ? 'No se encontraron proveedores' : 'No hay proveedores registrados'}
          </p>
          {!search && (
            <button onClick={openNew} className="mt-3 text-sm text-indigo-500 hover:text-indigo-700 font-medium transition-colors">
              Agregar primer proveedor →
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 overflow-hidden">
              {/* Card header */}
              <div className="bg-gradient-to-r from-indigo-500 to-violet-600 px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                      <Truck size={18} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-bold text-sm truncate">{p.nombre_local}</p>
                      {p.ruc_ci && (
                        <p className="text-indigo-200 text-xs mt-0.5 flex items-center gap-1">
                          <Hash size={10} /> RUC/CI: {p.ruc_ci}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(p)}
                      className="p-1.5 text-white/70 hover:text-white hover:bg-white/20 rounded-lg transition-all active:scale-90">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => handleDelete(p)}
                      className="p-1.5 text-white/70 hover:text-rose-300 hover:bg-white/20 rounded-lg transition-all active:scale-90">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Card body */}
              <div className="px-5 py-4 space-y-2.5">
                {p.telefono && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Phone size={13} className="text-gray-400 flex-shrink-0" />
                    <a href={`tel:${p.telefono}`} className="text-gray-700 hover:text-indigo-600 transition-colors">{p.telefono}</a>
                  </div>
                )}
                {p.correo && (
                  <div className="flex items-center gap-2.5 text-sm">
                    <Mail size={13} className="text-gray-400 flex-shrink-0" />
                    <a href={`mailto:${p.correo}`} className="text-gray-700 hover:text-indigo-600 transition-colors truncate">{p.correo}</a>
                  </div>
                )}
                {p.ubicacion && (
                  <div className="flex items-start gap-2.5 text-sm">
                    <MapPin size={13} className="text-gray-400 flex-shrink-0 mt-0.5" />
                    <a
                      href={p.ubicacion.startsWith('http') ? p.ubicacion : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.ubicacion)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-700 text-xs underline underline-offset-2 line-clamp-2"
                    >
                      {p.ubicacion.startsWith('http') ? 'Ver en Google Maps' : p.ubicacion}
                    </a>
                  </div>
                )}

                {(p.banco_cooperativa || p.numero_cuenta) && (
                  <div className="pt-2 mt-2 border-t border-gray-100">
                    {p.banco_cooperativa && (
                      <div className="flex items-center gap-2.5 text-sm">
                        <Building2 size={13} className="text-gray-400 flex-shrink-0" />
                        <span className="text-gray-700">{p.banco_cooperativa}</span>
                        {p.tipo_cuenta && (
                          <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 text-xs font-medium capitalize">{p.tipo_cuenta}</span>
                        )}
                      </div>
                    )}
                    {p.numero_cuenta && (
                      <div className="flex items-center gap-2.5 text-sm mt-1.5">
                        <CreditCard size={13} className="text-gray-400 flex-shrink-0" />
                        <span className="text-gray-700 font-mono text-xs">{p.numero_cuenta}</span>
                      </div>
                    )}
                    {p.nombre_titular && (
                      <div className="flex items-center gap-2.5 text-sm mt-1.5">
                        <User size={13} className="text-gray-400 flex-shrink-0" />
                        <span className="text-gray-600 text-xs">{p.nombre_titular}</span>
                      </div>
                    )}
                  </div>
                )}

                {!p.telefono && !p.correo && !p.ubicacion && !p.banco_cooperativa && !p.numero_cuenta && (
                  <p className="text-xs text-gray-300 italic">Sin información de contacto registrada</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear/editar */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Editar Proveedor' : 'Nuevo Proveedor'} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Nombre del Local *</label>
              <input type="text" value={form.nombre_local ?? ''} onChange={(e) => set('nombre_local', e.target.value)}
                placeholder="Ej: Ferretería Ruiz"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">RUC / CI</label>
              <input type="text" value={form.ruc_ci ?? ''} onChange={(e) => set('ruc_ci', e.target.value)}
                placeholder="0912345678001"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Teléfono</label>
              <input type="text" value={form.telefono ?? ''} onChange={(e) => set('telefono', e.target.value)}
                placeholder="0999 000 000"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Correo Electrónico</label>
              <input type="email" value={form.correo ?? ''} onChange={(e) => set('correo', e.target.value)}
                placeholder="proveedor@ejemplo.com"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Ubicación / Link Google Maps</label>
              <input type="text" value={form.ubicacion ?? ''} onChange={(e) => set('ubicacion', e.target.value)}
                placeholder="https://maps.google.com/... o dirección física"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all" />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Datos Bancarios</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Banco / Cooperativa</label>
                <input type="text" value={form.banco_cooperativa ?? ''} onChange={(e) => set('banco_cooperativa', e.target.value)}
                  placeholder="Banco Pichincha"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Tipo de Cuenta</label>
                <select value={form.tipo_cuenta ?? ''} onChange={(e) => set('tipo_cuenta', e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 bg-white transition-all">
                  <option value="">Seleccionar...</option>
                  <option value="ahorro">Ahorro</option>
                  <option value="corriente">Corriente</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">N° de Cuenta</label>
                <input type="text" value={form.numero_cuenta ?? ''} onChange={(e) => set('numero_cuenta', e.target.value)}
                  placeholder="2200123456789"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nombre del Titular</label>
                <input type="text" value={form.nombre_titular ?? ''} onChange={(e) => set('nombre_titular', e.target.value)}
                  placeholder="Juan Pérez"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all" />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setModalOpen(false)}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors active:scale-95">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl text-sm font-medium hover:from-indigo-600 hover:to-violet-700 transition-all disabled:opacity-60 active:scale-95">
              {saving ? 'Guardando...' : editTarget ? 'Actualizar' : 'Crear Proveedor'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
