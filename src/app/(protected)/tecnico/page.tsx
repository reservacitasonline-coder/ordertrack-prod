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

  // Filter orders
  const filteredOrdenes = useMemo(() => {
    const today = new Date().toDateString();
    return ordenes.filter((ot) => {
      if (filtro === 'hoy') {
        return ot.fecha_programada && new Date(ot.fecha_programada).toDateString() === today;
      }
      if (filtro === 'proximas') {
        return ot.estado === 'PROGRAMADA' || ot.estado === 'RECIBIDA';
      }
      return true;
    });
  }, [ordenes, filtro]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-20">
        <Spinner size="lg" />
        <span className="text-xs text-zinc-500 font-medium mt-3">Cargando bandeja de órdenes...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 max-w-md mx-auto px-1 py-3">
      {/* Header & Offline Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-950">Mis Órdenes</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Bandeja de campo y ejecución de OTs.</p>
        </div>
        {isOffline ? (
          <Badge bg="bg-amber-100" text="text-amber-800" border="border-amber-200">
            Modo Offline
          </Badge>
        ) : (
          <Badge bg="bg-teal-100" text="text-teal-800" border="border-teal-200">
            Conectado
          </Badge>
        )}
      </div>

      {/* Sync Banner if pending operations exist */}
      {isOffline && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-snug">
          <strong>Aviso:</strong> Estás operando en modo offline. Los cambios que realices se guardarán en tu dispositivo y se sincronizarán cuando recuperes la conexión a internet.
        </div>
      )}

      {/* Quick Filters */}
      <div className="grid grid-cols-3 gap-2 p-1 bg-zinc-100 rounded-xl">
        {(['todas', 'hoy', 'proximas'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setFiltro(mode)}
            className={`py-2 px-3 text-xs font-bold capitalize rounded-lg transition-all ${
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
      {filteredOrdenes.length === 0 ? (
        <EmptyState
          title="Sin órdenes asignadas"
          description="No tienes órdenes pendientes asignadas para el filtro seleccionado."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {filteredOrdenes.map((ot) => {
            const prioColor = PRIORIDAD_COLORS[ot.prioridad as keyof typeof PRIORIDAD_COLORS] || PRIORIDAD_COLORS.media;
            const stateColor = ESTADO_COLORS[ot.estado as keyof typeof ESTADO_COLORS] || ESTADO_COLORS.RECIBIDA;

            return (
              <Link href={`/tecnico/ordenes/${ot.id}`} key={ot.id}>
                <Card className="p-4 hover:border-zinc-300 transition-all flex flex-col gap-3.5 shadow-sm active:scale-[0.99]">
                  {/* Status, Priority & Code */}
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-zinc-800 font-mono">{ot.codigo_interno}</span>
                    <div className="flex gap-1.5 items-center">
                      <Badge bg={prioColor.bg} text={prioColor.text} border={prioColor.border} className="capitalize">
                        {PRIORIDAD_LABELS[ot.prioridad as keyof typeof PRIORIDAD_LABELS] || ot.prioridad}
                      </Badge>
                      <Badge bg={stateColor.bg} text={stateColor.text} border={stateColor.border}>
                        {ESTADO_LABELS[ot.estado as keyof typeof ESTADO_LABELS] || ot.estado}
                      </Badge>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <div className="flex flex-col gap-1">
                    <h3 className="font-bold text-zinc-900 text-[15px] leading-snug break-words">
                      {ot.titulo}
                    </h3>
                    <p className="text-zinc-600 text-xs truncate">
                      Cliente: <span className="font-semibold">{ot.cliente.nombre}</span>
                    </p>
                  </div>

                  {/* Programmed date */}
                  {ot.fecha_programada && (
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 border-t border-zinc-100 pt-3">
                      <svg className="w-3.5 h-3.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>
                        Programado: {new Date(ot.fecha_programada).toLocaleString('es-ES', {
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
  );
}
