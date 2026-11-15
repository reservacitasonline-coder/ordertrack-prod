export type RolUsuario = 'superadmin' | 'admin' | 'operador' | 'tecnico';

export interface CurrentUser {
  id: number
  supabase_uid: string
  email: string
  nombre: string
  rol: RolUsuario
  empresa_id: number | null
  activo: boolean
}

export interface UsuarioResumen {
  id: number;
  empresa_id: number | null;
  nombre: string;
  email: string;
  rol: RolUsuario;
}

export interface Usuario {
  id: number;
  empresa_id: number | null;
  nombre: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
  created_at: string;
}

export interface Empresa {
  id: number;
  nombre: string;
  ruc: string;
  api_key: string;
  activo: boolean;
  created_at: string;
}

export interface EmpresaResumen {
  id: number;
  nombre: string;
  ruc: string;
}

export interface ClienteResumen {
  id: number;
  empresa_id: number;
  nombre: string;
  ruc: string;
  telefono?: string | null;
  direccion?: string | null;
}

export interface ContratoCliente {
  codigo_contrato?: string;
  tipo_servicio?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  sla_horas_comprometido?: number;
  tarifa_mensual?: number;
  moneda?: string;
  contacto_comercial?: string;
  telefono_comercial?: string;
  email_comercial?: string;
  condiciones_pago?: string;
  estado_contrato?: 'vigente' | 'por_vencer' | 'vencido' | 'en_renovacion';
  observaciones?: string;
}

export interface Cliente {
  id: number;
  empresa_id: number;
  nombre: string;
  ruc: string;
  email: string | null;
  telefono: string | null;
  activo: boolean;
  created_at: string;
  contrato?: ContratoCliente | null;
  stats?: {
    total_ordenes: number;
    ordenes_activas: number;
    ordenes_completadas: number;
    total_equipos: number;
  };
  ultimas_ordenes?: Array<{
    id: number;
    codigo_interno: string;
    titulo: string;
    estado: EstadoOT;
    prioridad: PrioridadOT;
    created_at: string;
    fecha_programada?: string | null;
  }>;
  equipos?: Array<{
    id: number;
    nombre: string;
    codigo_inventario?: string | null;
    tipo?: { id: number; nombre: string; categoria?: { id: number; nombre: string } } | null;
  }>;
}

export type PrioridadOT = 'baja' | 'media' | 'alta' | 'critica';

export type EstadoOT =
  | 'RECIBIDA'
  | 'EN_REVISION'
  | 'APROBADA'
  | 'RECHAZADA'
  | 'PROGRAMADA'
  | 'EN_EJECUCION'
  | 'PAUSADA'
  | 'COMPLETADA'
  | 'CERRADA'
  | 'ANULADA'
  | 'ESPERANDO_REPUESTO'
  | 'PRECIERRE';

export type CanalIngreso = 'manual' | 'scraping' | 'correo' | 'api_externa';

export interface OrdenTrabajo {
  id: number;
  empresa_id: number;
  codigo_interno: string;
  codigo_externo: string | null;
  cliente: ClienteResumen;
  canal: string; // Nombre del canal (e.g. "manual", "scraping")
  titulo: string;
  descripcion?: string | null;
  prioridad: PrioridadOT;
  prioridad_origen: string | null;
  estado: EstadoOT;
  tecnico_asignado: UsuarioResumen | null;
  fecha_recepcion: string;
  fecha_programada: string | null;
  fecha_inicio_real: string | null;
  fecha_cierre: string | null;
  fecha_salida: string | null;
  fecha_llegada: string | null;
  latitud_salida: number | null;
  longitud_salida: number | null;
  latitud_llegada: number | null;
  longitud_llegada: number | null;
  firma_cliente: string | null;
  firma_nombre_cliente?: string | null;
  firma_documento_cliente?: string | null;
  firma_foto_evidencia?: string | null;
  monto?: number | null;
  plantilla_id: number | null;
  canal_id?: number | null;
  equipo_principal_id?: number | null;
  es_reapertura?: boolean;
  ot_original_id?: number | null;
  plantilla?: { id: number; titulo: string; tiempo_estimado_minutos: number } | null;
  plantillas: { id: number; titulo: string; tiempo_estimado_minutos: number }[];
  created_at: string;
  updated_at: string;
}

export interface OTEvento {
  id: number;
  ot_id: number;
  estado_anterior: EstadoOT | null;
  estado_nuevo: EstadoOT;
  usuario: UsuarioResumen | null;
  comentario: string | null;
  origen: 'manual' | 'sistema' | 'automatico';
  created_at: string;
}

export interface OTNota {
  id: number;
  ot_id: number;
  contenido: string;
  es_interna: boolean;
  created_at: string;
  usuario: UsuarioResumen | null;
}

export interface OTAdjunto {
  id: number;
  ot_id: number;
  nombre_archivo: string;
  ruta: string;
  url_publica?: string | null;
  tipo_mime: string | null;
  created_at: string;
  subido_por: number | null;
  usuarios: UsuarioResumen | null;
}

export interface PrioridadCliente {
  id: number;
  cliente_id: number;
  etiqueta_cliente: string;
  prioridad_interna: PrioridadOT;
  activo: boolean;
}

export interface DashboardConteos {
  por_estado: Record<EstadoOT, number>;
  por_prioridad: Record<PrioridadOT, number>;
  metricas?: {
    tiempo_medio_traslado_minutos: number;
    tiempo_medio_ejecucion_minutos: number;
    porcentaje_ots_con_checklist: number;
    ranking_tecnicos: { nombre: string; completadas: number }[];
  };
}

// Request and Response payloads
export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface OTCrearManual {
  cliente_id: number;
  titulo: string;
  descripcion?: string;
  prioridad: PrioridadOT;
  fecha_programada?: string;
}

export interface OTActualizar {
  titulo?: string;
  descripcion?: string;
  prioridad?: PrioridadOT;
  tecnico_asignado_id?: number | null;
  fecha_programada?: string | null;
}

export interface TransicionRequest {
  estado_nuevo: EstadoOT;
  comentario?: string;
}

export interface AsignarTecnicoRequest {
  tecnico_asignado_id: number | null;
}

export interface ClienteCrear {
  nombre: string;
  ruc: string;
  email?: string;
  telefono?: string;
  activo?: boolean;
}

export interface ClienteActualizar {
  nombre?: string;
  ruc?: string;
  email?: string;
  telefono?: string;
  activo?: boolean;
}

export interface PrioridadClienteCrear {
  etiqueta_cliente: string;
  prioridad_interna: PrioridadOT;
  activo?: boolean;
}

export interface PrioridadClienteActualizar {
  etiqueta_cliente?: string;
  prioridad_interna?: PrioridadOT;
  activo?: boolean;
}

export interface PlantillaItem {
  id: number;
  orden: number;
  pregunta: string;
  tipo_respuesta: 'SI_NO' | 'ESCALA' | 'NUMERICO' | 'TEXTO' | 'FOTO';
  requerido: boolean;
}

export interface PlantillaTrabajo {
  id: number;
  titulo: string;
  descripcion: string | null;
  tiempo_estimado_minutos: number;
  items: PlantillaItem[];
}

export interface RepuestoMaterial {
  id: number;
  empresa_id: number | null;
  nombre: string;
  codigo: string;
  precio_unitario: number | string;
  unidad_medida: string;
  created_at: string;
}

// ── MECE Kanban Phase Types ──────────────────────────────────────────
export type FaseMECE = 'INBOX' | 'ASIGNADAS' | 'EJECUCION' | 'DOCUMENTACION' | 'CERRADAS';

export interface KanbanColumn {
  fase: FaseMECE;
  label: string;
  icon: string;
  estados: EstadoOT[];
  ordenes: OrdenTrabajo[];
}

export type SLAStatus = 'ok' | 'warning' | 'critical';

// ── Equipment ────────────────────────────────────────────────────────
export interface EquipoCategoria {
  id: number;
  empresa_id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
}

export interface EquipoTipo {
  id: number;
  empresa_id: number;
  categoria_id: number;
  categoria?: EquipoCategoria;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
}

export interface Equipo {
  id: number;
  empresa_id: number;
  cliente_id: number;
  tipo_id: number;
  tipo?: EquipoTipo;
  nombre: string;
  numero_serie: string | null;
  modelo: string | null;
  marca: string | null;
  activo: boolean;
  created_at: string;
}

// ── Inventory ────────────────────────────────────────────────────────
export interface InventarioTecnico {
  id: number;
  tecnico_id: number;
  material_id: number;
  material?: RepuestoMaterial;
  cantidad: number;
  cantidad_minima: number;
  created_at: string;
}

export interface TransferenciaInventario {
  id: number;
  empresa_id: number | null;
  tecnico_id: number;
  material_id: number;
  cantidad: number;
  created_at: string;
}

// ── Notifications & Surveys ──────────────────────────────────────────
export interface EmpresaNotifConfig {
  id: number;
  empresa_id: number;
  evento: string;
  canal: 'email' | 'sms' | 'webhook';
  destino: string;
  activo: boolean;
  created_at: string;
}

export interface OTEncuesta {
  id: number;
  ot_id: number;
  calificacion: number;
  comentarios: string | null;
  created_at: string;
}

export interface WorkloadEntry {
  tecnico_id: number;
  nombre: string;
  en_ejecucion: number;
  programadas: number;
  esperando_repuesto: number;
  completadas: number;
  total: number;
}
