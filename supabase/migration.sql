-- ============================================================
-- OrderTrack — Schema de Producción para Supabase (PostgreSQL)
-- ============================================================
-- Instrucciones:
--   1. Ir a Supabase → SQL Editor → pegar este archivo completo → Run
--   2. Ejecutar en orden (los ENUMs primero, luego tablas en orden de FK)
-- ============================================================


-- ============================================================
-- TIPOS ENUM
-- ============================================================

CREATE TYPE usuario_rol        AS ENUM ('superadmin', 'admin', 'operador', 'tecnico');
CREATE TYPE ot_prioridad       AS ENUM ('baja', 'media', 'alta', 'critica');
CREATE TYPE ot_estado          AS ENUM (
  'RECIBIDA', 'EN_REVISION', 'APROBADA', 'RECHAZADA',
  'PROGRAMADA', 'EN_EJECUCION', 'PAUSADA',
  'COMPLETADA', 'CERRADA', 'ANULADA',
  'ESPERANDO_REPUESTO', 'PRECIERRE'
);
CREATE TYPE ote_origen         AS ENUM ('manual', 'sistema', 'automatico');
CREATE TYPE plantilla_item_tipo AS ENUM ('SI_NO', 'ESCALA', 'NUMERICO', 'TEXTO', 'FOTO');
CREATE TYPE repuesto_estado    AS ENUM ('SOLICITADO', 'EN_CAMINO', 'ENTREGADO');
CREATE TYPE equipo_estado      AS ENUM ('OPERATIVO', 'INOPERATIVO', 'EN_MANTENIMIENTO', 'DE_BAJA');


-- ============================================================
-- EMPRESAS
-- ============================================================

CREATE TABLE empresas (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(200) NOT NULL,
  ruc         VARCHAR(20)  NOT NULL UNIQUE,
  api_key     VARCHAR(255) NOT NULL UNIQUE,
  activo      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_empresas_ruc     ON empresas(ruc);
CREATE INDEX idx_empresas_api_key ON empresas(api_key);


-- ============================================================
-- USUARIOS
-- ============================================================

CREATE TABLE usuarios (
  id              SERIAL PRIMARY KEY,
  empresa_id      INTEGER REFERENCES empresas(id) ON DELETE CASCADE,
  nombre          VARCHAR(150) NOT NULL,
  email           VARCHAR(150) NOT NULL UNIQUE,
  rol             usuario_rol  NOT NULL,
  activo          BOOLEAN      NOT NULL DEFAULT TRUE,
  hashed_password VARCHAR(255),                          -- NULL para usuarios Supabase Auth
  supabase_uid    UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usuarios_email      ON usuarios(email);
CREATE INDEX idx_usuarios_empresa_id ON usuarios(empresa_id);


-- ============================================================
-- CLIENTES
-- ============================================================

CREATE TABLE clientes (
  id          SERIAL PRIMARY KEY,
  empresa_id  INTEGER      NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre      VARCHAR(200) NOT NULL,
  ruc         VARCHAR(20)  NOT NULL,
  email       VARCHAR(150),
  telefono    VARCHAR(20),
  activo      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_cliente_empresa_ruc UNIQUE (empresa_id, ruc)
);

CREATE INDEX idx_clientes_empresa_id ON clientes(empresa_id);


-- ============================================================
-- PRIORIDADES DE CLIENTE
-- ============================================================

CREATE TABLE prioridad_cliente (
  id                 SERIAL PRIMARY KEY,
  cliente_id         INTEGER     NOT NULL REFERENCES clientes(id),
  etiqueta_cliente   VARCHAR(100) NOT NULL,
  prioridad_interna  ot_prioridad NOT NULL,
  activo             BOOLEAN      NOT NULL DEFAULT TRUE,

  CONSTRAINT uq_cliente_prioridad_etiqueta UNIQUE (cliente_id, etiqueta_cliente)
);


-- ============================================================
-- CANAL DE INGRESO
-- ============================================================

CREATE TABLE canal_ingreso (
  id          SERIAL PRIMARY KEY,
  nombre      VARCHAR(50)  NOT NULL UNIQUE,
  descripcion VARCHAR(200)
);

CREATE INDEX idx_canal_ingreso_nombre ON canal_ingreso(nombre);


-- ============================================================
-- PLANTILLAS DE TRABAJO
-- ============================================================

CREATE TABLE plantillas_trabajo (
  id                       SERIAL PRIMARY KEY,
  empresa_id               INTEGER      NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  titulo                   VARCHAR(200) NOT NULL,
  descripcion              TEXT,
  tiempo_estimado_minutos  INTEGER      NOT NULL DEFAULT 60,
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_plantillas_empresa_id ON plantillas_trabajo(empresa_id);


-- ============================================================
-- ÍTEMS DE PLANTILLA (checklist)
-- ============================================================

CREATE TABLE plantilla_items (
  id              SERIAL PRIMARY KEY,
  plantilla_id    INTEGER             NOT NULL REFERENCES plantillas_trabajo(id) ON DELETE CASCADE,
  orden           INTEGER             NOT NULL DEFAULT 0,
  pregunta        VARCHAR(500)        NOT NULL,
  tipo_respuesta  plantilla_item_tipo NOT NULL DEFAULT 'SI_NO',
  requerido       BOOLEAN             NOT NULL DEFAULT TRUE,
  grupo           VARCHAR(100),
  created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_plantilla_items_plantilla_id ON plantilla_items(plantilla_id);


-- ============================================================
-- REPUESTOS / MATERIALES
-- ============================================================

CREATE TABLE repuestos_materiales (
  id              SERIAL PRIMARY KEY,
  empresa_id      INTEGER       NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre          VARCHAR(200)  NOT NULL,
  codigo          VARCHAR(100)  NOT NULL,
  precio_unitario NUMERIC(10,2) DEFAULT 0.00,
  unidad_medida   VARCHAR(50)   NOT NULL DEFAULT 'unidades',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_repuestos_empresa_id ON repuestos_materiales(empresa_id);


-- ============================================================
-- ÍTEMS DE SEGURIDAD
-- ============================================================

CREATE TABLE seguridad_items (
  id          SERIAL PRIMARY KEY,
  empresa_id  INTEGER      NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  pregunta    VARCHAR(500) NOT NULL,
  requerido   BOOLEAN      NOT NULL DEFAULT TRUE,
  es_critico  BOOLEAN      NOT NULL DEFAULT FALSE,
  orden       INTEGER      NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_seguridad_items_empresa_id ON seguridad_items(empresa_id);


-- ============================================================
-- CONFIGURACIÓN DE NOTIFICACIONES POR EMPRESA
-- ============================================================

CREATE TABLE empresa_notif_configs (
  id                       SERIAL PRIMARY KEY,
  empresa_id               INTEGER     NOT NULL UNIQUE REFERENCES empresas(id) ON DELETE CASCADE,
  activar_notificaciones   BOOLEAN     NOT NULL DEFAULT TRUE,
  notificar_via            VARCHAR(50) NOT NULL DEFAULT 'email',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- JERARQUÍA DE EQUIPOS: CATEGORÍA → TIPO → EQUIPO
-- ============================================================

CREATE TABLE equipo_categorias (
  id          SERIAL PRIMARY KEY,
  empresa_id  INTEGER      NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nombre      VARCHAR(150) NOT NULL,
  icono       VARCHAR(100),
  activo      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_equipo_categoria_empresa_nombre UNIQUE (empresa_id, nombre)
);

CREATE INDEX idx_equipo_categorias_empresa_id ON equipo_categorias(empresa_id);


CREATE TABLE equipo_tipos (
  id               SERIAL PRIMARY KEY,
  empresa_id       INTEGER  NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  categoria_id     INTEGER  NOT NULL REFERENCES equipo_categorias(id) ON DELETE CASCADE,
  nombre           VARCHAR(150) NOT NULL,
  campos_sugeridos JSONB,
  activo           BOOLEAN  NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_equipo_tipo_empresa_cat_nombre UNIQUE (empresa_id, categoria_id, nombre)
);

CREATE INDEX idx_equipo_tipos_empresa_id   ON equipo_tipos(empresa_id);
CREATE INDEX idx_equipo_tipos_categoria_id ON equipo_tipos(categoria_id);


CREATE TABLE equipos (
  id                 SERIAL PRIMARY KEY,
  empresa_id         INTEGER      NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id         INTEGER      REFERENCES clientes(id) ON DELETE SET NULL,
  tipo_id            INTEGER      NOT NULL REFERENCES equipo_tipos(id) ON DELETE RESTRICT,
  nombre             VARCHAR(200) NOT NULL,
  codigo_inventario  VARCHAR(100),
  area               VARCHAR(200),
  ubicacion_detalle  VARCHAR(300),
  atributos          JSONB,
  estado_operativo   equipo_estado NOT NULL DEFAULT 'OPERATIVO',
  activo             BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_equipo_empresa_codigo_inv UNIQUE (empresa_id, codigo_inventario)
);

CREATE INDEX idx_equipos_empresa_id  ON equipos(empresa_id);
CREATE INDEX idx_equipos_cliente_id  ON equipos(cliente_id);
CREATE INDEX idx_equipos_tipo_id     ON equipos(tipo_id);


-- ============================================================
-- ÓRDENES DE TRABAJO
-- ============================================================

CREATE TABLE ordenes_trabajo (
  id                      SERIAL PRIMARY KEY,
  empresa_id              INTEGER       NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  codigo_interno          VARCHAR(50)   NOT NULL,
  codigo_externo          VARCHAR(100),
  cliente_id              INTEGER       NOT NULL REFERENCES clientes(id),
  canal_id                INTEGER       NOT NULL REFERENCES canal_ingreso(id),
  titulo                  VARCHAR(300)  NOT NULL,
  descripcion             TEXT,
  prioridad               ot_prioridad  NOT NULL,
  prioridad_origen        VARCHAR(100),
  estado                  ot_estado     NOT NULL DEFAULT 'RECIBIDA',
  tecnico_asignado_id     INTEGER       REFERENCES usuarios(id),
  fecha_recepcion         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  fecha_programada        TIMESTAMPTZ,
  fecha_inicio_real       TIMESTAMPTZ,
  fecha_cierre            TIMESTAMPTZ,
  -- Campo de trabajo en terreno
  plantilla_id            INTEGER       REFERENCES plantillas_trabajo(id),
  fecha_salida            TIMESTAMPTZ,
  latitud_salida          FLOAT,
  longitud_salida         FLOAT,
  fecha_llegada           TIMESTAMPTZ,
  latitud_llegada         FLOAT,
  longitud_llegada        FLOAT,
  firma_cliente           VARCHAR(500),
  firma_nombre_cliente    VARCHAR(200),
  firma_documento_cliente VARCHAR(50),
  firma_foto_evidencia    VARCHAR(500),
  monto                   NUMERIC(10,2) DEFAULT 0.00,
  -- Reapertura / garantía
  es_reapertura           BOOLEAN       NOT NULL DEFAULT FALSE,
  ot_original_id          INTEGER       REFERENCES ordenes_trabajo(id) ON DELETE SET NULL,
  -- Equipo principal (referencia rápida)
  equipo_principal_id     INTEGER       REFERENCES equipos(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_ot_empresa_codigo UNIQUE (empresa_id, codigo_interno)
);

CREATE INDEX idx_ot_empresa_id          ON ordenes_trabajo(empresa_id);
CREATE INDEX idx_ot_cliente_id          ON ordenes_trabajo(cliente_id);
CREATE INDEX idx_ot_tecnico_asignado_id ON ordenes_trabajo(tecnico_asignado_id);
CREATE INDEX idx_ot_estado              ON ordenes_trabajo(estado);
CREATE INDEX idx_ot_codigo_interno      ON ordenes_trabajo(codigo_interno);


-- ============================================================
-- TABLA DE ASOCIACIÓN OT ↔ PLANTILLAS (many-to-many)
-- ============================================================

CREATE TABLE ot_plantillas_association (
  ot_id        INTEGER NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  plantilla_id INTEGER NOT NULL REFERENCES plantillas_trabajo(id) ON DELETE CASCADE,
  PRIMARY KEY (ot_id, plantilla_id)
);


-- ============================================================
-- EVENTOS / HISTORIAL DE ESTADOS
-- ============================================================

CREATE TABLE ot_eventos (
  id               SERIAL PRIMARY KEY,
  ot_id            INTEGER     NOT NULL REFERENCES ordenes_trabajo(id),
  estado_anterior  ot_estado,
  estado_nuevo     ot_estado   NOT NULL,
  usuario_id       INTEGER     REFERENCES usuarios(id),
  comentario       TEXT,
  origen           ote_origen  NOT NULL DEFAULT 'manual',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ot_eventos_ot_id ON ot_eventos(ot_id);


-- ============================================================
-- ADJUNTOS (fotos, PDFs — ruta = URL de Supabase Storage)
-- ============================================================

CREATE TABLE ot_adjuntos (
  id              SERIAL PRIMARY KEY,
  ot_id           INTEGER      NOT NULL REFERENCES ordenes_trabajo(id),
  nombre_archivo  VARCHAR(255) NOT NULL,
  ruta            VARCHAR(500) NOT NULL,   -- URL de Supabase Storage
  tipo_mime       VARCHAR(100),
  subido_por      INTEGER      REFERENCES usuarios(id),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ot_adjuntos_ot_id ON ot_adjuntos(ot_id);


-- ============================================================
-- NOTAS
-- ============================================================

CREATE TABLE ot_notas (
  id          SERIAL PRIMARY KEY,
  ot_id       INTEGER  NOT NULL REFERENCES ordenes_trabajo(id),
  usuario_id  INTEGER  REFERENCES usuarios(id),
  contenido   TEXT     NOT NULL,
  es_interna  BOOLEAN  NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ot_notas_ot_id ON ot_notas(ot_id);


-- ============================================================
-- CHECKLIST RESPUESTAS
-- ============================================================

CREATE TABLE ot_checklist_respuestas (
  id                SERIAL PRIMARY KEY,
  ot_id             INTEGER  NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  plantilla_item_id INTEGER  NOT NULL REFERENCES plantilla_items(id) ON DELETE CASCADE,
  valor_texto       TEXT,
  valor_numerico    FLOAT,
  valor_booleano    BOOLEAN,
  ruta_foto         VARCHAR(500),
  foto_antes        VARCHAR(500),
  foto_despues      VARCHAR(500),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checklist_ot_id ON ot_checklist_respuestas(ot_id);


-- ============================================================
-- REPUESTOS USADOS EN UNA OT
-- ============================================================

CREATE TABLE ot_repuestos_usados (
  id          SERIAL PRIMARY KEY,
  ot_id       INTEGER       NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  material_id INTEGER       NOT NULL REFERENCES repuestos_materiales(id) ON DELETE CASCADE,
  cantidad    NUMERIC(10,2) NOT NULL DEFAULT 1.0,
  foto_antes  VARCHAR(500),
  foto_despues VARCHAR(500),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ot_repuestos_usados_ot_id ON ot_repuestos_usados(ot_id);


-- ============================================================
-- REPUESTOS PENDIENTES (solicitados, en camino, entregados)
-- ============================================================

CREATE TABLE ot_repuestos_pendientes (
  id              SERIAL PRIMARY KEY,
  ot_id           INTEGER         NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  material_id     INTEGER         REFERENCES repuestos_materiales(id) ON DELETE SET NULL,
  nombre_otro     VARCHAR(200),   -- para repuesto no catalogado
  cantidad        NUMERIC(10,2)   NOT NULL,
  estado          repuesto_estado NOT NULL DEFAULT 'SOLICITADO',
  fecha_estimada  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ot_repuestos_pendientes_ot_id ON ot_repuestos_pendientes(ot_id);


-- ============================================================
-- RESPUESTAS DE SEGURIDAD
-- ============================================================

CREATE TABLE ot_seguridad_respuestas (
  id                     SERIAL PRIMARY KEY,
  ot_id                  INTEGER  NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  seguridad_item_id      INTEGER  NOT NULL REFERENCES seguridad_items(id) ON DELETE CASCADE,
  cumple                 BOOLEAN,
  motivo_no_cumplimiento TEXT,
  ruta_foto              VARCHAR(500),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ot_seguridad_ot_id ON ot_seguridad_respuestas(ot_id);


-- ============================================================
-- ENCUESTAS DE SATISFACCIÓN
-- ============================================================

CREATE TABLE ot_encuestas (
  id          SERIAL PRIMARY KEY,
  ot_id       INTEGER  NOT NULL UNIQUE REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  puntuacion  INTEGER  NOT NULL CHECK (puntuacion BETWEEN 1 AND 5),
  comentario  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- EQUIPOS VINCULADOS A UNA OT
-- ============================================================

CREATE TABLE ot_equipos (
  id           SERIAL PRIMARY KEY,
  ot_id        INTEGER  NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  equipo_id    INTEGER  NOT NULL REFERENCES equipos(id) ON DELETE CASCADE,
  es_principal BOOLEAN  NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_ot_equipo_ot_equipo UNIQUE (ot_id, equipo_id)
);

CREATE INDEX idx_ot_equipos_ot_id     ON ot_equipos(ot_id);
CREATE INDEX idx_ot_equipos_equipo_id ON ot_equipos(equipo_id);


-- ============================================================
-- INVENTARIO POR TÉCNICO
-- ============================================================

CREATE TABLE inventario_tecnicos (
  id               SERIAL PRIMARY KEY,
  tecnico_id       INTEGER       NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  material_id      INTEGER       NOT NULL REFERENCES repuestos_materiales(id) ON DELETE CASCADE,
  cantidad         NUMERIC(10,2) NOT NULL DEFAULT 0.0,
  cantidad_minima  NUMERIC(10,2) NOT NULL DEFAULT 0.0,
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_tecnico_material_inventario UNIQUE (tecnico_id, material_id)
);


-- ============================================================
-- TRANSFERENCIAS DE INVENTARIO
-- ============================================================

CREATE TABLE transferencias_inventario (
  id          SERIAL PRIMARY KEY,
  empresa_id  INTEGER       NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tecnico_id  INTEGER       NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  material_id INTEGER       NOT NULL REFERENCES repuestos_materiales(id) ON DELETE CASCADE,
  cantidad    NUMERIC(10,2) NOT NULL,
  fecha       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transferencias_tecnico_id ON transferencias_inventario(tecnico_id);


-- ============================================================
-- FUNCIÓN: updated_at automático
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER trg_updated_at_ordenes
  BEFORE UPDATE ON ordenes_trabajo
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_updated_at_plantillas
  BEFORE UPDATE ON plantillas_trabajo
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_updated_at_equipo_categorias
  BEFORE UPDATE ON equipo_categorias
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_updated_at_equipo_tipos
  BEFORE UPDATE ON equipo_tipos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_updated_at_equipos
  BEFORE UPDATE ON equipos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_updated_at_inventario_tecnicos
  BEFORE UPDATE ON inventario_tecnicos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
-- Habilitado en todas las tablas. El anon key no tiene acceso.
-- Las API Routes usan service_role key (server-side) que bypasea RLS.
-- ============================================================

ALTER TABLE empresas                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE prioridad_cliente         ENABLE ROW LEVEL SECURITY;
ALTER TABLE canal_ingreso             ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantillas_trabajo        ENABLE ROW LEVEL SECURITY;
ALTER TABLE plantilla_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE repuestos_materiales      ENABLE ROW LEVEL SECURITY;
ALTER TABLE seguridad_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes_trabajo           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ot_plantillas_association ENABLE ROW LEVEL SECURITY;
ALTER TABLE ot_eventos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE ot_adjuntos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ot_notas                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ot_checklist_respuestas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ot_repuestos_usados       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ot_repuestos_pendientes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ot_seguridad_respuestas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ot_encuestas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE ot_equipos                ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipos                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipo_tipos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipo_categorias         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_tecnicos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE transferencias_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresa_notif_configs     ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- DATOS INICIALES — canales de ingreso
-- ============================================================

INSERT INTO canal_ingreso (nombre, descripcion) VALUES
  ('Manual',   'Ingreso manual por operador'),
  ('WhatsApp', 'Ingreso via WhatsApp'),
  ('Email',    'Ingreso via email'),
  ('Web',      'Formulario web');
