import type { Insumo } from '../../types';
import { getStockEstado } from '../../types';

interface StockBadgeProps {
  insumo: Pick<Insumo, 'stock_actual' | 'stock_minimo'>;
  showValue?: boolean;
}

export default function StockBadge({ insumo, showValue = false }: StockBadgeProps) {
  const estado = getStockEstado(insumo);

  const config = {
    ok: { label: 'En stock', classes: 'bg-green-100 text-green-700 border border-green-200' },
    bajo: { label: 'Stock bajo', classes: 'bg-amber-100 text-amber-700 border border-amber-200' },
    agotado: { label: 'Agotado', classes: 'bg-red-100 text-red-700 border border-red-200' },
  };

  const { label, classes } = config[estado];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${classes}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${estado === 'ok' ? 'bg-green-500' : estado === 'bajo' ? 'bg-amber-500' : 'bg-red-500'}`} />
      {showValue ? `${insumo.stock_actual}` : label}
    </span>
  );
}
