import { supabase } from './supabase';

export async function recalcularStock(insumoId: number): Promise<string | null> {
  console.log('[stock] recalcularStock llamado para insumo_id:', insumoId);

  // Intentar RPC primero (SECURITY DEFINER, bypasa RLS)
  const { error: rpcError } = await supabase.rpc('recalcular_stock', { p_insumo_id: insumoId });
  if (!rpcError) {
    console.log('[stock] RPC ejecutado OK');
    return null;
  }
  console.warn('[stock] RPC falló:', rpcError.message, '— usando fallback cliente');

  // Fallback: calcular en cliente
  const [{ data: ents, error: eErr }, { data: sals, error: sErr }] = await Promise.all([
    supabase.from('entradas').select('cantidad').eq('insumo_id', insumoId),
    supabase.from('salidas').select('cantidad').eq('insumo_id', insumoId),
  ]);
  if (eErr) { console.error('[stock] Error leyendo entradas:', eErr.message); return eErr.message; }
  if (sErr) { console.error('[stock] Error leyendo salidas:', sErr.message); return sErr.message; }

  const totalE = (ents ?? []).reduce((s, e) => s + Number(e.cantidad), 0);
  const totalS = (sals ?? []).reduce((s, e) => s + Number(e.cantidad), 0);
  const nuevoStock = Math.max(0, totalE - totalS);
  console.log('[stock] Cálculo: entradas=', totalE, ' salidas=', totalS, ' → nuevo stock=', nuevoStock);

  const { error: upErr, count } = await supabase
    .from('insumos')
    .update({ stock_actual: nuevoStock })
    .eq('id', insumoId)
    .select('id', { count: 'exact', head: true });

  if (upErr) {
    console.error('[stock] UPDATE bloqueado por RLS u otro error:', upErr.message);
    return upErr.message;
  }
  console.log('[stock] UPDATE ejecutado, filas afectadas:', count);
  if (count === 0) {
    console.error('[stock] ADVERTENCIA: UPDATE no afectó ninguna fila — posible bloqueo RLS silencioso');
    return 'RLS bloqueó la actualización de stock (0 filas afectadas). Aplica el trigger SQL en Supabase.';
  }
  return null;
}
