-- Permite al admin de cada empresa decidir si sus técnicos pueden cargar
-- stock a su propio kit vehicular sin aprobación.
-- Por defecto TRUE: conserva el comportamiento actual.
-- Aplicar en Supabase → SQL Editor → Run. Es idempotente.

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS tecnico_autotransferencia BOOLEAN NOT NULL DEFAULT TRUE;
