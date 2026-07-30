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
          ubicacion: ot.cliente?.nombre || (ot.cliente as any)?.direccion || 'Sede de Cliente',
          prioridad: (ot.prioridad as 'critica' | 'alta' | 'media' | 'baja') || 'media',
          slaRestanteMinutos: 180,
          estado: ot.estado,
        }));

        // Merge API OTs with local storage items
        const apiMap = new Map(apiMapped.map((o) => [o.id, o]));
        const merged: MockOT[] = localOts.map((localItem) => {
          if (apiMap.has(localItem.id)) {
            const apiItem = apiMap.get(localItem.id)!;
            apiMap.delete(localItem.id);
            return {
              ...localItem,
              ...apiItem,
              equipo: apiItem.equipo && apiItem.equipo !== 'Servicio Técnico' ? apiItem.equipo : localItem.equipo,
              ubicacion: apiItem.ubicacion && apiItem.ubicacion !== 'Sede de Cliente' ? apiItem.ubicacion : localItem.ubicacion,
            };
          }
          return localItem;
        });
        merged.unshift(...Array.from(apiMap.values()));
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

  const [activeTab, setActiveTab] = useState<'pendientes' | 'atendidas' | 'todas'>('pendientes');

  const pendientes = ordenes.filter((o) => o.estado !== 'COMPLETADA' && o.estado !== 'CERRADA');
  const atendidas = ordenes.filter((o) => o.estado === 'COMPLETADA' || o.estado === 'CERRADA');

  const ordenesFiltradas = activeTab === 'pendientes' ? pendientes : activeTab === 'atendidas' ? atendidas : ordenes;

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6 p-2 md:p-6 text-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-zinc-950 tracking-tight">Inicio - Bandeja de Trabajo</h1>
          <p className="text-xs text-zinc-500 font-medium mt-0.5">Gestión de órdenes de trabajo atendidas y pendientes en campo</p>
        </div>
        <button
          onClick={handleSync}
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 active:scale-95 transition-all cursor-pointer shadow-2xs text-xs font-bold"
          title="Sincronizar bandeja"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18" />
          </svg>
          <span className="hidden sm:inline">Sincronizar</span>
        </button>
      </div>

      {/* Filter Tabs / Quick Access Selectors */}
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('pendientes')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'pendientes'
              ? 'bg-zinc-950 text-white shadow-xs'
              : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100'
          }`}
        >
          <span>📋 Por Atender</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'pendientes' ? 'bg-zinc-800 text-teal-400 font-black' : 'bg-zinc-100 text-zinc-600'}`}>
            {pendientes.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('atendidas')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'atendidas'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100'
          }`}
        >
          <span>✅ OT Atendidas</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'atendidas' ? 'bg-emerald-800 text-white font-black' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
            {atendidas.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('todas')}
          className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'todas'
              ? 'bg-zinc-950 text-white shadow-xs'
              : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-100'
          }`}
        >
          <span>Ver Todas</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === 'todas' ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`}>
            {ordenes.length}
          </span>
        </button>
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        {ordenesFiltradas.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-zinc-400 bg-white border border-zinc-200 rounded-2xl p-6 text-center">
            <span className="text-4xl mb-2">{activeTab === 'atendidas' ? '✅' : '📋'}</span>
            <p className="text-sm font-semibold text-zinc-700">
              {activeTab === 'atendidas' ? 'No hay órdenes atendidas registradas aún.' : 'No tienes órdenes asignadas.'}
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              {activeTab === 'atendidas' ? 'Al completar órdenes desde el flujo de campo, aparecerán aquí.' : 'Las nuevas órdenes asignadas aparecerán automáticamente.'}
            </p>
          </div>
        ) : (
          ordenesFiltradas.map((ot) => {
            const styles = PRIORITY_COLORS[ot.prioridad];
            const isCompleted = ot.estado === 'COMPLETADA' || ot.estado === 'CERRADA';

            return (
              <div
                key={ot.id}
                className={`bg-white border border-zinc-200 border-l-[6px] ${isCompleted ? 'border-l-emerald-500' : styles.border} rounded-2xl p-5 shadow-2xs flex flex-col justify-between gap-4 hover:shadow-md transition-all`}
              >
                {/* Header card info */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-zinc-800 bg-zinc-100 px-3 py-1 rounded-lg border border-zinc-200">
                    {ot.codigo_interno}
                  </span>
                  <div className="flex gap-2">
                    {isCompleted ? (
                      <span className="text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-250 px-2.5 py-1 rounded-lg">
                        Atendida
                      </span>
                    ) : (
                      <span className={`text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${styles.bg}`}>
                        {PRIORITY_LABELS[ot.prioridad]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-lg font-black text-zinc-950 leading-snug">
                    {ot.equipo}
                  </h3>
                  <div className="grid grid-cols-1 gap-1 text-xs text-zinc-500 font-medium mt-1">
                    <p className="flex items-center gap-1.5">
                      <span className="text-zinc-400">📍 Ubicación:</span>
                      <span className="text-zinc-850 font-semibold">{ot.ubicacion}</span>
                    </p>
                  </div>
                </div>

                {/* SLA and Action */}
                <div className="flex items-center justify-between pt-3 border-t border-zinc-100 mt-auto">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider">
                      {isCompleted ? 'Estado de Servicio' : 'Tiempo SLA restante'}
                    </span>
                    {isCompleted ? (
                      <span className="font-mono text-sm font-black text-emerald-700">
                        ✅ Finalizada
                      </span>
                    ) : (
                      <span className={`font-mono text-sm font-black ${ot.prioridad === 'critica' || ot.slaRestanteMinutos < 60 ? 'text-red-600' : 'text-zinc-800'}`}>
                        ⏱️ {formatSLA(ot.slaRestanteMinutos)}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => router.push(`/tecnico/ordenes/${ot.id}`)}
                    className={`h-11 px-5 rounded-xl text-xs font-black shadow-2xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      isCompleted
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-zinc-900 hover:bg-zinc-950 text-white'
                    }`}
                  >
                    {isCompleted ? 'Ver Detalle' : 'Abrir OT'}
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Access Block for Atendidas (When in 'pendientes' view) */}
      {activeTab === 'pendientes' && atendidas.length > 0 && (
        <div className="mt-6 pt-6 border-t border-zinc-200 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">✅</span>
              <h2 className="text-lg font-black text-zinc-950">OTs Atendidas Recientes (Acceso Rápido)</h2>
            </div>
            <button
              onClick={() => setActiveTab('atendidas')}
              className="text-xs font-extrabold text-teal-600 hover:text-teal-700 underline"
            >
              Ver todas ({atendidas.length})
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {atendidas.slice(0, 4).map((ot) => (
              <div
                key={`atendida-quick-${ot.id}`}
                className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-3 shadow-3xs"
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-mono text-[11px] font-black text-emerald-900 bg-white border border-emerald-200 px-2 py-0.5 rounded self-start">
                    {ot.codigo_interno}
                  </span>
                  <span className="text-sm font-bold text-zinc-900 truncate mt-1">{ot.equipo}</span>
                  <span className="text-xs text-zinc-500 truncate">{ot.ubicacion}</span>
                </div>
                <button
                  onClick={() => router.push(`/tecnico/ordenes/${ot.id}`)}
                  className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shrink-0 active:scale-95 transition-all shadow-3xs cursor-pointer"
                >
                  Ver OT
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sync Timestamp footer */}
      <div className="pt-4 border-t border-zinc-200 mt-4 flex items-center justify-center gap-1.5 text-xs text-zinc-450 font-bold uppercase tracking-wider">
        <svg className="w-4 h-4 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
        <span>Última sincronización: {syncTime}</span>
      </div>
    </div>
  );
}
