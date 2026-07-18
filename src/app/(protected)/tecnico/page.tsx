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

export default function TecnicoBandejaPage() {
  const { user } = useAuth();
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'hoy' | 'proximas' | 'todas'>('todas');
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
      return true;
    });
  }, [ordenes, heroOT, filtro]);

  // Summary counts
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
    <div className="flex flex-col gap-6 max-w-md mx-auto px-2 py-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-950">Mis Órdenes</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Bandeja de campo y ejecución rápida.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchOrdenes}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
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
          <span className="text-xs text-zinc-400 font-medium">Ejecución</span>
          <span className="text-base font-bold text-emerald-600 mt-0.5">{summary.active}</span>
        </div>
        <div className="flex flex-col items-center justify-center p-1.5 bg-zinc-50 rounded-xl">
          <span className="text-xs text-zinc-400 font-medium">Pendientes</span>
          <span className="text-base font-bold text-blue-600 mt-0.5">{summary.pending}</span>
        </div>
        <div className="flex flex-col items-center justify-center p-1.5 bg-zinc-50 rounded-xl">
          <span className="text-xs text-zinc-400 font-medium">Repuestos</span>
          <span className="text-base font-bold text-rose-500 mt-0.5">{summary.waiting}</span>
        </div>
        <div className="flex flex-col items-center justify-center p-1.5 bg-zinc-50 rounded-xl">
          <span className="text-xs text-zinc-400 font-medium">Terminadas</span>
          <span className="text-base font-bold text-zinc-500 mt-0.5">{summary.completed}</span>
        </div>
      </div>

      {/* 🚀 HERO CARD: Active / Next Job */}
      {heroOT ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-bold text-zinc-400 tracking-wider uppercase">Servicio Actual / Próximo</h2>
          <Card className="relative overflow-hidden border-2 border-teal-500/80 shadow-md p-5 bg-gradient-to-br from-white to-teal-50/10 flex flex-col gap-4">
            <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full -mr-8 -mt-8 pointer-events-none" />
            
            {/* Top row: Internal Code & Priority */}
            <div className="flex justify-between items-center">
              <span className="font-mono font-bold text-xs text-zinc-800 bg-zinc-100 px-2 py-0.5 rounded-md">
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
              <div className="flex items-center justify-between p-3 bg-zinc-50 border border-zinc-100 rounded-xl mt-1">
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
              <Button className="w-full justify-center bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-xl shadow-sm text-sm active:scale-[0.99] transition-transform">
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
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <h2 className="text-xs font-bold text-zinc-400 tracking-wider uppercase">Otros Trabajos</h2>
          <span className="text-[10px] text-zinc-400 font-medium font-mono">{filteredRemainingOrdenes.length} órdenes</span>
        </div>

        {/* Quick Filters */}
        <div className="grid grid-cols-3 gap-2 p-1 bg-zinc-100/80 border border-zinc-200/30 rounded-xl">
          {(['todas', 'hoy', 'proximas'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFiltro(mode)}
              className={`py-1.5 px-3 text-[11px] font-bold capitalize rounded-lg transition-all ${
                filtro === mode
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              {mode === 'proximas' ? 'Por iniciar' : mode}
            </button>
          ))}
        </div>

        {error && <ErrorMessage message={error} retry={fetchOrdenes} />}

        {/* List */}
        {filteredRemainingOrdenes.length === 0 ? (
          <EmptyState
            title="Sin otras órdenes"
            description="No tienes más órdenes programadas en esta vista."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {filteredRemainingOrdenes.map((ot) => {
              const prioColor = PRIORIDAD_COLORS[ot.prioridad as keyof typeof PRIORIDAD_COLORS] || PRIORIDAD_COLORS.media;
              const stateColor = ESTADO_COLORS[ot.estado as keyof typeof ESTADO_COLORS] || ESTADO_COLORS.RECIBIDA;

              return (
                <Link href={`/tecnico/ordenes/${ot.id}`} key={ot.id}>
                  <Card className="p-4 hover:border-zinc-300 transition-all flex flex-col gap-3 shadow-xs bg-white active:scale-[0.99]">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-zinc-700 font-mono">{ot.codigo_interno}</span>
                      <div className="flex gap-1.5 items-center">
                        <Badge bg={prioColor.bg} text={prioColor.text} border={prioColor.border} className="capitalize text-[10px]">
                          {PRIORIDAD_LABELS[ot.prioridad as keyof typeof PRIORIDAD_LABELS] || ot.prioridad}
                        </Badge>
                        <Badge bg={stateColor.bg} text={stateColor.text} border={stateColor.border} className="text-[10px]">
                          {ESTADO_LABELS[ot.estado as keyof typeof ESTADO_LABELS] || ot.estado}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <h3 className="font-semibold text-zinc-900 text-sm leading-snug break-words line-clamp-1">
                        {ot.titulo}
                      </h3>
                      <p className="text-zinc-500 text-[11px] truncate">
                        Cliente: <span className="font-medium text-zinc-700">{ot.cliente.nombre}</span>
                      </p>
                    </div>

                    {ot.fecha_programada && (
                      <div className="flex items-center gap-1 text-[10px] text-zinc-400 border-t border-zinc-100 pt-2 mt-1">
                        <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>
                          {new Date(ot.fecha_programada).toLocaleString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    )}
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
