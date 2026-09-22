export type PermisoKey =
  | 'ver_insumos' | 'ver_entradas' | 'ver_salidas' | 'ver_asignaciones'
  | 'ver_proveedores' | 'ver_rotacion' | 'ver_reportes' | 'ver_alertas'
  | 'insumos_crear' | 'insumos_editar' | 'insumos_eliminar' | 'insumos_exportar'
  | 'entradas_crear' | 'entradas_eliminar' | 'entradas_exportar'
  | 'salidas_crear' | 'salidas_editar' | 'salidas_eliminar' | 'salidas_exportar'
  | 'reportes_exportar'
  | 'proveedores_crear' | 'proveedores_editar' | 'proveedores_eliminar'
  | 'alertas_solicitar';

export type RolTipo = 'editor' | 'visualizador';

export interface GrupoPermiso {
  grupo: string;
  color: string;
  items: { key: PermisoKey; label: string }[];
}

export const GRUPOS_PERMISOS: GrupoPermiso[] = [
  {
    grupo: 'Módulos visibles',
    color: 'indigo',
    items: [
      { key: 'ver_insumos', label: 'Catálogo de Insumos' },
      { key: 'ver_entradas', label: 'Sección Entradas' },
      { key: 'ver_salidas', label: 'Sección Salidas' },
      { key: 'ver_asignaciones', label: 'Sección Asignaciones' },
      { key: 'ver_proveedores', label: 'Sección Proveedores' },
      { key: 'ver_rotacion', label: 'Rotación de Insumos' },
      { key: 'ver_reportes', label: 'Reportes' },
      { key: 'ver_alertas', label: 'Alertas de Stock' },
    ],
  },
  {
    grupo: 'Insumos',
    color: 'violet',
    items: [
      { key: 'insumos_crear', label: 'Crear nuevos insumos' },
      { key: 'insumos_editar', label: 'Editar insumos existentes' },
      { key: 'insumos_eliminar', label: 'Eliminar insumos' },
      { key: 'insumos_exportar', label: 'Exportar a Excel' },
    ],
  },
  {
    grupo: 'Entradas',
    color: 'emerald',
    items: [
      { key: 'entradas_crear', label: 'Registrar entradas' },
      { key: 'entradas_eliminar', label: 'Eliminar entradas' },
      { key: 'entradas_exportar', label: 'Exportar a Excel' },
    ],
  },
  {
    grupo: 'Salidas',
    color: 'rose',
    items: [
      { key: 'salidas_crear', label: 'Registrar salidas' },
      { key: 'salidas_editar', label: 'Editar salidas' },
      { key: 'salidas_eliminar', label: 'Eliminar salidas' },
      { key: 'salidas_exportar', label: 'Exportar a Excel' },
    ],
  },
  {
    grupo: 'Reportes',
    color: 'amber',
    items: [
      { key: 'reportes_exportar', label: 'Exportar reportes (PDF / Excel)' },
    ],
  },
  {
    grupo: 'Proveedores',
    color: 'blue',
    items: [
      { key: 'proveedores_crear', label: 'Crear proveedores' },
      { key: 'proveedores_editar', label: 'Editar proveedores' },
      { key: 'proveedores_eliminar', label: 'Eliminar proveedores' },
    ],
  },
  {
    grupo: 'Alertas',
    color: 'orange',
    items: [
      { key: 'alertas_solicitar', label: 'Solicitar reabastecimiento de stock' },
    ],
  },
];

export type RolePermisos = Record<PermisoKey, boolean>;

export const DEFAULT_EDITOR: RolePermisos = {
  ver_insumos: true,
  ver_entradas: true,
  ver_salidas: true,
  ver_asignaciones: true,
  ver_proveedores: false,
  ver_rotacion: false,
  ver_reportes: false,
  ver_alertas: true,
  insumos_crear: false,
  insumos_editar: true,
  insumos_eliminar: false,
  insumos_exportar: true,
  entradas_crear: true,
  entradas_eliminar: false,
  entradas_exportar: true,
  salidas_crear: true,
  salidas_editar: true,
  salidas_eliminar: true,
  salidas_exportar: true,
  reportes_exportar: false,
  proveedores_crear: false,
  proveedores_editar: false,
  proveedores_eliminar: false,
  alertas_solicitar: true,
};

export const DEFAULT_VISUALIZADOR: RolePermisos = {
  ver_insumos: true,
  ver_entradas: false,
  ver_salidas: true,
  ver_asignaciones: false,
  ver_proveedores: false,
  ver_rotacion: false,
  ver_reportes: false,
  ver_alertas: true,
  insumos_crear: false,
  insumos_editar: false,
  insumos_eliminar: false,
  insumos_exportar: false,
  entradas_crear: false,
  entradas_eliminar: false,
  entradas_exportar: false,
  salidas_crear: true,
  salidas_editar: false,
  salidas_eliminar: false,
  salidas_exportar: false,
  reportes_exportar: false,
  proveedores_crear: false,
  proveedores_editar: false,
  proveedores_eliminar: false,
  alertas_solicitar: true,
};

export interface PermisosConfig {
  editor: RolePermisos;
  visualizador: RolePermisos;
}

const LS_KEY = 'inventario_v3_permisos';

export function loadPermisosLocal(): PermisosConfig {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        editor: { ...DEFAULT_EDITOR, ...parsed.editor },
        visualizador: { ...DEFAULT_VISUALIZADOR, ...parsed.visualizador },
      };
    }
  } catch {}
  return { editor: DEFAULT_EDITOR, visualizador: DEFAULT_VISUALIZADOR };
}

export function savePermisosLocal(config: PermisosConfig) {
  localStorage.setItem(LS_KEY, JSON.stringify(config));
}

export const CONFIG_PIN = '300997';
const PIN_SESSION_KEY = 'inventario_config_unlocked';

export function checkPinSession(): boolean {
  return sessionStorage.getItem(PIN_SESSION_KEY) === '1';
}

export function setPinSession() {
  sessionStorage.setItem(PIN_SESSION_KEY, '1');
}

export const SQL_SYSTEM_CONFIG = `-- Ejecutar en Supabase → SQL Editor para persistencia multi-dispositivo:
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all" ON system_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write" ON system_config FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin')
);

-- Columna para tipo de perfil por usuario:
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS perfil_tipo TEXT DEFAULT 'visualizador'
  CHECK (perfil_tipo IN ('editor', 'visualizador'));`;
