import { useState, useRef } from 'react';
import { Upload, X, Camera } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string | undefined) => void;
  folder?: string;
}

export default function ImageUpload({ value, onChange, folder = 'insumos' }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('Solo se permiten imágenes'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('La imagen no puede superar 5MB'); return; }

    setUploading(true);
    const ext = file.name.split('.').pop();
    const filename = `${folder}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from('imagenes').upload(filename, file, { upsert: true });
    if (error) { toast.error('Error al subir la imagen'); setUploading(false); return; }

    const { data: { publicUrl } } = supabase.storage.from('imagenes').getPublicUrl(filename);
    onChange(publicUrl);
    setUploading(false);
    toast.success('Imagen subida correctamente');
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      {value ? (
        <div className="relative w-full h-40 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 group">
          <img src={value} alt="Imagen del insumo" className="w-full h-full object-cover" />
          {/* Overlay al hacer hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 px-3 py-2 bg-white text-gray-800 rounded-lg text-xs font-medium hover:bg-gray-100"
            >
              {uploading ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
              ) : (
                <Camera size={13} />
              )}
              Cambiar foto
            </button>
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700"
            >
              <X size={13} />
              Eliminar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full h-32 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-60"
        >
          {uploading ? (
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <Upload size={18} className="text-gray-500" />
              </div>
              <p className="text-sm text-gray-500">Haz clic para subir imagen</p>
              <p className="text-xs text-gray-400">PNG, JPG hasta 5MB</p>
            </>
          )}
        </button>
      )}
    </div>
  );
}
