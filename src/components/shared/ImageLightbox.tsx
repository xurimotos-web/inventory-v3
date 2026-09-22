import { useEffect } from 'react';
import { X, Download } from 'lucide-react';

interface ImageLightboxProps {
  src: string;
  alt: string;
  open: boolean;
  onClose: () => void;
}

export default function ImageLightbox({ src, alt, open, onClose }: ImageLightboxProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) {
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/85 backdrop-blur-md" />

      <div
        className="relative z-10 max-w-4xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-white/80 text-sm font-medium truncate max-w-xs">{alt}</p>
          <div className="flex items-center gap-2">
            <a
              href={src}
              download={alt}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Download size={13} />
              Descargar
            </a>
            <button
              onClick={onClose}
              className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Image */}
        <div className="bg-white/5 rounded-2xl overflow-hidden border border-white/10">
          <img
            src={src}
            alt={alt}
            className="w-full max-h-[75vh] object-contain"
          />
        </div>

        <p className="text-white/40 text-xs text-center mt-3">
          Haz clic fuera de la imagen o presiona ESC para cerrar
        </p>
      </div>
    </div>
  );
}
