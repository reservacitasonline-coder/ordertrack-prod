'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/Button';

interface RepuestoPendiente {
  id: number;
  cantidad: string | number;
  estado: 'SOLICITADO' | 'EN_CAMINO' | 'ENTREGADO' | string;
  nombre_otro?: string | null;
  fecha_estimada?: string | null;
  material?: { id: number; nombre: string; codigo?: string | null } | null;
}

interface Props {
  otId: string | number;
  estadoOt: string;
  puedeGestionar: boolean;
  onCambio: () => void;
}

const ETIQUETA: Record<string, string> = {
  SOLICITADO: 'Solicitado',
  EN_CAMINO: 'En camino',
  ENTREGADO: 'Entregado',
};

export function RepuestosPendientesPanel({ otId, estadoOt, puedeGestionar, onCambio }: Props) {
  const [items, setItems] = useState<RepuestoPendiente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [fecha, setFecha] = useState('');

  const cargar = useCallback(async () => {
    await Promise.resolve();
    try {
      const data = await apiFetch<RepuestoPendiente[]>(`/ordenes/${otId}/repuestos-pendientes`);
      setItems(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los repuestos solicitados');
    } finally {
      setCargando(false);
    }
  }, [otId]);

  useEffect(() => {
    Promise.resolve().then(cargar);
  }, [cargar, estadoOt]);

  const ejecutar = async (ruta: string, body?: object) => {
    setTrabajando(true);
    setError(null);
    try {
      await apiFetch(`/ordenes/${otId}/${ruta}`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      });
      await cargar();
      onCambio();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción');
    } finally {
      setTrabajando(false);
    }
  };

  if (cargando || items.length === 0) return null;

  const porEntregar = items.filter((i) => i.estado === 'SOLICITADO' || i.estado === 'EN_CAMINO');
  const solicitados = items.filter((i) => i.estado === 'SOLICITADO');
  const cerrada = !['ESPERANDO_REPUESTO', 'EN_EJECUCION'].includes(estadoOt);

  return (
    <div className="border-t border-zinc-100 pt-4 flex flex-col gap-3">
      <span className="text-xs font-semibold text-zinc-400">
        🔧 Repuestos solicitados por el técnico ({items.length})
      </span>
      <ul className="flex flex-col gap-1.5 text-xs">
        {items.map((i) => (
          <li
            key={i.id}
            className="flex justify-between items-center gap-3 bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2"
          >
            <span className="text-zinc-800 font-medium truncate">
              {i.material?.nombre ?? i.nombre_otro ?? 'Repuesto'} × {Number(i.cantidad)}
            </span>
            <span className="text-zinc-500 whitespace-nowrap">
              {ETIQUETA[i.estado] ?? i.estado}
              {i.estado === 'EN_CAMINO' && i.fecha_estimada
                ? ` · ${new Date(i.fecha_estimada).toLocaleDateString('es-PE')}`
                : ''}
            </span>
          </li>
        ))}
      </ul>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      {puedeGestionar && !cerrada && porEntregar.length > 0 && (
        <div className="flex flex-col gap-2">
          {solicitados.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="h-9 rounded-lg border border-zinc-200 px-2 text-xs"
                aria-label="Fecha estimada de llegada"
              />
              <Button
                type="button"
                variant="secondary"
                disabled={trabajando || !fecha}
                onClick={() => ejecutar('proveer-repuesto', { fecha_estimada: fecha })}
              >
                Marcar en camino
              </Button>
            </div>
          )}
          <div>
            <Button
              type="button"
              disabled={trabajando}
              onClick={() => ejecutar('entregar-repuestos')}
            >
              Marcar entregado y reanudar OT
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
