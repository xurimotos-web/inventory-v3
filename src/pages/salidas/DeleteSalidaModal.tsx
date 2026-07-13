import { useEffect, useState } from 'react';
import Modal from '../../components/shared/Modal';
import { supabase } from '../../lib/supabase';
import type { Salida } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangle, Trash2, KeyRound, PackageMinus } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate } from '../../lib/exportExcel';

interface DeleteSalidaModalProps {
  open: boolean;
  salidas: Salida[];
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeleteSalidaModal({ open, salidas, onClose, onDeleted }: DeleteSalidaModalProps) {
  const { user } = useAuth();
  const [motivo, setMotivo] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) { setMotivo(''); setPassword(''); setShowPassword(false); }
  }, [open]);

  async function handleDelete() {
    if (!motivo.trim()) { toast.error('Debes ingresar el motivo de eliminación'); return; }
    if (motivo.trim().length < 10) { toast.error('El motivo debe tener al menos 10 caracteres'); return; }
    if (!password.trim()) { toast.error('Ingresa tu contraseña para confirmar'); return; }

    setDeleting(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user!.email!,
      password,
    });

    if (authError) {
      toast.error('Contraseña incorrecta. Operación cancelada.');
      setDeleting(false);
      return;
    }

    const stockMap = new Map<number, number>();
    for (const s of salidas) {
      stockMap.set(s.insumo_id, (stockMap.get(s.insumo_id) ?? 0) + Number(s.cantidad));
    }

    const ids = salidas.map((s) => s.id);
    const { error: deleteError } = await supabase.from('salidas').delete().in('id', ids);

    if (deleteError) {
      toast.error('Error al eliminar los registros');
      setDeleting(false);
      return;
    }

    for (const [insumo_id, cantidad] of stockMap.entries()) {
      const { data: insumo } = await supabase
        .from('insumos').select('stock_actual').eq('id', insumo_id).single();
      if (insumo) {
        await supabase.from('insumos').update({
          stock_actual: insumo.stock_actual + cantidad,
          updated_at: new Date().toISOString(),
        }).eq('id', insumo_id);
      }
    }

    toast.success(`${ids.length} salida(s) eliminada(s) y stock restaurado`);
    setDeleting(false);
    onDeleted();
    onClose();
  }

  const total = salidas.reduce((acc, s) => acc + Number(s.cantidad), 0);

  return (
    <Modal open={open} onClose={onClose} title="Eliminar Salidas" size="md">
      <div className="space-y-5">
        {/* Advertencia */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <p className="text-red-800 font-semibold text-sm">Acción irreversible</p>
            <p className="text-red-600 text-xs mt-0.5">
              Se eliminarán <strong>{salidas.length}</strong> registro(s) permanentemente de la base de datos
              y se restaurará el stock correspondiente.
            </p>
          </div>
        </div>

        {/* Lista de salidas a eliminar */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Registros a eliminar ({salidas.length})
          </p>
          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
            {salidas.map((s) => {
              const insumo = s.insumo as unknown as { nombre: string; unidad: string } | undefined;
              const profile = s.profile as unknown as { nombre: string } | undefined;
              return (
                <div key={s.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-xs">
                  <PackageMinus size={13} className="text-red-400 flex-shrink-0" />
                  <span className="font-medium text-gray-700 truncate flex-1">{insumo?.nombre ?? `Salida #${s.id}`}</span>
                  <span className="text-red-600 font-semibold whitespace-nowrap">
                    -{s.cantidad} {insumo?.unidad}
                  </span>
                  <span className="text-gray-400 whitespace-nowrap">{formatDate(s.created_at)}</span>
                  {profile?.nombre && <span className="text-gray-400 truncate max-w-20">{profile.nombre}</span>}
                </div>
              );
            })}
          </div>
          {salidas.length > 1 && (
            <p className="text-xs text-gray-400 mt-1.5 text-right">
              Total a restaurar en stock: <strong className="text-green-600">+{total} unidades</strong>
            </p>
          )}
        </div>

        {/* Motivo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Motivo de eliminación <span className="text-red-500">*</span>
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            placeholder="Describe el motivo por el cual se elimina este(os) registro(s)..."
            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
          />
          <p className="text-xs text-gray-400 mt-0.5">{motivo.trim().length} / mín. 10 caracteres</p>
        </div>

        {/* Contraseña */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
            <KeyRound size={14} className="text-red-400" />
            Contraseña de administrador <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresa tu contraseña para confirmar"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 pr-20"
              onKeyDown={(e) => { if (e.key === 'Enter') handleDelete(); }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
            >
              {showPassword ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">La contraseña es verificada de forma segura antes de eliminar.</p>
        </div>

        {/* Botones */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            disabled={deleting}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting || !motivo.trim() || !password.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 shadow-sm shadow-red-600/30"
          >
            <Trash2 size={15} />
            {deleting ? 'Verificando...' : `Eliminar ${salidas.length > 1 ? `${salidas.length} registros` : 'registro'}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
