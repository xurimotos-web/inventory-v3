import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Download } from 'lucide-react';

interface ImageLightboxProps {
  src: string;
  alt: string;
  open: boolean;
  onClose: () => void;
}

export default function ImageLightbox({ src, alt, open, onClose }: ImageLightboxProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backgroundColor: 'rgba(0,0,0,0.88)',
      }}
      onClick={onClose}
    >
      <div
        style={{ position: 'relative', width: '100%', maxWidth: '56rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', padding: '0 0.25rem' }}>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '18rem' }}>
            {alt}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <a
              href={src}
              download={alt}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.75rem', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', fontSize: '0.75rem', borderRadius: '0.5rem', textDecoration: 'none' }}
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)')}
            >
              <Download size={13} />
              Descargar
            </a>
            <button
              onClick={onClose}
              style={{ padding: '0.375rem', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.2)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.1)')}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Image */}
        <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '1rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
          <img
            src={src}
            alt={alt}
            style={{ width: '100%', maxHeight: '75vh', objectFit: 'contain', display: 'block' }}
          />
        </div>

        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.75rem', textAlign: 'center', marginTop: '0.75rem' }}>
          Haz clic fuera de la imagen o presiona ESC para cerrar
        </p>
      </div>
    </div>,
    document.body
  );
}
