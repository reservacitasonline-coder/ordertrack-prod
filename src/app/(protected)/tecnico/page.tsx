'use client';

import React, { useEffect, useState, useMemo } from 'react';
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
  estado: string; // 'PROGRAMADA' | 'EN_EJECUCION' | 'COMPLETADA' | 'PAUSADA'
  tecnico_asignado_id?: number;
  fecha_programada?: string;
  hora_inicio?: string;
  hora_fin?: string;
  duracion?: string;
  lat?: number;
  lng?: number;
}

const DEFAULT_MOCK_OTS: MockOT[] = [
  {
    id: 101,
    codigo_interno: 'OT-2026-001',
    equipo: 'Mantenimiento Preventivo Compresor A-10',
    tipo_mantenimiento: 'Preventivo HVAC',
    ubicacion: 'Av. Javier Prado Este 456, San Isidro',
    prioridad: 'critica',
    slaRestanteMinutos: 45,
    estado: 'EN_EJECUCION',
    hora_inicio: '09:00 AM',
    hora_fin: '11:30 AM',
    duracion: '2h 30m',
    lat: -12.0864,
    lng: -77.0321,
  },
  {
    id: 102,
    codigo_interno: 'OT-2026-002',
    equipo: 'Revisión y Ajuste Switch Cisco Catalyst',
    tipo_mantenimiento: 'Correctivo Redes',
    ubicacion: 'Calle Las Begonias 210, Piso 4, Lince',
    prioridad: 'alta',
    slaRestanteMinutos: 15,
    estado: 'PROGRAMADA',
    hora_inicio: '01:00 PM',
    hora_fin: '03:00 PM',
    duracion: '2h 00m',
    lat: -12.0925,
    lng: -77.0289,
  },
  {
    id: 103,
    codigo_interno: 'OT-2026-003',
    equipo: 'Fusión y Certificación Fibra Óptica',
    tipo_mantenimiento: 'Preventivo Telecom',
    ubicacion: 'Av. República de Panamá 3055, San Borja',
    prioridad: 'alta',
    slaRestanteMinutos: 120,
    estado: 'PROGRAMADA',
    hora_inicio: '03:30 PM',
    hora_fin: '05:30 PM',
    duracion: '2h 00m',
    lat: -12.0991,
    lng: -77.0245,
  },
  {
    id: 104,
    codigo_interno: 'OT-2026-004',
    equipo: 'Inspección General Chiller Carrier 500TR',
    tipo_mantenimiento: 'Mantenimiento Aire Acondicionado',
    ubicacion: 'Av. Alfredo Mendiola 1400, Los Olivos',
    prioridad: 'media',
    slaRestanteMinutos: 180,
    estado: 'PAUSADA',
    hora_inicio: '06:00 PM',
    hora_fin: '07:30 PM',
    duracion: '1h 30m',
    lat: -12.0789,
    lng: -77.0398,
  },
];

interface CalendarDay {
  date: Date;
  dayShort: string;
  dayNumber: number;
  isToday: boolean;
  dateStr: string;
}

export default function MobileServiceManagementPage() {
  const router = useRouter();
  const [ordenes, setOrdenes] = useState<MockOT[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // View state switcher: 'lista' | 'mapa'
  const [viewMode, setViewMode] = useState<'lista' | 'mapa'>('lista');

  // Selected date state for weekly calendar
  const [selectedDateStr, setSelectedDateStr] = useState<string>('');

  // Selected map OT details
  const [selectedMapOtId, setSelectedMapOtId] = useState<number | null>(null);

  // Initialize selected date to today
  useEffect(() => {
    const today = new Date();
    setSelectedDateStr(today.toISOString().split('T')[0]);
  }, []);

  // Generate 7 days (Sun to Sat) for the weekly calendar
  const weeklyDays = useMemo<CalendarDay[]>(() => {
    const days: CalendarDay[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const currentDayOfWeek = today.getDay();

    const sunday = new Date(today);
    sunday.setDate(today.getDate() - currentDayOfWeek);
    sunday.setHours(0, 0, 0, 0);

    const todayStr = today.toISOString().split('T')[0];

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(sunday);
      dayDate.setDate(sunday.getDate() + i);
      const dateStr = dayDate.toISOString().split('T')[0];
      days.push({
        date: dayDate,
        dayShort: dayNames[i],
        dayNumber: dayDate.getDate(),
        isToday: dateStr === todayStr,
        dateStr,
      });
    }
    return days;
  }, []);

  // Formatted secondary date text (e.g. 'Today, Wed, Feb 10')
  const secondaryDateText = useMemo(() => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    const formatted = now.toLocaleDateString('en-US', options);
    return `Today, ${formatted}`;
  }, []);

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
      const apiData = await apiFetch<OrdenTrabajo[]>('/ordenes');
      if (Array.isArray(apiData)) {
        const assignedData = apiData.filter((ot) => {
          const techId = ot.tecnico_asignado?.id || (ot as any).tecnico_asignado_id;
          if (currentUser?.id) {
            return techId === currentUser.id;
          }
          return techId !== undefined && techId !== null;
        });

        const apiMapped: MockOT[] = assignedData.map((ot, idx) => {
          return {
            id: ot.id,
            codigo_interno: ot.codigo_interno,
            equipo: ot.titulo || 'Servicio Técnico',
            tipo_mantenimiento: ot.plantilla?.titulo || 'Mantenimiento Preventivo',
            ubicacion: ot.cliente?.nombre || (ot.cliente as any)?.direccion || 'Sede de Cliente',
            prioridad: (ot.prioridad as 'critica' | 'alta' | 'media' | 'baja') || 'media',
            slaRestanteMinutos: 180,
            estado: ot.estado,
            tecnico_asignado_id: ot.tecnico_asignado?.id || (ot as any).tecnico_asignado_id,
            hora_inicio: `${9 + idx}:00 AM`,
            hora_fin: `${11 + idx}:30 AM`,
            duracion: '2h 30m',
            lat: -12.0850 - (idx * 0.008),
            lng: -77.0300 + (idx * 0.006),
          };
        });

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

    setOrdenes(localOts);
    if (localOts.length > 0) {
      const activeOt = localOts.find(o => o.estado === 'EN_EJECUCION') || localOts[0];
      setSelectedMapOtId(activeOt.id);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadBandeja();
  }, []);

  const activeJob = useMemo(() => {
    return ordenes.find((ot) => ot.estado === 'EN_EJECUCION');
  }, [ordenes]);

  const currentMapOt = useMemo(() => {
    return ordenes.find((ot) => ot.id === selectedMapOtId) || activeJob || ordenes[0];
  }, [ordenes, selectedMapOtId, activeJob]);

  return (
    /* CONTENEDOR PRINCIPAL MOBILE-FIRST (ANCHO MÁXIMO 390px-430px, CENTRADO, SIN SCROLL HORIZONTAL, SIN CAJA DE SCROLL INTERNO) */
    <div className="w-full max-w-[420px] mx-auto min-h-screen bg-zinc-50 border border-zinc-200/80 rounded-2xl sm:rounded-[24px] sm:shadow-2xl flex flex-col font-sans text-zinc-900 select-none pb-24 relative">
      
      {/* ───────────────────────────────────────────────────────────── */}
      {/* HEADER NORMAL (NO FIJO: HACE SCROLL JUNTO CON LA PÁGINA) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-zinc-200/80 pt-4 px-4 pb-3 flex flex-col gap-2.5 shadow-2xs">
        
        {/* Fila Superior: Título 'Jobs' (SIN BOTÓN '+') */}
        <div className="flex items-center justify-between">
          <h1 className="text-[28px] font-black tracking-tight text-zinc-900 leading-none">
            Jobs
          </h1>

          <span className="text-[11px] font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200/80">
            {ordenes.length} Tasks
          </span>
        </div>

        {/* Calendario Semanal Horizontal (Fila compacta 7 días, flex justify-between sin scroll horizontal) */}
        <div className="flex justify-between items-center w-full gap-1">
          {weeklyDays.map((day) => {
            const isSelected = selectedDateStr === day.dateStr;
            return (
              <button
                key={day.dateStr}
                onClick={() => setSelectedDateStr(day.dateStr)}
                className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-full transition-all duration-200 cursor-pointer min-w-[40px] ${
                  isSelected
                    ? 'bg-green-600 text-white font-bold shadow-sm shadow-green-600/40 scale-[1.05]'
                    : 'text-zinc-600 hover:bg-zinc-100 font-medium'
                }`}
              >
                <span className={`text-[10px] uppercase font-semibold tracking-wider ${
                  isSelected ? 'text-green-100' : 'text-zinc-400'
                }`}>
                  {day.dayShort}
                </span>
                <span className={`text-xs font-black mt-0.5 ${
                  isSelected ? 'text-white' : 'text-zinc-900'
                }`}>
                  {day.dayNumber}
                </span>
              </button>
            );
          })}
        </div>

        {/* Texto de Fecha Secundaria debajo */}
        <div className="text-xs text-zinc-500 font-medium px-0.5 pt-0.5">
          <span>{secondaryDateText}</span>
        </div>
      </header>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* SELECTOR DE VISTA (SEGMENTED CONTROL) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="px-4 pt-3 pb-1">
        <div className="bg-zinc-100 p-1 rounded-xl flex items-center h-10 max-h-[40px] w-full">
          <button
            onClick={() => setViewMode('lista')}
            className={`flex-1 flex items-center justify-center gap-1.5 h-full rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
              viewMode === 'lista'
                ? 'bg-white text-zinc-900 shadow-xs scale-[1.01]'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span>Lista</span>
          </button>

          <button
            onClick={() => setViewMode('mapa')}
            className={`flex-1 flex items-center justify-center gap-1.5 h-full rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
              viewMode === 'mapa'
                ? 'bg-white text-zinc-900 shadow-xs scale-[1.01]'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.3">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.82V8.056a1 1 0 00-1.447-.894L15 9m0 11V9m0 0L9 7" />
            </svg>
            <span>Mapa</span>
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* LISTA DE TARJETAS (FLUJO NATURAL SIN CAJA DE SCROLL INTERNO) */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="px-4 py-2 space-y-3.5">
        
        {viewMode === 'lista' ? (
          loading ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white border border-zinc-200 rounded-2xl">
              <svg className="animate-spin h-6 w-6 text-green-600 mb-2" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-zinc-500 font-medium">Loading jobs...</span>
            </div>
          ) : ordenes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-400 bg-white border border-zinc-200 rounded-2xl p-6 text-center shadow-xs">
              <span className="text-3xl mb-2">🎉</span>
              <p className="text-sm font-bold text-zinc-800">No jobs scheduled for this date</p>
            </div>
          ) : (
            ordenes.map((ot) => {
              const isInProgress = ot.estado === 'EN_EJECUCION';

              return (
                <div
                  key={ot.id}
                  onClick={() => router.push(`/tecnico/ordenes/${ot.id}`)}
                  className={`rounded-[16px] p-4 transition-all duration-200 border cursor-pointer flex flex-col justify-between gap-3 shadow-xs active:scale-[0.99] ${
                    isInProgress
                      /* TARJETA 'EN CURSO / ON GOING': Fondo cálido crema/beige claro (#FDF2E9) */
                      ? 'bg-[#FDF2E9] border-orange-200/90 shadow-sm'
                      /* TARJETA 'ACTIVA / ACTIVE': Fondo blanco (#FFFFFF) */
                      : 'bg-white border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  {/* Fila Superior: Horario + Badge Superior Derecho */}
                  <div className="flex items-center justify-between gap-2">
                    {/* Rango de Horas y Duración Total */}
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600">
                      <svg className="w-3.5 h-3.5 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{ot.hora_inicio || '09:00 AM'} - {ot.hora_fin || '11:30 AM'}</span>
                      <span className="text-[10px] text-zinc-400 font-mono bg-zinc-100 px-1.5 py-0.2 rounded border border-zinc-200">
                        {ot.duracion || '2h 30m'}
                      </span>
                    </div>

                    {/* BADGE ESQUINA SUPERIOR DERECHA */}
                    {isInProgress ? (
                      /* Punto rojo (#EF4444) + 'On going' */
                      <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-50 border border-red-200/80 text-red-600 text-[11px] font-bold shadow-2xs">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                        </span>
                        <span>On going</span>
                      </div>
                    ) : (
                      /* Punto verde (#22C55E) + 'Active' */
                      <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-[11px] font-bold">
                        <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
                        <span>Active</span>
                      </div>
                    )}
                  </div>

                  {/* Título de la Tarea (Truncado con ellipsis) */}
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 leading-snug truncate">
                      {ot.equipo}
                    </h3>
                  </div>

                  {/* Dirección con Icono de Ubicación (Truncado con ellipsis) */}
                  <div className="flex items-center gap-1.5 text-xs text-zinc-600 font-medium">
                    <svg className="w-3.5 h-3.5 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="truncate">{ot.ubicacion}</span>
                  </div>

                  {/* Fila Inferior con CTA */}
                  <div className="pt-2 border-t border-zinc-200/60 flex items-center justify-between text-xs">
                    <span className="font-mono text-[10px] font-bold text-zinc-400">
                      {ot.codigo_interno}
                    </span>

                    <span className="text-xs font-bold text-green-600 flex items-center gap-1 hover:underline">
                      <span>View details</span>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.8">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>

                </div>
              );
            })
          )
        ) : (
          /* VISTA DE MAPA COMPACTA */
          <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs flex flex-col relative min-h-[360px]">
            <div className="p-3 bg-zinc-900 text-white flex items-center justify-between text-xs font-bold">
              <span>Service Route Map</span>
              <span className="text-green-400 text-[11px] font-mono">{ordenes.length} Jobs</span>
            </div>

            <div className="relative flex-1 bg-slate-100 min-h-[300px] flex items-center justify-center overflow-hidden">
              <svg className="absolute inset-0 w-full h-full opacity-35 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="m-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#64748B" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#m-grid)" />
                <line x1="0" y1="35%" x2="100%" y2="40%" stroke="#CBD5E1" strokeWidth="8" />
                <line x1="30%" y1="0" x2="45%" y2="100%" stroke="#CBD5E1" strokeWidth="8" />
              </svg>

              <div className="absolute inset-0 p-6 flex flex-col items-center justify-around z-10 pointer-events-auto">
                {ordenes.map((ot, idx) => (
                  <button
                    key={ot.id}
                    onClick={() => setSelectedMapOtId(ot.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold shadow-md border transition-all ${
                      ot.estado === 'EN_EJECUCION'
                        ? 'bg-red-500 text-white border-red-600 animate-bounce'
                        : 'bg-white text-zinc-800 border-zinc-300'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span>#{idx + 1} {ot.codigo_interno}</span>
                  </button>
                ))}
              </div>

              {currentMapOt && (
                <div className="absolute bottom-2 left-2 right-2 bg-white border border-zinc-200 rounded-xl p-3 shadow-lg z-20 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-900 truncate">{currentMapOt.equipo}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{currentMapOt.ubicacion}</p>
                  </div>
                  <button
                    onClick={() => router.push(`/tecnico/ordenes/${currentMapOt.id}`)}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold shrink-0 cursor-pointer"
                  >
                    Open
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
