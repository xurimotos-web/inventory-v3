import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import Modal from '../../components/shared/Modal';
import { supabase } from '../../lib/supabase';
import { Download, Upload, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';

interface ImportInsumosModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface RowPreview {
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  unidad: string;
  stock_actual: number;
  stock_minimo: number;
  costo_unitario: number;
  referencia: string;
  tienda_referencia: string;
  ok: boolean;
  error?: string;
}

const TEMPLATE_COLS = [
  'Codigo', 'Nombre', 'Descripcion', 'Categoria', 'Unidad',
  'Stock_Actual', 'Stock_Minimo', 'Costo_Unitario', 'Referencia', 'Tienda_Local',
];

const TEMPLATE_EXAMPLE = [
  { Codigo: 'INS-001', Nombre: 'Papel Bond A4', Descripcion: 'Resma 500 hojas', Categoria: 'Oficina', Unidad: 'resma', Stock_Actual: 10, Stock_Minimo: 2, Costo_Unitario: 15000, Referencia: 'PB-A4', Tienda_Local: 'Librería Central' },
  { Codigo: 'INS-002', Nombre: 'Cinta adhesiva', Descripcion: '', Categoria: 'Oficina', Unidad: 'unidad', Stock_Actual: 5, Stock_Minimo: 1, Costo_Unitario: 3500, Referencia: '', Tienda_Local: 'Ferretería Norte' },
];

function downloadTemplate() {
  const ws = XLSX.utils.json_to_sheet(TEMPLATE_EXAMPLE, { header: TEMPLATE_COLS });
  ws['!cols'] = TEMPLATE_COLS.map((k) => ({ wch: Math.max(k.length, 18) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
  XLSX.writeFile(wb, 'plantilla_importacion_insumos.xlsx');
}

export default function ImportInsumosModal({ open, onClose, onSaved }: ImportInsumosModalProps) {
  const [rows, setRows] = useState<RowPreview[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setRows([]); setDone(false); setDoneCount(0);
  }

  function handleClose() {
    reset(); onClose();
  }

  function parseRow(raw: Record<string, unknown>, idx: number): RowPreview {
    const nombre = String(raw['Nombre'] ?? raw['nombre'] ?? raw['NOMBRE'] ?? '').trim();
    const stock_actual = Number(raw['Stock_Actual'] ?? raw['stock_actual'] ?? raw['STOCK ACTUAL'] ?? raw['Cantidad'] ?? 0);
    const stock_minimo = Number(raw['Stock_Minimo'] ?? raw['stock_minimo'] ?? raw['STOCK MINIMO'] ?? raw['Cantidad Minima'] ?? 0);
    const costo_unitario = Number(raw['Costo_Unitario'] ?? raw['costo_unitario'] ?? raw['Costo Promedio'] ?? raw['COSTO UNITARIO'] ?? 0);

    const ok = nombre.length > 0;
    return {
      codigo: String(raw['Codigo'] ?? raw['codigo'] ?? raw['Código'] ?? raw['CODIGO'] ?? '').trim(),
      nombre,
      descripcion: String(raw['Descripcion'] ?? raw['descripcion'] ?? raw['DESCRIPCION'] ?? '').trim(),
      categoria: String(raw['Categoria'] ?? raw['Grupo'] ?? raw['CATEGORIA'] ?? raw['categoria'] ?? '').trim(),
      unidad: String(raw['Unidad'] ?? raw['unidad'] ?? raw['UNIDAD'] ?? 'unidad').trim() || 'unidad',
      stock_actual: isNaN(stock_actual) ? 0 : stock_actual,
      stock_minimo: isNaN(stock_minimo) ? 0 : stock_minimo,
      costo_unitario: isNaN(costo_unitario) ? 0 : costo_unitario,
      referencia: String(raw['Referencia'] ?? raw['referencia'] ?? '').trim(),
      tienda_referencia: String(raw['Tienda_Local'] ?? raw['tienda_referencia'] ?? raw['Tienda'] ?? '').trim(),
      ok,
      error: ok ? undefined : `Fila ${idx + 2}: nombre vacío`,
    };
  }

  function handleFile(file: File) {
    reset();
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
        if (raw.length === 0) { toast.error('El archivo está vacío'); return; }
        setRows(raw.map((r, i) => parseRow(r, i)));
      } catch {
        toast.error('Error al leer el archivo. Verifica que sea un Excel válido.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    const valid = rows.filter((r) => r.ok);
    if (valid.length === 0) { toast.error('No hay filas válidas para importar'); return; }

    setImporting(true);

    // Cargar categorías existentes para matchear por nombre
    const { data: cats } = await supabase.from('categorias').select('id, nombre');
    const catMap: Record<string, number> = {};
    (cats ?? []).forEach((c) => { catMap[c.nombre.toLowerCase()] = c.id; });

    // Crear categorías nuevas si hace falta
    const newCats = [...new Set(valid.map((r) => r.categoria).filter((c) => c && !catMap[c.toLowerCase()]))];
    for (const nombre of newCats) {
      const { data } = await supabase.from('categorias').insert({ nombre }).select('id').single();
      if (data) catMap[nombre.toLowerCase()] = data.id;
    }

    const payload = valid.map((r) => ({
      codigo: r.codigo || null,
      nombre: r.nombre,
      descripcion: r.descripcion || null,
      referencia: r.referencia || null,
      tienda_referencia: r.tienda_referencia || null,
      categoria_id: r.categoria ? (catMap[r.categoria.toLowerCase()] ?? null) : null,
      unidad: r.unidad,
      stock_actual: r.stock_actual,
      stock_minimo: r.stock_minimo,
      costo_unitario: r.costo_unitario,
      activo: true,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('insumos').insert(payload);
    setImporting(false);

    if (error) { toast.error('Error al importar: ' + error.message); return; }
    setDoneCount(valid.length);
    setDone(true);
    onSaved();
  }

  const validCount = rows.filter((r) => r.ok).length;
  const errorCount = rows.filter((r) => !r.ok).length;

  return (
    <Modal open={open} onClose={handleClose} title="Importar Insumos desde Excel" size="lg">
      <div className="space-y-4">

        {done ? (
          <div className="flex flex-col items-center text-center gap-4 py-6">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-800">¡Importación completada!</p>
              <p className="text-gray-500 text-sm mt-1">{doneCount} insumos importados correctamente</p>
            </div>
            <button onClick={handleClose} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
              Cerrar
            </button>
          </div>
        ) : (
          <>
            {/* Paso 1: Descargar plantilla */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-800 mb-1">Paso 1 — Descarga la plantilla Excel</p>
              <p className="text-xs text-blue-600 mb-3">
                La plantilla incluye el formato correcto y filas de ejemplo. También puedes adaptar tu archivo actual a estas columnas:<br />
                <span className="font-mono font-medium">Codigo, Nombre, Descripcion, Categoria, Unidad, Stock_Actual, Stock_Minimo, Costo_Unitario, Referencia, Tienda_Local</span>
              </p>
              <p className="text-xs text-blue-500 mb-3">
                Tu sistema actual usa: <em>Código, Producto, Grupo, Tipo, Cantidad, Costo Promedio</em> — estas columnas también son reconocidas automáticamente.
              </p>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Download size={15} />
                Descargar Plantilla (.xlsx)
              </button>
            </div>

            {/* Paso 2: Subir archivo */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Paso 2 — Sube tu archivo Excel</p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <button
                onClick={() => inputRef.current?.click()}
                className="w-full h-24 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
              >
                <FileSpreadsheet size={22} className="text-gray-400" />
                <p className="text-sm text-gray-500">Haz clic o arrastra tu archivo Excel aquí</p>
                <p className="text-xs text-gray-400">.xlsx, .xls, .csv</p>
              </button>
            </div>

            {/* Vista previa */}
            {rows.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-sm font-semibold text-gray-700">Vista previa</p>
                  <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                    <CheckCircle size={11} /> {validCount} válidas
                  </span>
                  {errorCount > 0 && (
                    <span className="flex items-center gap-1 text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                      <AlertCircle size={11} /> {errorCount} con error
                    </span>
                  )}
                </div>
                <div className="border border-gray-100 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0">
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-3 py-2 text-gray-400 font-semibold uppercase">Código</th>
                        <th className="text-left px-3 py-2 text-gray-400 font-semibold uppercase">Nombre</th>
                        <th className="text-left px-3 py-2 text-gray-400 font-semibold uppercase">Categoría</th>
                        <th className="text-left px-3 py-2 text-gray-400 font-semibold uppercase">Unidad</th>
                        <th className="text-right px-3 py-2 text-gray-400 font-semibold uppercase">Stock</th>
                        <th className="text-right px-3 py-2 text-gray-400 font-semibold uppercase">Costo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rows.map((r, i) => (
                        <tr key={i} className={r.ok ? 'hover:bg-gray-50' : 'bg-red-50'}>
                          <td className="px-3 py-2 font-mono text-gray-500">{r.codigo || '—'}</td>
                          <td className="px-3 py-2 font-medium text-gray-800">{r.nombre || <span className="text-red-500 italic">vacío</span>}</td>
                          <td className="px-3 py-2 text-gray-500">{r.categoria || '—'}</td>
                          <td className="px-3 py-2 text-gray-500">{r.unidad}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{r.stock_actual}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{r.costo_unitario.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Botones */}
            <div className="flex gap-3 pt-2">
              <button onClick={handleClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              {rows.length > 0 && (
                <button
                  onClick={handleImport}
                  disabled={importing || validCount === 0}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  <Upload size={15} />
                  {importing ? 'Importando...' : `Importar ${validCount} insumos`}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
