import { useEffect, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Package, Eye, ZoomIn, Upload, TrendingUp, AlertTriangle, Boxes, SendHorizonal, FileDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Insumo } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../context/PermissionsContext';
import StockBadge from '../../components/shared/StockBadge';
import InsumoModal from './InsumoModal';
import ImportInsumosModal from './ImportInsumosModal';
import AsignarStockModal from './AsignarStockModal';
import ConfirmDialog from '../../components/shared/ConfirmDialog';
import { PageLoader } from '../../components/shared/LoadingSpinner';
import Modal from '../../components/shared/Modal';
import ImageLightbox from '../../components/shared/ImageLightbox';
import toast from 'react-hot-toast';
import { formatCurrency, formatNumber, exportToExcel, exportToExcelMultiSheet } from '../../lib/exportExcel';

export default function InsumosPage() {
  const { isAdmin, user } = useAuth();
  const { can } = usePermissions();
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [userStock, setUserStock] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'ok' | 'bajo' | 'agotado'>('todos');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Insumo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Insumo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewInsumo, setViewInsumo] = useState<Insumo | null>(null);
  const [asignarTarget, setAsignarTarget] = useState<Insumo | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase
      .from('insumos')
      .select('*, categoria:categorias(nombre)')
      .eq('activo', true)
      .order('nombre');
    setInsumos(data ?? []);

    if (!isAdmin && user) {
      const { data: salidas } = await supabase
        .from('salidas')
        .select('insumo_id, cantidad, es_asignacion')
        .eq('usuario_id', user.id);
      const map: Record<number, number> = {};
      for (const s of salidas ?? []) {
        map[s.insumo_id] = (map[s.insumo_id] ?? 0) + (s.es_asignacion ? s.cantidad : -s.cantidad);
      }
      setUserStock(map);
    }

    setLoading(false);
  }

  function getDisplayStock(insumo: Insumo): number {
    return isAdmin ? insumo.stock_actual : Math.max(0, userStock[insumo.id] ?? 0);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('insumos').update({ activo: false }).eq('id', deleteTarget.id);
    if (error) {
      toast.error('Error al eliminar el insumo');
    } else {
      toast.success('Insumo eliminado');
      setDeleteTarget(null);
      load();
    }
    setDeleting(false);
  }

  function openLightbox(src: string, alt: string) {
    setLightbox({ src, alt });
  }

  // Para usuarios no-admin: solo insumos con stock asignado > 0
  const visibleInsumos = isAdmin
    ? insumos
    : insumos.filter((i) => (userStock[i.id] ?? 0) > 0);

  const categoriasList = Array.from(
    new Set(insumos.map((i) => (i.categoria as unknown as { nombre: string })?.nombre).filter(Boolean))
  ).sort();

  const filtered = visibleInsumos.filter((i) => {
    const q = search.toLowerCase();
    const cat = (i.categoria as unknown as { nombre: string })?.nombre ?? '';
    const matchSearch = i.nombre.toLowerCase().includes(q) ||
      (i.descripcion ?? '').toLowerCase().includes(q) ||
      (i.codigo ?? '').toLowerCase().includes(q) ||
      (i.referencia ?? '').toLowerCase().includes(q);
    const matchCat = !filtroCategoria || cat === filtroCategoria;
    if (filtroEstado === 'todos') return matchSearch && matchCat;
    const stockVal = getDisplayStock(i);
    const estado = stockVal <= 0 ? 'agotado' : stockVal <= i.stock_minimo ? 'bajo' : 'ok';
    return matchSearch && matchCat && estado === filtroEstado;
  });

  async function handleExport() {
    if (!isAdmin) {
      // Usuario normal: exporta solo sus insumos con su cuota
      const rows = filtered.map((i) => {
        const cat = (i.categoria as unknown as { nombre: string })?.nombre ?? '';
        const cuota = Math.max(0, userStock[i.id] ?? 0);
        const estado = cuota <= 0 ? 'Agotado' : cuota <= i.stock_minimo ? 'Stock bajo' : 'En stock';
        return {
          'Nombre': i.nombre,
          'Código': i.codigo ?? '',
          'Categoría': cat,
          'Unidad': i.unidad,
          'Mi cuota disponible': cuota,
          'Estado': estado,
        };
      });
      exportToExcel(rows, `mis_insumos_${new Date().toISOString().slice(0, 10)}`, 'Mis Insumos');
      toast.success(`${rows.length} insumos exportados`);
      return;
    }

    // Admin: carga entradas y salidas completas para el resumen
    const [{ data: todasSalidas }, { data: todasEntradas }] = await Promise.all([
      supabase
        .from('salidas')
        .select('insumo_id, cantidad, es_asignacion, usuario_id, created_at, entregado_a, area, destino, departamento, cargo, observaciones, profile:profiles(nombre)')
        .order('created_at', { ascending: false }),
      supabase
        .from('entradas')
        .select('insumo_id, cantidad'),
    ]);

    // Mapa nombre de insumo por id
    const mapaInsumo: Record<number, { nombre: string; unidad: string; codigo: string }> = {};
    for (const i of insumos) mapaInsumo[i.id] = { nombre: i.nombre, unidad: i.unidad, codigo: i.codigo ?? '' };

    // Mapa de totales de entradas por insumo
    const mapaEntradas: Record<number, number> = {};
    for (const e of todasEntradas ?? []) {
      mapaEntradas[e.insumo_id] = (mapaEntradas[e.insumo_id] ?? 0) + Number(e.cantidad);
    }

    // Mapa de asignaciones y consumos por insumo y usuario
    type UsuarioData = { nombre: string; depto: string; asignado: number; consumido: number };
    const mapaAsig: Record<number, { totalAsig: number; totalConsumo: number; usuarios: Record<string, UsuarioData> }> = {};

    for (const s of todasSalidas ?? []) {
      const insumoId = s.insumo_id as number;
      const uid = s.usuario_id as string;
      const p = s.profile as unknown as { nombre: string } | null;
      const dept = (s as unknown as { departamento?: string }).departamento ?? '';
      if (!mapaAsig[insumoId]) mapaAsig[insumoId] = { totalAsig: 0, totalConsumo: 0, usuarios: {} };
      if (!mapaAsig[insumoId].usuarios[uid]) {
        mapaAsig[insumoId].usuarios[uid] = { nombre: p?.nombre ?? uid, depto: dept, asignado: 0, consumido: 0 };
      }
      if (s.es_asignacion === true) {
        mapaAsig[insumoId].totalAsig += Number(s.cantidad);
        mapaAsig[insumoId].usuarios[uid].asignado += Number(s.cantidad);
      } else {
        mapaAsig[insumoId].totalConsumo += Number(s.cantidad);
        mapaAsig[insumoId].usuarios[uid].consumido += Number(s.cantidad);
      }
    }

    // Hoja 1: Inventario General con entradas, consumos y asignaciones
    const hoja1 = filtered.map((i) => {
      const cat = (i.categoria as unknown as { nombre: string })?.nombre ?? '';
      const estado = i.stock_actual <= 0 ? 'Agotado' : i.stock_actual <= i.stock_minimo ? 'Stock bajo' : 'En stock';
      const asig = mapaAsig[i.id];
      const totalEntradas = mapaEntradas[i.id] ?? 0;
      const totalConsumo = asig?.totalConsumo ?? 0;
      const totalAsignado = asig?.totalAsig ?? 0;
      const stockCalculado = Math.max(0, totalEntradas - totalConsumo);
      const detalleAsig = asig
        ? Object.values(asig.usuarios)
            .filter((u) => u.asignado > 0)
            .map((u) => `${u.nombre}: ${Math.max(0, u.asignado - u.consumido)} disp. / ${u.asignado} asig.`)
            .join(' | ')
        : 'Sin asignaciones';
      return {
        'Nombre': i.nombre,
        'Código': i.codigo ?? '',
        'Referencia': i.referencia ?? '',
        'Categoría': cat,
        'Unidad': i.unidad,
        'Stock Físico (BD)': i.stock_actual,
        'Stock Calculado': stockCalculado,
        'Total Entradas': totalEntradas,
        'Total Consumos (Salidas)': totalConsumo,
        'Total Asignado Virtual': totalAsignado,
        'Stock Mínimo': i.stock_minimo,
        'Costo Unitario': i.costo_unitario,
        'Valor Total': i.stock_actual * i.costo_unitario,
        'Estado': estado,
        'Tienda referencia': i.tienda_referencia ?? '',
        'Detalle asignaciones': detalleAsig,
      };
    });

    // Hoja 2: Cuotas por usuario (asignaciones vs consumos)
    const hoja2: Record<string, unknown>[] = [];
    for (const i of filtered) {
      const asig = mapaAsig[i.id];
      if (!asig) continue;
      for (const u of Object.values(asig.usuarios)) {
        if (u.asignado === 0 && u.consumido === 0) continue;
        hoja2.push({
          'Insumo': i.nombre,
          'Código': i.codigo ?? '',
          'Unidad': i.unidad,
          'Usuario': u.nombre,
          'Departamento': u.depto,
          'Cuota Asignada': u.asignado,
          'Consumido por usuario': u.consumido,
          'Cuota Disponible': Math.max(0, u.asignado - u.consumido),
        });
      }
    }

    // Hoja 3: Detalle de todas las salidas/consumos de usuarios
    const insumoIdsExportados = new Set(filtered.map((i) => i.id));
    const hoja3: Record<string, unknown>[] = [];
    for (const s of todasSalidas ?? []) {
      if (s.es_asignacion === true) continue; // solo consumos reales
      const insumoId = s.insumo_id as number;
      if (!insumoIdsExportados.has(insumoId)) continue;
      const p = s.profile as unknown as { nombre: string } | null;
      const ins = mapaInsumo[insumoId];
      hoja3.push({
        'Fecha': formatDate(s.created_at as string),
        'Insumo': ins?.nombre ?? '—',
        'Código': ins?.codigo ?? '—',
        'Unidad': ins?.unidad ?? '—',
        'Cantidad': Number(s.cantidad),
        'Registrado por': p?.nombre ?? '—',
        'Departamento': (s as unknown as { departamento?: string }).departamento ?? '—',
        'Cargo': (s as unknown as { cargo?: string }).cargo ?? '—',
        'Entregado a': (s as unknown as { entregado_a?: string }).entregado_a ?? '—',
        'Área': (s as unknown as { area?: string }).area ?? '—',
        'Destino': (s as unknown as { destino?: string }).destino ?? '—',
        'Observaciones': (s as unknown as { observaciones?: string }).observaciones ?? '—',
      });
    }

    const suffix = filtroCategoria ? `_${filtroCategoria}` : '_completo';
    exportToExcelMultiSheet(
      [
        { name: 'Inventario General', data: hoja1 },
        { name: 'Cuotas por Usuario', data: hoja2.length > 0 ? hoja2 : [{ Nota: 'No hay asignaciones registradas' }] },
        { name: 'Salidas de Usuarios', data: hoja3.length > 0 ? hoja3 : [{ Nota: 'No hay salidas registradas' }] },
      ],
      `inventario${suffix}_${new Date().toISOString().slice(0, 10)}`,
    );
    toast.success(`${hoja1.length} insumos · ${hoja3.length} salidas exportadas`);
  }

  const totalValor = insumos.reduce((acc, i) => acc + i.stock_actual * i.costo_unitario, 0);
  const countBajo = insumos.filter(i => i.stock_actual > 0 && i.stock_actual <= i.stock_minimo).length;
  const countAgotado = insumos.filter(i => i.stock_actual <= 0).length;

  if (loading) return <PageLoader />;

  const filterPills: { key: typeof filtroEstado; label: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'ok', label: 'En stock' },
    { key: 'bajo', label: 'Stock bajo' },
    { key: 'agotado', label: 'Agotado' },
  ];

  return (
    <div className="space-y-5 animate-fade-in-up">

      {/* KPI Cards */}
      {isAdmin ? (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-4 shadow-lg shadow-indigo-500/25 hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <Boxes size={16} className="text-white" />
              </div>
              <span className="text-white/60 text-xs font-medium">Catálogo</span>
            </div>
            <p className="text-3xl font-bold text-white">{insumos.length}</p>
            <p className="text-xs text-white/60 mt-0.5">insumos activos</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl p-4 shadow-lg shadow-emerald-500/25 hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <TrendingUp size={16} className="text-white" />
              </div>
              <span className="text-white/60 text-xs font-medium">Valor</span>
            </div>
            <p className="text-xl font-bold text-white leading-tight">{formatCurrency(totalValor)}</p>
            <p className="text-xs text-white/60 mt-0.5">valor total en bodega</p>
          </div>
          <div className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-4 shadow-lg shadow-amber-500/25 hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <AlertTriangle size={16} className="text-white" />
              </div>
              <span className="text-white/60 text-xs font-medium">Bajo mínimo</span>
            </div>
            <p className="text-3xl font-bold text-white">{countBajo}</p>
            <p className="text-xs text-white/60 mt-0.5">con stock bajo</p>
          </div>
          <div className="bg-gradient-to-br from-rose-400 to-red-500 rounded-2xl p-4 shadow-lg shadow-rose-500/25 hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <Package size={16} className="text-white" />
              </div>
              <span className="text-white/60 text-xs font-medium">Sin stock</span>
            </div>
            <p className="text-3xl font-bold text-white">{countAgotado}</p>
            <p className="text-xs text-white/60 mt-0.5">insumos agotados</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-4 shadow-lg shadow-indigo-500/25">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <Boxes size={16} className="text-white" />
              </div>
              <span className="text-white/60 text-xs font-medium">Mis insumos</span>
            </div>
            <p className="text-3xl font-bold text-white">{visibleInsumos.length}</p>
            <p className="text-xs text-white/60 mt-0.5">insumos asignados</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl p-4 shadow-lg shadow-emerald-500/25">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <Package size={16} className="text-white" />
              </div>
              <span className="text-white/60 text-xs font-medium">Con disponibilidad</span>
            </div>
            <p className="text-3xl font-bold text-white">{visibleInsumos.filter(i => (userStock[i.id] ?? 0) > 0).length}</p>
            <p className="text-xs text-white/60 mt-0.5">insumos disponibles</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, código, referencia..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all duration-200 shadow-sm"
          />
        </div>
        {/* Filtro categoría */}
        {categoriasList.length > 0 && (
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all shadow-sm"
          >
            <option value="">Todas las categorías</option>
            {categoriasList.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
        <div className="flex gap-2">
          {(isAdmin || can('insumos_exportar')) && (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-emerald-600 text-sm font-medium hover:bg-emerald-50 hover:border-emerald-300 transition-all duration-150 whitespace-nowrap active:scale-95 shadow-sm"
            >
              <FileDown size={15} />
              Exportar
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-all duration-150 whitespace-nowrap active:scale-95 shadow-sm"
            >
              <Upload size={15} />
              Importar
            </button>
          )}
          {(isAdmin || can('insumos_crear')) && (
            <button
              onClick={() => { setSelected(null); setModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl text-sm font-medium hover:from-indigo-600 hover:to-violet-700 transition-all duration-150 shadow-md shadow-indigo-500/30 hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap"
            >
              <Plus size={16} />
              Nuevo Insumo
            </button>
          )}
        </div>
      </div>

      {/* Filter pills + result count */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {filterPills.map((pill) => (
            <button
              key={pill.key}
              onClick={() => setFiltroEstado(pill.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
                filtroEstado === pill.key
                  ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25'
                  : 'bg-white text-gray-500 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {filtroCategoria && (
            <button
              onClick={() => setFiltroCategoria('')}
              className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full hover:bg-indigo-100 transition-colors"
            >
              {filtroCategoria} ×
            </button>
          )}
          <span className="text-xs text-gray-400 font-medium">
            {filtered.length === visibleInsumos.length
              ? `${visibleInsumos.length} insumos`
              : `${filtered.length} de ${visibleInsumos.length} insumos`}
          </span>
        </div>
      </div>

      {/* Tabla Desktop */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-300">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gradient-to-r from-gray-50/80 to-gray-50/40">
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Insumo</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Categoría</th>
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">{isAdmin ? 'Stock' : 'Mi stock'}</th>
                {isAdmin && <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Costo unit.</th>}
                {isAdmin && <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden xl:table-cell">Valor total</th>}
                <th className="text-left px-5 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Estado</th>
                <th className="px-5 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50/80">
              {filtered.map((insumo) => {
                const cat = insumo.categoria as unknown as { nombre: string };
                const displayStock = getDisplayStock(insumo);
                const pct = insumo.stock_minimo > 0 ? Math.min(100, Math.round((displayStock / (insumo.stock_minimo * 2)) * 100)) : 100;
                const barColor = displayStock <= 0 ? 'bg-rose-400' : displayStock <= insumo.stock_minimo ? 'bg-amber-400' : 'bg-emerald-400';
                return (
                  <tr key={insumo.id} className="hover:bg-indigo-50/20 transition-colors duration-150 group">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {insumo.imagen_url ? (
                          <button
                            onClick={() => openLightbox(insumo.imagen_url!, insumo.nombre)}
                            className="relative w-11 h-11 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 group/img shadow-sm"
                            title="Ver imagen"
                          >
                            <img src={insumo.imagen_url} alt="" className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-300" />
                            <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/40 transition-all flex items-center justify-center">
                              <ZoomIn size={13} className="text-white opacity-0 group-hover/img:opacity-100 transition-opacity" />
                            </div>
                          </button>
                        ) : (
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100/50 flex items-center justify-center flex-shrink-0">
                            <Package size={16} className="text-indigo-300" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 leading-tight">{insumo.nombre}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {insumo.codigo && (
                              <span className="text-xs text-gray-400 font-mono bg-gray-50 px-1.5 py-0.5 rounded">{insumo.codigo}</span>
                            )}
                            {!insumo.codigo && insumo.descripcion && (
                              <p className="text-xs text-gray-400 truncate max-w-44">{insumo.descripcion}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {cat?.nombre ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200/60">
                          {cat.nombre}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-1.5 min-w-[100px]">
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-bold text-gray-800 text-base leading-none">{formatNumber(displayStock)}</span>
                          <span className="text-xs text-gray-400">{insumo.unidad}</span>
                          {isAdmin && <span className="text-xs text-gray-300 ml-1">/ mín {formatNumber(insumo.stock_minimo)}</span>}
                        </div>
                        <div className="w-24 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-300 ${barColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-4 text-gray-600 hidden lg:table-cell">
                        <span className="font-medium">{formatCurrency(insumo.costo_unitario)}</span>
                      </td>
                    )}
                    {isAdmin && (
                      <td className="px-5 py-4 hidden xl:table-cell">
                        <span className="font-semibold text-gray-700">{formatCurrency(insumo.stock_actual * insumo.costo_unitario)}</span>
                      </td>
                    )}
                    <td className="px-5 py-4">
                      <StockBadge insumo={isAdmin ? insumo : { stock_actual: displayStock, stock_minimo: insumo.stock_minimo }} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setViewInsumo(insumo)}
                          className="p-1.5 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all duration-150 active:scale-90"
                          title="Ver detalle"
                        >
                          <Eye size={15} />
                        </button>
                        {insumo.imagen_url && (
                          <button
                            onClick={() => openLightbox(insumo.imagen_url!, insumo.nombre)}
                            className="p-1.5 text-gray-300 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all duration-150 active:scale-90"
                            title="Ver foto"
                          >
                            <ZoomIn size={15} />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => setAsignarTarget(insumo)}
                            className="p-1.5 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all duration-150 active:scale-90"
                            title="Asignar a usuario"
                          >
                            <SendHorizonal size={15} />
                          </button>
                        )}
                        {(isAdmin || can('insumos_editar')) && (
                          <button
                            onClick={() => { setSelected(insumo); setModalOpen(true); }}
                            className="p-1.5 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all duration-150 active:scale-90"
                          >
                            <Edit2 size={15} />
                          </button>
                        )}
                        {(isAdmin || can('insumos_eliminar')) && (
                          <button
                            onClick={() => setDeleteTarget(insumo)}
                            className="p-1.5 text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all duration-150 active:scale-90"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center">
                        <Package size={22} className="text-gray-300" />
                      </div>
                      <div>
                        <p className="text-gray-500 font-medium text-sm">No se encontraron insumos</p>
                        <p className="text-gray-400 text-xs mt-0.5">Intenta ajustar el filtro o la búsqueda</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-gray-50">
          {filtered.map((insumo) => {
            const cat = insumo.categoria as unknown as { nombre: string };
            const displayStock = getDisplayStock(insumo);
            const pct = insumo.stock_minimo > 0 ? Math.min(100, Math.round((displayStock / (insumo.stock_minimo * 2)) * 100)) : 100;
            const barColor = displayStock <= 0 ? 'bg-rose-400' : displayStock <= insumo.stock_minimo ? 'bg-amber-400' : 'bg-emerald-400';
            return (
              <div key={insumo.id} className="p-4 hover:bg-indigo-50/10 transition-colors">
                <div className="flex items-start gap-3">
                  {insumo.imagen_url ? (
                    <button
                      onClick={() => openLightbox(insumo.imagen_url!, insumo.nombre)}
                      className="relative w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 shadow-sm"
                    >
                      <img src={insumo.imagen_url} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-all flex items-center justify-center">
                        <ZoomIn size={14} className="text-white opacity-0 hover:opacity-100" />
                      </div>
                    </button>
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100/50 flex items-center justify-center flex-shrink-0">
                      <Package size={20} className="text-indigo-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 text-sm leading-tight">{insumo.nombre}</p>
                        {cat?.nombre && (
                          <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                            {cat.nombre}
                          </span>
                        )}
                      </div>
                      <StockBadge insumo={isAdmin ? insumo : { stock_actual: displayStock, stock_minimo: insumo.stock_minimo }} />
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{isAdmin ? 'Stock' : 'Mi stock'}: <strong className="text-gray-700">{formatNumber(displayStock)}</strong> {insumo.unidad}</span>
                        {isAdmin && <span className="text-gray-400">mín {formatNumber(insumo.stock_minimo)}</span>}
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      {isAdmin
                        ? <span className="text-xs text-gray-400">{formatCurrency(insumo.costo_unitario)} / {insumo.unidad}</span>
                        : <span className="text-xs text-gray-400">{insumo.unidad}</span>
                      }
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setViewInsumo(insumo)}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all active:scale-90"
                        >
                          <Eye size={15} />
                        </button>
                        {(isAdmin || can('insumos_editar')) && (
                          <button
                            onClick={() => { setSelected(insumo); setModalOpen(true); }}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all active:scale-90"
                          >
                            <Edit2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
                <Package size={22} className="text-gray-300" />
              </div>
              <p className="text-gray-400 text-sm">No se encontraron insumos</p>
            </div>
          )}
        </div>
      </div>

      <ImportInsumosModal open={importOpen} onClose={() => setImportOpen(false)} onSaved={load} />

      <AsignarStockModal
        open={!!asignarTarget}
        onClose={() => setAsignarTarget(null)}
        onSaved={load}
        insumo={asignarTarget}
      />

      <InsumoModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setSelected(null); }}
        onSaved={load}
        insumo={selected}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar Insumo"
        message={`¿Estás seguro de eliminar "${deleteTarget?.nombre}"? Esta acción no se puede deshacer.`}
        loading={deleting}
      />

      {/* Modal detalle */}
      <Modal open={!!viewInsumo} onClose={() => setViewInsumo(null)} title="Detalle del Insumo" size="md">
        {viewInsumo && (() => {
          const detailStock = getDisplayStock(viewInsumo);
          const pct = viewInsumo.stock_minimo > 0 ? Math.min(100, Math.round((detailStock / (viewInsumo.stock_minimo * 2)) * 100)) : 100;
          const barColor = detailStock <= 0 ? 'bg-rose-400' : detailStock <= viewInsumo.stock_minimo ? 'bg-amber-400' : 'bg-emerald-400';
          return (
            <div className="space-y-4">
              {viewInsumo.imagen_url ? (
                <div
                  className="relative rounded-2xl overflow-hidden bg-gray-100 h-52 group cursor-zoom-in"
                  onClick={() => openLightbox(viewInsumo.imagen_url!, viewInsumo.nombre)}
                >
                  <img src={viewInsumo.imagen_url} alt={viewInsumo.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 rounded-xl px-3 py-2 flex items-center gap-2 text-sm font-medium text-gray-800 shadow-lg">
                      <ZoomIn size={16} />
                      Ver en tamaño completo
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-32 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center border border-indigo-100/60">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-xl bg-indigo-100/60 flex items-center justify-center mx-auto mb-2">
                      <Package size={22} className="text-indigo-300" />
                    </div>
                    <p className="text-xs text-indigo-300 font-medium">Sin imagen</p>
                  </div>
                </div>
              )}

              {/* Stock progress */}
              <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-100 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nivel de stock</p>
                  <StockBadge insumo={isAdmin ? viewInsumo : { stock_actual: detailStock, stock_minimo: viewInsumo.stock_minimo }} />
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-bold text-gray-800">{formatNumber(detailStock)}</span>
                  <span className="text-sm text-gray-400">{viewInsumo.unidad}</span>
                  {isAdmin && <span className="text-xs text-gray-300 ml-1">/ mínimo {formatNumber(viewInsumo.stock_minimo)} {viewInsumo.unidad}</span>}
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className={`h-2 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-2.5 text-sm">
                {[
                  { label: 'Nombre', value: viewInsumo.nombre },
                  { label: 'Unidad', value: viewInsumo.unidad },
                  ...(isAdmin ? [
                    { label: 'Costo unitario', value: formatCurrency(viewInsumo.costo_unitario) },
                    { label: 'Valor en bodega', value: formatCurrency(viewInsumo.stock_actual * viewInsumo.costo_unitario) },
                  ] : []),
                  ...(viewInsumo.codigo ? [{ label: 'Código', value: viewInsumo.codigo }] : []),
                  ...(viewInsumo.referencia ? [{ label: 'Referencia', value: viewInsumo.referencia }] : []),
                  ...(viewInsumo.tienda_referencia ? [{ label: 'Tienda', value: viewInsumo.tienda_referencia }] : []),
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3 hover:bg-indigo-50/30 transition-colors duration-150">
                    <p className="text-xs text-gray-400 font-medium">{label}</p>
                    <p className="text-gray-800 font-semibold mt-0.5 truncate">{value}</p>
                  </div>
                ))}
              </div>

              {viewInsumo.descripcion && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 font-medium mb-1">Descripción</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{viewInsumo.descripcion}</p>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Lightbox */}
      <ImageLightbox
        open={!!lightbox}
        src={lightbox?.src ?? ''}
        alt={lightbox?.alt ?? ''}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}
