'use client';

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { urlDeArchivo } from '@/lib/files';
import { useAuth } from '@/app/(protected)/layout';
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
  seguridadRespuestas: Record<number, 'si' | 'no' | 'na'>;
  seguridadJustificaciones?: Record<number, string>;
  checklistRespuestas: Record<number, 'correcto' | 'pendiente'>;
  checklistFotosAntes?: Record<number, string>;
  checklistFotosDespues?: Record<number, string>;
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


// Repuesto disponible para registrar consumo: sale del kit del técnico o,
// si el kit está vacío, del catálogo real de la empresa. Nunca de datos fijos.
interface RepuestoDisponible {
  material_id: number;
  nombre: string;
  unidad: string;
  stock: number | null; // null = no está en el kit (sin control de stock)
}

// Mensaje real del servidor (ApiError.detail) para mostrárselo al técnico.
const mensajeDeError = (e: unknown, respaldo: string): string => {
  if (e instanceof Error && e.message) {
    if (e.message === 'Failed to fetch' || e.message.includes('NetworkError')) {
      return 'Sin conexión con el servidor. Revise su señal e intente de nuevo.';
    }
    return e.message;
  }
  return respaldo;
};

// Solo claves numéricas (id de material). Descarta borradores antiguos guardados por nombre.
const soloIdsDeMaterial = (raw: Record<string, number> | undefined): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    if (/^\d+$/.test(k) && Number(v) > 0) out[k] = Number(v);
  }
  return out;
};

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
  const { user } = useAuth();

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
  // Clave = id de material (como string)
  const [repuestosCantidades, setRepuestosCantidades] = useState<Record<string, number>>({});
  const [repuestosDisponibles, setRepuestosDisponibles] = useState<RepuestoDisponible[]>([]);
  const [cargandoRepuestos, setCargandoRepuestos] = useState<boolean>(true);
  const [errorGuardado, setErrorGuardado] = useState<string>('');
  // La carga de preguntas falló (red/servidor): distinto de "la empresa no configuró nada"
  const [cargaSeguridadFallida, setCargaSeguridadFallida] = useState<boolean>(false);
  const [cargaChecklistFallida, setCargaChecklistFallida] = useState<boolean>(false);
  const [repuestosFotosAntes, setRepuestosFotosAntes] = useState<Record<string, string>>({});
  const [repuestosFotosDespues, setRepuestosFotosDespues] = useState<Record<string, string>>({});
  const [noRepuestosUsed, setNoRepuestosUsed] = useState<boolean>(false);
  const [firmaSaved, setFirmaSaved] = useState<boolean>(false);
  const [firmaDataUrl, setFirmaDataUrl] = useState<string | undefined>(undefined);
  const [firmaNombreCliente, setFirmaNombreCliente] = useState<string>('');
  const [firmaDocumentoCliente, setFirmaDocumentoCliente] = useState<string>('');
  const [firmaFotoEvidencia, setFirmaFotoEvidencia] = useState<string>('');

  // Usability & Validation States
  const [uploadingState, setUploadingState] = useState<Record<string, boolean>>({});
  const [showValidationErrors, setShowValidationErrors] = useState<boolean>(false);

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
            ubicacion: apiOt.cliente?.direccion || apiOt.cliente?.nombre || 'Sede de Cliente',
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
              // La empresa no configuró ítems de seguridad: no se inventan preguntas
              setSafetyItems([]);
            }
          } catch (e) {
            console.error('Could not fetch safety config from API:', e);
            setSafetyItems([]);
            setCargaSeguridadFallida(true);
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
              } catch (e) {
                console.error('Could not fetch checklist template:', e);
                setCargaChecklistFallida(true);
              }
            }
          } else if (apiOt.plantilla_id) {
            try {
              const pDetail = await apiFetch<{ items: { id: number; pregunta: string; orden: number; requerido: boolean }[] }>(`/plantillas/${apiOt.plantilla_id}`);
              if (pDetail && Array.isArray(pDetail.items)) {
                allItems.push(...pDetail.items);
              }
            } catch (e) {
              console.error('Could not fetch checklist template:', e);
              setCargaChecklistFallida(true);
            }
          }
          if (allItems.length > 0) {
            setChecklistItems(allItems);
          } else {
            // Orden sin plantilla: no hay checklist técnico que responder
            setChecklistItems([]);
          }
        }
      } catch (e) {
        console.error('Could not fetch OT detail from API:', e);
      } finally {
        setLoading(false);
      }
    }

    loadOtDetail();

    const applyProgress = (progress: ProgressState) => {
      if (progress.currentStep) setCurrentStep(progress.currentStep);
      if (progress.aceptada !== undefined) setAceptada(progress.aceptada);
      if (progress.aceptadaFecha && progress.aceptadaHora) {
        setAceptadaInfo({
          fecha: progress.aceptadaFecha,
          hora: progress.aceptadaHora,
          gps: progress.aceptadaGps || '',
        });
      }
      if (progress.seguridadRespuestas) setSeguridadRespuestas(progress.seguridadRespuestas);
      if (progress.seguridadJustificaciones) setSeguridadJustificaciones(progress.seguridadJustificaciones);
      if (progress.checklistRespuestas) setChecklistRespuestas(progress.checklistRespuestas);
      if (progress.checklistFotosAntes) setChecklistFotosAntes(progress.checklistFotosAntes);
      if (progress.checklistFotosDespues) setChecklistFotosDespues(progress.checklistFotosDespues);
      if (progress.repuestosCantidades) setRepuestosCantidades(soloIdsDeMaterial(progress.repuestosCantidades));
      if (progress.repuestosFotosAntes) setRepuestosFotosAntes(progress.repuestosFotosAntes);
      if (progress.repuestosFotosDespues) setRepuestosFotosDespues(progress.repuestosFotosDespues);
      if (progress.noRepuestosUsed !== undefined) setNoRepuestosUsed(progress.noRepuestosUsed);
      if (progress.firmaSaved !== undefined) setFirmaSaved(progress.firmaSaved);
      if (progress.firmaDataUrl) setFirmaDataUrl(progress.firmaDataUrl);
      if (progress.firmaNombreCliente) setFirmaNombreCliente(progress.firmaNombreCliente);
      if (progress.firmaDocumentoCliente) setFirmaDocumentoCliente(progress.firmaDocumentoCliente);
      if (progress.firmaFotoEvidencia) setFirmaFotoEvidencia(progress.firmaFotoEvidencia);
    };

    // 1. Cargar caché preliminar de localStorage para render inmediato sin parpadeo
    const progressKey = `ot_progress_${id}`;
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(progressKey);
        if (cached) applyProgress(JSON.parse(cached));
      } catch {}
    }

    // 2. Cargar fuente de verdad del servidor (persiste aunque cambie de celular, limpie caché o modo incógnito)
    apiFetch<{ progreso: ProgressState | null }>(`/tecnico/ordenes/${id}/progreso`)
      .then((res) => {
        if (res?.progreso) {
          applyProgress(res.progreso);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(progressKey, JSON.stringify(res.progreso));
            } catch {}
          }
        }
      })
      .catch((err) => {
        console.warn('No se pudo sincronizar progreso con el servidor, usando caché local:', err);
      });
  }, [id]);

  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const syncProgressToServer = useCallback((stateToSync: ProgressState) => {
    if (!id) return;
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    syncTimeoutRef.current = setTimeout(() => {
      apiFetch(`/tecnico/ordenes/${id}/progreso`, {
        method: 'POST',
        body: JSON.stringify({ progreso: stateToSync }),
      }).catch((err) => {
        console.warn('Auto-guardado en segundo plano falló:', err);
      });
    }, 600);
  }, [id]);

  const saveProgress = (updatedFields: Partial<ProgressState>, immediateSync = false) => {
    const progressKey = `ot_progress_${id}`;
    let current: Partial<ProgressState> = {};
    if (typeof window !== 'undefined') {
      try {
        const currentStored = localStorage.getItem(progressKey);
        if (currentStored) current = JSON.parse(currentStored);
      } catch {}
    }

    const nextState: ProgressState = {
      currentStep: updatedFields.currentStep ?? current.currentStep ?? currentStep,
      aceptada: updatedFields.aceptada ?? current.aceptada ?? aceptada,
      aceptadaFecha: updatedFields.aceptadaFecha ?? current.aceptadaFecha ?? aceptadaInfo?.fecha,
      aceptadaHora: updatedFields.aceptadaHora ?? current.aceptadaHora ?? aceptadaInfo?.hora,
      aceptadaGps: updatedFields.aceptadaGps ?? current.aceptadaGps ?? aceptadaInfo?.gps,
      seguridadRespuestas: updatedFields.seguridadRespuestas ?? current.seguridadRespuestas ?? seguridadRespuestas,
      seguridadJustificaciones: updatedFields.seguridadJustificaciones ?? current.seguridadJustificaciones ?? seguridadJustificaciones,
      checklistRespuestas: updatedFields.checklistRespuestas ?? current.checklistRespuestas ?? checklistRespuestas,
      checklistFotosAntes: updatedFields.checklistFotosAntes ?? current.checklistFotosAntes ?? checklistFotosAntes,
      checklistFotosDespues: updatedFields.checklistFotosDespues ?? current.checklistFotosDespues ?? checklistFotosDespues,
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

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(progressKey, JSON.stringify(nextState));
      } catch {}
    }

    if (immediateSync) {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      apiFetch(`/tecnico/ordenes/${id}/progreso`, {
        method: 'POST',
        body: JSON.stringify({ progreso: nextState }),
      }).catch(() => {});
    } else {
      syncProgressToServer(nextState);
    }
  };

  const handleUploadFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiFetch<{ ruta: string; url?: string }>(`/tecnico/ordenes/${id}/upload-foto`, {
      method: 'POST',
      body: formData,
    });
    return urlDeArchivo(res.ruta || res.url || '');
  };

  // Ubicación real del dispositivo. Si no hay permiso o señal se devuelve null y
  // la orden queda marcada "sin GPS": nunca se inventan coordenadas.
  const getCoordinates = (): Promise<{ latitude: number | null; longitude: number | null }> => {
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
            resolve({ latitude: null, longitude: null });
          },
          { timeout: 8000, enableHighAccuracy: true }
        );
      } else {
        resolve({ latitude: null, longitude: null });
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
      const gps =
        coords.latitude !== null && coords.longitude !== null
          ? `Lat: ${coords.latitude.toFixed(6)}, Lng: ${coords.longitude.toFixed(6)}`
          : 'Sin GPS';

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
      }, true);
    } catch (e) {
      console.error('Error registering departure:', e);
      setErrorGuardado(`No se pudo iniciar el traslado: ${mensajeDeError(e, 'intente de nuevo.')}`);
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
      }, true);
    } catch (e) {
      console.error('Error registering arrival:', e);
      setErrorGuardado(`No se pudo registrar la llegada: ${mensajeDeError(e, 'intente de nuevo.')}`);
    }
  };

  // Step 2 Actions
  const handleSeguridadRespuesta = (index: number, val: 'si' | 'no' | 'na') => {
    const updatedAnswers = { ...seguridadRespuestas, [index]: val };
    setSeguridadRespuestas(updatedAnswers);
    
    const updatedJustifications = { ...seguridadJustificaciones };
    if (val !== 'no') {
      delete updatedJustifications[index];
      setSeguridadJustificaciones(updatedJustifications);
    }
    
    saveProgress({
      seguridadRespuestas: updatedAnswers,
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
    saveProgress({ checklistRespuestas: updated });
  };

  const handleMarkAllCorrect = () => {
    const updated = { ...checklistRespuestas };
    checklistItems.forEach((item) => {
      if (updated[item.id] === undefined) {
        updated[item.id] = 'correcto';
      }
    });
    setChecklistRespuestas(updated);
    saveProgress({ checklistRespuestas: updated });
  };

  // Step 4 Actions
  const handleQuantityChange = (spare: string, diff: number, max: number | null = null) => {
    if (noRepuestosUsed) return;
    const currentQty = repuestosCantidades[spare] || 0;
    let newQty = Math.max(0, currentQty + diff);
    if (max !== null) newQty = Math.min(newQty, Math.max(0, Math.floor(max)));
    const updated = { ...repuestosCantidades, [spare]: newQty };
    setRepuestosCantidades(updated);
    saveProgress({ repuestosCantidades: updated });
  };

  const handleToggleNoRepuestos = () => {
    const nextVal = !noRepuestosUsed;
    const updatedQty = { ...repuestosCantidades };
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
  const [tempQuantities, setTempQuantities] = useState<Record<number, number>>({});
  
  const [mostrarManual, setMostrarManual] = useState<boolean>(false);
  const [manualDescripcion, setManualDescripcion] = useState<string>('');
  const [manualCantidad, setManualCantidad] = useState<number>(1);

  interface FaltanteLocal {
    idTemp: string;
    materialId: number | null;
    nombre: string;
    cantidad: number;
    precio?: number;
  }

  interface CatalogPart {
    id: number;
    nombre: string;
    sku: string;
    precio: number;
    stock: number;
    compatible: boolean;
  }

  const [repuestosFaltantesLocales, setRepuestosFaltantesLocales] = useState<FaltanteLocal[]>([]);
  const [catalogParts, setCatalogParts] = useState<CatalogPart[]>([]);

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const data = await apiFetch<{ id: number; nombre: string; codigo: string; precio_unitario: number | string }[]>('/repuestos');
        const mapped: CatalogPart[] = (Array.isArray(data) ? data : []).map((item) => ({
          id: item.id,
          nombre: item.nombre,
          sku: item.codigo,
          precio: Number(item.precio_unitario) || 0.0,
          stock: 0,
          compatible: true,
        }));
        setCatalogParts(mapped);
      } catch (e) {
        // Sin catálogo no se inventan repuestos: queda la opción de ingreso manual
        console.error('Error fetching catalog parts:', e);
        setCatalogParts([]);
      }
    };
    fetchCatalog();
  }, []);

  // Repuestos que el técnico puede registrar como usados: su kit vehicular real.
  // Si el kit está vacío se ofrece el catálogo de la empresa (sin control de stock).
  useEffect(() => {
    if (!user?.id) return;
    let cancelado = false;
    const cargar = async () => {
      try {
        const inv = await apiFetch<
          { material_id: number; cantidad: number | string; material: { id: number; nombre: string; unidad_medida: string } | null }[]
        >(`/inventario/tecnico/${user.id}`);
        const delKit: RepuestoDisponible[] = (Array.isArray(inv) ? inv : [])
          .filter((i) => i.material)
          .map((i) => ({
            material_id: i.material_id,
            nombre: i.material!.nombre,
            unidad: i.material!.unidad_medida || 'unidades',
            stock: Number(i.cantidad) || 0,
          }));
        if (delKit.length > 0) {
          if (!cancelado) setRepuestosDisponibles(delKit);
          return;
        }
        const cat = await apiFetch<{ id: number; nombre: string; unidad_medida?: string }[]>('/repuestos');
        if (!cancelado) {
          setRepuestosDisponibles(
            (Array.isArray(cat) ? cat : []).map((c) => ({
              material_id: c.id,
              nombre: c.nombre,
              unidad: c.unidad_medida || 'unidades',
              stock: null,
            }))
          );
        }
      } catch (e) {
        console.error('Error cargando repuestos disponibles:', e);
        if (!cancelado) setRepuestosDisponibles([]);
      } finally {
        if (!cancelado) setCargandoRepuestos(false);
      }
    };
    cargar();
    return () => {
      cancelado = true;
    };
  }, [user?.id]);

  const filteredCatalogParts = useMemo(() => {
    return catalogParts.filter(p => {
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
  }, [catalogParts, repuestoBusqueda, filtrarCompatibles]);

  const handleAgregarFaltanteLocal = () => {
    const newItems: FaltanteLocal[] = [];
    
    // 1. Gather catalog items with qty > 0
    Object.entries(tempQuantities).forEach(([idStr, qty]) => {
      if (qty > 0) {
        const matId = Number(idStr);
        const item = catalogParts.find(p => p.id === matId);
        if (item) {
          newItems.push({
            idTemp: Math.random().toString(36).substring(2, 9),
            materialId: matId,
            nombre: item.nombre,
            cantidad: qty,
          });
        }
      }
    });

    // 2. Gather manual item if filled and open
    let hasManual = false;
    let manualItem: FaltanteLocal | null = null;
    if (mostrarManual) {
      if (manualDescripcion.trim()) {
        manualItem = {
          idTemp: Math.random().toString(36).substring(2, 9),
          materialId: null,
          nombre: manualDescripcion.trim(),
          cantidad: manualCantidad,
        };
        hasManual = true;
      }
    }

    if (newItems.length === 0 && !hasManual) {
      alert('Debe ajustar la cantidad de al menos un repuesto (> 0) o llenar la descripción manual.');
      return;
    }

    // Update state
    setRepuestosFaltantesLocales((prev) => {
      const next = [...prev, ...newItems];
      if (manualItem) {
        next.push(manualItem);
      }
      return next;
    });

    // Close and reset
    setShowRepuestoModal(false);
    setRepuestoBusqueda('');
    setTempQuantities({});
    setMostrarManual(false);
    setManualDescripcion('');
    setManualCantidad(1);
  };

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

  const handleEnviarFaltantes = async () => {
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
      alert(`No se pudieron solicitar los repuestos: ${mensajeDeError(e, 'intente de nuevo.')}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSolicitarRepuestoFaltante = () => {
    setTempQuantities({});
    setShowRepuestoModal(true);
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
  const isStep1Valid = aceptada && ot?.fecha_llegada !== undefined && ot?.fecha_llegada !== null;
  const isStep2Valid = !cargaSeguridadFallida && safetyItems.every((item) => {
    const ans = seguridadRespuestas[item.id];
    if (ans === undefined) return false;
    if (ans === 'no') {
      const just = seguridadJustificaciones[item.id];
      return just !== undefined && just.trim() !== '';
    }
    return true;
  });
  
  const completedCount = checklistItems.filter((item) => checklistRespuestas[item.id] !== undefined).length;
  const totalCount = checklistItems.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isStep3Valid = !cargaChecklistFallida && completedCount === totalCount;

  const totalSparesQty = Object.values(repuestosCantidades).reduce((sum, val) => sum + val, 0);
  const isStep4Valid = noRepuestosUsed || totalSparesQty > 0;
  const hasSparesPending = !noRepuestosUsed && totalSparesQty === 0;

  const isStep5Valid = isStep1Valid && isStep2Valid && isStep3Valid && isStep4Valid && firmaSaved && firmaNombreCliente.trim() !== '' && firmaDocumentoCliente.trim() !== '' && firmaFotoEvidencia.trim() !== '';

  const handleNext = async () => {
    if (currentStep === 1 && !isStep1Valid) {
      setShowValidationErrors(true);
      return;
    }

    // Save safety answers to API when leaving Paso 2
    if (currentStep === 2) {
      if (!isStep2Valid) {
        setShowValidationErrors(true);
        return;
      }
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
        setErrorGuardado(`No se pudo guardar el checklist de seguridad: ${mensajeDeError(e, 'intente de nuevo.')}`);
        return;
      }
    }

    // Save technical checklist to API when leaving Paso 3
    if (currentStep === 3) {
      if (!isStep3Valid) {
        setShowValidationErrors(true);
        return;
      }
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
        setErrorGuardado(`No se pudo guardar el checklist: ${mensajeDeError(e, 'intente de nuevo.')}`);
        return;
      }
    }

    // Save spare parts to API when leaving Paso 4
    if (currentStep === 4) {
      if (!isStep4Valid) {
        setShowValidationErrors(true);
        return;
      }
      if (!noRepuestosUsed && totalSparesQty > 0) {
        try {
          const repuestosPayload = Object.keys(soloIdsDeMaterial(repuestosCantidades)).map((key) => ({
            material_id: Number(key),
            cantidad: repuestosCantidades[key],
            foto_antes: repuestosFotosAntes[key] || null,
            foto_despues: repuestosFotosDespues[key] || null,
          }));
          await apiFetch(`/tecnico/ordenes/${id}/repuestos`, {
            method: 'POST',
            body: JSON.stringify(repuestosPayload),
          });
        } catch (e) {
          // No avanzar: si se oculta el error, el consumo se pierde y el stock queda mal
          console.error('Error saving spare parts:', e);
          setErrorGuardado(`No se pudieron guardar los repuestos: ${mensajeDeError(e, 'intente de nuevo.')}`);
          return;
        }
      }
    }

    setErrorGuardado('');
    if (currentStep < 5) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      saveProgress({ currentStep: nextStep }, true);
      setShowValidationErrors(false);
    }
  };

  const handlePrev = () => {
    setShowValidationErrors(false);
    if (currentStep > 1) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      saveProgress({ currentStep: prevStep }, true);
    } else {
      router.push('/tecnico');
    }
  };

  const handleFinalizar = async () => {
    if (!isStep5Valid) return;
    if (!firmaDataUrl) {
      setErrorGuardado('Falta la firma del cliente. Pida que firme en el recuadro antes de finalizar.');
      return;
    }
    setErrorGuardado('');

    try {
      if (id) {
        await apiFetch(`/tecnico/ordenes/${id}/cerrar`, {
          method: 'POST',
          body: JSON.stringify({
            firma_base64: firmaDataUrl,
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
      console.error('Backend API cerrar failed:', err);
      setErrorGuardado(`No se pudo finalizar la orden: ${mensajeDeError(err, 'intente de nuevo.')}`);
    }
  };

  const handlePrecierre = async () => {
    try {
      if (id) {
        await apiFetch(`/ordenes/${id}/transicion`, {
          method: 'POST',
          body: JSON.stringify({
            estado_nuevo: 'PRECIERRE',
            comentario: 'Orden de trabajo pre-cerrada temporalmente desde terreno.',
          }),
        });
        if (ot) {
          setOt({ ...ot, estado: 'PRECIERRE' });
        }
        alert('¡Orden de Trabajo pre-cerrada correctamente!');
        router.push('/tecnico');
      }
    } catch (err) {
      console.error('Backend API transition to PRECIERRE failed:', err);
      setErrorGuardado(`No se pudo pre-cerrar la orden: ${mensajeDeError(err, 'intente de nuevo.')}`);
    }
  };

  const handleReabrirOT = async () => {
    try {
      if (id) {
        await apiFetch(`/ordenes/${id}/transicion`, {
          method: 'POST',
          body: JSON.stringify({
            estado_nuevo: 'EN_EJECUCION',
            comentario: 'Reanudando trabajos desde campo.',
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
      console.error('Backend API transition to EN_EJECUCION failed:', err);
      setErrorGuardado(`No se pudo reabrir la orden: ${mensajeDeError(err, 'intente de nuevo.')}`);
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
        {errorGuardado && (
          <div role="alert" className="w-full bg-red-50 border border-red-200 rounded-xl p-2.5 text-[11px] text-red-700 font-bold text-left">
            ⚠️ {errorGuardado}
          </div>
        )}
        
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
              const isInvalid = showValidationErrors && (
                ans === undefined ||
                (ans === 'no' && (!seguridadJustificaciones[item.id] || seguridadJustificaciones[item.id].trim() === ''))
              );
              return (
                <div 
                  key={item.id} 
                  className={`bg-white border rounded-[16px] p-4 shadow-xs space-y-3 transition-all ${
                    isInvalid ? 'border-red-300 bg-red-50/20' : 'border-zinc-200'
                  }`}
                >
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

            {/* Barra de Progreso del Checklist (H1) y Acelerador (H7) */}
            <div className="bg-white border border-zinc-200 rounded-[16px] p-4 shadow-xs space-y-3">
              <div className="flex justify-between text-[11px] font-extrabold text-zinc-500 uppercase tracking-wider">
                <span>Progreso de Inspección</span>
                <span>{completedCount} de {totalCount} completados</span>
              </div>
              <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-teal-600 h-full transition-all duration-500" 
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              
              {completedCount < totalCount && (
                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={handleMarkAllCorrect}
                    className="text-[10px] font-bold text-teal-650 hover:text-teal-700 transition-colors flex items-center gap-1 cursor-pointer bg-teal-50 px-2.5 py-1.5 rounded-lg border border-teal-200/50"
                  >
                    ⚡ Marcar todos como correcto
                  </button>
                </div>
              )}
            </div>

            {checklistItems.map((item) => {
              const ans = checklistRespuestas[item.id];
              const isInvalid = showValidationErrors && ans === undefined;
              return (
                <div 
                  key={item.id} 
                  className={`bg-white border rounded-[16px] p-4 shadow-xs space-y-3 transition-all ${
                    isInvalid ? 'border-red-300 bg-red-50/20' : 'border-zinc-200'
                  }`}
                >
                  <p className="text-xs font-bold text-zinc-900 leading-snug break-words whitespace-normal">
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
                    {/* Slot 1: Foto Antes */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-zinc-500 font-bold block mb-1">Foto Antes</span>
                      {checklistFotosAntes[item.id] ? (
                        <div className="relative h-[68px] border border-zinc-200 rounded-xl overflow-hidden group bg-zinc-50">
                          <img
                            src={urlDeArchivo(checklistFotosAntes[item.id])}
                            alt="Antes"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => {
                                const next = { ...checklistFotosAntes };
                                delete next[item.id];
                                setChecklistFotosAntes(next);
                                saveProgress({ checklistFotosAntes: next });
                              }}
                              className="bg-red-600 hover:bg-red-700 text-white rounded-lg p-1.5 text-[10px] font-bold transition-colors cursor-pointer"
                              title="Eliminar"
                            >
                              ✕ Eliminar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className={`flex flex-col items-center justify-center h-[68px] border border-dashed rounded-xl cursor-pointer transition-colors bg-zinc-50 hover:bg-zinc-100 ${
                          uploadingState[`${item.id}-antes`] ? 'border-zinc-300 opacity-60' : 'border-zinc-300 hover:border-teal-600'
                        }`}>
                          {uploadingState[`${item.id}-antes`] ? (
                            <>
                              <span className="animate-spin text-sm">⌛</span>
                              <span className="text-[9px] text-zinc-400 mt-1">Subiendo...</span>
                            </>
                          ) : (
                            <>
                              <span className="text-xs">📷</span>
                              <span className="text-[10px] text-zinc-500 mt-0.5">Foto Antes</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploadingState[`${item.id}-antes`]}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const uploadKey = `${item.id}-antes`;
                                setUploadingState((prev) => ({ ...prev, [uploadKey]: true }));
                                try {
                                  const path = await handleUploadFile(file);
                                  setErrorGuardado('');
                                  const next = { ...checklistFotosAntes, [item.id]: path };
                                  setChecklistFotosAntes(next);
                                  saveProgress({ checklistFotosAntes: next });
                                } catch (err) {
                                  console.error(err);
                                  setErrorGuardado(`La foto no se guardó: ${mensajeDeError(err, 'error de subida.')} Selecciónela otra vez para reintentar.`);
                                } finally {
                                  // Permite volver a elegir el mismo archivo para reintentar
                                  e.target.value = '';
                                  setUploadingState((prev) => ({ ...prev, [uploadKey]: false }));
                                }
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      )}
                    </div>

                    {/* Slot 2: Foto Después */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-zinc-500 font-bold block mb-1">Foto Después</span>
                      {checklistFotosDespues[item.id] ? (
                        <div className="relative h-[68px] border border-zinc-200 rounded-xl overflow-hidden group bg-zinc-50">
                          <img
                            src={urlDeArchivo(checklistFotosDespues[item.id])}
                            alt="Después"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => {
                                const next = { ...checklistFotosDespues };
                                delete next[item.id];
                                setChecklistFotosDespues(next);
                                saveProgress({ checklistFotosDespues: next });
                              }}
                              className="bg-red-600 hover:bg-red-700 text-white rounded-lg p-1.5 text-[10px] font-bold transition-colors cursor-pointer"
                              title="Eliminar"
                            >
                              ✕ Eliminar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <label className={`flex flex-col items-center justify-center h-[68px] border border-dashed rounded-xl cursor-pointer transition-colors bg-zinc-50 hover:bg-zinc-100 ${
                          uploadingState[`${item.id}-despues`] ? 'border-zinc-300 opacity-60' : 'border-zinc-300 hover:border-teal-600'
                        }`}>
                          {uploadingState[`${item.id}-despues`] ? (
                            <>
                              <span className="animate-spin text-sm">⌛</span>
                              <span className="text-[9px] text-zinc-400 mt-1">Subiendo...</span>
                            </>
                          ) : (
                            <>
                              <span className="text-xs">📷</span>
                              <span className="text-[10px] text-zinc-500 mt-0.5">Foto Después</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploadingState[`${item.id}-despues`]}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const uploadKey = `${item.id}-despues`;
                                setUploadingState((prev) => ({ ...prev, [uploadKey]: true }));
                                try {
                                  const path = await handleUploadFile(file);
                                  setErrorGuardado('');
                                  const next = { ...checklistFotosDespues, [item.id]: path };
                                  setChecklistFotosDespues(next);
                                  saveProgress({ checklistFotosDespues: next });
                                } catch (err) {
                                  console.error(err);
                                  setErrorGuardado(`La foto no se guardó: ${mensajeDeError(err, 'error de subida.')} Selecciónela otra vez para reintentar.`);
                                } finally {
                                  // Permite volver a elegir el mismo archivo para reintentar
                                  e.target.value = '';
                                  setUploadingState((prev) => ({ ...prev, [uploadKey]: false }));
                                }
                              }
                            }}
                            className="hidden"
                          />
                        </label>
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
                {cargandoRepuestos && (
                  <p className="text-xs text-zinc-400 font-medium py-2">Cargando repuestos…</p>
                )}
                {!cargandoRepuestos && repuestosDisponibles.length === 0 && (
                  <p className="text-xs text-zinc-500 font-medium py-2">
                    No hay repuestos en su kit ni en el catálogo de la empresa. Marque que no se usaron
                    repuestos o solicite uno faltante.
                  </p>
                )}
                {repuestosDisponibles.map((rp) => {
                  const spare = String(rp.material_id);
                  const qty = repuestosCantidades[spare] || 0;
                  const unit = rp.unidad || getSpareUnit(rp.nombre);
                  const sinStock = rp.stock !== null && qty >= Math.floor(rp.stock);
                  return (
                    <div key={spare} className="pt-3 first:pt-0 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="text-xs font-bold text-zinc-900 truncate">{rp.nombre}</p>
                          <p className="text-[10px] text-zinc-400 font-medium">
                            {unit}
                            {rp.stock !== null && ` · en kit: ${rp.stock}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            disabled={noRepuestosUsed}
                            onClick={() => handleQuantityChange(spare, -1, rp.stock)}
                            className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 font-bold text-sm disabled:opacity-40 flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="font-mono text-xs font-bold w-5 text-center">{qty}</span>
                          <button
                            disabled={noRepuestosUsed || sinStock}
                            onClick={() => handleQuantityChange(spare, 1, rp.stock)}
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
                            setErrorGuardado(`La foto no se guardó: ${mensajeDeError(err, 'error de subida.')} Selecciónela otra vez para reintentar.`);
                          } finally {
                            e.target.value = '';
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
      <div className="fixed bottom-[68px] left-0 right-0 max-w-[420px] mx-auto bg-white border-t border-zinc-200/80 p-3 flex flex-col gap-2.5 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        {errorGuardado && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-[11px] text-red-700 font-bold flex items-center gap-1.5">
            <span>⚠️</span>
            <span>{errorGuardado}</span>
          </div>
        )}
        {(cargaSeguridadFallida || cargaChecklistFallida) && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-[11px] text-red-700 font-bold flex items-center gap-2">
            <span className="flex-1">
              ⚠️ No se pudo cargar {cargaSeguridadFallida ? 'el checklist de seguridad' : 'el checklist técnico'}. Revise su señal y reintente antes de continuar.
            </span>
            <button onClick={() => window.location.reload()} className="shrink-0 h-8 px-3 bg-red-600 text-white rounded-lg">
              Reintentar
            </button>
          </div>
        )}
        {/* Banner de Validación de Errores (H9) */}
        {showValidationErrors && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-[11px] text-red-700 font-bold flex items-center gap-1.5 animate-fadeIn">
            <span>⚠️</span>
            <span>
              {currentStep === 1 && 'Falta iniciar traslado y confirmar llegada.'}
              {currentStep === 2 && 'Falta completar el checklist de seguridad obligatorio y justificaciones.'}
              {currentStep === 3 && `Falta responder ${totalCount - completedCount} preguntas en el checklist.`}
              {currentStep === 4 && "Seleccione al menos un repuesto o marque 'No se utilizaron repuestos'."}
            </span>
          </div>
        )}

        <div className="flex gap-3 w-full">
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
              onClick={handleNext}
              className="flex-1 h-11 rounded-xl text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white shadow-xs cursor-pointer"
            >
              <span>Avanzar</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
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
                  const qty = tempQuantities[item.id] || 0;
                  return (
                    <div
                      key={item.id}
                      className={`flex justify-between items-center p-2.5 rounded-xl border text-xs transition-all ${
                        qty > 0
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-medium'
                          : 'bg-white border-zinc-200 text-zinc-750 hover:bg-zinc-50'
                      }`}
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="font-bold text-zinc-900 truncate">{item.nombre}</span>
                        <span className="text-[10px] text-zinc-400 font-mono">{item.sku}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setTempQuantities(prev => ({
                              ...prev,
                              [item.id]: Math.max(0, qty - 1)
                            }));
                          }}
                          className="w-7 h-7 rounded-lg bg-zinc-100 border border-zinc-200 font-bold text-sm flex items-center justify-center cursor-pointer select-none active:scale-90 disabled:opacity-40"
                          disabled={qty === 0}
                        >
                          -
                        </button>
                        <span className="font-mono text-xs font-bold w-5 text-center">{qty}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setTempQuantities(prev => ({
                              ...prev,
                              [item.id]: Math.min(item.stock, qty + 1)
                            }));
                          }}
                          className="w-7 h-7 rounded-lg bg-zinc-100 border border-zinc-200 font-bold text-sm flex items-center justify-center cursor-pointer select-none active:scale-90"
                        >
                          +
                        </button>
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
                </div>
              )}
            </div>
            
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
