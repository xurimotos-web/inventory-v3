import { useState } from 'react';
import { Shield, ShieldCheck, Save, Copy, Info, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import {
  GRUPOS_PERMISOS, DEFAULT_EDITOR, DEFAULT_VISUALIZADOR,
  savePermisosLocal, SQL_SYSTEM_CONFIG,
  type PermisosConfig, type RolTipo, type PermisoKey, type RolePermisos,
} from '../../lib/permisos';
import { usePermissions } from '../../context/PermissionsContext';

export default function PermisosPanel() {
  const { config, reloadConfig } = usePermissions();
  const [editorPerms, setEditorPerms] = useState<RolePermisos>({ ...config.editor });
  const [visualizadorPerms, setVisualizadorPerms] = useState<RolePermisos>({ ...config.visualizador });
  const [saving, setSaving] = useState(false);
  const [showSQL, setShowSQL] = useState(false);

  function togglePerm(role: RolTipo, key: PermisoKey) {
    if (role === 'editor') {
      setEditorPerms((prev) => ({ ...prev, [key]: !prev[key] }));
    } else {
      setVisualizadorPerms((prev) => ({ ...prev, [key]: !prev[key] }));
    }
  }

  async function handleSave() {
    setSaving(true);
    const newConfig: PermisosConfig = { editor: editorPerms, visualizador: visualizadorPerms };
    savePermisosLocal(newConfig);

    try {
      const { error } = await supabase.from('system_config').upsert({
        key: 'permisos_roles',
        value: newConfig,
        updated_at: new Date().toISOString(),
      });
      if (!error) {
        toast.success('Permisos guardados en la nube');
        await reloadConfig();
        setSaving(false);
        return;
      }
    } catch {}

    toast.success('Permisos guardados localmente');
    await reloadConfig();
    setSaving(false);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="font-semibold text-gray-800">Permisos por Rol</p>
          <p className="text-xs text-gray-400 mt-0.5">Define qué puede hacer cada tipo de usuario. Los administradores siempre tienen acceso completo.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSQL(!showSQL)}
            className="flex items-center gap-1.5 px-3 py-2 border border-amber-200 bg-amber-50 text-amber-700 rounded-xl text-xs font-medium hover:bg-amber-100 transition-all"
          >
            <Info size={13} /> SQL Supabase
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl text-sm font-medium hover:from-indigo-600 hover:to-violet-700 transition-all shadow-sm shadow-indigo-500/20 disabled:opacity-60 active:scale-95">
            <Save size={14} /> {saving ? 'Guardando...' : 'Guardar Permisos'}
          </button>
        </div>
      </div>

      {/* SQL Banner */}
      {showSQL && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-xs font-semibold text-amber-800">
              Ejecutar en Supabase → SQL Editor para que los permisos funcionen en todos los dispositivos
            </p>
            <button
              onClick={() => { navigator.clipboard.writeText(SQL_SYSTEM_CONFIG); toast.success('SQL copiado'); }}
              className="flex items-center gap-1 text-xs px-2 py-1 bg-amber-200 text-amber-800 rounded-lg hover:bg-amber-300 transition-colors flex-shrink-0"
            >
              <Copy size={11} /> Copiar
            </button>
          </div>
          <pre className="text-xs text-amber-900 bg-amber-100/80 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">{SQL_SYSTEM_CONFIG}</pre>
        </div>
      )}

      {/* Role columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RoleColumn
          title="Editor"
          subtitle="Puede registrar y modificar"
          icon={<ShieldCheck size={16} className="text-white" />}
          headerGradient="from-indigo-500 to-violet-600"
          perms={editorPerms}
          onToggle={(key) => togglePerm('editor', key)}
          onReset={() => { setEditorPerms({ ...DEFAULT_EDITOR }); toast.success('Permisos de Editor restablecidos'); }}
        />
        <RoleColumn
          title="Visualizador"
          subtitle="Acceso de solo lectura"
          icon={<Shield size={16} className="text-white" />}
          headerGradient="from-slate-500 to-gray-600"
          perms={visualizadorPerms}
          onToggle={(key) => togglePerm('visualizador', key)}
          onReset={() => { setVisualizadorPerms({ ...DEFAULT_VISUALIZADOR }); toast.success('Permisos de Visualizador restablecidos'); }}
        />
      </div>

      {/* Info note */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2.5">
        <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          Para asignar el tipo de perfil a cada usuario, ve a la pestaña <strong>Usuarios</strong> → edita el usuario → selecciona <strong>Editor</strong> o <strong>Visualizador</strong>.
          Requiere ejecutar el SQL de arriba en Supabase para que funcione en todos los dispositivos.
        </p>
      </div>
    </div>
  );
}

const COLOR_MAP: Record<string, { badge: string; check: string }> = {
  indigo:  { badge: 'text-indigo-700 bg-indigo-100',  check: 'bg-indigo-500 border-indigo-500'  },
  violet:  { badge: 'text-violet-700 bg-violet-100',  check: 'bg-violet-500 border-violet-500'  },
  emerald: { badge: 'text-emerald-700 bg-emerald-100',check: 'bg-emerald-500 border-emerald-500'},
  rose:    { badge: 'text-rose-700 bg-rose-100',      check: 'bg-rose-500 border-rose-500'      },
  amber:   { badge: 'text-amber-700 bg-amber-100',    check: 'bg-amber-500 border-amber-500'    },
  blue:    { badge: 'text-blue-700 bg-blue-100',      check: 'bg-blue-500 border-blue-500'      },
  orange:  { badge: 'text-orange-700 bg-orange-100',  check: 'bg-orange-500 border-orange-500'  },
};

function RoleColumn({ title, subtitle, icon, headerGradient, perms, onToggle, onReset }: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  headerGradient: string;
  perms: RolePermisos;
  onToggle: (key: PermisoKey) => void;
  onReset: () => void;
}) {
  const activeCount = Object.values(perms).filter(Boolean).length;
  const totalCount = Object.values(perms).length;

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
      {/* Card header */}
      <div className={`bg-gradient-to-r ${headerGradient} p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              {icon}
            </div>
            <div>
              <p className="text-white font-bold text-sm">{title}</p>
              <p className="text-white/65 text-xs">{subtitle}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white font-bold text-xl leading-none">{activeCount}</p>
            <p className="text-white/60 text-xs">de {totalCount} permisos</p>
          </div>
        </div>
        <button onClick={onReset}
          className="mt-2.5 flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors">
          <RotateCcw size={10} /> Restablecer por defecto
        </button>
      </div>

      {/* Permission list */}
      <div className="p-4 space-y-4 max-h-[520px] overflow-y-auto">
        {GRUPOS_PERMISOS.map((grupo) => {
          const colors = COLOR_MAP[grupo.color] ?? { badge: 'text-gray-600 bg-gray-100', check: 'bg-gray-500 border-gray-500' };
          return (
            <div key={grupo.grupo}>
              <div className="mb-2">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${colors.badge}`}>
                  {grupo.grupo}
                </span>
              </div>
              <div className="space-y-0.5">
                {grupo.items.map((item) => (
                  <label
                    key={item.key}
                    onClick={() => onToggle(item.key)}
                    className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group select-none"
                  >
                    <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all
                      ${perms[item.key] ? colors.check : 'bg-white border-gray-300 group-hover:border-indigo-300'}`}>
                      {perms[item.key] && (
                        <svg viewBox="0 0 10 8" className="w-2.5 h-2 fill-none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="1,4 3.5,6.5 9,1" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm transition-colors leading-tight ${perms[item.key] ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
