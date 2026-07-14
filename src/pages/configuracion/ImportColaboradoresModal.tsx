import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import Modal from '../../components/shared/Modal';
import { supabase } from '../../lib/supabase';
import { Download, Upload, CheckCircle, AlertCircle, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

interface RowPreview {
  nombre: string;
  area: string;
  cargo: string;
  ok: boolean;
  error?: string;
}

const TEMPLATE_COLS = ['Nombre', 'Area', 'Cargo'];

const TEMPLATE_EXAMPLE = [
  { Nombre: 'Juan Pérez', Area: 'Producción', Cargo: 'Operario' },
  { Nombre: 'María García', Area: 'Cocina', Cargo: 'Chef' },
  { Nombre: 'Carlos López', Area: 'Bodega', Cargo: 'Almacenista' },
  { Nombre: 'Ana Martínez', Area: 'Administración', Cargo: 'Coordinadora' },
];

function downloadTemplate() {
  const ws = XLSX.utils.json_to_sheet(TEMPLATE_EXAMPLE, { header: TEMPLATE_COLS });
  ws['!cols'] = TEMPLATE_COLS.map(() => ({ wch: 24 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Colaboradores');
  XLSX.writeFile(wb, 'plantilla_colaboradores.xlsx');
}

export default function ImportColaboradoresModal({ open, onClose, onSaved }: Props) {
  const [rows, setRows] = useState<RowPreview[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() { setRows([]); setDone(false); setDoneCount(0); }
  function handleClose() { reset(); onClose(); }

  function parseRow(raw: Record<string, unknown>, idx: number): RowPreview {
    const nombre = String(
      raw['Nombre'] ?? raw['nombre'] ?? raw['NOMBRE'] ?? raw['Name'] ?? ''
    ).trim();
    const ok = nombre.length > 0;
    return {
      nombre,
      area: String(raw['Area'] ?? raw['area'] ?? raw['Área'] ?? raw['AREA'] ?? '').trim(),
      cargo: String(raw['Cargo'] ?? raw['cargo'] ?? raw['CARGO'] ?? raw['Puesto'] ?? '').trim(),
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

    const payload = valid.map((r) => ({
      nombre: r.nombre,
      area: r.area || null,
      cargo: r.cargo || null,
      activo: true,
    }));

    const { error } = await supabase.from('colaboradores').insert(payload);
    setImporting(false);
    if (error) { toast.error('Error al importar: ' + error.message); return; }
    setDoneCount(valid.length);
    setDone(true);
    onSaved();
  }

  const validCount = rows.filter((r) => r.ok).length;
  const errorCount = rows.filter((r) => !r.ok).length;

  return (
    <Modal open={open} onClose={handleClose} title="Importar Colaboradores desde Excel" size="lg">
      <div className="space-y-4">
        {done ? (
          <div className="flex flex-col items-center text-center gap-4 py-6">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-800">¡Importación completada!</p>
              <p className="text-gray-500 text-sm mt-1">{doneCount} colaboradores importados correctamente</p>
            </div>
            <button onClick={handleClose} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-800 mb-1">Paso 1 — Descarga la plantilla Excel</p>
              <p className="text-xs text-blue-600 mb-3">
                La plantilla tiene 3 columnas:{' '}
                <span className="font-mono font-medium">Nombre</span> (obligatorio),{' '}
                <span className="font-mono font-medium">Area</span> y{' '}
                <span className="font-mono font-medium">Cargo</span> (opcionales).
                También puedes adaptar tu propio archivo siempre que tenga la columna Nombre.
              </p>
              <button onClick={downloadTemplate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
                <Download size={15} /> Descargar Plantilla (.xlsx)
              </button>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Paso 2 — Sube tu archivo Excel</p>
              <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <button onClick={() => inputRef.current?.click()}
                className="w-full h-24 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
                <FileSpreadsheet size={22} className="text-gray-400" />
                <p className="text-sm text-gray-500">Haz clic o arrastra tu archivo Excel aquí</p>
                <p className="text-xs text-gray-400">.xlsx, .xls, .csv</p>
              </button>
            </div>

            {rows.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-sm font-semibold text-gray-700">Vista previa — {rows.length} filas</p>
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
                        <th className="text-left px-3 py-2 text-gray-400 font-semibold uppercase">Nombre</th>
                        <th className="text-left px-3 py-2 text-gray-400 font-semibold uppercase">Área</th>
                        <th className="text-left px-3 py-2 text-gray-400 font-semibold uppercase">Cargo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rows.map((r, i) => (
                        <tr key={i} className={r.ok ? 'hover:bg-gray-50' : 'bg-red-50'}>
                          <td className="px-3 py-2 font-medium text-gray-800">
                            {r.nombre || <span className="text-red-500 italic">vacío</span>}
                          </td>
                          <td className="px-3 py-2 text-gray-500">{r.area || '—'}</td>
                          <td className="px-3 py-2 text-gray-500">{r.cargo || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={handleClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              {rows.length > 0 && (
                <button onClick={handleImport} disabled={importing || validCount === 0}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60">
                  <Upload size={15} />
                  {importing ? 'Importando...' : `Importar ${validCount} colaboradores`}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
