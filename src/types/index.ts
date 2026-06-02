export type Rol = 'admin' | 'usuario';

export interface Profile {
  id: string;
  nombre: string;
  departamento: string;
  cargo: string;
  rol: Rol;
  activo: boolean;
  created_at: string;
  email?: string;
}

export interface Categoria {
  id: number;
  nombre: string;
  descripcion?: string;
  created_at: string;
}

export interface Insumo {
  id: number;
  nombre: string;
  descripcion?: string;
  categoria_id?: number;
  categoria?: Categoria;
  unidad: string;
  stock_actual: number;
  stock_minimo: number;
  costo_unitario: number;
  imagen_url?: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Entrada {
  id: number;
  insumo_id: number;
  insumo?: Insumo;
  cantidad: number;
  costo_unitario: number;
  proveedor?: string;
  numero_factura?: string;
  observaciones?: string;
  usuario_id: string;
  profile?: Profile;
  created_at: string;
}

export interface Salida {
  id: number;
  insumo_id: number;
  insumo?: Insumo;
  cantidad: number;
  usuario_id: string;
  profile?: Profile;
  departamento: string;
  cargo: string;
  observaciones?: string;
  created_at: string;
}

export type StockEstado = 'ok' | 'bajo' | 'agotado';

export function getStockEstado(insumo: Pick<Insumo, 'stock_actual' | 'stock_minimo'>): StockEstado {
  if (insumo.stock_actual <= 0) return 'agotado';
  if (insumo.stock_actual <= insumo.stock_minimo) return 'bajo';
  return 'ok';
}
