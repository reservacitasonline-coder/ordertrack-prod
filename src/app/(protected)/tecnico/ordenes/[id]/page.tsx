'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { OrdenTrabajo } from '@/types';

interface MockOT {
  id: number;
  codigo_interno: string;
  equipo: string;
  ubicacion: string;
  prioridad: 'critica' | 'alta' | 'media' | 'baja';
  slaRestanteMinutos: number;
  estado: string;
}

interface ProgressState {
  currentStep: number; // 1 to 5
  aceptada: boolean;
  aceptadaFecha?: string;
  aceptadaHora?: string;
  aceptadaGps?: string;
  seguridadRespuestas: Record<string, 'si' | 'no'>; // index -> value
  checklistRespuestas: Record<string, 'correcto' | 'pendiente'>; // index -> value
  repuestosCantidades: Record<string, number>; // name -> quantity
  noRepuestosUsed: boolean;
  firmaSaved: boolean;
  firmaDataUrl?: string;
}

const SAFETY_QUESTIONS = [
  '¿Bloqueo de energía aplicado?',
  '¿EPP completo?',
  '¿Área asegurada y señalizada?',
];

const CHECKLIST_ITEMS = [
  'Revisar fugas',
  'Presión correcta',
  'Cableado en buen estado',
  'Temperatura dentro de rango',
];

const SPARES_ITEMS = [
  'Filtro de aire',
  'Correa',
  'Aceite compresor',
];

const formatSLA = (minutos: number) => {
  if (minutos <= 0) return 'SLA Vencido';
  if (minutos < 60) return `${minutos} min`;
  const hrs = Math.floor(minutos / 60);
  const mins = minutos % 60;
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
};

export default function TecnicoOrdenDetallePage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);

  const [ot, setOt] = useState<MockOT | null>(null);
  const [loading, setLoading] = useState(true);

  // Flow State
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [aceptada, setAceptada] = useState<boolean>(false);
  const [aceptadaInfo, setAceptadaInfo] = useState<{ fecha: string; hora: string; gps: string } | null>(null);
  const [seguridadRespuestas, setSeguridadRespuestas] = useState<Record<number, 'si' | 'no'>>({});
  const [checklistRespuestas, setChecklistRespuestas] = useState<Record<number, 'correcto' | 'pendiente'>>({});
  const [repuestosCantidades, setRepuestosCantidades] = useState<Record<string, number>>({
    'Filtro de aire': 0,
    'Correa': 0,
    'Aceite compresor': 0,
  });
  const [noRepuestosUsed, setNoRepuestosUsed] = useState<boolean>(false);
  const [firmaSaved, setFirmaSaved] = useState<boolean>(false);
  const [firmaDataUrl, setFirmaDataUrl] = useState<string | undefined>(undefined);

  // Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Load OT and Progress
  useEffect(() => {
    async function loadOtDetail() {
      setLoading(true);
      const storedOts = localStorage.getItem('mock_tecnico_ordenes');
      let foundOt: MockOT | null = null;
      if (storedOts) {
        try {
          const ots: MockOT[] = JSON.parse(storedOts);
          foundOt = ots.find((o) => o.id === id) || null;
        } catch {}
      }

      if (!foundOt && id) {
        try {
          const apiOt = await apiFetch<OrdenTrabajo>(`/ordenes/${id}`);
          if (apiOt) {
            foundOt = {
              id: apiOt.id,
              codigo_interno: apiOt.codigo_interno,
              equipo: apiOt.titulo || 'Servicio Técnico',
              ubicacion: apiOt.cliente?.direccion || apiOt.cliente?.nombre || 'Sede de Cliente',
              prioridad: (apiOt.prioridad as any) || 'media',
              slaRestanteMinutos: 180,
              estado: apiOt.estado,
            };
          }
        } catch (e) {
          console.warn('Could not fetch OT detail from API:', e);
        }
      }

      setOt(foundOt);
      setLoading(false);
    }

    loadOtDetail();

    // Load progress from localStorage
    const progressKey = `mock_ot_progress_${id}`;
    const storedProgress = localStorage.getItem(progressKey);
    if (storedProgress) {
      try {
        const progress: ProgressState = JSON.parse(storedProgress);
        setCurrentStep(progress.currentStep || 1);
        setAceptada(progress.aceptada || false);
        if (progress.aceptadaFecha && progress.aceptadaHora) {
          setAceptadaInfo({
            fecha: progress.aceptadaFecha,
            hora: progress.aceptadaHora,
            gps: progress.aceptadaGps || '',
          });
        }
        setSeguridadRespuestas(progress.seguridadRespuestas as any || {});
        setChecklistRespuestas(progress.checklistRespuestas as any || {});
        setRepuestosCantidades(progress.repuestosCantidades || {
          'Filtro de aire': 0,
          'Correa': 0,
          'Aceite compresor': 0,
        });
        setNoRepuestosUsed(progress.noRepuestosUsed || false);
        setFirmaSaved(progress.firmaSaved || false);
        setFirmaDataUrl(progress.firmaDataUrl);
      } catch (e) {
        console.error('Error loading progress', e);
      }
    }
    setLoading(false);
  }, [id]);

  // Save Progress whenever state changes
  const saveProgress = (updatedFields: Partial<ProgressState>) => {
    const progressKey = `mock_ot_progress_${id}`;
    const currentStored = localStorage.getItem(progressKey);
    let current: Partial<ProgressState> = {};
    if (currentStored) {
      current = JSON.parse(currentStored);
    }

    const nextState: ProgressState = {
      currentStep: updatedFields.currentStep ?? current.currentStep ?? currentStep,
      aceptada: updatedFields.aceptada ?? current.aceptada ?? aceptada,
      aceptadaFecha: updatedFields.aceptadaFecha ?? current.aceptadaFecha ?? aceptadaInfo?.fecha,
      aceptadaHora: updatedFields.aceptadaHora ?? current.aceptadaHora ?? aceptadaInfo?.hora,
      aceptadaGps: updatedFields.aceptadaGps ?? current.aceptadaGps ?? aceptadaInfo?.gps,
      seguridadRespuestas: updatedFields.seguridadRespuestas ?? current.seguridadRespuestas ?? (seguridadRespuestas as any),
      checklistRespuestas: updatedFields.checklistRespuestas ?? current.checklistRespuestas ?? (checklistRespuestas as any),
      repuestosCantidades: updatedFields.repuestosCantidades ?? current.repuestosCantidades ?? repuestosCantidades,
      noRepuestosUsed: updatedFields.noRepuestosUsed ?? current.noRepuestosUsed ?? noRepuestosUsed,
      firmaSaved: updatedFields.firmaSaved ?? current.firmaSaved ?? firmaSaved,
      firmaDataUrl: updatedFields.firmaDataUrl ?? current.firmaDataUrl ?? firmaDataUrl,
    };

    localStorage.setItem(progressKey, JSON.stringify(nextState));
  };

  // Step 1 Actions
  const handleAceptar = () => {
    const now = new Date();
    const fecha = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const gps = 'Lat: -12.046374, Lng: -77.042793'; // Mock GPS coordinates

    setAceptada(true);
    setAceptadaInfo({ fecha, hora, gps });

    saveProgress({
      aceptada: true,
      aceptadaFecha: fecha,
      aceptadaHora: hora,
      aceptadaGps: gps,
    });
  };

  const handleAceptarYSalir = () => {
    if (!aceptada) {
      handleAceptar();
    }
    router.push('/tecnico');
  };

  // Step 2 Actions
  const handleSeguridadRespuesta = (index: number, val: 'si' | 'no') => {
    const updated = { ...seguridadRespuestas, [index]: val };
    setSeguridadRespuestas(updated);
    saveProgress({ seguridadRespuestas: updated as any });
  };

  // Step 3 Actions
  const handleChecklistRespuesta = (index: number, val: 'correcto' | 'pendiente') => {
    const updated = { ...checklistRespuestas, [index]: val };
    setChecklistRespuestas(updated);
    saveProgress({ checklistRespuestas: updated as any });
  };

  // Step 4 Actions
  const handleQuantityChange = (spare: string, diff: number) => {
    if (noRepuestosUsed) return;
    const currentQty = repuestosCantidades[spare] || 0;
    const newQty = Math.max(0, currentQty + diff);
    const updated = { ...repuestosCantidades, [spare]: newQty };
    setRepuestosCantidades(updated);
    saveProgress({ repuestosCantidades: updated });
  };

  const handleToggleNoRepuestos = () => {
    const nextVal = !noRepuestosUsed;
    setNoRepuestosUsed(nextVal);
    let updatedQty = { ...repuestosCantidades };
    if (nextVal) {
      // Clear quantities if checked
      Object.keys(repuestosCantidades).forEach((k) => {
        updatedQty[k] = 0;
      });
      setRepuestosCantidades(updatedQty);
    }
    saveProgress({
      noRepuestosUsed: nextVal,
      repuestosCantidades: updatedQty,
    });
  };

  // Step 5 Canvas Drawing Logic
  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = '#18181b'; // zinc-900
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    // Auto-save signature
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL();
      setFirmaSaved(true);
      setFirmaDataUrl(dataUrl);
      saveProgress({
        firmaSaved: true,
        firmaDataUrl: dataUrl,
      });
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setFirmaSaved(false);
    setFirmaDataUrl(undefined);
    saveProgress({
      firmaSaved: false,
      firmaDataUrl: undefined,
    });
  };

  // Resize canvas display mapping
  useEffect(() => {
    if (currentStep === 5 && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = canvas.parentElement?.clientWidth || 350;
      canvas.height = 180;
      const ctx = canvas.getContext('2d');
      if (ctx && firmaDataUrl) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
        };
        img.src = firmaDataUrl;
      }
    }
  }, [currentStep, firmaDataUrl]);

  // Validation Checkers
  const isStep1Valid = aceptada;
  const isStep2Valid = SAFETY_QUESTIONS.every((_, idx) => seguridadRespuestas[idx] !== undefined);
  const isStep3Valid = CHECKLIST_ITEMS.every((_, idx) => checklistRespuestas[idx] !== undefined);

  const totalSparesQty = Object.values(repuestosCantidades).reduce((sum, val) => sum + val, 0);
  const isStep4Valid = noRepuestosUsed || totalSparesQty > 0;
  const hasSparesPending = !noRepuestosUsed && totalSparesQty === 0;

  const isStep5Valid = isStep1Valid && isStep2Valid && isStep3Valid && isStep4Valid && firmaSaved;

  // Step transitions
  const handleNext = () => {
    if (currentStep === 1 && !isStep1Valid) return;
    if (currentStep === 2 && !isStep2Valid) return;
    if (currentStep === 3 && !isStep3Valid) return;
    if (currentStep === 4 && !isStep4Valid) return;

    if (currentStep < 5) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      saveProgress({ currentStep: nextStep });
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      saveProgress({ currentStep: prevStep });
    } else {
      router.push('/tecnico');
    }
  };

  const handleFinalizar = () => {
    if (!isStep5Valid) return;

    // Retrieve active OTs, change status of the current one to COMPLETADA
    const storedOts = localStorage.getItem('mock_tecnico_ordenes');
    if (storedOts) {
      const ots: MockOT[] = JSON.parse(storedOts);
      const updated = ots.map((o) => {
        if (o.id === id) {
          return { ...o, estado: 'COMPLETADA' };
        }
        return o;
      });
      localStorage.setItem('mock_tecnico_ordenes', JSON.stringify(updated));
    }

    // Clean up local OT progress
    localStorage.removeItem(`mock_ot_progress_${id}`);

    alert('¡Orden de Trabajo finalizada con éxito!');
    router.push('/tecnico');
  };

  if (loading) {
    return (
      <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center p-8 bg-zinc-50 min-h-[calc(100vh-8rem)] rounded-2xl border border-zinc-200">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-zinc-900"></div>
        <p className="text-sm font-semibold text-zinc-500 mt-4">Cargando detalles de la orden...</p>
      </div>
    );
  }

  if (!ot) {
    return (
      <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center p-8 bg-zinc-50 min-h-[calc(100vh-8rem)] rounded-2xl border border-zinc-200 text-center">
        <span className="text-4xl mb-4">⚠️</span>
        <h2 className="text-lg font-black text-zinc-950">Orden de Trabajo no encontrada</h2>
        <button
          onClick={() => router.push('/tecnico')}
          className="mt-6 h-12 w-full bg-zinc-900 text-white rounded-xl text-sm font-black shadow-sm"
        >
          Regresar a la bandeja
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-5 p-4 text-zinc-900 bg-zinc-50 min-h-[calc(100vh-8rem)] rounded-2xl shadow-xs border border-zinc-200 relative pb-28">
      {/* Top Header details */}
      <div className="flex flex-col gap-3 pb-3 border-b border-zinc-200 mt-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-base font-black text-zinc-800 bg-zinc-150 border border-zinc-200 px-3 py-1 rounded-lg">
            {ot.codigo_interno}
          </span>
          <span className="text-xs text-zinc-450 font-bold uppercase tracking-wider">
            {formatSLA(ot.slaRestanteMinutos)} restantes
          </span>
        </div>

        {/* 5-Step Progress Bar */}
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex items-center justify-between relative px-2">
            {/* Background line */}
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-zinc-200 -translate-y-1/2 -z-0"></div>
            {/* Highlighted progress line */}
            <div
              className="absolute top-1/2 left-0 h-1 bg-zinc-900 -translate-y-1/2 -z-0 transition-all duration-300"
              style={{ width: `${((currentStep - 1) / 4) * 100}%` }}
            ></div>

            {/* Stepper buttons (Read-only representation) */}
            {[1, 2, 3, 4, 5].map((stepNum) => {
              const isActive = currentStep === stepNum;
              const isPassed = currentStep > stepNum;
              return (
                <div
                  key={stepNum}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black z-10 border-2 transition-all ${
                    isActive
                      ? 'bg-zinc-950 border-zinc-950 text-white shadow-md ring-4 ring-zinc-200'
                      : isPassed
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-white border-zinc-300 text-zinc-400'
                  }`}
                >
                  {isPassed ? '✓' : stepNum}
                </div>
              );
            })}
          </div>

          {/* Active Step Label */}
          <div className="flex justify-between text-[11px] font-black uppercase tracking-wider text-zinc-400 px-1 mt-1">
            <span className={currentStep === 1 ? 'text-zinc-950 font-extrabold' : ''}>Aceptar</span>
            <span className={currentStep === 2 ? 'text-zinc-950 font-extrabold' : ''}>Seguridad</span>
            <span className={currentStep === 3 ? 'text-zinc-950 font-extrabold' : ''}>Checklist</span>
            <span className={currentStep === 4 ? 'text-zinc-950 font-extrabold' : ''}>Repuestos</span>
            <span className={currentStep === 5 ? 'text-zinc-950 font-extrabold' : ''}>Cierre</span>
          </div>
        </div>
      </div>

      {/* STEP CONTENT CONTAINER */}
      <div className="flex-1 flex flex-col gap-4">
        {/* PASO 1: ACEPTAR */}
        {currentStep === 1 && (
          <div className="flex flex-col gap-5">
            <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-3xs flex flex-col gap-3">
              <span className="text-xs text-zinc-450 font-bold uppercase tracking-wider">Detalles de la Orden</span>
              <div className="flex flex-col gap-2.5">
                <div className="flex justify-between border-b border-zinc-100 pb-2">
                  <span className="text-zinc-500 font-medium">Equipo:</span>
                  <span className="text-zinc-900 font-black text-right">{ot.equipo}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-100 pb-2">
                  <span className="text-zinc-500 font-medium">Ubicación:</span>
                  <span className="text-zinc-900 font-black text-right">{ot.ubicacion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-medium">SLA:</span>
                  <span className="text-red-650 font-black text-right">⏱️ {formatSLA(ot.slaRestanteMinutos)}</span>
                </div>
              </div>
            </div>

            {/* Representative Icon Center */}
            <div className="flex flex-col items-center justify-center py-6 bg-white border border-zinc-200 rounded-2xl shadow-3xs">
              <div className="w-24 h-24 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-4xl mb-3 shadow-inner">
                📥
              </div>
              <p className="text-sm text-zinc-500 font-bold uppercase tracking-wide">Aceptación de OT</p>
            </div>

            {/* Aceptada Notification Info */}
            {aceptada ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col gap-2.5 shadow-3xs text-emerald-950">
                <div className="flex items-center gap-2 font-black text-sm">
                  <span className="text-lg">✅</span>
                  OT Aceptada Exitosamente
                </div>
                <div className="text-xs font-semibold leading-relaxed flex flex-col gap-0.5 pl-7">
                  <p>📅 Fecha: {aceptadaInfo?.fecha}</p>
                  <p>⏰ Hora: {aceptadaInfo?.hora}</p>
                  <p>📍 GPS: {aceptadaInfo?.gps}</p>
                  <p className="text-[10px] text-emerald-700 italic font-medium mt-1">La información fue registrada automáticamente.</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleAceptar}
                  className="w-full h-14 bg-zinc-900 hover:bg-zinc-950 text-white rounded-xl text-base font-black shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  🚀 Aceptar OT
                </button>
                <button
                  onClick={handleAceptarYSalir}
                  className="w-full h-14 bg-white border border-zinc-250 text-zinc-700 hover:bg-zinc-50 rounded-xl text-base font-black active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                >
                  Aceptar y salir
                </button>
              </div>
            )}
          </div>
        )}

        {/* PASO 2: SEGURIDAD */}
        {currentStep === 2 && (
          <div className="flex flex-col gap-4">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 items-start shadow-3xs text-amber-950">
              <span className="text-xl shrink-0">🛡️</span>
              <p className="text-xs font-semibold leading-relaxed">
                Todas las validaciones de seguridad son obligatorias para avanzar a los trabajos técnicos.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {SAFETY_QUESTIONS.map((pregunta, idx) => {
                const ans = seguridadRespuestas[idx];
                return (
                  <div
                    key={idx}
                    className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-3xs flex flex-col gap-4"
                  >
                    <span className="text-base font-black text-zinc-900 leading-snug">
                      {pregunta}
                    </span>
                    <div className="grid grid-cols-2 gap-3.5">
                      <button
                        onClick={() => handleSeguridadRespuesta(idx, 'si')}
                        className={`h-14 rounded-xl text-sm font-black border transition-all cursor-pointer ${
                          ans === 'si'
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                            : 'bg-white border-zinc-250 text-zinc-700 hover:bg-zinc-50'
                        }`}
                      >
                        Sí
                      </button>
                      <button
                        onClick={() => handleSeguridadRespuesta(idx, 'no')}
                        className={`h-14 rounded-xl text-sm font-black border transition-all cursor-pointer ${
                          ans === 'no'
                            ? 'bg-red-650 border-red-650 text-white shadow-sm'
                            : 'bg-white border-zinc-250 text-zinc-700 hover:bg-zinc-50'
                        }`}
                      >
                        No
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PASO 3: CHECKLIST */}
        {currentStep === 3 && (
          <div className="flex flex-col gap-4">
            <div className="bg-zinc-100 border border-zinc-200 rounded-2xl p-4 flex gap-3 items-start shadow-3xs text-zinc-700">
              <span className="text-xl shrink-0">📋</span>
              <p className="text-xs font-semibold leading-relaxed">
                Complete el checklist de inspección técnica en terreno. Todos los elementos deben responderse.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {CHECKLIST_ITEMS.map((item, idx) => {
                const ans = checklistRespuestas[idx];
                return (
                  <div
                    key={idx}
                    className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-3xs flex flex-col gap-4"
                  >
                    <span className="text-base font-black text-zinc-900 leading-snug">
                      {item}
                    </span>
                    <div className="grid grid-cols-2 gap-3.5">
                      <button
                        onClick={() => handleChecklistRespuesta(idx, 'correcto')}
                        className={`h-14 rounded-xl text-sm font-black border transition-all cursor-pointer ${
                          ans === 'correcto'
                            ? 'bg-zinc-900 border-zinc-950 text-white shadow-sm'
                            : 'bg-white border-zinc-250 text-zinc-700 hover:bg-zinc-50'
                        }`}
                      >
                        Correcto
                      </button>
                      <button
                        onClick={() => handleChecklistRespuesta(idx, 'pendiente')}
                        className={`h-14 rounded-xl text-sm font-black border transition-all cursor-pointer ${
                          ans === 'pendiente'
                            ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                            : 'bg-white border-zinc-250 text-zinc-700 hover:bg-zinc-50'
                        }`}
                      >
                        Pendiente
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PASO 4: REPUESTOS */}
        {currentStep === 4 && (
          <div className="flex flex-col gap-4">
            {hasSparesPending && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3 items-start shadow-3xs text-red-950">
                <span className="text-xl shrink-0">⚠️</span>
                <p className="text-xs font-semibold leading-relaxed">
                  <strong>Faltan registrar repuestos:</strong> La OT no podrá cerrarse hasta declarar si se utilizaron repuestos.
                </p>
              </div>
            )}

            {/* List of Spares */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-3xs flex flex-col gap-4">
              <span className="text-xs text-zinc-450 font-bold uppercase tracking-wider border-b border-zinc-100 pb-2">
                Repuestos de Inventario
              </span>

              <div className="flex flex-col gap-4.5 divide-y divide-zinc-100">
                {SPARES_ITEMS.map((spare) => {
                  const qty = repuestosCantidades[spare] || 0;
                  return (
                    <div key={spare} className="flex items-center justify-between pt-4.5 first:pt-0">
                      <span className="text-base font-black text-zinc-900">{spare}</span>
                      <div className="flex items-center gap-4">
                        <button
                          disabled={noRepuestosUsed}
                          onClick={() => handleQuantityChange(spare, -1)}
                          className="w-12 h-12 rounded-xl bg-zinc-100 border border-zinc-200 hover:bg-zinc-200 font-black text-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center select-none active:scale-90 transition-all"
                        >
                          -
                        </button>
                        <span className="font-mono text-lg font-black w-8 text-center">{qty}</span>
                        <button
                          disabled={noRepuestosUsed}
                          onClick={() => handleQuantityChange(spare, 1)}
                          className="w-12 h-12 rounded-xl bg-zinc-100 border border-zinc-200 hover:bg-zinc-200 font-black text-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center select-none active:scale-90 transition-all"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Option Checkbox */}
            <button
              onClick={handleToggleNoRepuestos}
              className={`w-full p-4 border rounded-2xl font-black text-sm flex items-center justify-between transition-all active:scale-[0.99] cursor-pointer ${
                noRepuestosUsed
                  ? 'bg-zinc-900 border-zinc-900 text-white'
                  : 'bg-white border-zinc-250 text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              <span>No utilicé repuestos</span>
              <div
                className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center text-xs ${
                  noRepuestosUsed ? 'bg-white border-white text-zinc-900 font-black' : 'border-zinc-300'
                }`}
              >
                {noRepuestosUsed && '✓'}
              </div>
            </button>
          </div>
        )}

        {/* PASO 5: CIERRE */}
        {currentStep === 5 && (
          <div className="flex flex-col gap-4">
            {/* Final validations notification list if any is missing */}
            {!isStep5Valid && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col gap-2.5 shadow-3xs text-red-950">
                <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider">
                  ⚠️ Requisitos de cierre pendientes:
                </div>
                <ul className="text-xs font-semibold list-disc pl-5 flex flex-col gap-1">
                  {!isStep1Valid && <li>Falta aceptación de la orden (Paso 1)</li>}
                  {!isStep2Valid && <li>Falta completar checklist de seguridad (Paso 2)</li>}
                  {!isStep3Valid && <li>Falta completar checklist técnico (Paso 3)</li>}
                  {!isStep4Valid && <li>Falta registrar repuestos o declarar que no se usaron (Paso 4)</li>}
                  {!firmaSaved && <li>Falta registrar la firma digital de conformidad</li>}
                </ul>
              </div>
            )}

            <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-3xs flex flex-col gap-4">
              <span className="text-xs text-zinc-450 font-bold uppercase tracking-wider border-b border-zinc-100 pb-2">
                Firma digital
              </span>

              {/* Digital signature canvas area */}
              <div className="border border-zinc-250 bg-zinc-50 rounded-xl overflow-hidden touch-none relative">
                <canvas
                  ref={canvasRef}
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerLeave={stopDrawing}
                  className="w-full h-[180px] block cursor-crosshair"
                />
                {!firmaSaved && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs text-zinc-400 font-medium">
                    Firme aquí con el dedo o lápiz
                  </div>
                )}
              </div>

              <button
                onClick={clearSignature}
                className="w-full h-11 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-xl text-xs font-bold text-zinc-500 hover:text-zinc-800 transition-all cursor-pointer active:scale-95"
              >
                Borrar firma
              </button>
            </div>

            {/* Finalize Button */}
            <button
              disabled={!isStep5Valid}
              onClick={handleFinalizar}
              className={`w-full h-14 rounded-xl text-base font-black shadow-md flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                isStep5Valid
                  ? 'bg-zinc-900 hover:bg-zinc-950 text-white'
                  : 'bg-zinc-200 text-zinc-400 border border-zinc-300 cursor-not-allowed'
              }`}
            >
              Finalizar OT
            </button>
          </div>
        )}
      </div>

      {/* LINEAR NAVIGATION FOOTER (Atrás / Siguiente) */}
      <div className="absolute bottom-4 left-4 right-4 bg-zinc-50 pt-2 border-t border-zinc-200 flex gap-4">
        {/* Atrás button */}
        <button
          onClick={handlePrev}
          className="w-1/3 h-14 bg-white border border-zinc-250 text-zinc-700 hover:bg-zinc-50 rounded-xl text-base font-black transition-all active:scale-95 cursor-pointer flex items-center justify-center"
        >
          {currentStep === 1 ? 'Salir' : 'Atrás'}
        </button>

        {/* Siguiente / Continuar button */}
        {currentStep < 5 && (
          <button
            disabled={
              (currentStep === 1 && !isStep1Valid) ||
              (currentStep === 2 && !isStep2Valid) ||
              (currentStep === 3 && !isStep3Valid) ||
              (currentStep === 4 && !isStep4Valid)
            }
            onClick={handleNext}
            className={`w-2/3 h-14 rounded-xl text-base font-black shadow-sm flex items-center justify-center transition-all active:scale-95 ${
              (currentStep === 1 && !isStep1Valid) ||
              (currentStep === 2 && !isStep2Valid) ||
              (currentStep === 3 && !isStep3Valid) ||
              (currentStep === 4 && !isStep4Valid)
                ? 'bg-zinc-200 text-zinc-400 border border-zinc-300 cursor-not-allowed'
                : 'bg-zinc-900 hover:bg-zinc-950 text-white cursor-pointer'
            }`}
          >
            Siguiente
          </button>
        )}
      </div>
    </div>
  );
}
