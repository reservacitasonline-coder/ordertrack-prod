'use client';

import React from 'react';
import { WorkloadEntry } from '@/types';

interface WorkloadChartProps {
  entries: WorkloadEntry[];
}

export const WorkloadChart: React.FC<WorkloadChartProps> = ({ entries }) => {
  if (entries.length === 0) {
    return (
      <div className="py-10 text-center text-xs text-zinc-400 font-medium border border-dashed border-zinc-200 rounded-lg">
        No se registran asignaciones de técnicos en el período seleccionado.
      </div>
    );
  }

  // Find max total to calculate bar widths relatively
  const maxTotal = Math.max(...entries.map((e) => e.total), 1);

  return (
    <div className="flex flex-col gap-4 text-zinc-900">
      <div className="flex flex-col gap-3.5">
        {entries.map((entry) => {
          const activeCount = entry.en_ejecucion + entry.programadas + entry.esperando_repuesto;

          // Calculate percentage segments relative to maxTotal
          const pctProg = (entry.programadas / maxTotal) * 100;
          const pctExec = (entry.en_ejecucion / maxTotal) * 100;
          const pctWait = (entry.esperando_repuesto / maxTotal) * 100;
          const pctDone = (entry.completadas / maxTotal) * 100;

          return (
            <div key={entry.tecnico_id} className="flex flex-col gap-1.5 text-xs">
              {/* Technician Info */}
              <div className="flex justify-between items-baseline">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-900">{entry.nombre}</span>
                  {activeCount > 0 ? (
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-zinc-100 text-zinc-700">
                      {activeCount} en curso
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                      Disponible
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-500 font-mono tabular-nums">
                  <span className="font-semibold text-zinc-800">{entry.completadas}</span> cerradas /{' '}
                  <span className="text-zinc-600">{entry.total} total</span>
                </div>
              </div>

              {/* Refined Stacked Progress Bar */}
              <div className="w-full h-2.5 bg-zinc-100 rounded-sm overflow-hidden flex">
                {entry.programadas > 0 && (
                  <div
                    style={{ width: `${pctProg}%` }}
                    className="bg-slate-400 h-full border-r border-white/40 transition-all duration-300"
                    title={`Programadas: ${entry.programadas}`}
                  />
                )}
                {entry.en_ejecucion > 0 && (
                  <div
                    style={{ width: `${pctExec}%` }}
                    className="bg-teal-600 h-full border-r border-white/40 transition-all duration-300"
                    title={`En Ejecución: ${entry.en_ejecucion}`}
                  />
                )}
                {entry.esperando_repuesto > 0 && (
                  <div
                    style={{ width: `${pctWait}%` }}
                    className="bg-amber-500 h-full border-r border-white/40 transition-all duration-300"
                    title={`Esperando Repuesto: ${entry.esperando_repuesto}`}
                  />
                )}
                {entry.completadas > 0 && (
                  <div
                    style={{ width: `${pctDone}%` }}
                    className="bg-zinc-300 h-full transition-all duration-300"
                    title={`Completadas: ${entry.completadas}`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sized & Sober Corporate Legend */}
      <div className="flex flex-wrap items-center justify-between border-t border-zinc-100 pt-3 text-[11px] text-zinc-500">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-slate-400 shrink-0" />
            <span>Programada</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-teal-600 shrink-0" />
            <span>En Ejecución</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 shrink-0" />
            <span>Esperando Repuesto</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-zinc-300 shrink-0" />
            <span>Completada</span>
          </div>
        </div>
        <span className="text-[10px] text-zinc-400 hidden sm:inline">
          Capacidad normalizada por carga de trabajo
        </span>
      </div>
    </div>
  );
};
