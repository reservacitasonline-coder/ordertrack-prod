'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { OrdenTrabajo } from '@/types';

interface MockOT {
  id: number;
  codigo_interno: string;
  equipo: string;
  ubicacion: string;
  prioridad: 'critica' | 'alta' | 'media' | 'baja';
  slaRestanteMinutos: number;
  estado: string; // 'PROGRAMADA' | 'EN_EJECUCION' | 'COMPLETADA'
}

const DEFAULT_MOCK_OTS: MockOT[] = [
  {
    id: 101,
    codigo_interno: 'OT-2026-001',
    equipo: 'Compresor de Aire A-10',
    ubicacion: 'Sede Principal - Sótano 1',
    prioridad: 'critica',
    slaRestanteMinutos: 45,
    estado: 'PROGRAMADA',
  },
  {
    id: 102,
    codigo_interno: 'OT-2026-002',
    equipo: 'Switch Cisco Catalyst 2960',
    ubicacion: 'Edificio B - Piso 4',
    prioridad: 'alta',
    slaRestanteMinutos: 15,
    estado: 'PROGRAMADA',
  },
  {
    id: 103,
    codigo_interno: 'OT-2026-003',
    equipo: 'Bandeja Distribución de Fibra',
    ubicacion: 'Nodo Sur - Planta Baja',
    prioridad: 'alta',
    slaRestanteMinutos: 120,
    estado: 'PROGRAMADA',
  },
  {
    id: 104,
    codigo_interno: 'OT-2026-004',
    equipo: 'Chiller Industrial Carrier',
    ubicacion: 'Planta de Producción',
    prioridad: 'media',
    slaRestanteMinutos: 180,
    estado: 'PROGRAMADA',
  },
  {
    id: 105,
    codigo_interno: 'OT-2026-005',
    equipo: 'Tablero Eléctrico Principal T-2',
    ubicacion: 'Sede Principal - Piso 2',
    prioridad: 'baja',
    slaRestanteMinutos: 360,
    estado: 'PROGRAMADA',
  },
];

const PRIORITY_WEIGHTS = {
  critica: 4,
  alta: 3,
  media: 2,
  baja: 1,
};

const PRIORITY_LABELS = {
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
};

const PRIORITY_COLORS = {
  critica: {
    bg: 'bg-red-50 text-red-700 border-red-200',
    badge: 'bg-red-600 text-white',
    border: 'border-l-red-600',
  },
  alta: {
    bg: 'bg-orange-50 text-orange-700 border-orange-200',
    badge: 'bg-orange-600 text-white',
    border: 'border-l-orange-500',
  },
  media: {
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
    badge: 'bg-amber-500 text-white',
    border: 'border-l-amber-550',
  },
  baja: {
    bg: 'bg-slate-50 text-slate-700 border-slate-200',
    badge: 'bg-slate-500 text-white',
    border: 'border-l-slate-400',
  },
};

const formatSLA = (minutos: number) => {
  if (minutos <= 0) return 'SLA Vencido';
  if (minutos < 60) return `${minutos} min`;
  const hrs = Math.floor(minutos / 60);
  const mins = minutos % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
};

export default function TecnicoBandejaPage() {
  const router = useRouter();
  const [ordenes, setOrdenes] = useState<MockOT[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncTime, setSyncTime] = useState<string>('');

  const loadBandeja = async () => {
    setLoading(true);
    let localOts: MockOT[] = [];
    const stored = localStorage.getItem('mock_tecnico_ordenes');
    if (stored) {
      try {
        localOts = JSON.parse(stored);
      } catch {
        localOts = DEFAULT_MOCK_OTS;
      }
    } else {
      localOts = DEFAULT_MOCK_OTS;
    }

    try {
      // Try to fetch real orders assigned to the technician from backend
      const apiData = await apiFetch<OrdenTrabajo[]>('/ordenes');
      if (Array.isArray(apiData)) {
        const apiMapped: MockOT[] = apiData.map((ot) => ({
          id: ot.id,
          codigo_interno: ot.codigo_interno,
          equipo: ot.titulo || 'Servicio Técnico',
          ubicacion: ot.cliente?.direccion || ot.cliente?.nombre || 'Sede de Cliente',
          prioridad: (ot.prioridad as 'critica' | 'alta' | 'media' | 'baja') || 'media',
          slaRestanteMinutos: 180,
          estado: ot.estado,
        }));

        // Merge API OTs with local storage (API items take precedence)
        const apiIds = new Set(apiMapped.map((o) => o.id));
        const merged = [...apiMapped, ...localOts.filter((o) => !apiIds.has(o.id))];
        localOts = merged;
        localStorage.setItem('mock_tecnico_ordenes', JSON.stringify(localOts));
      }
    } catch (e) {
      console.warn('API fetch for technician orders failed, using local storage cache:', e);
    }

    // Sort by priority and SLA
    const sorted = [...localOts].sort((a, b) => {
      const pA = PRIORITY_WEIGHTS[a.prioridad] || 0;
      const pB = PRIORITY_WEIGHTS[b.prioridad] || 0;
      if (pA !== pB) {
        return pB - pA;
      }
      return a.slaRestanteMinutos - b.slaRestanteMinutos;
    });

    setOrdenes(sorted);
    setLoading(false);

    // Update sync timestamp
    const now = new Date();
    const formatted =
      now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' ' +
      now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    localStorage.setItem('mock_tecnico_sync_time', formatted);
    setSyncTime(formatted);
  };

  useEffect(() => {
    loadBandeja();
  }, []);

  const handleSync = async () => {
    await loadBandeja();
    alert('Bandeja de trabajo sincronizada correctamente.');
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-6 p-4 text-zinc-900 bg-zinc-50 min-h-[calc(100vh-8rem)] rounded-2xl shadow-xs border border-zinc-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-200 mt-2">
        <h1 className="text-2xl font-black text-zinc-950 tracking-tight">Bandeja de Trabajo</h1>
        <button
          onClick={handleSync}
          className="flex items-center justify-center p-3 rounded-xl bg-white border border-zinc-200 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 active:scale-95 transition-all cursor-pointer shadow-3xs"
          title="Sincronizar bandeja"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18" />
          </svg>
        </button>
      </div>

      {/* Orders List */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto max-h-[70vh] pr-1">
        {ordenes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <span className="text-4xl mb-2">📋</span>
            <p className="text-sm font-semibold">No tienes órdenes asignadas.</p>
          </div>
        ) : (
          ordenes.map((ot) => {
            const styles = PRIORITY_COLORS[ot.prioridad];
            const isCompleted = ot.estado === 'COMPLETADA';

            return (
              <div
                key={ot.id}
                className={`bg-white border border-zinc-200 border-l-[6px] ${styles.border} rounded-2xl p-5 shadow-xs flex flex-col gap-4 active:scale-[0.99] transition-all`}
              >
                {/* Header card info */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-black text-zinc-800 bg-zinc-100 px-3 py-1 rounded-lg border border-zinc-200">
                    {ot.codigo_interno}
                  </span>
                  <div className="flex gap-2">
                    {isCompleted ? (
                      <span className="text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-250 px-2.5 py-1 rounded-lg">
                        Completada
                      </span>
                    ) : (
                      <span className={`text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${styles.bg}`}>
                        {PRIORITY_LABELS[ot.prioridad]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg font-black text-zinc-950 leading-tight">
                    {ot.equipo}
                  </h3>
                  <div className="grid grid-cols-1 gap-1 text-sm text-zinc-500 font-medium mt-2">
                    <p className="flex items-center gap-1.5">
                      <span className="text-zinc-400">📍 Ubicación:</span>
                      <span className="text-zinc-850 font-semibold">{ot.ubicacion}</span>
                    </p>
                  </div>
                </div>

                {/* SLA and Action */}
                <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider">Tiempo SLA restante</span>
                    <span className={`font-mono text-base font-black ${ot.prioridad === 'critica' || ot.slaRestanteMinutos < 60 ? 'text-red-600' : 'text-zinc-800'}`}>
                      ⏱️ {formatSLA(ot.slaRestanteMinutos)}
                    </span>
                  </div>
                  <button
                    onClick={() => router.push(`/tecnico/ordenes/${ot.id}`)}
                    className="h-12 px-6 bg-zinc-900 hover:bg-zinc-950 text-white rounded-xl text-sm font-black shadow-sm active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    Abrir OT
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sync Timestamp footer */}
      <div className="pt-4 border-t border-zinc-200 mt-auto flex items-center justify-center gap-1.5 text-xs text-zinc-450 font-bold uppercase tracking-wider">
        <svg className="w-4 h-4 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        <span>Última sincronización: {syncTime}</span>
      </div>
    </div>
  );
}
