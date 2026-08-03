'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { OrdenTrabajo } from '@/types';
import { getUserFromToken } from '@/lib/auth';

interface MockOT {
  id: number;
  codigo_interno: string;
  equipo: string;
  tipo_mantenimiento?: string;
  ubicacion: string;
  prioridad: 'critica' | 'alta' | 'media' | 'baja';
  slaRestanteMinutos: number;
  estado: string; // 'PROGRAMADA' | 'EN_EJECUCION' | 'COMPLETADA'
  tecnico_asignado_id?: number;
}

const DEFAULT_MOCK_OTS: MockOT[] = [
  {
    id: 101,
    codigo_interno: 'OT-2026-001',
    equipo: 'Compresor de Aire A-10',
    tipo_mantenimiento: 'Mantenimiento Preventivo HVAC',
    ubicacion: 'Sede Principal - Sótano 1',
    prioridad: 'critica',
    slaRestanteMinutos: 45,
    estado: 'PROGRAMADA',
  },
  {
    id: 102,
    codigo_interno: 'OT-2026-002',
    equipo: 'Switch Cisco Catalyst 2960',
    tipo_mantenimiento: 'Mantenimiento Correctivo Redes',
    ubicacion: 'Edificio B - Piso 4',
    prioridad: 'alta',
    slaRestanteMinutos: 15,
    estado: 'PROGRAMADA',
  },
  {
    id: 103,
    codigo_interno: 'OT-2026-003',
    equipo: 'Bandeja Distribución de Fibra',
    tipo_mantenimiento: 'Mantenimiento Preventivo Redes',
    ubicacion: 'Nodo Sur - Planta Baja',
    prioridad: 'alta',
    slaRestanteMinutos: 120,
    estado: 'PROGRAMADA',
  },
  {
    id: 104,
    codigo_interno: 'OT-2026-004',
    equipo: 'Chiller Industrial Carrier',
    tipo_mantenimiento: 'Mantenimiento de Aire Acondicionado',
    ubicacion: 'Planta de Producción',
    prioridad: 'media',
    slaRestanteMinutos: 180,
    estado: 'PROGRAMADA',
  },
  {
    id: 105,
    codigo_interno: 'OT-2026-005',
    equipo: 'Tablero Eléctrico Principal T-2',
    tipo_mantenimiento: 'Mantenimiento General Eléctrico',
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

const ESTADO_ICONS: Record<string, string> = {
  RECIBIDA: '📥',
  EN_REVISION: '🔍',
  APROBADA: '✅',
  RECHAZADA: '❌',
  PROGRAMADA: '🕒',
  EN_EJECUCION: '🛠️',
  PAUSADA: '⏸️',
  COMPLETADA: '🎉',
  CERRADA: '🔒',
  ANULADA: '🚫',
  ESPERANDO_REPUESTO: '📦',
  PRECIERRE: '📑',
};

const ESTADO_COLORS: Record<string, string> = {
  RECIBIDA: 'bg-zinc-100 text-zinc-800 border-zinc-200',
  EN_REVISION: 'bg-blue-50 text-blue-750 border-blue-250',
  APROBADA: 'bg-emerald-50 text-emerald-750 border-emerald-250',
  RECHAZADA: 'bg-rose-50 text-rose-755 border-rose-250',
  PROGRAMADA: 'bg-indigo-50 text-indigo-750 border-indigo-250',
  EN_EJECUCION: 'bg-sky-55 text-sky-750 border-sky-250',
  PAUSADA: 'bg-amber-50 text-amber-755 border-amber-250',
  COMPLETADA: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  CERRADA: 'bg-zinc-200 text-zinc-700 border-zinc-300',
  ANULADA: 'bg-zinc-350 text-zinc-650 border-zinc-400',
  ESPERANDO_REPUESTO: 'bg-purple-50 text-purple-750 border-purple-250',
  PRECIERRE: 'bg-amber-100 text-amber-850 border-amber-300',
};

const formatSLA = (minutos: number) => {
  if (minutos <= 0) return 'SLA Vencido';
  if (minutos < 60) return `${minutos} min`;
  const hrs = Math.floor(minutos / 60);
  const mins = minutos % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
};

const getCategoryWeight = (estado: string) => {
  if (estado === 'PRECIERRE') return 1;
  if (['COMPLETADA', 'CERRADA', 'ANULADA'].includes(estado)) return 3;
  return 2; // Pending states
};

export default function TecnicoBandejaPage() {
  const router = useRouter();
  const [ordenes, setOrdenes] = useState<MockOT[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncTime, setSyncTime] = useState<string>('');

  // Social comments states
  const [openCommentsOtId, setOpenCommentsOtId] = useState<number | null>(null);
  const [otNotes, setOtNotes] = useState<Record<number, any[]>>({});
  const [loadingNotes, setLoadingNotes] = useState<Record<number, boolean>>({});
  const [newNoteTexts, setNewNoteTexts] = useState<Record<number, string>>({});
  const [submittingNote, setSubmittingNote] = useState<Record<number, boolean>>({});

  const toggleComments = async (otId: number) => {
    if (openCommentsOtId === otId) {
      setOpenCommentsOtId(null);
      return;
    }
    setOpenCommentsOtId(otId);
    
    // Fetch notes if not already loaded or to refresh
    setLoadingNotes(prev => ({ ...prev, [otId]: true }));
    try {
      const data = await apiFetch<any[]>(`/ordenes/${otId}/notas`);
      setOtNotes(prev => ({ ...prev, [otId]: data || [] }));
    } catch (e) {
      console.warn("Failed to fetch notes for OT", otId, e);
      setOtNotes(prev => ({ ...prev, [otId]: [] }));
    } finally {
      setLoadingNotes(prev => ({ ...prev, [otId]: false }));
    }
  };

  const handleAddNote = async (otId: number) => {
    const text = newNoteTexts[otId] || "";
    if (!text.trim()) return;

    setSubmittingNote(prev => ({ ...prev, [otId]: true }));
    try {
      const created = await apiFetch<any>(`/ordenes/${otId}/notas`, {
        method: 'POST',
        body: JSON.stringify({
          contenido: text.trim(),
          es_interna: true
        })
      });

      setOtNotes(prev => ({
        ...prev,
        [otId]: [created, ...(prev[otId] || [])]
      }));
      setNewNoteTexts(prev => ({ ...prev, [otId]: "" }));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar el comentario');
    } finally {
      setSubmittingNote(prev => ({ ...prev, [otId]: false }));
    }
  };

  const handleCopyLocation = (address: string) => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(address);
      alert(`Dirección copiada: "${address}"`);
    } else {
      alert(address);
    }
  };

  const loadBandeja = async () => {
    setLoading(true);
    const currentUser = getUserFromToken();
    let localOts: MockOT[] = [];
    const stored = localStorage.getItem('mock_tecnico_ordenes');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (currentUser?.id) {
          localOts = parsed.filter((item: any) => {
            const techId = item.tecnico_asignado_id || item.tecnico_asignado?.id;
            return techId === currentUser.id;
          });
        } else {
          localOts = parsed;
        }
      } catch {
        localOts = [];
      }
    }

    try {
      // Try to fetch real orders assigned to the technician from backend
      const apiData = await apiFetch<OrdenTrabajo[]>('/ordenes');
      if (Array.isArray(apiData)) {
        const assignedData = apiData.filter((ot) => {
          const techId = ot.tecnico_asignado?.id || (ot as any).tecnico_asignado_id;
          if (currentUser?.id) {
            return techId === currentUser.id;
          }
          return techId !== undefined && techId !== null;
        });

        const apiMapped: MockOT[] = assignedData.map((ot) => {
          const tipoMantto =
            ot.plantillas && ot.plantillas.length > 0
              ? ot.plantillas.map((p) => p.titulo).join(', ')
              : ot.plantilla?.titulo || 'Mantto General';

          return {
            id: ot.id,
            codigo_interno: ot.codigo_interno,
            equipo: ot.titulo || 'Servicio Técnico',
            tipo_mantenimiento: tipoMantto,
            ubicacion: ot.cliente?.nombre || (ot.cliente as any)?.direccion || 'Sede de Cliente',
            prioridad: (ot.prioridad as 'critica' | 'alta' | 'media' | 'baja') || 'media',
            slaRestanteMinutos: 180,
            estado: ot.estado,
            tecnico_asignado_id: ot.tecnico_asignado?.id || (ot as any).tecnico_asignado_id,
          };
        });

        // Merge API OTs with local storage items so manually created OTs persist
        const apiMap = new Map(apiMapped.map((o) => [o.id, o]));
        const merged: MockOT[] = localOts.map((localItem) => {
          if (apiMap.has(localItem.id)) {
            const apiItem = apiMap.get(localItem.id)!;
            apiMap.delete(localItem.id);
            return {
              ...localItem,
              ...apiItem,
              estado: localItem.estado || apiItem.estado,
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
      if (localOts.length === 0) {
        localOts = DEFAULT_MOCK_OTS;
      }
    }

    // Sort by category first, then priority and SLA
    const sorted = [...localOts].sort((a, b) => {
      const catA = getCategoryWeight(a.estado);
      const catB = getCategoryWeight(b.estado);
      if (catA !== catB) {
        return catA - catB;
      }
      const pA = PRIORITY_WEIGHTS[a.prioridad as 'critica' | 'alta' | 'media' | 'baja'] || 0;
      const pB = PRIORITY_WEIGHTS[b.prioridad as 'critica' | 'alta' | 'media' | 'baja'] || 0;
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

  // Show all orders sorted (PRECIERRE first, then pending, then closed)
  const ordenesPendientes = ordenes;

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6 p-2 md:p-6 text-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-zinc-950 tracking-tight">Bandeja de Trabajo</h1>
          <p className="text-xs text-zinc-500 font-medium mt-0.5">Órdenes de trabajo pendientes por atender en campo</p>
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

      {/* Orders Grid - Only Unattended OTs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        {ordenesPendientes.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-zinc-400 bg-white border border-zinc-200 rounded-2xl p-6 text-center">
            <span className="text-4xl mb-2">🎉</span>
            <p className="text-sm font-semibold text-zinc-800">¡Al día! No tienes órdenes pendientes por atender.</p>
            <p className="text-xs text-zinc-400 mt-1">Las nuevas órdenes asignadas aparecerán aquí automáticamente.</p>
          </div>
        ) : (
          ordenesPendientes.map((ot) => {
            const styles = PRIORITY_COLORS[ot.prioridad];

            return (
              <div
                key={ot.id}
                className={`bg-white border border-zinc-200 border-l-[6px] ${styles.border} rounded-2xl p-5 shadow-2xs flex flex-col justify-between gap-4 hover:shadow-md transition-all`}
              >
                {/* Header card info */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-black text-zinc-800 bg-zinc-100 px-3 py-1 rounded-lg border border-zinc-200">
                    {ot.codigo_interno}
                  </span>
                  <span className={`text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${styles.bg}`}>
                    {PRIORITY_LABELS[ot.prioridad]}
                  </span>
                </div>

                {/* Details */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Tipo de Mantenimiento / Plantilla */}
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2.5 py-1 rounded-lg w-fit">
                      <span>📋</span>
                      <span>{ot.tipo_mantenimiento || 'Mantto General'}</span>
                    </div>

                    {/* SLA countdown if active */}
                    {!['COMPLETADA', 'CERRADA', 'ANULADA'].includes(ot.estado) && (
                      <div className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg border ${ot.prioridad === 'critica' || ot.slaRestanteMinutos < 60 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-zinc-50 text-zinc-700 border-zinc-200'}`}>
                        <span>⏱️</span>
                        <span className="font-mono">{formatSLA(ot.slaRestanteMinutos)}</span>
                      </div>
                    )}
                  </div>

                  <h3 className="text-base md:text-lg font-black text-zinc-950 leading-snug">
                    {ot.equipo}
                  </h3>
                  <div className="grid grid-cols-1 gap-1 text-xs text-zinc-500 font-medium">
                    <p className="flex items-center gap-1.5">
                      <span className="text-zinc-400">📍 Ubicación:</span>
                      <span className="text-zinc-850 font-semibold">{ot.ubicacion}</span>
                    </p>
                  </div>
                </div>

                {/* Social Action Bar */}
                <div className="flex flex-col gap-3 mt-auto">
                  <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
                    {/* Status Reaction Tag */}
                    <div className={`flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg border ${ESTADO_COLORS[ot.estado] || 'bg-zinc-100 text-zinc-800 border-zinc-200'}`} title="Estado de la Orden">
                      <span>{ESTADO_ICONS[ot.estado] || '📋'}</span>
                      <span>{ot.estado}</span>
                    </div>

                    {/* Quick Interaction Buttons */}
                    <div className="flex items-center gap-1.5">
                      {/* Comments Social Button */}
                      <button
                        onClick={() => toggleComments(ot.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer ${openCommentsOtId === ot.id ? 'bg-zinc-100 text-zinc-950 shadow-2xs border border-zinc-200' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}
                      >
                        <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 18.113a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 13.717 3.75 12.89 3.75 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                        </svg>
                        {otNotes[ot.id]?.length !== undefined && (
                          <span className="font-mono text-zinc-700">{otNotes[ot.id].length}</span>
                        )}
                      </button>

                      {/* Map Location Social Button */}
                      <button
                        onClick={() => handleCopyLocation(ot.ubicacion)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-all active:scale-95 cursor-pointer"
                        title="Copiar ubicación"
                      >
                        <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25s-7.5-4.108-7.5-11.25a7.5 7.5 0 1115 0z" />
                        </svg>
                      </button>

                      {/* Detail Social Button */}
                      <button
                        onClick={() => router.push(`/tecnico/ordenes/${ot.id}`)}
                        className={`h-9 px-4 rounded-xl text-xs font-black shadow-2xs active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer ${['COMPLETADA', 'CERRADA', 'ANULADA'].includes(ot.estado) ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-250' : 'bg-zinc-900 hover:bg-zinc-950 text-white'}`}
                      >
                        <span>{['COMPLETADA', 'CERRADA', 'ANULADA'].includes(ot.estado) ? 'Ver Detalle' : 'Abrir OT'}</span>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Expanded notes feed */}
                  {openCommentsOtId === ot.id && (
                    <div className="mt-2 pt-3 border-t border-zinc-100 flex flex-col gap-3">
                      <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Notas de Campo y Comentarios</h4>
                      
                      {/* Comments List */}
                      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                        {loadingNotes[ot.id] ? (
                          <div className="flex items-center justify-center py-4 text-xs text-zinc-400 gap-1.5">
                            <svg className="animate-spin h-4 w-4 text-zinc-500" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Cargando notas...
                          </div>
                        ) : !otNotes[ot.id] || otNotes[ot.id].length === 0 ? (
                          <p className="text-xs text-zinc-400 py-2 text-center italic">No hay notas registradas.</p>
                        ) : (
                          otNotes[ot.id].map((note: any) => (
                            <div key={note.id} className="bg-zinc-50 border border-zinc-150 rounded-xl p-2.5 text-xs">
                              <div className="flex items-center justify-between mb-1 text-[10px] font-bold text-zinc-400">
                                <span className="text-zinc-650 font-extrabold">{note.usuario?.nombre || 'Técnico'}</span>
                                <span>{new Date(note.created_at).toLocaleDateString('es-ES', {hour: '2-digit', minute:'2-digit'})}</span>
                              </div>
                              <p className="text-zinc-800 leading-relaxed font-semibold">{note.contenido}</p>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Comment Input */}
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="text"
                          placeholder="Escribe una nota rápida..."
                          value={newNoteTexts[ot.id] || ''}
                          onChange={(e) => setNewNoteTexts(prev => ({ ...prev, [ot.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddNote(ot.id);
                          }}
                          disabled={submittingNote[ot.id]}
                          className="flex-1 min-w-0 h-9 px-3 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:border-zinc-400 focus:bg-white transition-all text-zinc-900 font-medium"
                        />
                        <button
                          onClick={() => handleAddNote(ot.id)}
                          disabled={submittingNote[ot.id] || !(newNoteTexts[ot.id] || '').trim()}
                          className="h-9 w-9 bg-zinc-900 hover:bg-zinc-950 text-white rounded-lg flex items-center justify-center shrink-0 disabled:opacity-40 disabled:hover:bg-zinc-900 active:scale-95 transition-all cursor-pointer"
                        >
                          {submittingNote[ot.id] ? (
                            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

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


