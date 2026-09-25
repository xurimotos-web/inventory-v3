import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import {
  loadPermisosLocal, DEFAULT_EDITOR, DEFAULT_VISUALIZADOR,
  type PermisoKey, type RolTipo, type PermisosConfig,
} from '../lib/permisos';

interface PermissionsContextValue {
  can: (key: PermisoKey) => boolean;
  rolTipo: RolTipo;
  config: PermisosConfig;
  reloadConfig: () => Promise<void>;
}

const defaultConfig: PermisosConfig = { editor: DEFAULT_EDITOR, visualizador: DEFAULT_VISUALIZADOR };

const PermissionsContext = createContext<PermissionsContextValue>({
  can: () => true,
  rolTipo: 'visualizador',
  config: defaultConfig,
  reloadConfig: async () => {},
});

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { isAdmin, profile } = useAuth();
  const [config, setConfig] = useState<PermisosConfig>(loadPermisosLocal());
  const [rolTipo, setRolTipo] = useState<RolTipo>('visualizador');

  async function loadConfig() {
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'permisos_roles')
        .maybeSingle();
      if (!error && data?.value) {
        const v = data.value as PermisosConfig;
        setConfig({
          editor: { ...DEFAULT_EDITOR, ...v.editor },
          visualizador: { ...DEFAULT_VISUALIZADOR, ...v.visualizador },
        });
        return;
      }
    } catch {}
    setConfig(loadPermisosLocal());
  }

  async function loadRolTipo() {
    if (!profile) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('perfil_tipo')
        .eq('id', profile.id)
        .single();
      if (data && (data as any).perfil_tipo) {
        setRolTipo((data as any).perfil_tipo as RolTipo);
        return;
      }
    } catch {}
    setRolTipo('visualizador');
  }

  useEffect(() => {
    loadConfig();
    if (!isAdmin && profile) loadRolTipo();

    // Realtime: reload permissions whenever system_config changes
    const channel = supabase
      .channel('permisos_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_config' }, () => {
        loadConfig();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, isAdmin]);

  function can(key: PermisoKey): boolean {
    if (isAdmin) return true;
    const perms = rolTipo === 'editor' ? config.editor : config.visualizador;
    return perms[key] ?? false;
  }

  return (
    <PermissionsContext.Provider value={{ can, rolTipo, config, reloadConfig: loadConfig }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}
