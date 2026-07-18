'use client';

import React from 'react';
import { WorkloadEntry } from '@/types';

interface WorkloadChartProps {
  entries: WorkloadEntry[];
}

export const WorkloadChart: React.FC<WorkloadChartProps> = ({ entries }) => {
  if (entries.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-zinc-400 font-medium">
        No hay datos de técnicos asignados activos.
      </div>
    );
  }

  // Find max total to calculate bar widths relatively
  const maxTotal = Math.max(...entries.map(e => e.total), 1);

  return (
    <div className="flex flex-col gap-4 text-zinc-900">
      <div className="flex flex-col gap-3">
        {entries.map((entry) => {
          const activeCount = entry.en_ejecucion + entry.programadas + entry.esperando_repuesto;
          
          // Calculate percentage segments
          const pctProg = (entry.programadas / maxTotal) * 100;
          const pctExec = (entry.en_ejecucion / maxTotal) * 100;
          const pctWait = (entry.esperando_repuesto / maxTotal) * 100;
          const pctDone = (entry.completadas / maxTotal) * 100;

          return (
            <div key={entry.tecnico_id} className="flex flex-col gap-1 text-xs">
              
              {/* Technician Info */}
              <div className="flex justify-between items-center">
                <span className="font-semibold text-zinc-800">{entry.nombre}</span>
                <span className="text-[11px] text-zinc-500 font-semibold font-mono">
                  {activeCount} activos / {entry.total} total
                </span>
              </div>

              {/* Stacked Progress Bar */}
              <div className="w-full h-3.5 bg-zinc-100 rounded-lg overflow-hidden flex shadow-inner">
                {entry.programadas > 0 && (
                  <div
                    style={{ width: `${pctProg}%` }}
                    className="bg-sky-500 h-full border-r border-white/20 transition-all duration-300"
                    title={`Programadas: ${entry.programadas}`}
                  />
                )}
                {entry.en_ejecucion > 0 && (
                  <div
                    style={{ width: `${pctExec}%` }}
                    className="bg-emerald-500 h-full border-r border-white/20 transition-all duration-300 animate-pulse"
                    title={`En Ejecución: ${entry.en_ejecucion}`}
                  />
                )}
                {entry.esperando_repuesto > 0 && (
                  <div
                    style={{ width: `${pctWait}%` }}
                    className="bg-rose-500 h-full border-r border-white/20 transition-all duration-300"
                    title={`Esperando Repuesto: ${entry.esperando_repuesto}`}
                  />
                )}
                {entry.completadas > 0 && (
                  <div
                    style={{ width: `${pctDone}%` }}
                    className="bg-zinc-400 h-full transition-all duration-300"
                    title={`Completadas: ${entry.completadas}`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-zinc-100 pt-3 text-[10px] text-zinc-500 font-semibold">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
          <span>Programada</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>En Ejecución</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <span>Esperando Repuesto</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-400" />
          <span>Completada</span>
        </div>
      </div>
    </div>
  );
};
