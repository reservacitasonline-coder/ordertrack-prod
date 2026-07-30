'use client';

import React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { ESTADO_COLORS, ESTADO_LABELS, PRIORIDAD_COLORS, PRIORIDAD_LABELS, SLA_THRESHOLDS } from '@/lib/constants';
import { OrdenTrabajo, SLAStatus } from '@/types';

interface KanbanCardProps {
  ot: OrdenTrabajo;
  isDragging?: boolean;
  isUpdating?: boolean;
}

function getSLAStatus(ot: OrdenTrabajo): SLAStatus {
  // Calculate SLA based on the linked template's estimated time
  const estimadoMinutos =
    ot.plantillas?.[0]?.tiempo_estimado_minutos ??
    ot.plantilla?.tiempo_estimado_minutos ??
    0;

  if (estimadoMinutos === 0) return 'ok'; // No template, no SLA

  // Only calculate for active states
  const startTime = ot.fecha_inicio_real || ot.fecha_salida;
  if (!startTime) return 'ok';

  // If already completed/closed, check final time
  const endTime = ot.fecha_cierre || new Date().toISOString();
  const elapsedMs = new Date(endTime).getTime() - new Date(startTime).getTime();
  const elapsedMin = elapsedMs / 60000;

  if (elapsedMin >= estimadoMinutos * SLA_THRESHOLDS.criticalPercent) return 'critical';
  if (elapsedMin >= estimadoMinutos * SLA_THRESHOLDS.warningPercent) return 'warning';
  return 'ok';
}

function getTimeInPhase(ot: OrdenTrabajo): string {
  const ref = ot.updated_at || ot.created_at;
  if (!ref) return '';
  const diffMs = Date.now() - new Date(ref).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d`;
}

const SLA_INDICATOR: Record<SLAStatus, { dot: string; label: string }> = {
  ok: { dot: 'bg-green-400', label: 'SLA OK' },
  warning: { dot: 'bg-amber-400', label: 'SLA Próximo' },
  critical: { dot: 'bg-red-500', label: 'SLA Vencido' },
};

export const KanbanCard: React.FC<KanbanCardProps> = ({ ot, isDragging, isUpdating }) => {
  const prioColor = PRIORIDAD_COLORS[ot.prioridad] || PRIORIDAD_COLORS.media;
  const stateColor = ESTADO_COLORS[ot.estado] || ESTADO_COLORS.RECIBIDA;
  const sla = getSLAStatus(ot);
  const slaInfo = SLA_INDICATOR[sla];
  const timeInPhase = getTimeInPhase(ot);

  return (
    <Link href={`/ordenes/${ot.id}`} prefetch={false}>
      <div
        className={`
          group relative rounded-xl border bg-white p-3.5 flex flex-col gap-2.5
          transition-all duration-200 cursor-grab active:cursor-grabbing
          ${isDragging
            ? 'shadow-xl border-teal-400 ring-2 ring-teal-400/30 scale-[1.03] rotate-[1deg] z-50 opacity-95'
            : 'shadow-xs hover:shadow-md hover:border-zinc-300 border-zinc-200'
          }
          ${isUpdating ? 'opacity-60 pointer-events-none' : ''}
        `}
      >
        {isUpdating && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-xs flex items-center justify-center rounded-xl z-20">
            <Spinner size="sm" />
          </div>
        )}
        {/* SLA indicator strip */}
        <div className={`absolute top-0 left-0 right-0 h-[3px] rounded-t-xl ${slaInfo.dot} opacity-80`} />

        {/* Header: Code + Time in phase */}
        <div className="flex justify-between items-center">
          <span className="font-bold text-zinc-800 font-mono text-[11px] tracking-tight">
            {ot.codigo_interno}
          </span>
          <span className="text-[10px] text-zinc-400 font-medium flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {timeInPhase}
          </span>
        </div>

        {/* Title */}
        <h4 className="text-[12px] font-semibold text-zinc-900 leading-snug line-clamp-2 break-words">
          {ot.titulo}
        </h4>

        {/* Client */}
        <span className="text-[10px] text-zinc-500 font-medium truncate">
          {ot.cliente.nombre}
        </span>

        {/* Footer: Badges + Technician */}
        <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-zinc-100">
          <div className="flex items-center gap-1 flex-wrap">
            <Badge bg={prioColor.bg} text={prioColor.text} border={prioColor.border} className="capitalize text-[9px] py-0 px-1.5">
              {PRIORIDAD_LABELS[ot.prioridad] || ot.prioridad}
            </Badge>
            <Badge bg={stateColor.bg} text={stateColor.text} border={stateColor.border} className="text-[9px] py-0 px-1.5">
              {ESTADO_LABELS[ot.estado] || ot.estado}
            </Badge>
          </div>

          {/* Technician avatar */}
          {ot.tecnico_asignado ? (
            <div className="flex items-center gap-1 shrink-0" title={ot.tecnico_asignado.nombre}>
              <div className="w-5 h-5 rounded-full bg-teal-100 border border-teal-300 flex items-center justify-center text-[8px] font-bold text-teal-700">
                {ot.tecnico_asignado.nombre.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
            </div>
          ) : (
            <span className="text-[9px] text-zinc-400 italic shrink-0">Sin asignar</span>
          )}
        </div>

        {/* SLA tooltip on hover */}
        {sla !== 'ok' && (
          <div className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full ${slaInfo.dot} border-2 border-white shadow-sm flex items-center justify-center`} title={slaInfo.label}>
            <span className="text-white text-[7px] font-bold">!</span>
          </div>
        )}
      </div>
    </Link>
  );
};
