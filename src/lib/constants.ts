import { EstadoOT, PrioridadOT, RolUsuario } from '@/types';

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
  EN_EJECUCION: ['PAUSADA', 'COMPLETADA', 'ANULADA'],
  PAUSADA: ['EN_EJECUCION', 'ANULADA'],
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
