-- Migración: crear tablas areas y destinos para formulario de salidas
-- Ejecutar en: Supabase > SQL Editor

CREATE TABLE IF NOT EXISTS public.areas (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.destinos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.destinos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "areas_select" ON public.areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "areas_all"    ON public.areas FOR ALL    TO authenticated USING (true);

CREATE POLICY "destinos_select" ON public.destinos FOR SELECT TO authenticated USING (true);
CREATE POLICY "destinos_all"    ON public.destinos FOR ALL    TO authenticated USING (true);
