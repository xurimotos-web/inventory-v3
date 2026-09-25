import { useEffect, useState } from 'react';
import Modal from '../../components/shared/Modal';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';

interface UsuarioModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  usuario?: Profile | null;
}

const EMPTY = {
  nombre: '', email: '', password: '', departamento: '',
  cargo: '', rol: 'usuario' as 'admin' | 'usuario', activo: true,
  perfil_tipo: 'visualizador' as 'editor' | 'visualizador',
};

const selectCls = 'w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

async function adminChangePassword(userId: string, newPassword: string): Promise<string | null> {
  const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!serviceKey || serviceKey === 'PENDIENTE') return 'Service key no configurada';

  const res = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
    },
    body: JSON.stringify({ password: newPassword }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return data.message ?? 'Error al cambiar contraseña';
  }
  return null;
}

export default function UsuarioModal({ open, onClose, onSaved, usuario }: UsuarioModalProps) {
  const { user: me } = useAuth();
  const [form, setForm] = useState({ ...EMPTY });
  const [newPassword, setNewPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [departamentos, setDepartamentos] = useState<string[]>([]);
  const [cargos, setCargos] = useState<string[]>([]);
  const isEdit = !!usuario;
  const isSelf = usuario?.id === me?.id;

  useEffect(() => {
    supabase.from('departamentos').select('nombre').order('nombre')
      .then(({ data }) => setDepartamentos((data ?? []).map((d) => d.nombre)));
    supabase.from('cargos').select('nombre').order('nombre')
      .then(({ data }) => setCargos((data ?? []).map((c) => c.nombre)));
  }, [open]);

  useEffect(() => {
    if (usuario) {
      setForm({
        nombre: usuario.nombre,
        email: usuario.email ?? '',
        password: '',
        departamento: usuario.departamento,
        cargo: usuario.cargo,
        rol: usuario.rol,
        activo: usuario.activo,
        perfil_tipo: usuario.perfil_tipo ?? 'visualizador',
      });
    } else {
      setForm({ ...EMPTY });
    }
    setNewPassword('');
    setShowPass(false);
    setShowNewPass(false);
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
    if (newPassword && newPassword.length < 6) { toast.error('La nueva contraseña debe tener al menos 6 caracteres'); return; }

    setSaving(true);

    if (isEdit) {
      const { error } = await supabase.from('profiles').update({
        nombre: form.nombre.trim(),
        departamento: form.departamento.trim(),
        cargo: form.cargo.trim(),
        rol: form.rol,
      }).eq('id', usuario!.id);

      if (error) { toast.error('Error al actualizar: ' + error.message); setSaving(false); return; }

      if (!isSelf) {
        const { error: error2 } = await supabase.from('profiles').update({
          activo: form.activo,
        }).eq('id', usuario!.id);

        if (error2) { toast.error('Error al actualizar estado: ' + error2.message); setSaving(false); return; }

        await supabase.from('profiles').update({
          perfil_tipo: form.perfil_tipo,
        }).eq('id', usuario!.id);
      }

      if (newPassword) {
        if (isSelf) {
          const { error: passError } = await supabase.auth.updateUser({ password: newPassword });
          if (passError) { toast.error('Perfil guardado, pero error al cambiar contraseña'); setSaving(false); return; }
        } else {
          const err = await adminChangePassword(usuario!.id, newPassword);
          if (err) { toast.error(`Perfil guardado, pero: ${err}`); setSaving(false); return; }
        }
        toast.success('Usuario y contraseña actualizados');
      } else {
        toast.success('Usuario actualizado');
      }
    } else {
      const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY;
      const url = import.meta.env.VITE_SUPABASE_URL;

      const res = await fetch(`${url}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
        },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          email_confirm: true,
          user_metadata: { nombre: form.nombre.trim() },
        }),
      });

      const authData = await res.json();
      if (!res.ok || !authData.id) {
        toast.error(authData.message ?? 'Error al crear el usuario');
        setSaving(false);
        return;
      }

      const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.id,
        nombre: form.nombre.trim(),
        departamento: form.departamento.trim(),
        cargo: form.cargo.trim(),
        rol: form.rol,
        activo: true,
      });

      if (profileError) { toast.error('Error al crear el perfil'); setSaving(false); return; }
      toast.success('Usuario creado. Puede ingresar de inmediato.');
    }

    onSaved();
    onClose();
    setSaving(false);
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Usuario' : 'Nuevo Usuario'} size="md">
      <div className="space-y-4">

        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre completo *</label>
          <input type="text" value={form.nombre} onChange={(e) => set('nombre', e.target.value)}
            placeholder="Ej: Juan Pérez"
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {/* Email + contraseña solo al crear */}
        {!isEdit && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Correo electrónico *</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                placeholder="usuario@empresa.com"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña *</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full pr-10 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Departamento y cargo — dropdowns */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Departamento *</label>
            <select value={form.departamento} onChange={(e) => set('departamento', e.target.value)} className={selectCls}>
              <option value="">Seleccionar...</option>
              {/* Mantener valor actual aunque no esté en la lista */}
              {form.departamento && !departamentos.includes(form.departamento) && (
                <option value={form.departamento}>{form.departamento}</option>
              )}
              {departamentos.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            {departamentos.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">Sin departamentos. Agrégalos en Configuración.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Cargo *</label>
            <select value={form.cargo} onChange={(e) => set('cargo', e.target.value)} className={selectCls}>
              <option value="">Seleccionar...</option>
              {form.cargo && !cargos.includes(form.cargo) && (
                <option value={form.cargo}>{form.cargo}</option>
              )}
              {cargos.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {cargos.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">Sin cargos. Agrégalos en Configuración.</p>
            )}
          </div>
        </div>

        {/* Rol */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Rol de acceso *</label>
          <div className="grid grid-cols-2 gap-3">
            {(['usuario', 'admin'] as const).map((rol) => (
              <button key={rol} type="button" onClick={() => set('rol', rol)}
                className={`px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all text-left
                  ${form.rol === rol ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                <p className="font-semibold capitalize">{rol}</p>
                <p className="text-xs opacity-70 mt-0.5">
                  {rol === 'admin' ? 'Acceso completo al sistema' : 'Solo puede registrar salidas'}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Tipo de perfil — solo al editar usuarios no-admin y no uno mismo */}
        {isEdit && !isSelf && form.rol === 'usuario' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de acceso</label>
            <div className="grid grid-cols-2 gap-3">
              {(['editor', 'visualizador'] as const).map((tipo) => (
                <button key={tipo} type="button"
                  onClick={() => setForm((prev) => ({ ...prev, perfil_tipo: tipo }))}
                  className={`px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all text-left
                    ${form.perfil_tipo === tipo ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  <p className="font-semibold capitalize">{tipo}</p>
                  <p className="text-xs opacity-70 mt-0.5">
                    {tipo === 'editor' ? 'Puede registrar y modificar' : 'Solo lectura y consultas'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Estado activo/inactivo — solo al editar y no uno mismo */}
        {isEdit && !isSelf && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado del usuario</label>
            <button type="button"
              onClick={() => setForm((prev) => ({ ...prev, activo: !prev.activo }))}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all duration-200
                ${form.activo ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-rose-300 bg-rose-50 text-rose-700'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full flex-shrink-0 ${form.activo ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                <div className="text-left">
                  <p className="text-sm font-semibold">{form.activo ? 'Activo' : 'Inactivo'}</p>
                  <p className="text-xs opacity-70 mt-0.5">
                    {form.activo ? 'El usuario puede iniciar sesión' : 'El usuario no puede acceder al sistema'}
                  </p>
                </div>
              </div>
              <div className={`w-11 h-6 rounded-full transition-all duration-300 relative flex-shrink-0 ${form.activo ? 'bg-emerald-500' : 'bg-rose-400'}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${form.activo ? 'left-5' : 'left-0.5'}`} />
              </div>
            </button>
          </div>
        )}

        {/* Cambiar contraseña al editar */}
        {isEdit && (
          <div className="border border-dashed border-gray-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <KeyRound size={14} className="text-gray-400" />
              <p className="text-sm font-medium text-gray-600">Cambiar contraseña</p>
              <span className="text-xs text-gray-400">(opcional)</span>
            </div>
            <div className="relative">
              <input
                type={showNewPass ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Dejar en blanco para no cambiar"
                className="w-full pr-10 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="button" onClick={() => setShowNewPass(!showNewPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {newPassword && newPassword.length < 6 && (
              <p className="text-xs text-red-500">Mínimo 6 caracteres</p>
            )}
          </div>
        )}

        {/* Botones */}
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
