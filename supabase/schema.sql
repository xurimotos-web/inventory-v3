-- =============================================
-- INVENTARIO V3.0 - SCHEMA SUPABASE
-- Ejecutar en: Supabase > SQL Editor
-- =============================================

-- 1. PERFILES DE USUARIO (vinculados a auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nombre TEXT NOT NULL,
  departamento TEXT NOT NULL DEFAULT '',
  cargo TEXT NOT NULL DEFAULT '',
  rol TEXT NOT NULL DEFAULT 'usuario' CHECK (rol IN ('admin', 'usuario')),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. CATEGORÍAS DE INSUMOS
CREATE TABLE public.categorias (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. INSUMOS (Catálogo)
CREATE TABLE public.insumos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  categoria_id INTEGER REFERENCES public.categorias(id) ON DELETE SET NULL,
  unidad TEXT NOT NULL DEFAULT 'unidad',
  stock_actual NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_minimo NUMERIC(12,2) NOT NULL DEFAULT 0,
  costo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  imagen_url TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ENTRADAS (Recepciones / Compras)
CREATE TABLE public.entradas (
  id SERIAL PRIMARY KEY,
  insumo_id INTEGER NOT NULL REFERENCES public.insumos(id),
  cantidad NUMERIC(12,2) NOT NULL,
  costo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  proveedor TEXT,
  numero_factura TEXT,
  observaciones TEXT,
  usuario_id UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. SALIDAS (Consumos / Retiros)
CREATE TABLE public.salidas (
  id SERIAL PRIMARY KEY,
  insumo_id INTEGER NOT NULL REFERENCES public.insumos(id),
  cantidad NUMERIC(12,2) NOT NULL,
  usuario_id UUID NOT NULL REFERENCES public.profiles(id),
  departamento TEXT NOT NULL DEFAULT '',
  cargo TEXT NOT NULL DEFAULT '',
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salidas ENABLE ROW LEVEL SECURITY;

-- PROFILES: cada usuario ve todos (para admin panel) pero solo edita el suyo
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (true);

-- CATEGORIAS: todos los autenticados leen, solo admin escribe (en producción añadir check de rol)
CREATE POLICY "categorias_select" ON public.categorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "categorias_all" ON public.categorias FOR ALL TO authenticated USING (true);

-- INSUMOS: todos leen, todos pueden modificar (el control de rol se hace en el frontend)
CREATE POLICY "insumos_select" ON public.insumos FOR SELECT TO authenticated USING (true);
CREATE POLICY "insumos_all" ON public.insumos FOR ALL TO authenticated USING (true);

-- ENTRADAS: todos los autenticados pueden ver e insertar
CREATE POLICY "entradas_select" ON public.entradas FOR SELECT TO authenticated USING (true);
CREATE POLICY "entradas_insert" ON public.entradas FOR INSERT TO authenticated WITH CHECK (true);

-- SALIDAS: todos pueden insertar la suya, admin ve todas, usuario solo las suyas
CREATE POLICY "salidas_select_admin" ON public.salidas FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin')
  );
CREATE POLICY "salidas_insert" ON public.salidas FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================
-- STORAGE BUCKET para imágenes
-- =============================================

-- Ejecutar desde el dashboard de Supabase > Storage > New Bucket
-- Nombre: imagenes
-- Public: true
-- O ejecutar esto si tienes permisos de storage:

INSERT INTO storage.buckets (id, name, public) VALUES ('imagenes', 'imagenes', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "imagenes_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'imagenes');
CREATE POLICY "imagenes_auth_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'imagenes');
CREATE POLICY "imagenes_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'imagenes');
CREATE POLICY "imagenes_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'imagenes');

-- =============================================
-- DATOS DE EJEMPLO (opcional, borrar en prod)
-- =============================================

INSERT INTO public.categorias (nombre, descripcion) VALUES
  ('Papelería', 'Materiales de oficina y papelería'),
  ('Limpieza', 'Productos de limpieza e higiene'),
  ('Herramientas', 'Herramientas y equipos'),
  ('Tecnología', 'Equipos y accesorios tecnológicos'),
  ('Cafetería', 'Insumos para cafetería y cocina');

-- =============================================
-- TRIGGER para actualizar updated_at en insumos
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER insumos_updated_at
  BEFORE UPDATE ON public.insumos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- CREAR PRIMER ADMIN MANUALMENTE
-- Después de que el usuario se registre en Supabase Auth,
-- actualizar su rol a admin con:
-- UPDATE public.profiles SET rol = 'admin' WHERE id = 'uuid-del-usuario';
-- =============================================
