import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X } from 'lucide-react';

export interface ComboOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface ComboBoxProps {
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  /** Si true, el valor guardado es el texto libre (no el value de la opción) */
  freeText?: boolean;
}

export default function ComboBox({
  options, value, onChange, placeholder = 'Buscar o seleccionar...', emptyText, freeText = false,
}: ComboBoxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // Texto visible en el input
  const displayText = freeText
    ? value
    : (options.find((o) => o.value === value)?.label ?? '');

  const [text, setText] = useState(displayText);

  // Sincronizar cuando el valor cambia desde afuera (reset del form)
  useEffect(() => {
    const label = freeText ? value : (options.find((o) => o.value === value)?.label ?? '');
    setText(label);
    if (!open) setQuery('');
  }, [value, options, freeText]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!open) return;
    function handleDown(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || dropRef.current?.contains(t)) return;
      closeDropdown();
    }
    document.addEventListener('mousedown', handleDown);
    return () => document.removeEventListener('mousedown', handleDown);
  }, [open, value, options, freeText]);

  function calcPos() {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }

  function openDropdown() {
    calcPos();
    setOpen(true);
    setQuery('');
  }

  function closeDropdown() {
    setOpen(false);
    setQuery('');
    // Revertir texto si no es freeText y no hay valor
    if (!freeText) {
      setText(options.find((o) => o.value === value)?.label ?? '');
    }
  }

  const filtered = query.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        (o.sublabel ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : options;

  function handleSelect(opt: ComboOption) {
    onChange(freeText ? opt.label : opt.value);
    setText(opt.label);
    setQuery('');
    setOpen(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setText(val);
    setQuery(val);
    if (!open) openDropdown();
    if (freeText) {
      onChange(val);
    } else if (!val) {
      onChange('');
    }
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('');
    setText('');
    setQuery('');
    setOpen(false);
  }

  const inputCls = 'w-full pl-3.5 pr-16 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={handleInputChange}
        onFocus={openDropdown}
        placeholder={placeholder}
        className={inputCls}
        autoComplete="off"
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
        {(value || text) && (
          <button type="button" onClick={handleClear} className="p-1 text-gray-400 hover:text-gray-600 transition-colors rounded">
            <X size={13} />
          </button>
        )}
        <button
          type="button"
          onClick={() => open ? closeDropdown() : openDropdown()}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors rounded"
        >
          <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && createPortal(
        <div
          ref={dropRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 10000 }}
          className="bg-white border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <p className="px-3.5 py-2.5 text-sm text-gray-400">{emptyText ?? 'Sin resultados'}</p>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
                className={`w-full text-left px-3.5 py-2.5 text-sm transition-colors flex flex-col gap-0.5 ${
                  opt.value === value || (freeText && opt.label === value)
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="font-medium leading-tight">{opt.label}</span>
                {opt.sublabel && <span className="text-xs text-gray-400">{opt.sublabel}</span>}
              </button>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
