import { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import Modal from '../../components/shared/Modal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { recalcularStock } from '../../lib/stockUtils';
import { Upload, CheckCircle2, XCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';

interface ParsedRow {
  fecha: string;
  codigo: string;
  insumo_nombre: string;
  cantidad: number;
  entregado_a: string;
  area: string;
  destino: string;
  usuario_nombre: string;
  departamento: string;
  cargo: string;
  observaciones: string;
  insumo_id: number | null;
  usuario_id: string;
  status: 'pending' | 'ok' | 'error';
  error?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export default function ImportSalidasModal({ open, onClose, onImported }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [insumos, setInsumos] = useState<{ id: number; nombre: string; codigo: string | null }[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; nombre: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) { setRows([]); setDone(false); return; }
    Promise.all([
      supabase.from('insumos').select('id, nombre, codigo').eq('activo', true),
      supabase.from('profiles').select('id, nombre'),
    ]).then(([{ data: ins }, { data: profs }]) => {
      setInsumos(ins ?? []);
      setProfiles(profs ?? []);
    });
  }, [open]);

  function parseDate(val: unknown): string {
    if (!val) return new Date().toISOString();
    if (typeof val === 'number') {
      return new Date(Math.round((val - 25569) * 86400 * 1000)).toISOString();
    }
    if (typeof val === 'string') {
      const p = val.split('/');
      if (p.length === 3) return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]), 12).toISOString();
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    if (val instanceof Date) return val.toISOString();
    return new Date().toISOString();
  }

  function findInsumo(codigo: string, nombre: string) {
    const c = codigo.toLowerCase().trim();
    const n = nombre.toLowerCase().trim();
    return insumos.find(i =>
      (c && i.codigo && i.codigo.toLowerCase().trim() === c) ||
      i.nombre.toLowerCase().trim() === n
    ) ?? null;
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
        if (data.length < 2) { toast.error('El archivo está vacío'); return; }

        const headers = (data[0] as string[]).map(h => String(h ?? '').toLowerCase().trim());
        const col = (keyword: string) => headers.findIndex(h => h.includes(keyword));

        const iF = col('fecha'), iCod = col('código'), iI = col('insumo');
        const iC = col('cantidad'), iEnt = col('entregado'), iArea = col('área');
        const iDest = col('destino'), iUsr = col('usuario'), iDept = col('departamento');
        const iCargo = col('cargo'), iObs = col('observaci');

        const parsed: ParsedRow[] = [];
        for (let i = 1; i < data.length; i++) {
          const r = data[i] as unknown[];
          const nombre = String(r[iI >= 0 ? iI : 2] ?? '').trim();
          const codigo = String(r[iCod >= 0 ? iCod : 1] ?? '').trim();
          const cantidad = Number(r[iC >= 0 ? iC : 3] ?? 0);
          if (!nombre || cantidad <= 0) continue;

          const insumoMatch = findInsumo(codigo, nombre);
          const usrNombre = String(r[iUsr >= 0 ? iUsr : 8] ?? '').trim();
          const profileMatch = profiles.find(p => p.nombre.toLowerCase() === usrNombre.toLowerCase());

          parsed.push({
            fecha: parseDate(r[iF >= 0 ? iF : 0]),
            codigo,
            insumo_nombre: nombre,
            cantidad,
            entregado_a: String(r[iEnt >= 0 ? iEnt : 5] ?? '').trim(),
            area: String(r[iArea >= 0 ? iArea : 6] ?? '').trim(),
            destino: String(r[iDest >= 0 ? iDest : 7] ?? '').trim(),
            usuario_nombre: usrNombre,
            departamento: String(r[iDept >= 0 ? iDept : 9] ?? '').trim(),
            cargo: String(r[iCargo >= 0 ? iCargo : 10] ?? '').trim(),
            observaciones: String(r[iObs >= 0 ? iObs : 11] ?? '').trim(),
            insumo_id: insumoMatch?.id ?? null,
            usuario_id: profileMatch?.id ?? user!.id,
            status: 'pending',
            error: insumoMatch ? undefined : `"${codigo || nombre}" no encontrado en catálogo`,
          });
        }
        setRows(parsed);
      } catch {
        toast.error('Error al leer el archivo');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    const valid = rows.filter(r => r.insumo_id !== null);
    if (valid.length === 0) { toast.error('No hay filas válidas'); return; }
    setImporting(true);
    const updated = [...rows];
    const affected = new Set<number>();
    let ok = 0, errors = 0;

    for (let i = 0; i < updated.length; i++) {
      const row = updated[i];
      if (!row.insumo_id) { updated[i] = { ...row, status: 'error' }; errors++; continue; }
      const { error } = await supabase.from('salidas').insert({
        insumo_id: row.insumo_id,
        cantidad: row.cantidad,
        entregado_a: row.entregado_a || null,
        area: row.area || null,
        destino: row.destino || null,
        departamento: row.departamento || '—',
        cargo: row.cargo || '—',
        observaciones: row.observaciones || null,
        usuario_id: row.usuario_id,
        es_asignacion: false,
        created_at: row.fecha,
      });
      if (error) { updated[i] = { ...row, status: 'error', error: error.message }; errors++; }
      else { updated[i] = { ...row, status: 'ok' }; affected.add(row.insumo_id); ok++; }
      setRows([...updated]);
    }

    for (const id of affected) await recalcularStock(id);
    setImporting(false);
    setDone(true);
    toast.success(`${ok} salidas importadas${errors > 0 ? `, ${errors} con error` : ''}`);
    onImported();
  }

  const validCount = rows.filter(r => r.insumo_id !== null).length;
  const errorCount = rows.filter(r => r.insumo_id === null).length;

  return (
    <Modal open={open} onClose={onClose} title="Importar Salidas desde Excel" size="xl">
      <div className="space-y-4">
        {rows.length === 0 ? (
          <div className="space-y-4">
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-sm">
              <p className="font-semibold text-rose-800 mb-1">Formato de columnas esperado:</p>
              <p className="text-xs text-rose-600 font-mono leading-relaxed">
                Fecha · Código · Insumo · Cantidad · Unidad · Entregado a · Área · Destino · Usuario · Departamento · Cargo · Observaciones
              </p>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-3 p-10 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50/30 transition-colors">
              <FileSpreadsheet size={36} className="opacity-40" />
              <div className="text-center">
                <p className="text-sm font-medium">Seleccionar archivo Excel</p>
                <p className="text-xs text-gray-400 mt-0.5">.xlsx o .xls</p>
              </div>
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1.5 text-sm text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg">
                <CheckCircle2 size={14} /> {validCount} válidas
              </span>
              {errorCount > 0 && (
                <span className="flex items-center gap-1.5 text-sm text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg">
                  <AlertCircle size={14} /> {errorCount} sin coincidencia
                </span>
              )}
              <span className="text-xs text-gray-400 ml-auto">{rows.length} filas leídas</span>
            </div>

            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <div className="overflow-auto max-h-72">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-gray-500 font-semibold w-8"></th>
                      <th className="px-3 py-2.5 text-left text-gray-500 font-semibold">Código</th>
                      <th className="px-3 py-2.5 text-left text-gray-500 font-semibold">Insumo</th>
                      <th className="px-3 py-2.5 text-left text-gray-500 font-semibold">Cant.</th>
                      <th className="px-3 py-2.5 text-left text-gray-500 font-semibold">Entregado a</th>
                      <th className="px-3 py-2.5 text-left text-gray-500 font-semibold">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rows.map((row, i) => (
                      <tr key={i} className={
                        row.status === 'ok' ? 'bg-emerald-50/50' :
                        row.status === 'error' ? 'bg-red-50/60' :
                        row.insumo_id === null ? 'bg-amber-50/40' : ''
                      }>
                        <td className="px-3 py-2 text-center">
                          {row.status === 'ok' ? <CheckCircle2 size={13} className="text-emerald-500" /> :
                           row.status === 'error' ? <XCircle size={13} className="text-red-500" /> :
                           row.insumo_id === null ? <AlertCircle size={13} className="text-amber-500" /> :
                           <Upload size={13} className="text-gray-300" />}
                        </td>
                        <td className="px-3 py-2 text-gray-400 font-mono">{row.codigo || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={row.insumo_id === null ? 'text-amber-700' : 'text-gray-800'}>{row.insumo_nombre}</span>
                          {row.insumo_id === null && <span className="text-amber-500 text-xs block">No encontrado</span>}
                          {row.error && row.status === 'error' && row.insumo_id !== null && <span className="text-red-500 text-xs block">{row.error}</span>}
                        </td>
                        <td className="px-3 py-2 font-semibold text-rose-600">-{row.cantidad}</td>
                        <td className="px-3 py-2 text-gray-500">{row.entregado_a || '—'}</td>
                        <td className="px-3 py-2 text-gray-400">{new Date(row.fecha).toLocaleDateString('es-EC')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {!done ? (
              <div className="flex gap-3">
                <button onClick={() => setRows([])} disabled={importing}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50">
                  Cambiar archivo
                </button>
                <button onClick={handleImport} disabled={importing || validCount === 0}
                  className="flex-1 px-4 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-medium hover:bg-rose-700 transition-colors disabled:opacity-60">
                  {importing ? 'Importando...' : `Importar ${validCount} salidas`}
                </button>
              </div>
            ) : (
              <button onClick={onClose}
                className="w-full px-4 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-medium hover:bg-rose-700 transition-colors">
                Listo
              </button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
