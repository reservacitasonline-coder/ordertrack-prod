'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { OrdenTrabajo } from '@/types';
import { PRIORIDAD_COLORS, PRIORIDAD_LABELS } from '@/lib/constants';

interface MappedOT {
  id: number;
  codigo_interno: string;
  equipo: string;
  tipo_mantenimiento?: string;
  ubicacion: string;
  prioridad: 'critica' | 'alta' | 'media' | 'baja';
  slaRestanteMinutos: number;
  estado: string;
  tecnico_asignado_id?: number;
  fecha_programada?: string;
  hora_inicio?: string;
  hora_fin?: string;
  duracion?: string;
  fecha_asignacion?: string;
  lat?: number;
  lng?: number;
}

interface CalendarDay {
  date: Date;
  dayShort: string;
  dayNumber: number;
  isToday: boolean;
  dateStr: string;
}

export default function MobileServiceManagementPage() {
  const router = useRouter();
  const [ordenes, setOrdenes] = useState<MappedOT[]>([]);
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
    try {
      const apiOrdenes = await apiFetch<OrdenTrabajo[]>('/tecnico/ordenes');
      if (apiOrdenes && Array.isArray(apiOrdenes)) {
        const apiMapped: MappedOT[] = apiOrdenes.map((o, idx) => {
          const tipoMantto =
            o.plantillas && o.plantillas.length > 0
              ? o.plantillas.map((p) => p.titulo).join(', ')
              : o.plantilla?.titulo || 'Mantto General';

          const dateObj = o.fecha_programada ? new Date(o.fecha_programada) : (o.created_at ? new Date(o.created_at) : new Date());
          const dateStr = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
          const parsedTime = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: true });

          return {
            id: o.id,
            codigo_interno: o.codigo_interno,
            equipo: o.titulo || 'Servicio Técnico',
            tipo_mantenimiento: tipoMantto,
            ubicacion: (o.cliente as any)?.direccion || o.cliente?.nombre || 'Sede de Cliente',
            prioridad: o.prioridad || 'media',
            slaRestanteMinutos: 120,
            estado: o.estado,
            hora_inicio: parsedTime,
            fecha_asignacion: dateStr,
            lat: -12.0850 - (idx * 0.008),
            lng: -77.0300 + (idx * 0.006),
          };
        });

        setOrdenes(apiMapped);
        if (apiMapped.length > 0) {
          const activeOt = apiMapped.find(o => o.estado === 'EN_EJECUCION') || apiMapped[0];
          setSelectedMapOtId(activeOt.id);
        }
      }
    } catch (e) {
      console.warn('API fetch for technician orders failed:', e);
    } finally {
      setLoading(false);
    }
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
    /* CONTENEDOR PRINCIPAL MOBILE-FIRST (ANCHO MÁXIMO 390px-430px, CENTRADO, SIN SCROLL HORIZONTAL) */
    <div className="w-full max-w-[420px] mx-auto min-h-screen bg-zinc-50 border border-zinc-200/80 rounded-2xl sm:rounded-[24px] sm:shadow-2xl flex flex-col font-sans text-zinc-900 select-none pb-24 relative overflow-x-hidden">
      
      {/* HEADER NORMAL (HACE SCROLL JUNTO CON LA PÁGINA) */}
      <header className="bg-white border-b border-zinc-200/80 pt-4 px-4 pb-3 flex flex-col gap-2.5 shadow-2xs">
        
        {/* Título Principal 'Órdenes de Trabajo': font-bold, 28px, color text-zinc-900 (#18181B) */}
        <div className="flex items-center justify-between">
          <h1 className="text-[28px] font-bold tracking-tight text-zinc-900 leading-none">
            Órdenes de Trabajo
          </h1>

          <span className="text-[11px] font-medium text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200/80">
            {ordenes.length} Tareas
          </span>
        </div>


        {/* Etiquetas Secundarias y Fechas: font-normal, 12px-13px, color text-zinc-500 (#71717A) */}
        <div className="text-[12px] text-zinc-500 font-normal px-0.5 pt-0.5">
          <span>{secondaryDateText}</span>
        </div>
      </header>

      {/* SELECTOR DE VISTA (SEGMENTED CONTROL) */}
      <div className="px-4 pt-3 pb-1">
        <div className="bg-zinc-100 p-1 rounded-xl flex items-center h-10 max-h-[40px] w-full">
          <button
            onClick={() => setViewMode('lista')}
            className={`flex-1 flex items-center justify-center gap-1.5 h-full rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
              viewMode === 'lista'
                ? 'bg-white text-zinc-900 shadow-xs scale-[1.01]'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span>Lista</span>
          </button>

          <button
            onClick={() => setViewMode('mapa')}
            className={`flex-1 flex items-center justify-center gap-1.5 h-full rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
              viewMode === 'mapa'
                ? 'bg-white text-zinc-900 shadow-xs scale-[1.01]'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.82V8.056a1 1 0 00-1.447-.894L15 9m0 11V9m0 0L9 7" />
            </svg>
            <span>Mapa</span>
          </button>
        </div>
      </div>

      {/* LISTA DE TARJETAS */}
      <div className="px-4 py-2 space-y-3.5">
        
        {viewMode === 'lista' ? (
          loading ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white border border-zinc-200 rounded-[16px]">
              <svg className="animate-spin h-6 w-6 text-teal-600 mb-2" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-zinc-500 font-normal">Cargando órdenes de trabajo...</span>
            </div>
          ) : ordenes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-400 bg-white border border-zinc-200 rounded-[16px] p-6 text-center shadow-xs">
              <span className="text-3xl mb-2">🎉</span>
              <p className="text-sm font-semibold text-zinc-800">Sin órdenes programadas para esta fecha</p>
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
                      ? 'bg-[#FDF2E9] border-orange-200/90 shadow-xs'
                      : 'bg-white border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  {/* Fila Superior: Horario + Badge */}
                  <div className="flex items-center justify-between gap-2">
                    {/* Fecha y Hora de Asignación */}
                    <div className="flex flex-col text-[13px] font-normal text-zinc-600">
                      <div className="flex items-center gap-1.5">
                        <span>📅</span>
                        <span className="font-semibold text-zinc-800">{ot.fecha_asignacion || '04/08/2026'}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 text-zinc-500 text-xs">
                        <svg className="w-3.5 h-3.5 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{ot.hora_inicio || '09:00 AM'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Badge de Prioridad */}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border capitalize ${
                        PRIORIDAD_COLORS[ot.prioridad]?.bg || 'bg-zinc-50'
                      } ${
                        PRIORIDAD_COLORS[ot.prioridad]?.text || 'text-zinc-600'
                      } ${
                        PRIORIDAD_COLORS[ot.prioridad]?.border || 'border-zinc-200'
                      }`}>
                        {PRIORIDAD_LABELS[ot.prioridad] || ot.prioridad}
                      </span>

                      {/* Texto de Badges / Indicadores ('Active', 'On going'): font-medium, 11px-12px (text-[11px]) */}
                      {isInProgress && (
                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-50 border border-red-200/80 text-red-600 text-[11px] font-medium shadow-2xs">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                          </span>
                          <span>On going</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Títulos de Tarjetas: font-semibold, 15px-16px, color text-zinc-900 (#18181B) */}
                  <div>
                    <h3 className="text-[15px] font-semibold text-zinc-900 leading-snug truncate">
                      {ot.equipo}
                    </h3>
                  </div>

                  {/* Dirección y cuerpo primario: font-normal, 13px-14px, color text-zinc-600 (#52525B) */}
                  <div className="flex items-center gap-1.5 text-[13px] text-zinc-600 font-normal">
                    <svg className="w-3.5 h-3.5 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="truncate">{ot.ubicacion}</span>
                  </div>

                  {/* Fila Inferior con CTA */}
                  <div className="pt-2 border-t border-zinc-200/60 flex items-center justify-between text-xs">
                    <span className="font-mono text-[11px] font-normal text-zinc-500">
                      {ot.codigo_interno}
                    </span>

                    {/* Botones de Acción: font-semibold / font-medium, 14px-15px */}
                    <span className="text-[13px] font-semibold text-teal-600 flex items-center gap-1 hover:underline">
                      <span>Ver detalles</span>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
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
          <div className="bg-white border border-zinc-200 rounded-[16px] overflow-hidden shadow-xs flex flex-col relative min-h-[360px]">
            <div className="p-3 bg-zinc-900 text-white flex items-center justify-between text-xs font-semibold">
              <span>Mapa de Ruta de Servicios</span>
              <span className="text-teal-400 text-[11px] font-mono">{ordenes.length} Órdenes</span>
            </div>

            <div className="relative flex-1 bg-slate-100 min-h-[300px] flex items-center justify-center overflow-hidden">
              <svg className="absolute inset-0 w-full h-full opacity-35 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="m-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                    <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#64748B" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#m-grid)" />
              </svg>

              <div className="absolute inset-0 p-6 flex flex-col items-center justify-around z-10 pointer-events-auto">
                {ordenes.map((ot, idx) => (
                  <button
                    key={ot.id}
                    onClick={() => setSelectedMapOtId(ot.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold shadow-md border transition-all ${
                      ot.estado === 'EN_EJECUCION'
                        ? 'bg-red-500 text-white border-red-600 animate-bounce'
                        : 'bg-white text-zinc-800 border-zinc-300'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-teal-500" />
                    <span>#{idx + 1} {ot.codigo_interno}</span>
                  </button>
                ))}
              </div>

              {currentMapOt && (
                <div className="absolute bottom-2 left-2 right-2 bg-white border border-zinc-200 rounded-xl p-3 shadow-lg z-20 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-zinc-900 truncate">{currentMapOt.equipo}</p>
                    <p className="text-[12px] font-normal text-zinc-500 truncate">{currentMapOt.ubicacion}</p>
                  </div>
                  <button
                    onClick={() => router.push(`/tecnico/ordenes/${currentMapOt.id}`)}
                    className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer"
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
