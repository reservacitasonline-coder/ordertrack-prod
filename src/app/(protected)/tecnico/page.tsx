'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../layout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { EmptyState } from '@/components/ui/EmptyState';
import { apiFetch } from '@/lib/api';
import { ESTADO_COLORS, ESTADO_LABELS, PRIORIDAD_COLORS, PRIORIDAD_LABELS } from '@/lib/constants';
import { OrdenTrabajo } from '@/types';

// Timer Component to show real-time elapsed time on the Bandeja
const LiveTimer: React.FC<{ startTime: string; estimatedMin: number }> = ({ startTime, estimatedMin }) => {
  const [elapsed, setElapsed] = useState('');
  const [isOvertime, setIsOvertime] = useState(false);

  useEffect(() => {
    const calculateTime = () => {
      const start = new Date(startTime).getTime();
      const now = Date.now();
      const diffMs = now - start;

      if (isNaN(start)) {
        setElapsed('--:--');
        return;
      }

      const diffMin = Math.floor(diffMs / 60000);
      const diffSecs = Math.floor((diffMs % 60000) / 1000);
      
      const pad = (num: number) => String(num).padStart(2, '0');
      setElapsed(`${pad(diffMin)}:${pad(diffSecs)}`);

      if (estimatedMin && diffMin >= estimatedMin) {
        setIsOvertime(true);
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [startTime, estimatedMin]);

  return (
    <div className="flex items-center gap-1.5 font-mono text-sm">
      <span className={`w-2.5 h-2.5 rounded-full ${isOvertime ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
      <span className={`font-bold ${isOvertime ? 'text-rose-600' : 'text-zinc-700'}`}>
        {elapsed}
      </span>
      {estimatedMin > 0 && (
        <span className="text-xs text-zinc-400 font-normal font-sans">
          / {estimatedMin}m est.
        </span>
      )}
    </div>
  );
};

// SLA Formatter Helper
const getSlaLabel = (ot: OrdenTrabajo): string => {
  if (ot.estado === 'COMPLETADA' || ot.estado === 'CERRADA') {
    return 'Terminado';
  }
  if (!ot.fecha_programada) {
    return '--';
  }
  const sched = new Date(ot.fecha_programada).getTime();
  const now = Date.now();
  const diffMs = sched - now;

  if (diffMs < 0) {
    const minAgo = Math.floor(Math.abs(diffMs) / 60000);
    if (minAgo < 60) return `Hace ${minAgo}m`;
    const hrAgo = Math.floor(minAgo / 60);
    const daysAgo = Math.floor(hrAgo / 24);
    if (daysAgo > 0) return `Hace ${daysAgo}d`;
    return `Hace ${hrAgo}h`;
  } else {
    const minLeft = Math.floor(diffMs / 60000);
    if (minLeft < 60) return `${minLeft}m`;
    const hrLeft = Math.floor(minLeft / 60);
    const minRemainder = minLeft % 60;
    const daysLeft = Math.floor(hrLeft / 24);
    
    // Check if tomorrow
    const schedDate = new Date(ot.fecha_programada);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (schedDate.toDateString() === tomorrow.toDateString()) {
      const timeStr = schedDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      return `Mañana ${timeStr}`;
    }
    
    if (daysLeft > 0) return `${daysLeft}d ${hrLeft % 24}h`;
    if (hrLeft > 0) return `${hrLeft}h ${minRemainder}m`;
    return `${minLeft}m`;
  }
};

export default function TecnicoBandejaPage() {
  const { user } = useAuth();
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'hoy' | 'proximas' | 'vencidas'>('hoy');
  const [isOffline, setIsOffline] = useState(false);

  // Sync state with online/offline
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    setIsOffline(!navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchOrdenes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (navigator.onLine) {
        const data = await apiFetch<OrdenTrabajo[]>('/tecnico/ordenes');
        setOrdenes(data);
        // Cache in local storage for offline use
        localStorage.setItem(`cache_tecnico_ots_${user?.id}`, JSON.stringify(data));
      } else {
        setIsOffline(true);
        const cached = localStorage.getItem(`cache_tecnico_ots_${user?.id}`);
        if (cached) {
          setOrdenes(JSON.parse(cached));
        } else {
          setOrdenes([]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar las órdenes asignadas');
      // Attempt to load from cache on error
      const cached = localStorage.getItem(`cache_tecnico_ots_${user?.id}`);
      if (cached) {
        setOrdenes(JSON.parse(cached));
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchOrdenes();
  }, [fetchOrdenes]);

  // Find the active or next programmed OT
  const heroOT = useMemo(() => {
    if (ordenes.length === 0) return null;
    // 1. Any in progress
    const active = ordenes.find((o) => o.estado === 'EN_EJECUCION');
    if (active) return active;
    // 2. Any paused / waiting for parts that are active
    const paused = ordenes.find((o) => o.estado === 'PAUSADA' || o.estado === 'ESPERANDO_REPUESTO');
    if (paused) return paused;
    // 3. First programmed
    const prog = ordenes.find((o) => o.estado === 'PROGRAMADA');
    if (prog) return prog;
    // 4. Fallback first received/triage status
    return ordenes[0];
  }, [ordenes]);

  // Filter remaining orders (excluding the one displayed in the Hero card)
  const filteredRemainingOrdenes = useMemo(() => {
    const today = new Date().toDateString();
    const remaining = heroOT ? ordenes.filter((o) => o.id !== heroOT.id) : ordenes;

    return remaining.filter((ot) => {
      if (filtro === 'hoy') {
        return ot.fecha_programada && new Date(ot.fecha_programada).toDateString() === today;
      }
      if (filtro === 'proximas') {
        return ot.estado === 'PROGRAMADA' || ot.estado === 'RECIBIDA';
      }
      if (filtro === 'vencidas') {
        return (
          ot.estado !== 'COMPLETADA' &&
          ot.estado !== 'CERRADA' &&
          ot.estado !== 'ANULADA' &&
          ot.fecha_programada &&
          new Date(ot.fecha_programada) < new Date() &&
          new Date(ot.fecha_programada).toDateString() !== today
        );
      }
      return true;
    });
  }, [ordenes, heroOT, filtro]);

  // Calculate specific filter counts to show in chips
  const filterCounts = useMemo(() => {
    const today = new Date().toDateString();
    let hoy = 0;
    let proximas = 0;
    let vencidas = 0;

    ordenes.forEach((ot) => {
      if (ot.fecha_programada && new Date(ot.fecha_programada).toDateString() === today) {
        hoy++;
      }
      if (ot.estado === 'PROGRAMADA' || ot.estado === 'RECIBIDA') {
        proximas++;
      }
      if (
        ot.estado !== 'COMPLETADA' &&
        ot.estado !== 'CERRADA' &&
        ot.estado !== 'ANULADA' &&
        ot.fecha_programada &&
        new Date(ot.fecha_programada) < new Date() &&
        new Date(ot.fecha_programada).toDateString() !== today
      ) {
        vencidas++;
      }
    });

    return { hoy, proximas, vencidas };
  }, [ordenes]);

  // Summary counts for grid status
  const summary = useMemo(() => {
    let active = 0;
    let pending = 0;
    let waiting = 0;
    let completed = 0;

    ordenes.forEach((o) => {
      if (o.estado === 'EN_EJECUCION') active++;
      else if (o.estado === 'COMPLETADA' || o.estado === 'CERRADA') completed++;
      else if (o.estado === 'ESPERANDO_REPUESTO') waiting++;
      else pending++;
    });

    return { active, pending, waiting, completed };
  }, [ordenes]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-20">
        <Spinner size="lg" />
        <span className="text-xs text-zinc-500 font-medium mt-3">Cargando bandeja de órdenes...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5.5 max-w-md mx-auto px-2 py-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-950">Mis Órdenes</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Bandeja de campo y ejecución rápida.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchOrdenes}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
            title="Refrescar órdenes"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18" />
            </svg>
          </button>
          {isOffline ? (
            <Badge bg="bg-amber-100" text="text-amber-800" border="border-amber-200">Offline</Badge>
          ) : (
            <Badge bg="bg-teal-100" text="text-teal-800" border="border-teal-200">Online</Badge>
          )}
        </div>
      </div>

      {/* Offline Sync Warning Banner */}
      {isOffline && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-snug flex gap-2.5 items-start">
          <span className="text-base">⚠️</span>
          <div>
            <strong>Modo Offline Activo:</strong> Las tareas realizadas se almacenarán localmente y se sincronizarán de inmediato cuando se recupere la conexión a internet.
          </div>
        </div>
      )}

      {/* Summary Pills Grid */}
      <div className="grid grid-cols-4 gap-2 bg-white p-3 rounded-2xl border border-zinc-200/80 shadow-xs">
        <div className="flex flex-col items-center justify-center p-1.5 bg-zinc-50 rounded-xl">
          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Ejecución</span>
          <span className="text-base font-bold text-emerald-600 mt-0.5">{summary.active}</span>
        </div>
        <div className="flex flex-col items-center justify-center p-1.5 bg-zinc-50 rounded-xl">
          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Pendientes</span>
          <span className="text-base font-bold text-blue-600 mt-0.5">{summary.pending}</span>
        </div>
        <div className="flex flex-col items-center justify-center p-1.5 bg-zinc-50 rounded-xl">
          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Repuestos</span>
          <span className="text-base font-bold text-rose-500 mt-0.5">{summary.waiting}</span>
        </div>
        <div className="flex flex-col items-center justify-center p-1.5 bg-zinc-50 rounded-xl">
          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Cerradas</span>
          <span className="text-base font-bold text-zinc-500 mt-0.5">{summary.completed}</span>
        </div>
      </div>

      {/* 🚀 HERO CARD: Active / Next Job */}
      {heroOT ? (
        <div className="flex flex-col gap-2.5">
          <h2 className="text-xs font-bold text-zinc-400 tracking-wider uppercase">Servicio Actual / Próximo</h2>
          <Card className="relative overflow-hidden border-2 border-teal-600 shadow-md p-5 bg-gradient-to-br from-white to-teal-50/10 flex flex-col gap-4">
            <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full -mr-8 -mt-8 pointer-events-none" />
            
            {/* Top row: Internal Code & Priority */}
            <div className="flex justify-between items-center">
              <span className="font-mono font-bold text-xs text-zinc-800 bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200">
                {heroOT.codigo_interno}
              </span>
              <div className="flex gap-1.5 items-center">
                <Badge bg={PRIORIDAD_COLORS[heroOT.prioridad].bg} text={PRIORIDAD_COLORS[heroOT.prioridad].text} border={PRIORIDAD_COLORS[heroOT.prioridad].border} className="capitalize py-0.5 px-2">
                  {PRIORIDAD_LABELS[heroOT.prioridad]}
                </Badge>
                <Badge bg={ESTADO_COLORS[heroOT.estado].bg} text={ESTADO_COLORS[heroOT.estado].text} border={ESTADO_COLORS[heroOT.estado].border} className="py-0.5 px-2">
                  {ESTADO_LABELS[heroOT.estado]}
                </Badge>
              </div>
            </div>

            {/* Info details */}
            <div className="flex flex-col gap-1.5">
              <h3 className="text-base font-bold text-zinc-900 leading-snug break-words">
                {heroOT.titulo}
              </h3>
              <div className="flex flex-col gap-1 mt-1 text-xs text-zinc-600">
                <p className="flex items-center gap-1.5">
                  <span className="font-semibold text-zinc-800">Cliente:</span> {heroOT.cliente.nombre}
                </p>
                {heroOT.fecha_programada && (
                  <p className="flex items-center gap-1.5">
                    <span className="font-semibold text-zinc-800">Programado:</span> {new Date(heroOT.fecha_programada).toLocaleString('es-ES', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
            </div>

            {/* Live Ticker / Estimated timing info */}
            {heroOT.estado === 'EN_EJECUCION' && (heroOT.fecha_inicio_real || heroOT.fecha_salida) ? (
              <div className="flex items-center justify-between p-3 bg-zinc-50 border border-zinc-200 rounded-xl mt-1">
                <span className="text-xs text-zinc-500 font-medium">Tiempo en Sitio:</span>
                <LiveTimer 
                  startTime={heroOT.fecha_inicio_real || heroOT.fecha_salida || ''} 
                  estimatedMin={heroOT.plantillas?.[0]?.tiempo_estimado_minutos ?? heroOT.plantilla?.tiempo_estimado_minutos ?? 0}
                />
              </div>
            ) : (
              heroOT.plantillas?.[0] && (
                <p className="text-[11px] text-zinc-400 font-medium flex items-center gap-1">
                  ⏱️ Tiempo estimado de ejecución: <span className="font-semibold text-zinc-600">{heroOT.plantillas?.[0].tiempo_estimado_minutos} min</span>
                </p>
              )
            )}

            {/* Primary Action Button */}
            <Link href={`/tecnico/ordenes/${heroOT.id}`} className="mt-2 block w-full">
              <Button className="w-full justify-center bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-xl shadow-sm text-sm active:scale-[0.99] transition-transform cursor-pointer">
                {heroOT.estado === 'EN_EJECUCION' ? 'Continuar Trabajos' : 'Iniciar Trabajo'}
                <svg className="w-4 h-4 ml-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Button>
            </Link>
          </Card>
        </div>
      ) : null}

      {/* OTRAS ÓRDENES ASIGNADAS */}
      <div className="flex flex-col gap-3.5">
        <div className="flex justify-between items-center">
          <h2 className="text-xs font-bold text-zinc-500 tracking-wider uppercase">Otros Trabajos</h2>
          <span className="text-[10px] text-zinc-400 font-medium font-mono bg-zinc-100 border border-zinc-200/50 px-2 py-0.5 rounded-md">{filteredRemainingOrdenes.length} órdenes</span>
        </div>

        {/* Quick Filters - Mockup Style */}
        <div className="flex gap-2 overflow-x-auto pb-1 mt-0.5">
          {(['hoy', 'proximas', 'vencidas'] as const).map((mode) => {
            const active = filtro === mode;
            const count = filterCounts[mode];
            const label = mode === 'hoy' ? 'Hoy' : mode === 'proximas' ? 'Próximas' : 'Vencidas';
            
            return (
              <button
                key={mode}
                onClick={() => setFiltro(mode)}
                className={`flex items-center gap-1.5 py-1.5 px-3.5 rounded-full text-xs font-bold tracking-wide transition-all border shrink-0 cursor-pointer ${
                  active
                    ? 'bg-teal-600 border-teal-600 text-white shadow-xs'
                    : 'bg-zinc-50 border-zinc-200/80 text-zinc-500 hover:text-zinc-800'
                }`}
              >
                {label}
                <span className={`font-mono text-[10px] font-bold ${active ? 'opacity-85 text-white' : 'text-zinc-400'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {error && <ErrorMessage message={error} retry={fetchOrdenes} />}

        {/* List of Orders - Premium Mockup Style */}
        {filteredRemainingOrdenes.length === 0 ? (
          <EmptyState
            title="Sin otras órdenes"
            description="No tienes más órdenes programadas en esta vista."
          />
        ) : (
          <div className="flex flex-col gap-3.5">
            {filteredRemainingOrdenes.map((ot) => {
              const prioColor = PRIORIDAD_COLORS[ot.prioridad as keyof typeof PRIORIDAD_COLORS] || PRIORIDAD_COLORS.media;
              const stateColor = ESTADO_COLORS[ot.estado as keyof typeof ESTADO_COLORS] || ESTADO_COLORS.RECIBIDA;
              const slaText = getSlaLabel(ot);

              // Left thick priority border color
              const priorityLeftBorder = 
                ot.prioridad === 'critica'
                  ? 'border-l-rose-500 shadow-rose-500/5'
                  : ot.prioridad === 'alta'
                    ? 'border-l-orange-500 shadow-orange-500/5'
                    : ot.prioridad === 'media'
                      ? 'border-l-amber-500 shadow-amber-500/5'
                      : 'border-l-zinc-400 shadow-slate-400/5';

              return (
                <Link href={`/tecnico/ordenes/${ot.id}`} key={ot.id}>
                  <Card className={`p-4 border-l-[5px] ${priorityLeftBorder} hover:border-zinc-350 transition-all flex flex-col gap-3.5 shadow-xs bg-white active:scale-[0.99]`}>
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{ot.codigo_interno}</span>
                        <h3 className="font-bold text-zinc-900 text-sm leading-snug break-words mt-0.5 line-clamp-1">
                          {ot.titulo}
                        </h3>
                        <p className="text-zinc-500 text-xs mt-0.5 font-medium line-clamp-1">
                          Cliente: <span className="font-semibold text-zinc-700">{ot.cliente.nombre}</span>
                        </p>
                      </div>
                      
                      {/* SLA Badge */}
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono shrink-0 ${
                        ot.prioridad === 'critica'
                          ? 'bg-rose-50 text-rose-700 border border-rose-100'
                          : ot.prioridad === 'alta'
                            ? 'bg-orange-50 text-orange-700 border border-orange-100'
                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        ⏱️ {slaText}
                      </div>
                    </div>

                    {/* Address with Map Marker Icon */}
                    <div className="flex items-center gap-1.5 text-zinc-500 font-mono text-[11px] mt-0.5 leading-none">
                      <svg className="w-3.5 h-3.5 shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="truncate">Cusco · RUC: {ot.cliente.ruc}</span>
                    </div>

                    {/* Meta Section */}
                    <div className="flex items-center justify-between pt-3 border-t border-dashed border-zinc-150/70 mt-0.5">
                      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                        ot.estado === 'EN_EJECUCION'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : ot.estado === 'COMPLETADA'
                            ? 'bg-green-50 text-green-700 border border-green-100'
                            : 'bg-zinc-100 text-zinc-600 border border-zinc-200'
                      }`}>
                        {ot.estado === 'EN_EJECUCION' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />}
                        {ESTADO_LABELS[ot.estado]}
                      </div>
                      
                      <div className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${prioColor.bg} ${prioColor.text} border ${prioColor.border}`}>
                        Prioridad {PRIORIDAD_LABELS[ot.prioridad]}
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
