import { useEffect, useState } from 'react';
import Modal from '../../components/shared/Modal';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types';
import toast from 'react-hot-toast';

interface UsuarioModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  usuario?: Profile | null;
}

const EMPTY = {
  nombre: '', email: '', password: '', departamento: '',
  cargo: '', rol: 'usuario' as 'admin' | 'usuario',
};

export default function UsuarioModal({ open, onClose, onSaved, usuario }: UsuarioModalProps) {
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const isEdit = !!usuario;

  useEffect(() => {
    if (usuario) {
      setForm({
        nombre: usuario.nombre,
        email: usuario.email ?? '',
        password: '',
        departamento: usuario.departamento,
        cargo: usuario.cargo,
        rol: usuario.rol,
      });
    } else {
      setForm({ ...EMPTY });
    }
  }, [usuario, open]);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!form.nombre.trim()) { toast.error('El nombre es obligatorio'); return; }
    if (!form.departamento.trim()) { toast.error('El departamento es obligatorio'); return; }
    if (!form.cargo.trim()) { toast.error('El cargo es obligatorio'); return; }
    if (!isEdit && !form.email.trim()) { toast.error('El email es obligatorio'); return; }
    if (!isEdit && form.password.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return; }

    setSaving(true);

    if (isEdit) {
      // Solo actualizar perfil
      const { error } = await supabase.from('profiles').update({
        nombre: form.nombre.trim(),
        departamento: form.departamento.trim(),
        cargo: form.cargo.trim(),
        rol: form.rol,
      }).eq('id', usuario!.id);

      if (error) { toast.error('Error al actualizar el usuario'); setSaving(false); return; }
      toast.success('Usuario actualizado');
    } else {
      // Crear usuario con Supabase Auth Admin (requiere función edge o service key)
      // Usamos signUp en el cliente por limitación de la capa gratuita
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { nombre: form.nombre.trim() } }
      });

      if (error || !data.user) {
        toast.error(error?.message ?? 'Error al crear el usuario');
        setSaving(false);
        return;
      }

      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        nombre: form.nombre.trim(),
        departamento: form.departamento.trim(),
        cargo: form.cargo.trim(),
        rol: form.rol,
        activo: true,
      });

      if (profileError) {
        toast.error('Error al crear el perfil del usuario');
        setSaving(false);
        return;
      }
      toast.success('Usuario creado. El usuario debe verificar su email para activar la cuenta.');
    }

    onSaved();
    onClose();
    setSaving(false);
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Usuario' : 'Nuevo Usuario'} size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo *</label>
          <input type="text" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Ej: Juan Pérez"
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {!isEdit && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Correo electrónico *</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="usuario@empresa.com"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña *</label>
              <input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Mínimo 6 caracteres"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Departamento *</label>
            <input type="text" value={form.departamento} onChange={(e) => set('departamento', e.target.value)} placeholder="Ej: Operaciones"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Cargo *</label>
            <input type="text" value={form.cargo} onChange={(e) => set('cargo', e.target.value)} placeholder="Ej: Técnico"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Rol de acceso *</label>
          <div className="grid grid-cols-2 gap-3">
            {(['usuario', 'admin'] as const).map((rol) => (
              <button
                key={rol}
                type="button"
                onClick={() => set('rol', rol)}
                className={`px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all text-left
                  ${form.rol === rol ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                <p className="font-semibold capitalize">{rol}</p>
                <p className="text-xs opacity-70 mt-0.5">
                  {rol === 'admin' ? 'Acceso completo al sistema' : 'Solo puede registrar salidas'}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60">
            {saving ? 'Guardando...' : isEdit ? 'Actualizar' : 'Crear Usuario'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
