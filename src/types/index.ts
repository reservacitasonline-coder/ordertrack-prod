export type RolUsuario = 'superadmin' | 'admin' | 'operador' | 'tecnico';

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
  | 'ESPERANDO_REPUESTO';

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
  plantilla_id: number | null;
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
  tipo_mime: string | null;
  created_at: string;
  usuario_subido: UsuarioResumen | null;
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
  nombre: string;
  codigo: string;
  precio_unitario: number | string;
  unidad_medida: string;
}
