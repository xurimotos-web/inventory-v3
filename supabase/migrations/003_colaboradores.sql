-- Migración: tabla colaboradores (personas que reciben insumos)
-- Ejecutar en: Supabase > SQL Editor

CREATE TABLE IF NOT EXISTS public.colaboradores (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  area TEXT,
  cargo TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "colaboradores_select" ON public.colaboradores FOR SELECT TO authenticated USING (true);
CREATE POLICY "colaboradores_all"    ON public.colaboradores FOR ALL    TO authenticated USING (true);
