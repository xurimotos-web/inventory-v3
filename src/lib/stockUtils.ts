import { supabase } from './supabase';

export async function recalcularStock(insumoId: number): Promise<string | null> {
  const [eResult, sResult] = await Promise.all([
    supabase.from('entradas').select('cantidad').eq('insumo_id', insumoId),
    supabase.from('salidas').select('cantidad, es_asignacion').eq('insumo_id', insumoId),
  ]);
  if (eResult.error) return eResult.error.message;
  if (sResult.error) return sResult.error.message;
  const totalEntradas = (eResult.data ?? []).reduce((s, r) => s + Number(r.cantidad), 0);
  const totalSalidas = (sResult.data ?? [])
    .filter((r) => r.es_asignacion !== true)
    .reduce((s, r) => s + Number(r.cantidad), 0);
  const { error: updateError } = await supabase.from('insumos').update({
    stock_actual: Math.max(0, totalEntradas - totalSalidas),
  }).eq('id', insumoId);
  if (updateError) return updateError.message;
  return null;
}
