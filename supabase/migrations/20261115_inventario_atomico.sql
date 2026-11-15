-- Operaciones de inventario en una sola transacción.
-- Antes cada paso (leer stock, sumar, registrar) era una llamada separada desde la
-- API: dos peticiones simultáneas podían pisarse y un fallo a medias dejaba el
-- stock descuadrado. Estas funciones hacen todo o nada.
-- Aplicar en Supabase → SQL Editor → Run. Es idempotente.
-- La API detecta si existen; si no, sigue usando el camino anterior.

-- Carga stock al kit de un técnico y deja el registro de la transferencia.
CREATE OR REPLACE FUNCTION transferir_a_tecnico(
  p_empresa_id  INTEGER,
  p_tecnico_id  INTEGER,
  p_material_id INTEGER,
  p_cantidad    NUMERIC
) RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_cantidad NUMERIC;
BEGIN
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a 0';
  END IF;

  INSERT INTO transferencias_inventario (empresa_id, tecnico_id, material_id, cantidad)
  VALUES (p_empresa_id, p_tecnico_id, p_material_id, p_cantidad);

  INSERT INTO inventario_tecnicos (tecnico_id, material_id, cantidad, cantidad_minima)
  VALUES (p_tecnico_id, p_material_id, p_cantidad, 0)
  ON CONFLICT (tecnico_id, material_id)
  DO UPDATE SET cantidad = inventario_tecnicos.cantidad + EXCLUDED.cantidad
  RETURNING cantidad INTO v_cantidad;

  RETURN v_cantidad;
END;
$$;

-- Reemplaza los repuestos usados de una OT: devuelve al kit el consumo anterior,
-- guarda la lista nueva y descuenta el stock. p_items es un arreglo JSON de
-- { material_id, cantidad, foto_antes, foto_despues }.
CREATE OR REPLACE FUNCTION registrar_repuestos_ot(
  p_ot_id      INTEGER,
  p_tecnico_id INTEGER,
  p_items      JSONB
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'p_items debe ser un arreglo';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) e
    WHERE (e->>'cantidad') IS NULL OR (e->>'cantidad')::NUMERIC <= 0
  ) THEN
    RAISE EXCEPTION 'Cada repuesto requiere cantidad mayor a 0';
  END IF;

  -- 1. Devolver al kit lo consumido antes en esta OT
  UPDATE inventario_tecnicos i
     SET cantidad = i.cantidad + u.total
    FROM (
      SELECT material_id, SUM(cantidad) AS total
        FROM ot_repuestos_usados
       WHERE ot_id = p_ot_id
       GROUP BY material_id
    ) u
   WHERE i.tecnico_id = p_tecnico_id
     AND i.material_id = u.material_id;

  -- 2. Reemplazar la lista
  DELETE FROM ot_repuestos_usados WHERE ot_id = p_ot_id;

  INSERT INTO ot_repuestos_usados (ot_id, material_id, cantidad, foto_antes, foto_despues)
  SELECT p_ot_id,
         (e->>'material_id')::INTEGER,
         (e->>'cantidad')::NUMERIC,
         e->>'foto_antes',
         e->>'foto_despues'
    FROM jsonb_array_elements(p_items) e;

  -- 3. Descontar el consumo nuevo
  UPDATE inventario_tecnicos i
     SET cantidad = i.cantidad - n.total
    FROM (
      SELECT (e->>'material_id')::INTEGER AS material_id,
             SUM((e->>'cantidad')::NUMERIC) AS total
        FROM jsonb_array_elements(p_items) e
       GROUP BY 1
    ) n
   WHERE i.tecnico_id = p_tecnico_id
     AND i.material_id = n.material_id;
END;
$$;

-- Solo el servidor (service_role) puede llamarlas; nunca el navegador.
DO $$
BEGIN
  REVOKE ALL ON FUNCTION transferir_a_tecnico(INTEGER, INTEGER, INTEGER, NUMERIC) FROM PUBLIC;
  REVOKE ALL ON FUNCTION registrar_repuestos_ot(INTEGER, INTEGER, JSONB) FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION transferir_a_tecnico(INTEGER, INTEGER, INTEGER, NUMERIC) FROM anon, authenticated;
    REVOKE ALL ON FUNCTION registrar_repuestos_ot(INTEGER, INTEGER, JSONB) FROM anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION transferir_a_tecnico(INTEGER, INTEGER, INTEGER, NUMERIC) TO service_role;
    GRANT EXECUTE ON FUNCTION registrar_repuestos_ot(INTEGER, INTEGER, JSONB) TO service_role;
  END IF;
END;
$$;
