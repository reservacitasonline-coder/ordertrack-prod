'use client';

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
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
  fecha_salida?: string;
  fecha_llegada?: string;
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

const parseUTC = (dateStr: string | null | undefined): Date => {
  if (!dateStr) return new Date();
  if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
    return new Date(dateStr + 'Z');
  }
  return new Date(dateStr);
};

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

  const [safetyItems, setSafetyItems] = useState<{ id: number; pregunta: string; orden: number; requerido: boolean }[]>([]);
  const [checklistItems, setChecklistItems] = useState<{ id: number; pregunta: string; orden: number; requerido: boolean }[]>([]);

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
            fecha_salida: apiOt.fecha_salida || undefined,
            fecha_llegada: apiOt.fecha_llegada || undefined,
          });

          // Sincronizar automáticamente el estado local del paso si no está en localStorage
          const isOtAccepted = apiOt.estado === 'EN_EJECUCION' || !!apiOt.fecha_salida || ['PAUSADA', 'ESPERANDO_REPUESTO', 'PRECIERRE', 'COMPLETADA', 'CERRADA'].includes(apiOt.estado);
          if (isOtAccepted) {
            setAceptada(true);
            const dateSalida = apiOt.fecha_salida ? parseUTC(apiOt.fecha_salida) : new Date();
            const fecha = dateSalida.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const hora = dateSalida.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            setAceptadaInfo((prev) => prev || {
              fecha,
              hora,
              gps: apiOt.latitud_salida ? `Lat: ${apiOt.latitud_salida.toFixed(6)}, Lng: ${apiOt.longitud_salida?.toFixed(6)}` : '',
            });
          }

          if (apiOt.fecha_llegada) {
            setCurrentStep((prev) => Math.max(prev, 2));
          }

          // Fetch safety items
          try {
            const sItems = await apiFetch<{ id: number; pregunta: string; orden: number; requerido: boolean }[]>(`/tecnico/ordenes/${id}/seguridad`);
            if (sItems && Array.isArray(sItems) && sItems.length > 0) {
              setSafetyItems(sItems);
            } else {
              setSafetyItems(SAFETY_QUESTIONS.map((q, idx) => ({ id: idx + 1, pregunta: q, orden: idx + 1, requerido: true })));
            }
          } catch (e) {
            console.warn('Could not fetch safety config from API, using fallback:', e);
            setSafetyItems(SAFETY_QUESTIONS.map((q, idx) => ({ id: idx + 1, pregunta: q, orden: idx + 1, requerido: true })));
          }

          // Fetch template technical checklist items
          const allItems: { id: number; pregunta: string; orden: number; requerido: boolean }[] = [];
          if (apiOt.plantillas && apiOt.plantillas.length > 0) {
            for (const p of apiOt.plantillas) {
              try {
                const pDetail = await apiFetch<{ items: { id: number; pregunta: string; orden: number; requerido: boolean }[] }>(`/plantillas/${p.id}`);
                if (pDetail && Array.isArray(pDetail.items)) {
                  allItems.push(...pDetail.items);
                }
              } catch {}
            }
          } else if (apiOt.plantilla_id) {
            try {
              const pDetail = await apiFetch<{ items: { id: number; pregunta: string; orden: number; requerido: boolean }[] }>(`/plantillas/${apiOt.plantilla_id}`);
              if (pDetail && Array.isArray(pDetail.items)) {
                allItems.push(...pDetail.items);
              }
            } catch {}
          }
          if (allItems.length > 0) {
            setChecklistItems(allItems);
          } else {
            setChecklistItems(CHECKLIST_ITEMS.map((q, idx) => ({ id: idx + 1, pregunta: q, orden: idx + 1, requerido: true })));
          }
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

  const getCoordinates = (): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve) => {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          },
          () => {
            resolve({ latitude: -12.046374, longitude: -77.042793 });
          },
          { timeout: 5000 }
        );
      } else {
        resolve({ latitude: -12.046374, longitude: -77.042793 });
      }
    });
  };

  // Step 1 Actions
  const handleAceptar = async () => {
    const coords = await getCoordinates();
    try {
      await apiFetch(`/tecnico/ordenes/${id}/salida`, {
        method: 'POST',
        body: JSON.stringify({
          latitud_salida: coords.latitude,
          longitud_salida: coords.longitude,
        }),
      });

      const now = new Date();
      const fecha = now.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const hora = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const gps = `Lat: ${coords.latitude.toFixed(6)}, Lng: ${coords.longitude.toFixed(6)}`;

      setAceptada(true);
      setAceptadaInfo({ fecha, hora, gps });
      if (ot) {
        setOt({
          ...ot,
          estado: 'EN_EJECUCION',
          fecha_salida: now.toISOString(),
        });
      }

      saveProgress({
        aceptada: true,
        aceptadaFecha: fecha,
        aceptadaHora: hora,
        aceptadaGps: gps,
      });
    } catch (e) {
      console.error('Error registering departure:', e);
      alert('Error al aceptar la orden e iniciar traslado.');
    }
  };

  const handleLlegada = async () => {
    const coords = await getCoordinates();
    try {
      await apiFetch(`/tecnico/ordenes/${id}/llegada`, {
        method: 'POST',
        body: JSON.stringify({
          latitud_llegada: coords.latitude,
          longitud_llegada: coords.longitude,
        }),
      });

      const now = new Date();
      if (ot) {
        setOt({
          ...ot,
          fecha_llegada: now.toISOString(),
        });
      }

      setCurrentStep(2);
      saveProgress({
        currentStep: 2,
      });
    } catch (e) {
      console.error('Error registering arrival:', e);
      alert('Error al registrar la llegada al sitio.');
    }
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

  // Local state for requesting missing spare parts
  const [showRepuestoModal, setShowRepuestoModal] = useState<boolean>(false);
  const [repuestoBusqueda, setRepuestoBusqueda] = useState<string>('');
  const [filtrarCompatibles, setFiltrarCompatibles] = useState<boolean>(true);
  const [selectedMaterial, setSelectedMaterial] = useState<any | null>(null);
  const [repuestoCantidad, setRepuestoCantidad] = useState<number>(1);
  
  const [mostrarManual, setMostrarManual] = useState<boolean>(false);
  const [manualDescripcion, setManualDescripcion] = useState<string>('');
  const [manualCantidad, setManualCantidad] = useState<number>(1);
  const [manualPrecio, setManualPrecio] = useState<string>('');

  const [repuestosFaltantesLocales, setRepuestosFaltantesLocales] = useState<{
    idTemp: string;
    materialId: number | null;
    nombre: string;
    cantidad: number;
    precio?: number;
  }[]>([]);

  const CATALOG_SPARE_PARTS = useMemo(() => [
    { id: 1, nombre: 'Filtro de aire HVAC', sku: 'FLT-HVAC-01', precio: 25.0, stock: 12, compatible: true },
    { id: 2, nombre: 'Correa de Transmisión V-Belt', sku: 'BELT-V-02', precio: 15.0, stock: 8, compatible: true },
    { id: 3, nombre: 'Aceite para Compresor ISO 68', sku: 'OIL-COMP-68', precio: 45.0, stock: 15, compatible: true },
    { id: 4, nombre: 'Sensor de Temperatura RTD', sku: 'SNS-TEMP-04', precio: 60.0, stock: 5, compatible: false },
    { id: 5, nombre: 'Válvula de Expansión Termostática', sku: 'VALV-EXP-05', precio: 120.0, stock: 3, compatible: false },
    { id: 6, nombre: 'Filtro Deshidratador 1/4', sku: 'FLT-DRY-06', precio: 18.5, stock: 20, compatible: false },
    { id: 7, nombre: 'Capacitor de Marcha 45uF', sku: 'CAP-RUN-45', precio: 12.0, stock: 14, compatible: true },
  ], []);

  const filteredCatalogParts = useMemo(() => {
    return CATALOG_SPARE_PARTS.filter(p => {
      if (repuestoBusqueda) {
        const query = repuestoBusqueda.toLowerCase();
        if (!p.nombre.toLowerCase().includes(query) && !p.sku.toLowerCase().includes(query)) {
          return false;
        }
      }
      if (filtrarCompatibles && !p.compatible) {
        return false;
      }
      return true;
    });
  }, [CATALOG_SPARE_PARTS, repuestoBusqueda, filtrarCompatibles]);

  const handleAgregarFaltanteLocal = useCallback(() => {
    let name = '';
    let qty = 1;
    let matId: number | null = null;
    let price: number | undefined = undefined;

    if (mostrarManual) {
      if (!manualDescripcion.trim()) {
        alert('Debe ingresar la descripción del repuesto.');
        return;
      }
      name = manualDescripcion.trim();
      qty = manualCantidad;
      if (manualPrecio) {
        price = parseFloat(manualPrecio);
      }
    } else if (selectedMaterial) {
      name = selectedMaterial.nombre;
      qty = repuestoCantidad;
      matId = selectedMaterial.id;
      price = selectedMaterial.precio;
    } else {
      alert('Debe seleccionar un repuesto o ingresar uno manual.');
      return;
    }

    const newItem = {
      idTemp: Math.random().toString(36).substring(2, 9),
      materialId: matId,
      nombre: name,
      cantidad: qty,
      precio: price,
    };

    setRepuestosFaltantesLocales((prev) => [...prev, newItem]);
    
    // Reset modal states
    setShowRepuestoModal(false);
    setRepuestoBusqueda('');
    setSelectedMaterial(null);
    setRepuestoCantidad(1);
    setMostrarManual(false);
    setManualDescripcion('');
    setManualCantidad(1);
    setManualPrecio('');
  }, [mostrarManual, manualDescripcion, manualCantidad, manualPrecio, selectedMaterial, repuestoCantidad]);

  const handleLocalQtyChange = useCallback((idTemp: string, delta: number) => {
    setRepuestosFaltantesLocales((prev) =>
      prev.map((item) => {
        if (item.idTemp === idTemp) {
          return { ...item, cantidad: Math.max(1, item.cantidad + delta) };
        }
        return item;
      })
    );
  }, []);

  const handleLocalRemove = useCallback((idTemp: string) => {
    setRepuestosFaltantesLocales((prev) => prev.filter((item) => item.idTemp !== idTemp));
  }, []);

  const handleEnviarFaltantes = useCallback(async () => {
    if (repuestosFaltantesLocales.length === 0) return;
    setLoading(true);
    try {
      for (const item of repuestosFaltantesLocales) {
        await apiFetch(`/tecnico/ordenes/${id}/solicitar-repuesto`, {
          method: 'POST',
          body: JSON.stringify({
            material_id: item.materialId,
            nombre_otro: item.materialId ? null : item.nombre,
            cantidad: item.cantidad,
          }),
        });
      }
      
      if (ot) {
        setOt({ ...ot, estado: 'ESPERANDO_REPUESTO' });
      }
      
      alert('Repuestos solicitados correctamente. La orden ha sido pausada.');
      router.push('/tecnico');
    } catch (e) {
      console.error('Error requesting spare parts:', e);
      alert('Ocurrió un error al solicitar los repuestos.');
    } finally {
      setLoading(false);
    }
  }, [repuestosFaltantesLocales, id, ot, router]);

  const handleSolicitarRepuestoFaltante = useCallback(() => {
    setShowRepuestoModal(true);
  }, []);

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
  const isStep1Valid = aceptada && ot?.fecha_llegada !== undefined && ot?.fecha_llegada !== null;
  const isStep2Valid = safetyItems.length > 0 && safetyItems.every((item) => {
    const ans = seguridadRespuestas[item.id];
    if (ans === undefined) return false;
    if (ans === 'no') {
      const just = seguridadJustificaciones[item.id];
      return just !== undefined && just.trim() !== '';
    }
    return true;
  });
  const isStep3Valid = checklistItems.length > 0 && checklistItems.every((item) => checklistRespuestas[item.id] !== undefined);

  const totalSparesQty = Object.values(repuestosCantidades).reduce((sum, val) => sum + val, 0);
  const isStep4Valid = noRepuestosUsed || totalSparesQty > 0;
  const hasSparesPending = !noRepuestosUsed && totalSparesQty === 0;

  const isStep5Valid = isStep1Valid && isStep2Valid && isStep3Valid && isStep4Valid && firmaSaved && firmaNombreCliente.trim() !== '' && firmaDocumentoCliente.trim() !== '' && firmaFotoEvidencia.trim() !== '';

  const handleNext = async () => {
    if (currentStep === 1 && !isStep1Valid) return;

    // Save safety answers to API when leaving Paso 2
    if (currentStep === 2) {
      if (!isStep2Valid) return;
      try {
        const respuestasPayload = safetyItems.map((item) => ({
          seguridad_item_id: item.id,
          cumple: seguridadRespuestas[item.id] === 'si' ? true : (seguridadRespuestas[item.id] === 'no' ? false : null),
          justificacion: seguridadJustificaciones[item.id] || null,
        }));
        await apiFetch(`/tecnico/ordenes/${id}/seguridad`, {
          method: 'POST',
          body: JSON.stringify({ respuestas: respuestasPayload }),
        });
      } catch (e) {
        console.error('Error saving safety checklist:', e);
      }
    }

    // Save technical checklist to API when leaving Paso 3
    if (currentStep === 3) {
      if (!isStep3Valid) return;
      try {
        const respuestasPayload = checklistItems.map((item) => ({
          plantilla_item_id: item.id,
          valor_booleano: checklistRespuestas[item.id] === 'correcto',
          foto_antes: checklistFotosAntes[item.id] || null,
          foto_despues: checklistFotosDespues[item.id] || null,
        }));
        await apiFetch(`/tecnico/ordenes/${id}/checklist`, {
          method: 'POST',
          body: JSON.stringify({ respuestas: respuestasPayload }),
        });
      } catch (e) {
        console.error('Error saving technical checklist:', e);
      }
    }

    // Save spare parts to API when leaving Paso 4
    if (currentStep === 4) {
      if (!isStep4Valid) return;
      if (!noRepuestosUsed && totalSparesQty > 0) {
        try {
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
          await apiFetch(`/tecnico/ordenes/${id}/repuestos`, {
            method: 'POST',
            body: JSON.stringify(repuestosPayload),
          });
        } catch (e) {
          console.error('Error saving spare parts:', e);
        }
      }
    }

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
        await apiFetch(`/tecnico/ordenes/${id}/cerrar`, {
          method: 'POST',
          body: JSON.stringify({
            firma_base64: firmaDataUrl || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            comentario: 'Orden de trabajo finalizada en terreno con firma de conformidad.',
            firma_nombre_cliente: firmaNombreCliente,
            firma_documento_cliente: firmaDocumentoCliente,
            firma_foto_evidencia: firmaFotoEvidencia,
          }),
        });

        if (ot) {
          setOt({ ...ot, estado: 'COMPLETADA' });
        }
        localStorage.removeItem(`ot_progress_${id}`);
        alert('¡Orden de Trabajo finalizada con éxito!');
        router.push('/tecnico');
      }
    } catch (err) {
      console.warn('Backend API cerrar failed:', err);
      alert('Error al finalizar la Orden de Trabajo. Por favor reintente.');
    }
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

            {aceptada && !ot?.fecha_llegada ? (
              <div className="space-y-4">
                <div className="bg-teal-50 border border-teal-200 rounded-[16px] p-4 space-y-1 text-xs text-teal-900 font-medium">
                  <p className="font-bold flex items-center gap-1 text-teal-800">
                    <span>✅</span> Traslado Iniciado
                  </p>
                  <p className="text-zinc-600">📅 Fecha: {aceptadaInfo?.fecha}</p>
                  <p className="text-zinc-600">⏰ Hora: {aceptadaInfo?.hora}</p>
                  <p className="text-[10px] text-zinc-400 mt-1">Viajando hacia el cliente...</p>
                </div>
                <button
                  onClick={handleLlegada}
                  className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  📍 Confirmar llegada al sitio
                </button>
              </div>
            ) : (aceptada || ot?.fecha_llegada) ? (
              <div className="bg-teal-50 border border-teal-200 rounded-[16px] p-4 space-y-1 text-xs text-teal-900 font-medium">
                <p className="font-bold flex items-center gap-1 text-teal-800">
                  <span>✅</span> Llegada Confirmada
                </p>
                <p className="text-zinc-600">Procediendo al checklist de seguridad.</p>
              </div>
            ) : (
              <div className="flex gap-3 w-full">
                <button
                  onClick={handleAceptar}
                  className="flex-1 h-12 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  🚀 Iniciar Traslado
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

            {safetyItems.map((item) => {
              const ans = seguridadRespuestas[item.id];
              return (
                <div key={item.id} className="bg-white border border-zinc-200 rounded-[16px] p-4 shadow-xs space-y-3">
                  <p className="text-xs font-bold text-zinc-900 leading-snug">
                    {item.pregunta}
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSeguridadRespuesta(item.id, 'si')}
                      className={`flex-1 h-10 rounded-xl text-xs font-bold border transition-all ${
                        ans === 'si'
                          ? 'bg-teal-600 border-teal-600 text-white shadow-xs'
                          : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                      }`}
                    >
                      Sí
                    </button>
                    <button
                      onClick={() => handleSeguridadRespuesta(item.id, 'no')}
                      className={`flex-1 h-10 rounded-xl text-xs font-bold border transition-all ${
                        ans === 'no'
                          ? 'bg-red-600 border-red-600 text-white shadow-xs'
                          : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                      }`}
                    >
                      No
                    </button>
                    <button
                      onClick={() => handleSeguridadRespuesta(item.id, 'na')}
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
                        value={seguridadJustificaciones[item.id] || ''}
                        onChange={(e) => handleSeguridadJustificacion(item.id, e.target.value)}
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

            {checklistItems.map((item) => {
              const ans = checklistRespuestas[item.id];
              return (
                <div key={item.id} className="bg-white border border-zinc-200 rounded-[16px] p-4 shadow-xs space-y-3">
                  <p className="text-xs font-bold text-zinc-900 leading-snug truncate">
                    {item.pregunta}
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleChecklistRespuesta(item.id, 'correcto')}
                      className={`flex-1 h-10 rounded-xl text-xs font-bold border transition-all ${
                        ans === 'correcto'
                          ? 'bg-teal-600 border-teal-600 text-white shadow-xs'
                          : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                      }`}
                    >
                      Correcto
                    </button>
                    <button
                      onClick={() => handleChecklistRespuesta(item.id, 'pendiente')}
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
                      {checklistFotosAntes[item.id] ? (
                        <div className="border border-zinc-200 rounded-lg p-1.5 flex items-center justify-between bg-zinc-50 text-[10px]">
                          <span className="truncate max-w-[70px] text-zinc-600">{checklistFotosAntes[item.id]}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = { ...checklistFotosAntes };
                              delete next[item.id];
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
                                const next = { ...checklistFotosAntes, [item.id]: path };
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
                      {checklistFotosDespues[item.id] ? (
                        <div className="border border-zinc-200 rounded-lg p-1.5 flex items-center justify-between bg-zinc-50 text-[10px]">
                          <span className="truncate max-w-[70px] text-zinc-600">{checklistFotosDespues[item.id]}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = { ...checklistFotosDespues };
                              delete next[item.id];
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
                                const next = { ...checklistFotosDespues, [item.id]: path };
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

            {repuestosFaltantesLocales.length > 0 && (
              <div className="bg-white border border-zinc-200 rounded-[16px] p-4 shadow-xs space-y-3">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block border-b border-zinc-100 pb-1">
                  Repuestos Faltantes a Solicitar
                </span>
                <div className="space-y-3 divide-y divide-zinc-100">
                  {repuestosFaltantesLocales.map((item) => (
                    <div key={item.idTemp} className="pt-3 first:pt-0 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-zinc-900 truncate">{item.nombre}</p>
                        {item.precio && (
                          <p className="text-[10px] text-zinc-400 font-medium">
                            Precio est: ${item.precio.toFixed(2)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleLocalQtyChange(item.idTemp, -1)}
                          className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 font-bold text-sm flex items-center justify-center cursor-pointer select-none active:scale-95 transition-all"
                        >
                          -
                        </button>
                        <span className="font-mono text-xs font-bold w-5 text-center">{item.cantidad}</span>
                        <button
                          type="button"
                          onClick={() => handleLocalQtyChange(item.idTemp, 1)}
                          className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 font-bold text-sm flex items-center justify-center cursor-pointer select-none active:scale-95 transition-all"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLocalRemove(item.idTemp)}
                          className="w-8 h-8 rounded-lg border border-red-100 bg-red-50 text-red-600 font-bold text-xs flex items-center justify-center hover:bg-red-100 transition-colors cursor-pointer"
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <button
                  type="button"
                  onClick={handleEnviarFaltantes}
                  className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all mt-2 cursor-pointer shadow-xs active:scale-95"
                >
                  📨 Enviar Solicitud y Pausar Trabajo
                </button>
              </div>
            )}

            <button
              onClick={handleToggleNoRepuestos}
              className={`w-full h-11 p-3 border rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                noRepuestosUsed
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              <span>No utilicé repuestos</span>
              <span>{noRepuestosUsed && '✓'}</span>
            </button>

            <button
              type="button"
              onClick={handleSolicitarRepuestoFaltante}
              className="w-full h-11 p-3 border border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all mt-2 cursor-pointer active:scale-95"
            >
              ⚠️ Solicitar Repuesto Faltante
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
      {/* Bottom Sheet Drawer for Spare Parts Selection */}
      {showRepuestoModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center animate-fadeIn">
          {/* Backdrop Click */}
          <div className="absolute inset-0" onClick={() => setShowRepuestoModal(false)} />
          
          <div className="relative bg-white w-full max-w-[430px] rounded-t-2xl p-5 flex flex-col gap-4 max-h-[85vh] overflow-y-auto z-10 shadow-xl border-t border-zinc-200 animate-slideUp">
            {/* Drawer Handle */}
            <div className="w-12 h-1.5 bg-zinc-200 rounded-full mx-auto mb-1 shrink-0" />
            
            <div className="flex justify-between items-center shrink-0">
              <h3 className="text-sm font-bold text-zinc-900">Solicitar Repuesto Faltante</h3>
              <button
                type="button"
                onClick={() => setShowRepuestoModal(false)}
                className="text-zinc-400 hover:text-zinc-650 text-xs font-bold p-1"
              >
                Cerrar
              </button>
            </div>
            
            {/* Search Input */}
            <div className="relative shrink-0">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400 text-xs">
                🔍
              </span>
              <input
                type="text"
                placeholder="Buscar repuesto en el catálogo..."
                value={repuestoBusqueda}
                onChange={(e) => setRepuestoBusqueda(e.target.value)}
                className="w-full text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 rounded-xl pl-8 pr-4 py-2.5 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all placeholder-zinc-400"
              />
            </div>
            
            {/* Toggle Switch */}
            <div className="flex items-center justify-between py-1 bg-zinc-50 border border-zinc-150 rounded-xl px-3 shrink-0">
              <span className="text-[11px] font-bold text-zinc-600">Filtrar solo compatibles con este equipo</span>
              <button
                type="button"
                onClick={() => setFiltrarCompatibles(!filtrarCompatibles)}
                className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-all duration-200 ${
                  filtrarCompatibles ? 'bg-emerald-600' : 'bg-zinc-200'
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-all duration-200 ${
                    filtrarCompatibles ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            
            {/* Catalog Items List */}
            <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
              {filteredCatalogParts.length === 0 ? (
                <div className="text-center text-zinc-400 text-[11px] py-4 bg-zinc-50 border border-dashed border-zinc-200 rounded-xl">
                  No se encontraron repuestos compatibles.
                </div>
              ) : (
                filteredCatalogParts.map((item) => {
                  const isSelected = selectedMaterial?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedMaterial(item);
                        setMostrarManual(false);
                      }}
                      className={`flex justify-between items-center p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-medium'
                          : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="font-bold text-zinc-900 truncate">{item.nombre}</span>
                        <span className="text-[10px] text-zinc-400 font-mono">{item.sku}</span>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end">
                        <span className="font-bold text-zinc-800">${item.precio.toFixed(2)}</span>
                        <span className="text-[9px] text-zinc-400 font-medium">Stock: {item.stock}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            
            {/* Manual item form toggle / section */}
            <div className="shrink-0 border-t border-zinc-100 pt-2">
              <button
                type="button"
                onClick={() => {
                  setMostrarManual(!mostrarManual);
                  setSelectedMaterial(null);
                }}
                className={`text-[11px] font-bold w-full text-left py-2 px-3 rounded-xl border border-dashed transition-all flex justify-between items-center ${
                  mostrarManual
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                    : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'
                }`}
              >
                <span>➕ Agregar ítem manual / no catalogado</span>
                <span>{mostrarManual ? '▲' : '▼'}</span>
              </button>

              {mostrarManual && (
                <div className="flex flex-col gap-3 p-3 border border-zinc-200 bg-zinc-50/50 rounded-xl mt-2 animate-fadeIn">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-zinc-500 uppercase">Descripción del Repuesto *</label>
                    <input
                      type="text"
                      placeholder="Ej: Manguera de cobre 1/2"
                      value={manualDescripcion}
                      onChange={(e) => setManualDescripcion(e.target.value)}
                      className="w-full text-xs p-2 border border-zinc-200 bg-white rounded-lg focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-zinc-800 font-medium"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-bold text-zinc-500 uppercase">Cantidad</label>
                      <input
                        type="number"
                        min="1"
                        value={manualCantidad}
                        onChange={(e) => setManualCantidad(parseFloat(e.target.value) || 1)}
                        className="w-full text-xs p-2 border border-zinc-200 bg-white rounded-lg focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-zinc-800 font-mono font-bold"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-bold text-zinc-500 uppercase">Precio Estimado ($)</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="0.00"
                        value={manualPrecio}
                        onChange={(e) => setManualPrecio(e.target.value)}
                        className="w-full text-xs p-2 border border-zinc-200 bg-white rounded-lg focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 text-zinc-800 font-mono font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Quantity Selector for Cataloged Spare Part */}
            {selectedMaterial && (
              <div className="flex justify-between items-center bg-zinc-50 border border-zinc-200 rounded-xl p-3 shrink-0">
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="text-[9px] text-zinc-400 font-bold uppercase">Cantidad</span>
                  <span className="text-xs font-bold text-zinc-800 truncate">{selectedMaterial.nombre}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setRepuestoCantidad(prev => Math.max(1, prev - 1))}
                    className="w-8 h-8 rounded-lg bg-white border border-zinc-200 font-bold text-sm flex items-center justify-center cursor-pointer select-none active:scale-95 transition-all"
                  >
                    -
                  </button>
                  <span className="font-mono text-xs font-bold w-5 text-center">{repuestoCantidad}</span>
                  <button
                    type="button"
                    onClick={() => setRepuestoCantidad(prev => Math.min(selectedMaterial.stock, prev + 1))}
                    className="w-8 h-8 rounded-lg bg-white border border-zinc-200 font-bold text-sm flex items-center justify-center cursor-pointer select-none active:scale-95 transition-all"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
            
            {/* Action buttons */}
            <div className="flex gap-3 mt-1 shrink-0">
              <button
                type="button"
                onClick={() => setShowRepuestoModal(false)}
                className="flex-1 h-11 border border-zinc-200 hover:bg-zinc-50 text-zinc-700 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAgregarFaltanteLocal}
                className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
              >
                Agregar a Solicitud
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
