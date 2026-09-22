import type { Insumo } from '../../types';
import { getStockEstado } from '../../types';

interface StockBadgeProps {
  insumo: Pick<Insumo, 'stock_actual' | 'stock_minimo'>;
  showValue?: boolean;
}

export default function StockBadge({ insumo, showValue = false }: StockBadgeProps) {
  const estado = getStockEstado(insumo);

  const config = {
    ok:      { label: 'En stock',   dot: 'bg-emerald-400', classes: 'bg-emerald-50 text-emerald-700 border border-emerald-200/70' },
    bajo:    { label: 'Stock bajo', dot: 'bg-amber-400',   classes: 'bg-amber-50 text-amber-700 border border-amber-200/70' },
    agotado: { label: 'Agotado',    dot: 'bg-rose-400',    classes: 'bg-rose-50 text-rose-700 border border-rose-200/70' },
  };

  const { label, dot, classes } = config[estado];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${classes} whitespace-nowrap`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot} flex-shrink-0`} />
      {showValue ? `${insumo.stock_actual}` : label}
    </span>
  );
}
