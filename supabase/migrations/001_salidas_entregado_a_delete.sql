-- Migración: agregar columna entregado_a y política DELETE para admin
-- Ejecutar en: Supabase > SQL Editor

-- 1. Agregar columna entregado_a (persona que recibe el insumo)
ALTER TABLE public.salidas ADD COLUMN IF NOT EXISTS entregado_a TEXT;

-- 2. Agregar columnas area y destino si no existen (por si no estaban en el schema original)
ALTER TABLE public.salidas ADD COLUMN IF NOT EXISTS area TEXT;
ALTER TABLE public.salidas ADD COLUMN IF NOT EXISTS destino TEXT;

-- 3. Política DELETE para administradores en salidas
DROP POLICY IF EXISTS "salidas_delete_admin" ON public.salidas;
CREATE POLICY "salidas_delete_admin" ON public.salidas FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'admin')
  );
