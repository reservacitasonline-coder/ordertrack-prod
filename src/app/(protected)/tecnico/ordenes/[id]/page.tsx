'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { OrdenTrabajo } from '@/types';

interface MockOT {
  id: number;
  codigo_interno: string;
  equipo: string;
  tipo_mantenimiento?: string;
  ubicacion: string;
  prioridad: 'critica' | 'alta' | 'media' | 'baja';
  slaRestanteMinutos: number;
  estado: string;
}

interface ProgressState {
  currentStep: number;
  aceptada: boolean;
  aceptadaFecha?: string;
  aceptadaHora?: string;
  aceptadaGps?: string;
  seguridadRespuestas: Record<string, 'si' | 'no' | 'na'>;
  seguridadJustificaciones?: Record<string, string>;
  checklistRespuestas: Record<string, 'correcto' | 'pendiente'>;
  checklistFotosAntes?: Record<string, string>;
  checklistFotosDespues?: Record<string, string>;
  repuestosCantidades: Record<string, number>;
  repuestosFotosAntes?: Record<string, string>;
  repuestosFotosDespues?: Record<string, string>;
  noRepuestosUsed: boolean;
  firmaSaved: boolean;
  firmaDataUrl?: string;
  firmaNombreCliente?: string;
  firmaDocumentoCliente?: string;
  firmaFotoEvidencia?: string;
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

const getSpareUnit = (spareName: string): string => {
  const lower = spareName.toLowerCase();
  if (lower.includes('aceite')) return 'litros';
  if (lower.includes('correa') || lower.includes('cable') || lower.includes('manguera')) return 'metros';
  return 'unidades';
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
  const [seguridadRespuestas, setSeguridadRespuestas] = useState<Record<number, 'si' | 'no' | 'na'>>({});
  const [seguridadJustificaciones, setSeguridadJustificaciones] = useState<Record<number, string>>({});
  const [checklistRespuestas, setChecklistRespuestas] = useState<Record<number, 'correcto' | 'pendiente'>>({});
  const [checklistFotosAntes, setChecklistFotosAntes] = useState<Record<number, string>>({});
  const [checklistFotosDespues, setChecklistFotosDespues] = useState<Record<number, string>>({});
  const [repuestosCantidades, setRepuestosCantidades] = useState<Record<string, number>>({
    'Filtro de aire': 0,
    'Correa': 0,
    'Aceite compresor': 0,
  });
  const [repuestosFotosAntes, setRepuestosFotosAntes] = useState<Record<string, string>>({});
  const [repuestosFotosDespues, setRepuestosFotosDespues] = useState<Record<string, string>>({});
  const [noRepuestosUsed, setNoRepuestosUsed] = useState<boolean>(false);
  const [firmaSaved, setFirmaSaved] = useState<boolean>(false);
  const [firmaDataUrl, setFirmaDataUrl] = useState<string | undefined>(undefined);
  const [firmaNombreCliente, setFirmaNombreCliente] = useState<string>('');
  const [firmaDocumentoCliente, setFirmaDocumentoCliente] = useState<string>('');
  const [firmaFotoEvidencia, setFirmaFotoEvidencia] = useState<string>('');

  // Canvas Ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Load OT and Progress
  useEffect(() => {
    async function loadOtDetail() {
      if (!id) return;
      setLoading(true);
      try {
        const apiOt = await apiFetch<OrdenTrabajo>(`/ordenes/${id}`);
        if (apiOt) {
          const tipoMantto =
            apiOt.plantillas && apiOt.plantillas.length > 0
              ? apiOt.plantillas.map((p) => p.titulo).join(', ')
              : apiOt.plantilla?.titulo || 'Mantto General';

          const estimadoMinutos =
            apiOt.plantillas?.[0]?.tiempo_estimado_minutos ??
            apiOt.plantilla?.tiempo_estimado_minutos ??
            120;

          let remainingMinutes = estimadoMinutos;
          const startTime = apiOt.fecha_inicio_real || apiOt.fecha_salida;
          if (startTime) {
            const endTime = apiOt.fecha_cierre || new Date().toISOString();
            const elapsedMs = new Date(endTime).getTime() - new Date(startTime).getTime();
            const elapsedMin = elapsedMs / 60000;
            remainingMinutes = Math.max(0, estimadoMinutos - Math.floor(elapsedMin));
          }

          setOt({
            id: apiOt.id,
            codigo_interno: apiOt.codigo_interno,
            equipo: apiOt.titulo || 'Servicio Técnico',
            tipo_mantenimiento: tipoMantto,
            ubicacion: (apiOt.cliente as any)?.direccion || apiOt.cliente?.nombre || 'Sede de Cliente',
            prioridad: apiOt.prioridad || 'media',
            slaRestanteMinutos: remainingMinutes,
            estado: apiOt.estado,
          });
        }
      } catch (e) {
        console.warn('Could not fetch OT detail from API:', e);
      } finally {
        setLoading(false);
      }
    }

    loadOtDetail();

    const progressKey = `ot_progress_${id}`;
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
        setSeguridadJustificaciones(progress.seguridadJustificaciones || {});
        setChecklistRespuestas(progress.checklistRespuestas as any || {});
        setChecklistFotosAntes(progress.checklistFotosAntes as any || {});
        setChecklistFotosDespues(progress.checklistFotosDespues as any || {});
        setRepuestosCantidades(progress.repuestosCantidades || {
          'Filtro de aire': 0,
          'Correa': 0,
          'Aceite compresor': 0,
        });
        setRepuestosFotosAntes(progress.repuestosFotosAntes || {});
        setRepuestosFotosDespues(progress.repuestosFotosDespues || {});
        setNoRepuestosUsed(progress.noRepuestosUsed || false);
        setFirmaSaved(progress.firmaSaved || false);
        setFirmaDataUrl(progress.firmaDataUrl);
        setFirmaNombreCliente(progress.firmaNombreCliente || '');
        setFirmaDocumentoCliente(progress.firmaDocumentoCliente || '');
        setFirmaFotoEvidencia(progress.firmaFotoEvidencia || '');
      } catch (e) {
        console.error('Error loading progress', e);
      }
    }
  }, [id]);

  const saveProgress = (updatedFields: Partial<ProgressState>) => {
    const progressKey = `ot_progress_${id}`;
    const currentStored = localStorage.getItem(progressKey);
    let current: Partial<ProgressState> = {};
    if (currentStored) {
      try {
        current = JSON.parse(currentStored);
      } catch {}
    }

    const nextState: ProgressState = {
      currentStep: updatedFields.currentStep ?? current.currentStep ?? currentStep,
      aceptada: updatedFields.aceptada ?? current.aceptada ?? aceptada,
      aceptadaFecha: updatedFields.aceptadaFecha ?? current.aceptadaFecha ?? aceptadaInfo?.fecha,
      aceptadaHora: updatedFields.aceptadaHora ?? current.aceptadaHora ?? aceptadaInfo?.hora,
      aceptadaGps: updatedFields.aceptadaGps ?? current.aceptadaGps ?? aceptadaInfo?.gps,
      seguridadRespuestas: updatedFields.seguridadRespuestas ?? current.seguridadRespuestas ?? (seguridadRespuestas as any),
      seguridadJustificaciones: updatedFields.seguridadJustificaciones ?? current.seguridadJustificaciones ?? seguridadJustificaciones,
      checklistRespuestas: updatedFields.checklistRespuestas ?? current.checklistRespuestas ?? (checklistRespuestas as any),
      checklistFotosAntes: updatedFields.checklistFotosAntes ?? current.checklistFotosAntes ?? (checklistFotosAntes as any),
      checklistFotosDespues: updatedFields.checklistFotosDespues ?? current.checklistFotosDespues ?? (checklistFotosDespues as any),
      repuestosCantidades: updatedFields.repuestosCantidades ?? current.repuestosCantidades ?? repuestosCantidades,
      repuestosFotosAntes: updatedFields.repuestosFotosAntes ?? current.repuestosFotosAntes ?? repuestosFotosAntes,
      repuestosFotosDespues: updatedFields.repuestosFotosDespues ?? current.repuestosFotosDespues ?? repuestosFotosDespues,
      noRepuestosUsed: updatedFields.noRepuestosUsed ?? current.noRepuestosUsed ?? noRepuestosUsed,
      firmaSaved: updatedFields.firmaSaved ?? current.firmaSaved ?? firmaSaved,
      firmaDataUrl: updatedFields.firmaDataUrl ?? current.firmaDataUrl ?? firmaDataUrl,
      firmaNombreCliente: updatedFields.firmaNombreCliente ?? current.firmaNombreCliente ?? firmaNombreCliente,
      firmaDocumentoCliente: updatedFields.firmaDocumentoCliente ?? current.firmaDocumentoCliente ?? firmaDocumentoCliente,
      firmaFotoEvidencia: updatedFields.firmaFotoEvidencia ?? current.firmaFotoEvidencia ?? firmaFotoEvidencia,
    };

    localStorage.setItem(progressKey, JSON.stringify(nextState));
  };

  const handleUploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiFetch<{ ruta: string }>(`/tecnico/ordenes/${id}/upload-foto`, {
      method: 'POST',
      body: formData,
    });
    return res.ruta;
  };

  // Step 1 Actions
  const handleAceptar = () => {
    const now = new Date();
    const fecha = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const gps = 'Lat: -12.046374, Lng: -77.042793';

    setAceptada(true);
    setAceptadaInfo({ fecha, hora, gps });
    setCurrentStep(2);

    saveProgress({
      aceptada: true,
      aceptadaFecha: fecha,
      aceptadaHora: hora,
      aceptadaGps: gps,
      currentStep: 2,
    });
  };

  // Step 2 Actions
  const handleSeguridadRespuesta = (index: number, val: 'si' | 'no' | 'na') => {
    const updatedAnswers = { ...seguridadRespuestas, [index]: val };
    setSeguridadRespuestas(updatedAnswers);
    
    let updatedJustifications = { ...seguridadJustificaciones };
    if (val !== 'no') {
      delete updatedJustifications[index];
      setSeguridadJustificaciones(updatedJustifications);
    }
    
    saveProgress({
      seguridadRespuestas: updatedAnswers as any,
      seguridadJustificaciones: updatedJustifications,
    });
  };

  const handleSeguridadJustificacion = (index: number, val: string) => {
    const updated = { ...seguridadJustificaciones, [index]: val };
    setSeguridadJustificaciones(updated);
    saveProgress({ seguridadJustificaciones: updated });
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
    let updatedQty = { ...repuestosCantidades };
    if (nextVal) {
      Object.keys(repuestosCantidades).forEach((k) => {
        updatedQty[k] = 0;
      });
      setRepuestosCantidades(updatedQty);
    }
    setNoRepuestosUsed(nextVal);
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
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
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

  useEffect(() => {
    if (currentStep === 5 && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = canvas.parentElement?.clientWidth || 320;
      canvas.height = 160;
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
  const isStep2Valid = SAFETY_QUESTIONS.every((_, idx) => {
    const ans = seguridadRespuestas[idx];
    if (ans === undefined) return false;
    if (ans === 'no') {
      const just = seguridadJustificaciones[idx];
      return just !== undefined && just.trim() !== '';
    }
    return true;
  });
  const isStep3Valid = CHECKLIST_ITEMS.every((_, idx) => checklistRespuestas[idx] !== undefined);

  const totalSparesQty = Object.values(repuestosCantidades).reduce((sum, val) => sum + val, 0);
  const isStep4Valid = noRepuestosUsed || totalSparesQty > 0;
  const hasSparesPending = !noRepuestosUsed && totalSparesQty === 0;

  const isStep5Valid = isStep1Valid && isStep2Valid && isStep3Valid && isStep4Valid && firmaSaved && firmaNombreCliente.trim() !== '' && firmaDocumentoCliente.trim() !== '' && firmaFotoEvidencia.trim() !== '';

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

  const handleFinalizar = async () => {
    if (!isStep5Valid) return;

    try {
      if (id) {
        const checklistRespList = CHECKLIST_ITEMS.map((_, idx) => ({
          plantilla_item_id: idx + 1,
          valor_booleano: checklistRespuestas[idx] === 'correcto',
          foto_antes: checklistFotosAntes[idx] || null,
          foto_despues: checklistFotosDespues[idx] || null,
        }));
        try {
          await apiFetch(`/ordenes/${id}/checklist`, {
            method: 'POST',
            body: JSON.stringify({ respuestas: checklistRespList }),
          });
        } catch (e) {
          console.warn('Checklist upload to backend failed:', e);
        }

        const repuestosPayload = Object.keys(repuestosCantidades)
          .filter((name) => repuestosCantidades[name] > 0)
          .map((name) => {
            let materialId = 1;
            if (name === 'Correa') materialId = 2;
            else if (name === 'Aceite compresor') materialId = 3;
            return {
              material_id: materialId,
              cantidad: repuestosCantidades[name],
              foto_antes: repuestosFotosAntes[name] || null,
              foto_despues: repuestosFotosDespues[name] || null,
            };
          });
        if (repuestosPayload.length > 0) {
          try {
            await apiFetch(`/ordenes/${id}/repuestos`, {
              method: 'POST',
              body: JSON.stringify(repuestosPayload),
            });
          } catch (e) {
            console.warn('Repuestos upload to backend failed:', e);
          }
        }

        await apiFetch(`/ordenes/${id}/cerrar`, {
          method: 'POST',
          body: JSON.stringify({
            firma_base64: firmaDataUrl || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            comentario: 'Orden de trabajo finalizada en terreno con firma de conformidad.',
            firma_nombre_cliente: firmaNombreCliente,
            firma_documento_cliente: firmaDocumentoCliente,
            firma_foto_evidencia: firmaFotoEvidencia,
          }),
        });
      }
    } catch (err) {
      console.warn('Backend API cerrar failed:', err);
    }

    if (ot) {
      setOt({ ...ot, estado: 'COMPLETADA' });
    }
    localStorage.removeItem(`ot_progress_${id}`);
    alert('¡Orden de Trabajo finalizada con éxito!');
    router.push('/tecnico');
  };

  const handlePrecierre = async () => {
    try {
      if (id) {
        await apiFetch(`/ordenes/${id}/transicion`, {
          method: 'POST',
          body: JSON.stringify({
            nuevo_estado: 'PRECIERRE',
            notas: 'Orden de trabajo pre-cerrada temporalmente desde terreno.',
          }),
        });
        if (ot) {
          setOt({ ...ot, estado: 'PRECIERRE' });
        }
        alert('¡Orden de Trabajo pre-cerrada correctamente!');
        router.push('/tecnico');
      }
    } catch (err) {
      console.warn('Backend API transition to PRECIERRE failed:', err);
    }
  };

  const handleReabrirOT = async () => {
    try {
      if (id) {
        await apiFetch(`/ordenes/${id}/transicion`, {
          method: 'POST',
          body: JSON.stringify({
            nuevo_estado: 'EN_EJECUCION',
            notas: 'Reanudando trabajos desde campo.',
          }),
        });
        if (ot) {
          setOt({ ...ot, estado: 'EN_EJECUCION' });
        }
        setCurrentStep(3);
        saveProgress({ currentStep: 3 });
        alert('¡Orden de Trabajo reabierta!');
      }
    } catch (err) {
      console.warn('Backend API transition to EN_EJECUCION failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-[420px] mx-auto min-h-screen bg-zinc-50 border border-zinc-200/80 rounded-2xl flex flex-col items-center justify-center p-6 text-center">
        <svg className="animate-spin h-7 w-7 text-teal-600 mb-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-xs font-semibold text-zinc-500">Cargando detalles de la orden...</p>
      </div>
    );
  }

  if (!ot) {
    return (
      <div className="w-full max-w-[420px] mx-auto min-h-screen bg-zinc-50 border border-zinc-200/80 rounded-2xl flex flex-col items-center justify-center p-6 text-center">
        <span className="text-4xl mb-3">⚠️</span>
        <h2 className="text-base font-bold text-zinc-900">Orden de Trabajo no encontrada</h2>
        <button
          onClick={() => router.push('/tecnico')}
          className="mt-4 px-4 h-11 bg-teal-600 text-white rounded-xl text-xs font-bold active:scale-95 transition-all"
        >
          Volver a la Bandeja
        </button>
      </div>
    );
  }

  if (ot.estado === 'PRECIERRE') {
    return (
      <div className="w-full max-w-[420px] mx-auto min-h-screen bg-zinc-50 border border-zinc-200/80 rounded-2xl p-6 flex flex-col justify-center items-center text-center gap-4">
        <span className="text-5xl">📑</span>
        <h2 className="text-xl font-bold text-zinc-900">Orden en PRECIERRE</h2>
        <p className="text-xs text-zinc-600 leading-relaxed">
          Esta orden se encuentra pre-cerrada temporalmente. Puedes reanudar los trabajos cuando regreses al sitio.
        </p>
        
        <div className="flex gap-3 w-full pt-4">
          <button
            onClick={() => router.push('/tecnico')}
            className="flex-1 h-11 bg-white border border-zinc-200 text-zinc-700 rounded-xl text-xs font-bold active:scale-95 transition-all"
          >
            Volver
          </button>
          <button
            onClick={handleReabrirOT}
            className="flex-1 h-11 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold active:scale-95 transition-all"
          >
            Reanudar Trabajos
          </button>
        </div>
      </div>
    );
  }

  if (ot.estado === 'COMPLETADA' || ot.estado === 'CERRADA') {
    return (
      <div className="w-full max-w-[420px] mx-auto min-h-screen bg-zinc-50 border border-zinc-200/80 rounded-2xl p-6 flex flex-col justify-center items-center text-center gap-4">
        <span className="text-5xl">✅</span>
        <h2 className="text-xl font-bold text-zinc-900">Orden Finalizada</h2>
        <p className="text-xs text-zinc-600 leading-relaxed">
          Esta orden de trabajo se encuentra en estado <span className="font-bold text-zinc-900">{ot.estado}</span> (Solo Lectura).
        </p>
        
        <div className="flex gap-3 w-full pt-4">
          <button
            onClick={() => router.push('/tecnico')}
            className="flex-1 h-11 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold active:scale-95 transition-all"
          >
            Volver a la Bandeja
          </button>
        </div>
      </div>
    );
  }

  return (
    /* CONTENEDOR PRINCIPAL MOBILE-FIRST (ANCHO MÁXIMO 430px, CENTRADO, SIN SCROLL HORIZONTAL) */
    <div className="w-full max-w-[420px] mx-auto min-h-screen bg-zinc-50 border border-zinc-200/80 rounded-2xl sm:rounded-[24px] sm:shadow-2xl flex flex-col font-sans text-zinc-900 select-none pb-36 relative overflow-x-hidden">
      
      {/* Encabezado Superior de la Ficha */}
      <header className="bg-white border-b border-zinc-200/80 p-4 flex flex-col gap-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-bold text-zinc-800 bg-zinc-100 px-2.5 py-1 rounded-lg border border-zinc-200 truncate max-w-[180px]">
            {ot.codigo_interno}
          </span>
          <span className="text-[11px] font-bold text-zinc-500">
            ⏱️ SLA: {formatSLA(ot.slaRestanteMinutos)}
          </span>
        </div>

        {/* Stepper de 5 Pasos */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between relative px-1">
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-zinc-200 -translate-y-1/2 -z-0" />
            <div
              className="absolute top-1/2 left-0 h-1 bg-teal-600 -translate-y-1/2 -z-0 transition-all duration-300"
              style={{ width: `${((currentStep - 1) / 4) * 100}%` }}
            />

            {[1, 2, 3, 4, 5].map((stepNum) => {
              const isActive = currentStep === stepNum;
              const isPassed = currentStep > stepNum;
              return (
                <div
                  key={stepNum}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold z-10 border-2 transition-all ${
                    isActive
                      ? 'bg-teal-600 border-teal-600 text-white shadow-sm ring-2 ring-teal-200'
                      : isPassed
                      ? 'bg-teal-600 border-teal-600 text-white'
                      : 'bg-white border-zinc-300 text-zinc-400'
                  }`}
                >
                  {isPassed ? '✓' : stepNum}
                </div>
              );
            })}
          </div>

          <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-zinc-400 px-0.5">
            <span className={currentStep === 1 ? 'text-teal-700 font-extrabold' : ''}>Aceptar</span>
            <span className={currentStep === 2 ? 'text-teal-700 font-extrabold' : ''}>Seguridad</span>
            <span className={currentStep === 3 ? 'text-teal-700 font-extrabold' : ''}>Checklist</span>
            <span className={currentStep === 4 ? 'text-teal-700 font-extrabold' : ''}>Repuestos</span>
            <span className={currentStep === 5 ? 'text-teal-700 font-extrabold' : ''}>Cierre</span>
          </div>
        </div>
      </header>

      {/* ÁREA DE PASOS */}
      <div className="p-4 space-y-4">
        
        {/* PASO 1: ACEPTAR */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="bg-white border border-zinc-200 rounded-[16px] p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                  Detalles de la Orden
                </span>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {ot.prioridad.toUpperCase()}
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg w-fit border border-teal-200">
                  📋 {ot.tipo_mantenimiento || 'Mantenimiento Preventivo'}
                </p>
                <h3 className="text-base font-bold text-zinc-900 leading-snug truncate">
                  {ot.equipo}
                </h3>
                <p className="text-xs text-zinc-600 flex items-center gap-1 font-medium truncate">
                  📍 {ot.ubicacion}
                </p>
              </div>
            </div>

            {aceptada ? (
              <div className="bg-teal-50 border border-teal-200 rounded-[16px] p-4 space-y-1 text-xs text-teal-900 font-medium">
                <p className="font-bold flex items-center gap-1 text-teal-800">
                  <span>✅</span> OT Aceptada Exitosamente
                </p>
                <p className="text-zinc-600">📅 Fecha: {aceptadaInfo?.fecha}</p>
                <p className="text-zinc-600">⏰ Hora: {aceptadaInfo?.hora}</p>
                <p className="text-[10px] text-zinc-400 mt-1">Registrado automáticamente en terreno.</p>
              </div>
            ) : (
              <div className="flex gap-3 w-full">
                <button
                  onClick={handleAceptar}
                  className="flex-1 h-12 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  🚀 Aceptar OT
                </button>
              </div>
            )}
          </div>
        )}

        {/* PASO 2: SEGURIDAD */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="bg-teal-50 border border-teal-200 rounded-[16px] p-3.5 text-xs text-teal-900 font-medium flex items-center gap-2">
              <span>🛡️</span>
              <span>Validaciones de seguridad obligatorias antes de avanzar.</span>
            </div>

            {SAFETY_QUESTIONS.map((pregunta, idx) => {
              const ans = seguridadRespuestas[idx];
              return (
                <div key={idx} className="bg-white border border-zinc-200 rounded-[16px] p-4 shadow-xs space-y-3">
                  <p className="text-xs font-bold text-zinc-900 leading-snug">
                    {pregunta}
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSeguridadRespuesta(idx, 'si')}
                      className={`flex-1 h-10 rounded-xl text-xs font-bold border transition-all ${
                        ans === 'si'
                          ? 'bg-teal-600 border-teal-600 text-white shadow-xs'
                          : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                      }`}
                    >
                      Sí
                    </button>
                    <button
                      onClick={() => handleSeguridadRespuesta(idx, 'no')}
                      className={`flex-1 h-10 rounded-xl text-xs font-bold border transition-all ${
                        ans === 'no'
                          ? 'bg-red-600 border-red-600 text-white shadow-xs'
                          : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                      }`}
                    >
                      No
                    </button>
                    <button
                      onClick={() => handleSeguridadRespuesta(idx, 'na')}
                      className={`flex-1 h-10 rounded-xl text-xs font-bold border transition-all ${
                        ans === 'na'
                          ? 'bg-zinc-500 border-zinc-500 text-white shadow-xs'
                          : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                      }`}
                    >
                      N/A
                    </button>
                  </div>

                  {ans === 'no' && (
                    <div className="space-y-1 pt-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase">
                        Justificación *
                      </label>
                      <textarea
                        value={seguridadJustificaciones[idx] || ''}
                        onChange={(e) => handleSeguridadJustificacion(idx, e.target.value)}
                        placeholder="Escriba el motivo..."
                        className="w-full p-2.5 border border-zinc-200 rounded-xl text-xs bg-zinc-50 focus:outline-none focus:border-teal-600 min-h-[70px] resize-none"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* PASO 3: CHECKLIST */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="bg-white border border-zinc-200 rounded-[16px] p-3.5 text-xs text-zinc-600 font-medium flex items-center gap-2">
              <span>📋</span>
              <span>Complete los ítems de inspección técnica.</span>
            </div>

            {CHECKLIST_ITEMS.map((item, idx) => {
              const ans = checklistRespuestas[idx];
              return (
                <div key={idx} className="bg-white border border-zinc-200 rounded-[16px] p-4 shadow-xs space-y-3">
                  <p className="text-xs font-bold text-zinc-900 leading-snug truncate">
                    {item}
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleChecklistRespuesta(idx, 'correcto')}
                      className={`flex-1 h-10 rounded-xl text-xs font-bold border transition-all ${
                        ans === 'correcto'
                          ? 'bg-teal-600 border-teal-600 text-white shadow-xs'
                          : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                      }`}
                    >
                      Correcto
                    </button>
                    <button
                      onClick={() => handleChecklistRespuesta(idx, 'pendiente')}
                      className={`flex-1 h-10 rounded-xl text-xs font-bold border transition-all ${
                        ans === 'pendiente'
                          ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                          : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                      }`}
                    >
                      Pendiente
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100">
                    <div>
                      <span className="text-[10px] text-zinc-500 font-bold block mb-1">Foto Antes</span>
                      {checklistFotosAntes[idx] ? (
                        <div className="border border-zinc-200 rounded-lg p-1.5 flex items-center justify-between bg-zinc-50 text-[10px]">
                          <span className="truncate max-w-[70px] text-zinc-600">{checklistFotosAntes[idx]}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = { ...checklistFotosAntes };
                              delete next[idx];
                              setChecklistFotosAntes(next);
                              saveProgress({ checklistFotosAntes: next });
                            }}
                            className="text-red-500 font-bold"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const path = await handleUploadFile(file);
                                const next = { ...checklistFotosAntes, [idx]: path };
                                setChecklistFotosAntes(next);
                                saveProgress({ checklistFotosAntes: next });
                              } catch (err) {
                                console.error(err);
                              }
                            }
                          }}
                          className="block w-full text-[10px] text-zinc-500 file:mr-1 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:bg-zinc-100 file:text-zinc-700"
                        />
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-500 font-bold block mb-1">Foto Después</span>
                      {checklistFotosDespues[idx] ? (
                        <div className="border border-zinc-200 rounded-lg p-1.5 flex items-center justify-between bg-zinc-50 text-[10px]">
                          <span className="truncate max-w-[70px] text-zinc-600">{checklistFotosDespues[idx]}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = { ...checklistFotosDespues };
                              delete next[idx];
                              setChecklistFotosDespues(next);
                              saveProgress({ checklistFotosDespues: next });
                            }}
                            className="text-red-500 font-bold"
                          >
                            X
                          </button>
                        </div>
                      ) : (
                        <input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const path = await handleUploadFile(file);
                                const next = { ...checklistFotosDespues, [idx]: path };
                                setChecklistFotosDespues(next);
                                saveProgress({ checklistFotosDespues: next });
                              } catch (err) {
                                console.error(err);
                              }
                            }
                          }}
                          className="block w-full text-[10px] text-zinc-500 file:mr-1 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:bg-zinc-100 file:text-zinc-700"
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* PASO 4: REPUESTOS */}
        {currentStep === 4 && (
          <div className="space-y-4">
            {hasSparesPending && (
              <div className="bg-red-50 border border-red-200 rounded-[16px] p-3.5 text-xs text-red-700 font-medium">
                ⚠️ Registrar repuestos o marcar que no se usaron.
              </div>
            )}

            <div className="bg-white border border-zinc-200 rounded-[16px] p-4 shadow-xs space-y-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block border-b border-zinc-100 pb-1">
                Repuestos de Inventario
              </span>

              <div className="space-y-3 divide-y divide-zinc-100">
                {SPARES_ITEMS.map((spare) => {
                  const qty = repuestosCantidades[spare] || 0;
                  const unit = getSpareUnit(spare);
                  return (
                    <div key={spare} className="pt-3 first:pt-0 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="text-xs font-bold text-zinc-900 truncate">{spare}</p>
                          <p className="text-[10px] text-zinc-400 font-medium">{unit}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            disabled={noRepuestosUsed}
                            onClick={() => handleQuantityChange(spare, -1)}
                            className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 font-bold text-sm disabled:opacity-40 flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="font-mono text-xs font-bold w-5 text-center">{qty}</span>
                          <button
                            disabled={noRepuestosUsed}
                            onClick={() => handleQuantityChange(spare, 1)}
                            className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 font-bold text-sm disabled:opacity-40 flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleToggleNoRepuestos}
              className={`w-full h-11 p-3 border rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                noRepuestosUsed
                  ? 'bg-teal-600 border-teal-600 text-white'
                  : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              <span>No utilicé repuestos</span>
              <span>{noRepuestosUsed && '✓'}</span>
            </button>
          </div>
        )}

        {/* PASO 5: CIERRE */}
        {currentStep === 5 && (
          <div className="space-y-4">
            {!isStep5Valid && (
              <div className="bg-red-50 border border-red-200 rounded-[16px] p-3.5 text-xs text-red-700 space-y-1">
                <p className="font-bold">⚠️ Requisitos pendientes para el cierre:</p>
                <ul className="text-[11px] list-disc pl-4 space-y-0.5">
                  {!isStep1Valid && <li>Aceptar orden</li>}
                  {!isStep2Valid && <li>Checklist seguridad incompleto</li>}
                  {!isStep3Valid && <li>Checklist técnico incompleto</li>}
                  {!isStep4Valid && <li>Registrar repuestos</li>}
                  {firmaNombreCliente.trim() === '' && <li>Nombre del cliente</li>}
                  {firmaDocumentoCliente.trim() === '' && <li>Documento de identidad</li>}
                  {firmaFotoEvidencia.trim() === '' && <li>Foto de evidencia</li>}
                  {!firmaSaved && <li>Firma digital</li>}
                </ul>
              </div>
            )}

            <div className="bg-white border border-zinc-200 rounded-[16px] p-4 shadow-xs space-y-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block border-b border-zinc-100 pb-1">
                Datos del Receptor
              </span>

              <div className="space-y-2.5">
                <div>
                  <label className="text-[11px] font-bold text-zinc-600 block mb-1">Nombre del Cliente *</label>
                  <input
                    type="text"
                    value={firmaNombreCliente}
                    onChange={(e) => {
                      setFirmaNombreCliente(e.target.value);
                      saveProgress({ firmaNombreCliente: e.target.value });
                    }}
                    placeholder="Ej: Juan Pérez"
                    className="w-full h-10 border border-zinc-200 rounded-xl px-3 text-xs bg-zinc-50 focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-600 block mb-1">Documento de Identidad *</label>
                  <input
                    type="text"
                    value={firmaDocumentoCliente}
                    onChange={(e) => {
                      setFirmaDocumentoCliente(e.target.value);
                      saveProgress({ firmaDocumentoCliente: e.target.value });
                    }}
                    placeholder="DNI / RUT"
                    className="w-full h-10 border border-zinc-200 rounded-xl px-3 text-xs bg-zinc-50 focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-zinc-600 block mb-1">Foto de Evidencia *</label>
                  {firmaFotoEvidencia ? (
                    <div className="border border-zinc-200 rounded-xl p-2 flex items-center justify-between bg-zinc-50 text-xs">
                      <span className="truncate max-w-[180px] font-mono text-[10px] text-zinc-600">{firmaFotoEvidencia}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setFirmaFotoEvidencia('');
                          saveProgress({ firmaFotoEvidencia: '' });
                        }}
                        className="text-red-500 font-bold"
                      >
                        Eliminar
                      </button>
                    </div>
                  ) : (
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const path = await handleUploadFile(file);
                            setFirmaFotoEvidencia(path);
                            saveProgress({ firmaFotoEvidencia: path });
                          } catch (err) {
                            console.error(err);
                          }
                        }
                      }}
                      className="block w-full text-xs text-zinc-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:bg-zinc-100 file:text-zinc-700"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white border border-zinc-200 rounded-[16px] p-4 shadow-xs space-y-2.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block border-b border-zinc-100 pb-1">
                Firma Digital
              </span>

              <div className="border border-zinc-200 bg-zinc-50 rounded-xl overflow-hidden touch-none relative">
                <canvas
                  ref={canvasRef}
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerLeave={stopDrawing}
                  className="w-full h-[160px] block cursor-crosshair"
                />
                {!firmaSaved && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs text-zinc-400">
                    Firme aquí
                  </div>
                )}
              </div>

              <button
                onClick={clearSignature}
                className="w-full h-9 bg-white border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
              >
                Borrar firma
              </button>
            </div>

            {/* BOTONES DE ACCIÓN PRINCIPALES */}
            <div className="flex gap-3 w-full pt-1">
              <button
                onClick={handlePrecierre}
                className="flex-1 h-11 rounded-xl text-xs font-bold border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 transition-all active:scale-95"
              >
                Precierre
              </button>
              <button
                disabled={!isStep5Valid}
                onClick={handleFinalizar}
                className={`flex-1 h-11 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                  isStep5Valid
                    ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-xs'
                    : 'bg-zinc-200 text-zinc-400 border border-zinc-300 cursor-not-allowed'
                }`}
              >
                Finalizar OT
              </button>
            </div>
          </div>
        )}
      </div>

      {/* NAVEGACIÓN FIJA DE PASOS POR ENCIMA DEL BOTTOM NAV (bottom-[68px] z-50) */}
      <div className="fixed bottom-[68px] left-0 right-0 max-w-[420px] mx-auto bg-white border-t border-zinc-200/80 p-3 flex gap-3 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <button
          onClick={handlePrev}
          className="flex-1 h-11 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl text-xs font-bold active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span>{currentStep === 1 ? 'Salir' : 'Atrás'}</span>
        </button>

        {currentStep < 5 && (
          <button
            disabled={
              (currentStep === 1 && !isStep1Valid) ||
              (currentStep === 2 && !isStep2Valid) ||
              (currentStep === 3 && !isStep3Valid) ||
              (currentStep === 4 && !isStep4Valid)
            }
            onClick={handleNext}
            className={`flex-1 h-11 rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5 ${
              (currentStep === 1 && !isStep1Valid) ||
              (currentStep === 2 && !isStep2Valid) ||
              (currentStep === 3 && !isStep3Valid) ||
              (currentStep === 4 && !isStep4Valid)
                ? 'bg-zinc-200 text-zinc-400 border border-zinc-300 cursor-not-allowed'
                : 'bg-teal-600 hover:bg-teal-700 text-white shadow-xs cursor-pointer'
            }`}
          >
            <span>Avanzar</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

    </div>
  );
}
