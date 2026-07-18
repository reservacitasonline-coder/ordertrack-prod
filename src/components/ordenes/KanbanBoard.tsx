'use client';

import React, { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { Badge } from '@/components/ui/Badge';
import { KanbanCard } from './KanbanCard';
import { FASES_MECE, FASE_COLORS, TRANSICIONES_PERMITIDAS } from '@/lib/constants';
import { OrdenTrabajo, EstadoOT, FaseMECE } from '@/types';

// ── Droppable Column ────────────────────────────────────────────────
interface KanbanColumnProps {
  fase: FaseMECE;
  label: string;
  icon: string;
  estados: EstadoOT[];
  ordenes: OrdenTrabajo[];
  accentColor: string;
  faseColor: { bg: string; text: string; border: string; accent: string };
  filterTecnico: string;
}

const KanbanColumnComponent: React.FC<KanbanColumnProps> = ({
  fase, label, icon, estados, ordenes, faseColor, filterTecnico
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: fase });

  // Filter by technician if set
  const filtered = filterTecnico
    ? ordenes.filter(ot => ot.tecnico_asignado?.id === Number(filterTecnico))
    : ordenes;

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col min-h-[400px] w-[280px] shrink-0 lg:w-auto lg:shrink rounded-2xl border transition-all duration-200
        ${isOver
          ? `${faseColor.border} ring-2 ring-offset-1 ring-teal-400/40 bg-teal-50/30`
          : `border-zinc-200 bg-zinc-50/50`
        }
      `}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200/80 rounded-t-2xl bg-white/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <h3 className="font-bold text-zinc-800 text-sm">{label}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full text-[10px] font-bold text-white ${faseColor.accent}`}>
            {filtered.length}
          </span>
        </div>
      </div>

      {/* Column Body */}
      <div className="flex-1 p-3 flex flex-col gap-2.5 overflow-y-auto max-h-[calc(100vh-280px)]">
        {filtered.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <span className="text-[11px] text-zinc-400 font-medium text-center leading-relaxed">
              Sin órdenes en<br/>{label.toLowerCase()}
            </span>
          </div>
        ) : (
          filtered.map((ot) => (
            <div key={ot.id} data-ot-id={ot.id}>
              <KanbanCard ot={ot} />
            </div>
          ))
        )}
      </div>

      {/* Column Footer - Sub-states */}
      <div className="px-4 py-2 border-t border-zinc-200/60 bg-white/60 rounded-b-2xl">
        <div className="flex flex-wrap gap-1">
          {estados.map(est => {
            const count = filtered.filter(o => o.estado === est).length;
            return (
              <span key={est} className="text-[9px] text-zinc-400 font-medium">
                {est.replace(/_/g, ' ').toLowerCase()}: <span className="text-zinc-600 font-bold">{count}</span>
                {estados.indexOf(est) < estados.length - 1 && <span className="mx-1">·</span>}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── Main Kanban Board ───────────────────────────────────────────────
interface KanbanBoardProps {
  ordenes: OrdenTrabajo[];
  onTransition: (otId: number, estadoNuevo: EstadoOT) => Promise<void>;
}

function getTargetEstadoForFase(fase: FaseMECE, currentEstado: EstadoOT): EstadoOT | null {
  // Find the first valid transition from currentEstado that leads into the target fase
  const faseConfig = FASES_MECE.find(f => f.fase === fase);
  if (!faseConfig) return null;

  const allowed = TRANSICIONES_PERMITIDAS[currentEstado] || [];
  const validTarget = faseConfig.estados.find(est => allowed.includes(est));
  return validTarget || null;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ ordenes, onTransition }) => {
  const [activeOt, setActiveOt] = useState<OrdenTrabajo | null>(null);
  const [filterTecnico, setFilterTecnico] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Group orders by MECE phase
  const columns = useMemo(() => {
    return FASES_MECE.map(faseConfig => {
      const matching = ordenes.filter(ot => faseConfig.estados.includes(ot.estado));
      return { ...faseConfig, ordenes: matching };
    });
  }, [ordenes]);

  // Get unique technicians for filter
  const tecnicos = useMemo(() => {
    const map = new Map<number, string>();
    ordenes.forEach(ot => {
      if (ot.tecnico_asignado) {
        map.set(ot.tecnico_asignado.id, ot.tecnico_asignado.nombre);
      }
    });
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [ordenes]);

  const handleDragStart = (event: DragStartEvent) => {
    const otId = Number(event.active.id);
    const ot = ordenes.find(o => o.id === otId);
    setActiveOt(ot || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveOt(null);
    const { active, over } = event;
    if (!over) return;

    const otId = Number(active.id);
    const targetFase = over.id as FaseMECE;
    const ot = ordenes.find(o => o.id === otId);
    if (!ot) return;

    // Check if OT is already in the target phase
    const targetConfig = FASES_MECE.find(f => f.fase === targetFase);
    if (!targetConfig || targetConfig.estados.includes(ot.estado)) return;

    // Find valid transition
    const targetEstado = getTargetEstadoForFase(targetFase, ot.estado);
    if (!targetEstado) {
      // Could show a toast/notification here
      console.warn(`Transición no permitida de ${ot.estado} a fase ${targetFase}`);
      return;
    }

    await onTransition(otId, targetEstado);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-zinc-800">Tablero Kanban</h2>
          <span className="text-[10px] text-zinc-400 font-medium">
            Arrastra una tarjeta entre columnas para cambiar de fase
          </span>
        </div>
        {tecnicos.length > 0 && (
          <select
            value={filterTecnico}
            onChange={e => setFilterTecnico(e.target.value)}
            className="text-xs border border-zinc-200 rounded-lg px-3 py-1.5 bg-white text-zinc-700 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          >
            <option value="">Todos los técnicos</option>
            {tecnicos.map(t => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
        )}
      </div>

      {/* Kanban Grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-row overflow-x-auto gap-4 min-h-[500px] pb-4 lg:grid lg:grid-cols-5 lg:overflow-x-visible">
          {columns.map(col => (
            <KanbanColumnComponent
              key={col.fase}
              fase={col.fase}
              label={col.label}
              icon={col.icon}
              estados={col.estados}
              ordenes={col.ordenes}
              accentColor={FASE_COLORS[col.fase].accent}
              faseColor={FASE_COLORS[col.fase]}
              filterTecnico={filterTecnico}
            />
          ))}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeOt ? <KanbanCard ot={activeOt} isDragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};
