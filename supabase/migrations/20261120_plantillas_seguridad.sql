-- ============================================================
-- MIGRACIÓN: PLANTILLAS DE SEGURIDAD EN CAMPO (TRABAJOS ELÉCTRICOS, LOTO, ALTURAS)
-- Permite crear múltiples plantillas de seguridad especializadas y
-- asociarlas selectivamente a las Órdenes de Trabajo (OT).
--
-- Ejecutar en: Supabase → SQL Editor → Run (Es idempotente).
-- ============================================================

-- 1. Tabla principal de plantillas de seguridad
CREATE TABLE IF NOT EXISTS plantillas_seguridad (
  id          SERIAL PRIMARY KEY,
  empresa_id  INTEGER      NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  titulo      VARCHAR(255) NOT NULL,
  descripcion TEXT,
  categoria   VARCHAR(100) NOT NULL DEFAULT 'ELECTRICO', -- 'ELECTRICO', 'ALTURAS', 'LOTO', 'EPP', 'GENERAL'
  es_default  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plantillas_seguridad_empresa_id ON plantillas_seguridad(empresa_id);

-- 2. Vincular seguridad_items con plantilla_id
ALTER TABLE seguridad_items
  ADD COLUMN IF NOT EXISTS plantilla_id INTEGER REFERENCES plantillas_seguridad(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_seguridad_items_plantilla_id ON seguridad_items(plantilla_id);

-- 3. Tabla de asociación entre OTs y Plantillas de Seguridad
CREATE TABLE IF NOT EXISTS ot_seguridad_plantillas (
  ot_id        INTEGER NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  plantilla_id INTEGER NOT NULL REFERENCES plantillas_seguridad(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ot_id, plantilla_id)
);

CREATE INDEX IF NOT EXISTS idx_ot_seguridad_plantillas_ot_id ON ot_seguridad_plantillas(ot_id);

-- 4. Habilitar RLS (acceso por service_role server-side)
ALTER TABLE plantillas_seguridad    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ot_seguridad_plantillas ENABLE ROW LEVEL SECURITY;

-- 5. Sembrar Plantillas y Preguntas de Seguridad Eléctrica para empresas activas
DO $$
DECLARE
  r_emp RECORD;
  v_plan1_id INTEGER;
  v_plan2_id INTEGER;
  v_plan3_id INTEGER;
  v_plan4_id INTEGER;
BEGIN
  FOR r_emp IN SELECT id FROM empresas LOOP

    -- ── PLANTILLA 1: Las 5 Reglas de Oro de Seguridad Eléctrica ──
    SELECT id INTO v_plan1_id FROM plantillas_seguridad 
    WHERE empresa_id = r_emp.id AND titulo = 'Seguridad Eléctrica: Las 5 Reglas de Oro (RETIE / NFPA 70E)';
    
    IF v_plan1_id IS NULL THEN
      INSERT INTO plantillas_seguridad (empresa_id, titulo, descripcion, categoria, es_default)
      VALUES (
        r_emp.id,
        'Seguridad Eléctrica: Las 5 Reglas de Oro (RETIE / NFPA 70E)',
        'Protocolo mandatorio para desenergización y aseguramiento de circuitos e instalaciones de baja y media tensión antes de cualquier intervención directa.',
        'ELECTRICO',
        TRUE
      ) RETURNING id INTO v_plan1_id;

      INSERT INTO seguridad_items (empresa_id, plantilla_id, pregunta, requerido, es_critico, orden) VALUES
        (r_emp.id, v_plan1_id, '¿Se realizó el corte visible o apertura efectiva de todas las fuentes de alimentación del circuito?', TRUE, TRUE, 1),
        (r_emp.id, v_plan1_id, '¿Se aplicó bloqueo físico (candado LOTO) y tarjeta de señalización de peligro en los seccionadores o disyuntores?', TRUE, TRUE, 2),
        (r_emp.id, v_plan1_id, '¿Se comprobó la ausencia total de tensión en todas las fases y neutro mediante detector/multímetro verificado (Live-Dead-Live)?', TRUE, TRUE, 3),
        (r_emp.id, v_plan1_id, '¿Se colocó la puesta a tierra temporal y en cortocircuito en todas las fases activas del área de trabajo?', TRUE, TRUE, 4),
        (r_emp.id, v_plan1_id, '¿Se encuentra delimitada y señalizada la zona de trabajo con conos, cinta reflectiva y aviso de peligro?', TRUE, FALSE, 5);
    END IF;

    -- ── PLANTILLA 2: EPP Dieléctrico y Protección contra Arco ──
    SELECT id INTO v_plan2_id FROM plantillas_seguridad 
    WHERE empresa_id = r_emp.id AND titulo = 'EPP Dieléctrico e Inspección contra Arco Eléctrico (Arc Flash)';
    
    IF v_plan2_id IS NULL THEN
      INSERT INTO plantillas_seguridad (empresa_id, titulo, descripcion, categoria, es_default)
      VALUES (
        r_emp.id,
        'EPP Dieléctrico e Inspección contra Arco Eléctrico (Arc Flash)',
        'Inspección pre-operacional de elementos de protección personal dieléctricos y ropa ignífuga según categoría de riesgo de arco.',
        'EPP',
        FALSE
      ) RETURNING id INTO v_plan2_id;

      INSERT INTO seguridad_items (empresa_id, plantilla_id, pregunta, requerido, es_critico, orden) VALUES
        (r_emp.id, v_plan2_id, '¿Los guantes dieléctricos fueron inspeccionados visualmente y sometidos a prueba neumática (inflado) descartando perforaciones?', TRUE, TRUE, 1),
        (r_emp.id, v_plan2_id, '¿Se colocaron sobreguantes de vaqueta/cuero sobre los guantes dieléctricos para protección mecánica y térmica?', TRUE, TRUE, 2),
        (r_emp.id, v_plan2_id, '¿El técnico utiliza ropa de trabajo 100% ignífuga / anti-arco con nivel ATPV (cal/cm²) correspondiente al tablero o celda?', TRUE, TRUE, 3),
        (r_emp.id, v_plan2_id, '¿El casco de seguridad es dieléctrico (Clase E - 20,000V) con barboquejo ajustado y careta facial contra arco eléctrico?', TRUE, TRUE, 4),
        (r_emp.id, v_plan2_id, '¿El calzado de seguridad es 100% dieléctrico, sin puntera ni ojalillos metálicos, limpio y con suela seca libre de virutas?', TRUE, FALSE, 5);
    END IF;

    -- ── PLANTILLA 3: Trabajos en Altura con Riesgo Eléctrico ──
    SELECT id INTO v_plan3_id FROM plantillas_seguridad 
    WHERE empresa_id = r_emp.id AND titulo = 'Trabajos en Altura con Riesgo Eléctrico (Postes y Redes Aéreas)';
    
    IF v_plan3_id IS NULL THEN
      INSERT INTO plantillas_seguridad (empresa_id, titulo, descripcion, categoria, es_default)
      VALUES (
        r_emp.id,
        'Trabajos en Altura con Riesgo Eléctrico (Postes y Redes Aéreas)',
        'Inspección de estructuras de apoyo, sistemas anticaídas dieléctricos y distancias mínimas de seguridad en redes aéreas.',
        'ALTURAS',
        FALSE
      ) RETURNING id INTO v_plan3_id;

      INSERT INTO seguridad_items (empresa_id, plantilla_id, pregunta, requerido, es_critico, orden) VALUES
        (r_emp.id, v_plan3_id, '¿El arnés de cuerpo entero, eslingas y mosquetones cuentan con herrajes dieléctricos o aislamiento aislante no conductor?', TRUE, TRUE, 1),
        (r_emp.id, v_plan3_id, '¿Se inspeccionó la solidez mecánica del poste o estructura (ausencia de pudrición en la base o fracturas) antes del ascenso?', TRUE, TRUE, 2),
        (r_emp.id, v_plan3_id, '¿Se respetan estrictamente las Distancias Mínimas de Seguridad (DMS) respecto a líneas energizadas vecinas?', TRUE, TRUE, 3),
        (r_emp.id, v_plan3_id, '¿La escalera de fibra de vidrio cuenta con zapatas antideslizantes y se encuentra firmemente amarrada al poste en su extremo?', TRUE, TRUE, 4),
        (r_emp.id, v_plan3_id, '¿Se dispone de pértiga de rescate dieléctrica en el sitio y el segundo técnico/vigía conoce el protocolo de emergencia?', TRUE, FALSE, 5);
    END IF;

    -- ── PLANTILLA 4: Cuadros de Distribución y Medición en Baja Tensión ──
    SELECT id INTO v_plan4_id FROM plantillas_seguridad 
    WHERE empresa_id = r_emp.id AND titulo = 'Intervención en Cuadros de Distribución y Medición en Baja Tensión';
    
    IF v_plan4_id IS NULL THEN
      INSERT INTO plantillas_seguridad (empresa_id, titulo, descripcion, categoria, es_default)
      VALUES (
        r_emp.id,
        'Intervención en Cuadros de Distribución y Medición en Baja Tensión',
        'Protocolo de seguridad para mantenimiento, cambio de protecciones, acometidas y conexionado de tableros eléctricos.',
        'LOTO',
        FALSE
      ) RETURNING id INTO v_plan4_id;

      INSERT INTO seguridad_items (empresa_id, plantilla_id, pregunta, requerido, es_critico, orden) VALUES
        (r_emp.id, v_plan4_id, '¿Las herramientas manuales (destornilladores, alicates, llaves) cuentan con aislamiento certificado 1000V (VDE / IEC 60900)?', TRUE, TRUE, 1),
        (r_emp.id, v_plan4_id, '¿Los instrumentos de medición (multímetro o pinza amperimétrica) cuentan con categoría mínima CAT III 600V / CAT IV?', TRUE, TRUE, 2),
        (r_emp.id, v_plan4_id, '¿Se verificó que bancos de condensadores o fuentes ininterrumpidas (UPS) se encuentren completamente descargados?', TRUE, TRUE, 3),
        (r_emp.id, v_plan4_id, '¿Se instalaron mantas o protectores aislantes temporales para cubrir partes energizadas adyacentes?', TRUE, FALSE, 4),
        (r_emp.id, v_plan4_id, '¿El área de piso cuenta con alfombra o tapete dieléctrico certificado frente al tablero intervenido?', TRUE, FALSE, 5);
    END IF;

    -- Actualizar ítems huérfanos pre-existentes a la plantilla 1
    UPDATE seguridad_items
    SET plantilla_id = v_plan1_id
    WHERE empresa_id = r_emp.id AND plantilla_id IS NULL;

  END LOOP;
END $$;
