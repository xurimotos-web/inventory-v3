import { useEffect, useState } from 'react';
import { AlertTriangle, Download, Package, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Insumo } from '../../types';
import { getStockEstado } from '../../types';
import { formatCurrency, exportToExcel, formatNumber } from '../../lib/exportExcel';
import StockBadge from '../../components/shared/StockBadge';
import { PageLoader } from '../../components/shared/LoadingSpinner';
import toast from 'react-hot-toast';

export default function AlertasPage() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedAgotados, setCollapsedAgotados] = useState(false);
  const [collapsedBajos, setCollapsedBajos] = useState(false);

  useEffect(() => {
    supabase.from('insumos')
      .select('*, categoria:categorias(nombre)')
      .eq('activo', true)
      .order('stock_actual')
      .then(({ data }) => {
        const alertas = (data ?? []).filter((i) => getStockEstado(i) !== 'ok');
        setInsumos(alertas);
        setLoading(false);
      });
  }, []);

  function handleExportSinStock() {
    const sinStock = insumos.filter((i) => i.stock_actual <= 0);
    if (sinStock.length === 0) { toast.error('No hay insumos agotados'); return; }
    const rows = sinStock.map((i) => {
      const cat = i.categoria as unknown as { nombre: string };
      return {
        Estado: 'AGOTADO',
        Insumo: i.nombre,
        Referencia: i.referencia ?? '—',
        'Tienda / Local': i.tienda_referencia ?? '—',
        Categoría: cat?.nombre ?? '—',
        'Stock Actual': 0,
        'Stock Mínimo': i.stock_minimo,
        'A Comprar (mínimo)': i.stock_minimo,
        Unidad: i.unidad,
        'Precio Unitario': i.costo_unitario,
        'Costo Estimado Reposición': i.stock_minimo * i.costo_unitario,
      };
    });
    exportToExcel(rows, `sin_stock_${new Date().toISOString().slice(0, 10)}`, 'Sin Stock');
    toast.success(`${sinStock.length} insumos sin stock exportados`);
  }

  function handleExport() {
    if (insumos.length === 0) { toast.error('No hay alertas activas'); return; }
    const rows = insumos.map((i) => {
      const cat = i.categoria as unknown as { nombre: string };
      const faltante = Math.max(0, i.stock_minimo - i.stock_actual);
      return {
        Estado: getStockEstado(i) === 'agotado' ? 'AGOTADO' : 'STOCK BAJO',
        Insumo: i.nombre,
        Referencia: i.referencia ?? '—',
        'Tienda / Local': i.tienda_referencia ?? '—',
        Categoría: cat?.nombre ?? '—',
        'Stock Actual': i.stock_actual,
        'Stock Mínimo': i.stock_minimo,
        'Cantidad a Comprar': faltante,
        Unidad: i.unidad,
        'Precio Unitario': i.costo_unitario,
        'Valor Stock Actual': i.stock_actual * i.costo_unitario,
        'Valor a Reponer': faltante * i.costo_unitario,
      };
    });
    exportToExcel(rows, `lista_compras_${new Date().toISOString().slice(0, 10)}`, 'Lista de Compras');
    toast.success('Lista de compras exportada');
  }

  if (loading) return <PageLoader />;

  const agotados = insumos.filter((i) => getStockEstado(i) === 'agotado');
  const bajos = insumos.filter((i) => getStockEstado(i) === 'bajo');

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header con stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-rose-400 to-red-500 rounded-2xl p-5 shadow-lg shadow-rose-500/25 hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
              <AlertTriangle size={14} className="text-white" />
            </div>
            <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Agotados</p>
          </div>
          <p className="text-4xl font-bold text-white">{agotados.length}</p>
          <p className="text-xs text-white/60 mt-1">insumos sin stock</p>
        </div>

        <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-5 shadow-lg shadow-amber-500/25 hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
              <AlertTriangle size={14} className="text-white" />
            </div>
            <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">Stock Bajo</p>
          </div>
          <p className="text-4xl font-bold text-white">{bajos.length}</p>
          <p className="text-xs text-white/60 mt-1">insumos bajo mínimo</p>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-3 hover:shadow-md transition-shadow duration-300">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Exportar</p>
          <button
            onClick={handleExport}
            disabled={insumos.length === 0}
            className="flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-slate-700 to-slate-800 text-white rounded-xl text-sm font-medium hover:from-slate-800 hover:to-slate-900 transition-all duration-150 disabled:opacity-50 shadow-sm active:scale-95"
          >
            <Download size={15} />
            Lista de compras
          </button>
          <button
            onClick={handleExportSinStock}
            disabled={agotados.length === 0}
            className="flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-rose-500 to-red-600 text-white rounded-xl text-sm font-medium hover:from-rose-600 hover:to-red-700 transition-all duration-150 disabled:opacity-50 shadow-sm shadow-rose-500/25 active:scale-95"
          >
            <Download size={15} />
            Solo sin stock ({agotados.length})
          </button>
        </div>
      </div>

      {insumos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <Package className="text-emerald-500" size={28} />
          </div>
          <p className="text-gray-700 font-semibold">¡Inventario en buen estado!</p>
          <p className="text-gray-400 text-sm mt-1">Todos los insumos están por encima del stock mínimo</p>
        </div>
      ) : (
        <>
          {agotados.length > 0 && (
            <div className="bg-white rounded-2xl border border-rose-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300">
              <button
                onClick={() => setCollapsedAgotados(!collapsedAgotados)}
                className="w-full px-5 py-3.5 border-b border-rose-50 bg-gradient-to-r from-rose-50 to-red-50 flex items-center gap-2 hover:from-rose-100 hover:to-red-100 transition-colors duration-150 cursor-pointer"
              >
                <div className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
                <h2 className="text-sm font-semibold text-rose-700 flex-1 text-left">Insumos Agotados ({agotados.length})</h2>
                {collapsedAgotados ? <ChevronDown size={16} className="text-rose-400" /> : <ChevronUp size={16} className="text-rose-400" />}
              </button>
              {!collapsedAgotados && (
                <div className="divide-y divide-gray-50">
                  {agotados.map((insumo) => (
                    <AlertRow key={insumo.id} insumo={insumo} />
                  ))}
                </div>
              )}
            </div>
          )}

          {bajos.length > 0 && (
            <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300">
              <button
                onClick={() => setCollapsedBajos(!collapsedBajos)}
                className="w-full px-5 py-3.5 border-b border-amber-50 bg-gradient-to-r from-amber-50 to-orange-50 flex items-center gap-2 hover:from-amber-100 hover:to-orange-100 transition-colors duration-150 cursor-pointer"
              >
                <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                <h2 className="text-sm font-semibold text-amber-700 flex-1 text-left">Stock Bajo ({bajos.length})</h2>
                {collapsedBajos ? <ChevronDown size={16} className="text-amber-400" /> : <ChevronUp size={16} className="text-amber-400" />}
              </button>
              {!collapsedBajos && (
                <div className="divide-y divide-gray-50">
                  {bajos.map((insumo) => (
                    <AlertRow key={insumo.id} insumo={insumo} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AlertRow({ insumo }: { insumo: Insumo }) {
  const cat = insumo.categoria as unknown as { nombre: string };
  const falta = Math.max(0, insumo.stock_minimo - insumo.stock_actual);
  return (
    <div className="px-5 py-4 flex items-center gap-4 hover:bg-gray-50/60 transition-colors duration-150">
      {insumo.imagen_url ? (
        <img src={insumo.imagen_url} alt="" className="w-10 h-10 rounded-xl object-cover bg-gray-100 flex-shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
          <Package size={16} className="text-gray-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-gray-800 text-sm">{insumo.nombre}</p>
          {cat?.nombre && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{cat.nombre}</span>}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-xs text-gray-500">Stock: <strong className="text-gray-700">{formatNumber(insumo.stock_actual)}</strong> / mín {formatNumber(insumo.stock_minimo)} {insumo.unidad}</p>
          {falta > 0 && (
            <p className="text-xs text-orange-600 font-semibold">Comprar: +{formatNumber(falta)} {insumo.unidad}</p>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
        <StockBadge insumo={insumo} />
        <p className="text-xs text-gray-400">{formatCurrency(falta * insumo.costo_unitario)}</p>
      </div>
    </div>
  );
}
