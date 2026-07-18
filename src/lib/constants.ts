import { EstadoOT, PrioridadOT, RolUsuario, FaseMECE } from '@/types';

export const ESTADO_LABELS: Record<EstadoOT, string> = {
  RECIBIDA: 'Recibida',
  EN_REVISION: 'En Revisión',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  PROGRAMADA: 'Programada',
  EN_EJECUCION: 'En Ejecución',
  PAUSADA: 'Pausada',
  COMPLETADA: 'Completada',
  CERRADA: 'Cerrada',
  ANULADA: 'Anulada',
  ESPERANDO_REPUESTO: 'Esperando Repuesto',
};

export const ESTADO_COLORS: Record<EstadoOT, { bg: string; text: string; border: string }> = {
  RECIBIDA: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  EN_REVISION: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  APROBADA: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  RECHAZADA: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  PROGRAMADA: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  EN_EJECUCION: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  PAUSADA: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  COMPLETADA: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  CERRADA: { bg: 'bg-zinc-100', text: 'text-zinc-700', border: 'border-zinc-300' },
  ANULADA: { bg: 'bg-zinc-50', text: 'text-zinc-400', border: 'border-zinc-200' },
  ESPERANDO_REPUESTO: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
};

export const PRIORIDAD_LABELS: Record<PrioridadOT, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  critica: 'Crítica',
};

export const PRIORIDAD_COLORS: Record<PrioridadOT, { bg: string; text: string; border: string }> = {
  baja: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
  media: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  alta: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  critica: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

export const ROL_LABELS: Record<RolUsuario, string> = {
  superadmin: 'Superadmin',
  admin: 'Administrador',
  operador: 'Operador',
  tecnico: 'Técnico de Campo',
};

// Transition matrix to validate allowed transitions client-side
export const TRANSICIONES_PERMITIDAS: Record<EstadoOT, EstadoOT[]> = {
  RECIBIDA: ['EN_REVISION', 'RECHAZADA', 'ANULADA'],
  EN_REVISION: ['APROBADA', 'RECHAZADA', 'ANULADA'],
  APROBADA: ['PROGRAMADA', 'EN_EJECUCION', 'ANULADA'],
  RECHAZADA: [],
  PROGRAMADA: ['EN_EJECUCION', 'PAUSADA', 'ANULADA'],
  EN_EJECUCION: ['PAUSADA', 'COMPLETADA', 'ANULADA', 'ESPERANDO_REPUESTO'],
  PAUSADA: ['EN_EJECUCION', 'ANULADA'],
  ESPERANDO_REPUESTO: ['EN_EJECUCION', 'ANULADA'],
  COMPLETADA: ['CERRADA'],
  CERRADA: [],
  ANULADA: [],
};

// Seed-based mock technicians list (since backend has no technicians endpoint)
export interface MockTecnico {
  id: number;
  nombre: string;
  email: string;
}

export const MOCK_TECNICOS_POR_EMPRESA: Record<number, MockTecnico[]> = {
  1: [ // Empresa Alpha (ID = 1 based on seed)
    { id: 4, nombre: 'Tecnico Alpha', email: 'tecnico_alpha@ordertrack.com' }
  ],
  2: [ // Empresa Beta (ID = 2 based on seed)
    { id: 7, nombre: 'Tecnico Beta', email: 'tecnico_beta@ordertrack.com' }
  ]
};

// ── MECE Kanban Phase Configuration ─────────────────────────────────
export const FASES_MECE: { fase: FaseMECE; label: string; icon: string; estados: EstadoOT[] }[] = [
  { fase: 'INBOX', label: 'Inbox', icon: '📥', estados: ['RECIBIDA'] },
  { fase: 'TRIAGE', label: 'Triage', icon: '📋', estados: ['EN_REVISION', 'APROBADA', 'RECHAZADA'] },
  { fase: 'EJECUCION', label: 'Ejecución', icon: '🔧', estados: ['PROGRAMADA', 'EN_EJECUCION', 'PAUSADA', 'ESPERANDO_REPUESTO'] },
  { fase: 'CIERRE', label: 'Cierre', icon: '✅', estados: ['COMPLETADA'] },
  { fase: 'ARCHIVO', label: 'Archivo', icon: '📦', estados: ['CERRADA', 'ANULADA'] },
];

export const FASE_LABELS: Record<FaseMECE, string> = {
  INBOX: 'Inbox',
  TRIAGE: 'Triage',
  EJECUCION: 'Ejecución',
  CIERRE: 'Cierre',
  ARCHIVO: 'Archivo',
};

export const FASE_COLORS: Record<FaseMECE, { bg: string; text: string; border: string; accent: string }> = {
  INBOX: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', accent: 'bg-blue-500' },
  TRIAGE: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', accent: 'bg-violet-500' },
  EJECUCION: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', accent: 'bg-emerald-500' },
  CIERRE: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', accent: 'bg-green-500' },
  ARCHIVO: { bg: 'bg-zinc-50', text: 'text-zinc-600', border: 'border-zinc-200', accent: 'bg-zinc-400' },
};

// ── SLA Thresholds (minutes) ────────────────────────────────────────
// Based on plantilla.tiempo_estimado_minutos
export const SLA_THRESHOLDS = {
  warningPercent: 0.75,  // 75% of estimated time → yellow
  criticalPercent: 1.0,  // 100% of estimated time → red
};

// ── Quick Reply Templates for Technician Text Fields ────────────────
export const QUICK_REPLIES: { category: string; replies: string[] }[] = [
  {
    category: 'Estado General',
    replies: [
      'Sin novedad',
      'Equipo operativo',
      'Funcionamiento normal',
      'Requiere seguimiento',
    ],
  },
  {
    category: 'Hallazgos',
    replies: [
      'Componente desgastado',
      'Cambio de pieza realizado',
      'Conexión restablecida',
      'Limpieza y ajuste realizado',
      'Calibración completada',
    ],
  },
  {
    category: 'Observaciones',
    replies: [
      'Se recomienda visita adicional',
      'Cliente informado del estado',
      'Se requiere repuesto para próxima visita',
      'Acceso restringido, coordinar con cliente',
    ],
  },
];
