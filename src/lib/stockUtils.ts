import { supabase } from './supabase';

export async function recalcularStock(insumoId: number): Promise<string | null> {
  const { error } = await supabase.rpc('recalcular_stock', { p_insumo_id: insumoId });
  if (error) return error.message;
  return null;
}
