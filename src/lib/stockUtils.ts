import { supabase } from './supabase';

export async function recalcularStock(insumoId: number): Promise<void> {
  const [eResult, sResult] = await Promise.all([
    supabase.from('entradas').select('cantidad').eq('insumo_id', insumoId),
    supabase.from('salidas').select('cantidad, es_asignacion').eq('insumo_id', insumoId),
  ]);
  if (eResult.error || sResult.error) return;
  const totalEntradas = (eResult.data ?? []).reduce((s, r) => s + Number(r.cantidad), 0);
  const totalSalidas = (sResult.data ?? [])
    .filter((r) => r.es_asignacion !== true)
    .reduce((s, r) => s + Number(r.cantidad), 0);
  await supabase.from('insumos').update({
    stock_actual: Math.max(0, totalEntradas - totalSalidas),
    updated_at: new Date().toISOString(),
  }).eq('id', insumoId);
}
