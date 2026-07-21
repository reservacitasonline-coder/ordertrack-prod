'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../layout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { apiFetch } from '@/lib/api';
import { ESTADO_COLORS, ESTADO_LABELS, PRIORIDAD_COLORS, PRIORIDAD_LABELS, QUICK_REPLIES } from '@/lib/constants';
import { OrdenTrabajo, PlantillaTrabajo, RepuestoMaterial, EstadoOT } from '@/types';

interface ChecklistAnswerInput {
  plantilla_item_id: number;
  pregunta: string;
  tipo_respuesta: string;
  requerido: boolean;
  valor_texto?: string;
  valor_numerico?: number;
  valor_booleano?: boolean;
  ruta_foto?: string;
}

interface MaterialUsedInput {
  material_id: number;
  nombre: string;
  cantidad: number;
}

export default function TecnicoEjecucionPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = Number(params?.id);

  const [ot, setOt] = useState<OrdenTrabajo | null>(null);
  const [plantilla, setPlantilla] = useState<PlantillaTrabajo | null>(null);
  const [plantillasAsociadas, setPlantillasAsociadas] = useState<PlantillaTrabajo[]>([]);
  const [materialesCatalog, setMaterialesCatalog] = useState<RepuestoMaterial[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Stepper Wizard State
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Safety checklist states
  const [safetyItems, setSafetyItems] = useState<any[]>([]);
  const [safetyRespuestas, setSafetyRespuestas] = useState<Record<number, { cumple: boolean; motivo_no_cumplimiento?: string }>>({});
  const [safetySubmitted, setSafetySubmitted] = useState(false);

  // Solicitar repuesto faltante modal/state
  const [showSolicitudModal, setShowSolicitudModal] = useState(false);
  const [solicitarMatId, setSolicitarMatId] = useState<number | 'otro'>('otro');
  const [solicitarOtroNombre, setSolicitarOtroNombre] = useState('');
  const [solicitarCantidad, setSolicitarCantidad] = useState(1);
  const [pendingParts, setPendingParts] = useState<any[]>([]);

  // Encuesta rating
  const [rating, setRating] = useState<number | null>(null);

  // Equipment history
  const [equipmentHistory, setEquipmentHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Field states
  const [checklistRespuestas, setChecklistRespuestas] = useState<Record<number, ChecklistAnswerInput>>({});
  const [repuestosUsados, setRepuestosUsados] = useState<Record<number, MaterialUsedInput>>({});
  const [comentariosCierre, setComentariosCierre] = useState('');
  
  // Signature Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Sync state with online/offline
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      triggerOfflineSync();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOffline(!navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [id]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let otData: OrdenTrabajo | null = null;
      let catalogData: RepuestoMaterial[] = [];
      let plantillaData: PlantillaTrabajo | null = null;

      if (navigator.onLine) {
        otData = await apiFetch<OrdenTrabajo>(`/ordenes/${id}`);
        catalogData = await apiFetch<RepuestoMaterial[]>('/repuestos');
        
        const plantillasIds: number[] = [];
        if (otData.plantillas && otData.plantillas.length > 0) {
          otData.plantillas.forEach((p: any) => plantillasIds.push(p.id));
        } else if (otData.plantilla_id) {
          plantillasIds.push(otData.plantilla_id);
        }

        const loadedPlantillas: PlantillaTrabajo[] = [];
        for (const pid of plantillasIds) {
          try {
            const pd = await apiFetch<PlantillaTrabajo>(`/plantillas/${pid}`);
            loadedPlantillas.push(pd);
            localStorage.setItem(`cache_plantilla_${pid}`, JSON.stringify(pd));
          } catch {}
        }
        plantillaData = loadedPlantillas[0] || null;

        localStorage.setItem(`cache_ot_${id}`, JSON.stringify(otData));
        localStorage.setItem(`cache_materiales`, JSON.stringify(catalogData));
        setPlantillasAsociadas(loadedPlantillas);
      } else {
        setIsOffline(true);
        const cachedOt = localStorage.getItem(`cache_ot_${id}`);
        const cachedMats = localStorage.getItem(`cache_materiales`);
        if (cachedOt) otData = JSON.parse(cachedOt);
        if (cachedMats) catalogData = JSON.parse(cachedMats);

        const cachedPlantillas: PlantillaTrabajo[] = [];
        const pIds: number[] = [];
        if (otData?.plantillas) otData.plantillas.forEach((p: any) => pIds.push(p.id));
        else if (otData?.plantilla_id) pIds.push(otData.plantilla_id);
        for (const pid of pIds) {
          const cached = localStorage.getItem(`cache_plantilla_${pid}`);
          if (cached) cachedPlantillas.push(JSON.parse(cached));
        }
        plantillaData = cachedPlantillas[0] || null;
        setPlantillasAsociadas(cachedPlantillas);
      }

      if (!otData) {
        throw new Error('No se pudo encontrar la orden de trabajo (sin conexión y sin caché)');
      }

      setOt(otData);
      setMaterialesCatalog(catalogData);
      
      if (plantillaData || plantillasAsociadas.length > 0) {
        const allItems = plantillasAsociadas.length > 0
          ? plantillasAsociadas.flatMap((pt) => pt.items)
          : (plantillaData?.items || []);
        const initialAnswers: Record<number, ChecklistAnswerInput> = {};
        allItems.forEach((item) => {
          initialAnswers[item.id] = {
            plantilla_item_id: item.id,
            pregunta: item.pregunta,
            tipo_respuesta: item.tipo_respuesta,
            requerido: item.requerido,
          };
        });

        const savedOffline = localStorage.getItem(`offline_checklist_${id}`);
        if (savedOffline) {
          const parsed = JSON.parse(savedOffline);
          Object.assign(initialAnswers, parsed);
        } else if (navigator.onLine) {
          try {
            const serverAnswers = await apiFetch<any[]>(`/ordenes/${id}/checklist-respuestas`);
            serverAnswers.forEach((ans) => {
              if (initialAnswers[ans.plantilla_item_id]) {
                initialAnswers[ans.plantilla_item_id].valor_texto = ans.valor_texto;
                initialAnswers[ans.plantilla_item_id].valor_numerico = ans.valor_numerico;
                initialAnswers[ans.plantilla_item_id].valor_booleano = ans.valor_booleano;
                initialAnswers[ans.plantilla_item_id].ruta_foto = ans.ruta_foto;
              }
            });
          } catch (e) {}
        }
        setChecklistRespuestas(initialAnswers);
      }

      // Load repuestos usados
      const initialRepuestos: Record<number, MaterialUsedInput> = {};
      const savedOfflineRep = localStorage.getItem(`offline_repuestos_${id}`);
      if (savedOfflineRep) {
        Object.assign(initialRepuestos, JSON.parse(savedOfflineRep));
      } else if (navigator.onLine) {
        try {
          const serverReps = await apiFetch<any[]>(`/ordenes/${id}/repuestos-usados`);
          serverReps.forEach((r) => {
            initialRepuestos[r.material.id] = {
              material_id: r.material.id,
              nombre: r.material.nombre,
              cantidad: parseFloat(r.cantidad),
            };
          });
        } catch (e) {}
      }
      setRepuestosUsados(initialRepuestos);

      // Load safety items
      if (navigator.onLine) {
        try {
          const sItems = await apiFetch<any[]>(`/tecnico/ordenes/${id}/seguridad`);
          setSafetyItems(sItems);
          
          const cachedSafety = localStorage.getItem(`offline_safety_${id}`);
          if (cachedSafety) {
            setSafetyRespuestas(JSON.parse(cachedSafety));
            setSafetySubmitted(true);
          } else {
            const initialSafety: Record<number, any> = {};
            sItems.forEach(item => {
              initialSafety[item.id] = { cumple: true, motivo_no_cumplimiento: '' };
            });
            setSafetyRespuestas(initialSafety);
          }
        } catch (e) {}
      } else {
        const cachedSafetyItems = localStorage.getItem(`cache_safety_items_${id}`);
        if (cachedSafetyItems) {
          setSafetyItems(JSON.parse(cachedSafetyItems));
        }
        const cachedSafety = localStorage.getItem(`offline_safety_${id}`);
        if (cachedSafety) {
          setSafetyRespuestas(JSON.parse(cachedSafety));
          setSafetySubmitted(true);
        }
      }

      setEquipmentHistory([
        { fecha: '2026-06-15', servicio: 'Mantenimiento Preventivo', tecnico: 'Técnico Alpha', nota: 'Atenuación fibra óptica en -14.2dB. Conectores limpios.' },
        { fecha: '2026-04-10', servicio: 'Reparación Enlace Fibra', tecnico: 'Técnico Beta', nota: 'Cambio de patchcord dañado. Señal restaurada.' }
      ]);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los detalles de la orden');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const hasInitializedStep = useRef(false);

  // Stepper steps configuration (mockup organization)
  const steps = useMemo(() => {
    const list = [];
    list.push({ id: 'aceptar', label: 'Aceptar', icon: '🚀' });
    if (safetyItems.length > 0) {
      list.push({ id: 'seguridad', label: 'Seguridad', icon: '🛡️' });
    }
    if (plantillasAsociadas.length > 0 || plantilla) {
      list.push({ id: 'checklist', label: 'Checklist', icon: '📋' });
    }
    list.push({ id: 'repuestos', label: 'Repuestos', icon: '🔧' });
    list.push({ id: 'cierre', label: 'Cierre', icon: '✍️' });
    return list;
  }, [safetyItems, plantillasAsociadas, plantilla]);

  const activeStep = steps[currentStepIndex];

  // Auto-focus the active step based on progress once upon load
  useEffect(() => {
    if (!loading && ot && !hasInitializedStep.current) {
      const isArrived = ot.estado === 'EN_EJECUCION' && ot.fecha_llegada;
      if (!isArrived) {
        setCurrentStepIndex(0);
      } else {
        const findIndexById = (id: string) => steps.findIndex(s => s.id === id);
        const indexSeguridad = findIndexById('seguridad');
        const indexChecklist = findIndexById('checklist');
        const indexRepuestos = findIndexById('repuestos');
        const indexCierre = findIndexById('cierre');

        if (indexSeguridad !== -1 && !safetySubmitted) {
          setCurrentStepIndex(indexSeguridad);
        } else {
          const answers = Object.values(checklistRespuestas);
          const hasUnansweredRequired = answers.some(a => 
            a.requerido && 
            a.valor_booleano === undefined && 
            a.valor_numerico === undefined && 
            (!a.valor_texto || a.valor_texto.trim() === '') && 
            !a.ruta_foto
          );
          if (indexChecklist !== -1 && hasUnansweredRequired) {
            setCurrentStepIndex(indexChecklist);
          } else {
            setCurrentStepIndex(indexRepuestos !== -1 ? indexRepuestos : indexCierre);
          }
        }
      }
      hasInitializedStep.current = true;
    }
  }, [loading, ot, steps, safetySubmitted, checklistRespuestas]);

  const translationTime = useMemo(() => {
    if (ot?.fecha_salida && ot?.fecha_llegada) {
      const diff = new Date(ot.fecha_llegada).getTime() - new Date(ot.fecha_salida).getTime();
      return `${Math.floor(diff / 60000)} min`;
    }
    return '24 min (estimado)';
  }, [ot?.fecha_salida, ot?.fecha_llegada]);

  const siteTime = useMemo(() => {
    if (ot?.fecha_llegada) {
      const diff = Date.now() - new Date(ot.fecha_llegada).getTime();
      return `${Math.floor(diff / 60000)} min`;
    }
    return '--';
  }, [ot?.fecha_llegada]);

  // Offline Synchronization Trigger
  const triggerOfflineSync = async () => {
    const queueKey = `offline_queue_ot_${id}`;
    const queue = localStorage.getItem(queueKey);
    if (!queue) return;

    const ops = JSON.parse(queue);
    if (ops.length === 0) return;

    setSubmitting(true);
    try {
      for (const op of ops) {
        if (op.type === 'salida') {
          await apiFetch(`/tecnico/ordenes/${id}/salida`, {
            method: 'POST',
            body: JSON.stringify(op.data),
          });
        } else if (op.type === 'llegada') {
          await apiFetch(`/tecnico/ordenes/${id}/llegada`, {
            method: 'POST',
            body: JSON.stringify(op.data),
          });
        } else if (op.type === 'seguridad') {
          await apiFetch(`/tecnico/ordenes/${id}/seguridad`, {
            method: 'POST',
            body: JSON.stringify(op.data),
          });
        } else if (op.type === 'solicitar-repuesto') {
          await apiFetch(`/tecnico/ordenes/${id}/solicitar-repuesto`, {
            method: 'POST',
            body: JSON.stringify(op.data),
          });
        } else if (op.type === 'checklist') {
          await apiFetch(`/tecnico/ordenes/${id}/checklist`, {
            method: 'POST',
            body: JSON.stringify(op.data),
          });
        } else if (op.type === 'repuestos') {
          await apiFetch(`/tecnico/ordenes/${id}/repuestos`, {
            method: 'POST',
            body: JSON.stringify(op.data),
          });
        } else if (op.type === 'encuesta') {
          await apiFetch(`/tecnico/ordenes/${id}/encuesta`, {
            method: 'POST',
            body: JSON.stringify(op.data),
          });
        } else if (op.type === 'cerrar') {
          await apiFetch(`/tecnico/ordenes/${id}/cerrar`, {
            method: 'POST',
            body: JSON.stringify(op.data),
          });
        }
      }
      localStorage.removeItem(queueKey);
      localStorage.removeItem(`offline_checklist_${id}`);
      localStorage.removeItem(`offline_repuestos_${id}`);
      localStorage.removeItem(`offline_safety_${id}`);
      alert('Cambios sincronizados correctamente con el servidor.');
      loadData();
    } catch (e) {
      alert('Error en la sincronización automática: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSubmitting(false);
    }
  };

  const queueOfflineOp = (type: string, data: any) => {
    const queueKey = `offline_queue_ot_${id}`;
    const queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
    queue.push({ type, data });
    localStorage.setItem(queueKey, JSON.stringify(queue));
  };

  const getCoordinates = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('La geolocalización no es soportada por este navegador.'));
      } else {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      }
    });
  };

  const handleStartTransit = async () => {
    setSubmitting(true);
    try {
      let lat = 0.0;
      let lng = 0.0;
      try {
        const pos = await getCoordinates();
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (e) {
        alert('No se pudo obtener la ubicación GPS exacta, se enviará coordenadas cero.');
      }

      const payload = { latitud_salida: lat, longitud_salida: lng };
      if (navigator.onLine) {
        await apiFetch(`/tecnico/ordenes/${id}/salida`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        loadData();
      } else {
        queueOfflineOp('salida', payload);
        if (ot) {
          const updated = { ...ot, estado: 'EN_EJECUCION' as EstadoOT, fecha_salida: new Date().toISOString() };
          setOt(updated);
          localStorage.setItem(`cache_ot_${id}`, JSON.stringify(updated));
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al registrar salida');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArriveSite = async () => {
    setSubmitting(true);
    try {
      let lat = 0.0;
      let lng = 0.0;
      try {
        const pos = await getCoordinates();
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (e) {
        alert('No se pudo obtener la ubicación GPS exacta.');
      }

      const payload = { latitud_llegada: lat, longitud_llegada: lng };
      if (navigator.onLine) {
        await apiFetch(`/tecnico/ordenes/${id}/llegada`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        loadData();
      } else {
        queueOfflineOp('llegada', payload);
        if (ot) {
          const updated = { ...ot, fecha_llegada: new Date().toISOString() };
          setOt(updated);
          localStorage.setItem(`cache_ot_${id}`, JSON.stringify(updated));
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al registrar llegada');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveSafety = async () => {
    for (const item of safetyItems) {
      const resp = safetyRespuestas[item.id];
      if (item.requerido && (!resp || resp.cumple === undefined)) {
        alert(`Falta responder el ítem de seguridad obligatorio: "${item.pregunta}"`);
        return;
      }
      if (resp && resp.cumple === false && (!resp.motivo_no_cumplimiento || resp.motivo_no_cumplimiento.trim() === '')) {
        alert(`Debe ingresar la justificación por el no cumplimiento de: "${item.pregunta}"`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        respuestas: Object.keys(safetyRespuestas).map((k) => ({
          seguridad_item_id: Number(k),
          cumple: safetyRespuestas[Number(k)].cumple,
          motivo_no_cumplimiento: safetyRespuestas[Number(k)].motivo_no_cumplimiento || null
        }))
      };

      if (navigator.onLine) {
        await apiFetch(`/tecnico/ordenes/${id}/seguridad`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } else {
        queueOfflineOp('seguridad', payload);
      }
      localStorage.setItem(`offline_safety_${id}`, JSON.stringify(safetyRespuestas));
      setSafetySubmitted(true);
      alert('Checklist de seguridad guardado con éxito.');
      
      // Advance step
      handleNextStep();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar el checklist de seguridad');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSolicitarRepuesto = async () => {
    if (solicitarMatId === 'otro' && (!solicitarOtroNombre || solicitarOtroNombre.trim() === '')) {
      alert('Debe especificar el nombre del repuesto faltante.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        material_id: solicitarMatId === 'otro' ? null : solicitarMatId,
        nombre_otro: solicitarMatId === 'otro' ? solicitarOtroNombre : null,
        cantidad: solicitarCantidad,
      };

      if (navigator.onLine) {
        await apiFetch(`/tecnico/ordenes/${id}/solicitar-repuesto`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        alert('Solicitud registrada. La orden ha sido pausada en estado ESPERANDO_REPUESTO.');
      } else {
        queueOfflineOp('solicitar-repuesto', payload);
        alert('Solicitud guardada en cola local offline. La orden de trabajo pasará a ESPERANDO_REPUESTO.');
      }

      if (ot) {
        setOt({ ...ot, estado: 'ESPERANDO_REPUESTO' as EstadoOT });
      }

      setPendingParts([
        ...pendingParts,
        {
          material_id: solicitarMatId === 'otro' ? null : solicitarMatId,
          nombre_otro: solicitarMatId === 'otro' ? solicitarOtroNombre : materialesCatalog.find(m => m.id === solicitarMatId)?.nombre,
          cantidad: solicitarCantidad,
          estado: 'SOLICITADO'
        }
      ]);

      setShowSolicitudModal(false);
      setSolicitarOtroNombre('');
      setSolicitarCantidad(1);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al registrar la solicitud de repuestos');
    } finally {
      setSubmitting(false);
    }
  };

  const updateChecklistItem = (itemId: number, fields: Partial<ChecklistAnswerInput>) => {
    const updated = {
      ...checklistRespuestas,
      [itemId]: { ...checklistRespuestas[itemId], ...fields },
    };
    setChecklistRespuestas(updated);
    localStorage.setItem(`offline_checklist_${id}`, JSON.stringify(updated));
  };

  const handleUploadPhoto = async (itemId: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (navigator.onLine) {
      setSubmitting(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`/api/v1/tecnico/ordenes/${id}/upload-foto`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          body: formData,
        });
        if (!res.ok) throw new Error('Error al subir imagen');
        const data = await res.json();
        updateChecklistItem(itemId, { ruta_foto: data.ruta });
      } catch (err) {
        alert('Error al subir imagen: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
        setSubmitting(false);
      }
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        updateChecklistItem(itemId, { ruta_foto: file.name });
        alert('Foto guardada localmente (Modo offline)');
      };
      reader.readAsDataURL(file);
    }
  };

  const saveChecklistResponses = async () => {
    const payload = {
      respuestas: Object.values(checklistRespuestas).map((r) => ({
        plantilla_item_id: r.plantilla_item_id,
        valor_texto: r.valor_texto,
        valor_numerico: r.valor_numerico,
        valor_booleano: r.valor_booleano,
        ruta_foto: r.ruta_foto,
      })),
    };
    if (navigator.onLine) {
      await apiFetch(`/tecnico/ordenes/${id}/checklist`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } else {
      queueOfflineOp('checklist', payload);
    }
  };

  const addMaterial = (mat: RepuestoMaterial) => {
    const quantity = repuestosUsados[mat.id] ? repuestosUsados[mat.id].cantidad + 1 : 1;
    const updated = {
      ...repuestosUsados,
      [mat.id]: { material_id: mat.id, nombre: mat.nombre, cantidad: quantity },
    };
    setRepuestosUsados(updated);
    localStorage.setItem(`offline_repuestos_${id}`, JSON.stringify(updated));
  };

  const removeMaterial = (matId: number) => {
    if (!repuestosUsados[matId]) return;
    const quantity = repuestosUsados[matId].cantidad - 1;
    let updated = { ...repuestosUsados };
    if (quantity <= 0) {
      delete updated[matId];
    } else {
      updated[matId] = { ...updated[matId], cantidad: quantity };
    }
    setRepuestosUsados(updated);
    localStorage.setItem(`offline_repuestos_${id}`, JSON.stringify(updated));
  };

  const saveRepuestosUsados = async () => {
    const payload = Object.values(repuestosUsados).map((r) => ({
      material_id: r.material_id,
      cantidad: r.cantidad,
    }));
    if (navigator.onLine) {
      await apiFetch(`/tecnico/ordenes/${id}/repuestos`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } else {
      queueOfflineOp('repuestos', payload);
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    const pos = getMousePos(canvas, e);
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getMousePos(canvas, e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const getMousePos = (canvas: HTMLCanvasElement, evt: any) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  useEffect(() => {
    if (canvasRef.current && activeStep?.id === 'cierre') {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      // Set canvas drawing buffer to match bounding client rect style layout size (prevents stretching)
      if (rect.width > 0 && rect.height > 0 && (canvas.width !== rect.width || canvas.height !== rect.height)) {
        canvas.width = rect.width;
        canvas.height = rect.height;
        setHasSignature(false); // Reset signature flag if buffer sizes actually changed
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
      }
    }
  }, [ot, activeStep]);

  // Stepper step flow navigation with validation checks
  const handleNextStep = () => {
    const currentType = steps[currentStepIndex].id;

    if (currentType === 'aceptar') {
      if (ot?.estado === 'PROGRAMADA') {
        alert('Debe iniciar el traslado (Aceptar OT) primero.');
        return;
      }
      if (ot?.estado === 'EN_EJECUCION' && !ot.fecha_llegada) {
        alert('Debe confirmar su llegada al sitio primero.');
        return;
      }
    }

    if (currentType === 'seguridad' && !safetySubmitted) {
      alert('Debe guardar y confirmar el checklist de seguridad primero.');
      return;
    }

    if (currentType === 'checklist') {
      for (const val of Object.values(checklistRespuestas)) {
        if (val.requerido) {
          if (val.tipo_respuesta === 'SI_NO' && val.valor_booleano === undefined) {
            alert(`Falta responder el ítem obligatorio: "${val.pregunta}"`);
            return;
          }
          if (val.tipo_respuesta === 'NUMERICO' && val.valor_numerico === undefined) {
            alert(`Falta valor numérico para: "${val.pregunta}"`);
            return;
          }
          if (val.tipo_respuesta === 'TEXTO' && (!val.valor_texto || val.valor_texto.trim() === '')) {
            alert(`Falta texto descriptivo para: "${val.pregunta}"`);
            return;
          }
          if (val.tipo_respuesta === 'FOTO' && !val.ruta_foto) {
            alert(`Falta subir fotografía para: "${val.pregunta}"`);
            return;
          }
        }
      }
    }

    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  // Checklist completion calculation
  const checklistCompletionPercentage = useMemo(() => {
    const answers = Object.values(checklistRespuestas);
    if (answers.length === 0) return 0;
    const answeredCount = answers.filter(a => 
      a.valor_booleano !== undefined || 
      a.valor_numerico !== undefined || 
      (a.valor_texto && a.valor_texto.trim() !== '') || 
      a.ruta_foto
    ).length;
    return Math.round((answeredCount / answers.length) * 100);
  }, [checklistRespuestas]);

  const handleCloseOrder = async () => {
    // Final validations
    if (!hasSignature) {
      alert('Debe registrar la firma de conformidad del cliente.');
      return;
    }

    setSubmitting(true);
    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const signatureBase64 = canvas.toDataURL('image/png');

      await saveChecklistResponses();
      await saveRepuestosUsados();

      if (rating !== null) {
        const surveyPayload = { puntuacion: rating, comentario: comentariosCierre };
        if (navigator.onLine) {
          try {
            await apiFetch(`/tecnico/ordenes/${id}/encuesta`, {
              method: 'POST',
              body: JSON.stringify(surveyPayload),
            });
          } catch (e) {}
        } else {
          queueOfflineOp('encuesta', surveyPayload);
        }
      }

      const payload = {
        firma_base64: signatureBase64,
        comentario: comentariosCierre,
      };

      if (navigator.onLine) {
        await apiFetch(`/tecnico/ordenes/${id}/cerrar`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        alert('Orden de Trabajo cerrada y completada con éxito.');
        router.push('/tecnico');
      } else {
        queueOfflineOp('cerrar', payload);
        if (ot) {
          const updated = { ...ot, estado: 'COMPLETADA' as EstadoOT, fecha_cierre: new Date().toISOString() };
          localStorage.setItem(`cache_ot_${id}`, JSON.stringify(updated));
        }
        alert('Orden guardada y encolada para cierre en modo offline.');
        router.push('/tecnico');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cerrar la orden');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-20">
        <Spinner size="lg" />
        <span className="text-xs text-zinc-500 font-medium mt-3">Cargando ficha de orden...</span>
      </div>
    );
  }

  if (error || !ot) {
    return <ErrorMessage message={error || 'Orden no encontrada'} retry={loadData} />;
  }

  const prioColor = PRIORIDAD_COLORS[ot.prioridad as keyof typeof PRIORIDAD_COLORS] || PRIORIDAD_COLORS.media;
  const stateColor = ESTADO_COLORS[ot.estado as keyof typeof ESTADO_COLORS] || ESTADO_COLORS.RECIBIDA;
  const arrived = ot.estado === 'EN_EJECUCION' && ot.fecha_llegada;

  return (
    <div className="flex flex-col gap-5.5 max-w-md mx-auto px-2 py-3 text-zinc-900 pb-28 relative">
      
      {/* Timer Flotante / Status Bar (Top Sticky) */}
      {arrived && (ot.fecha_inicio_real || ot.fecha_salida) && (
        <div className="sticky top-16 z-40 w-full bg-white/80 backdrop-blur-md border border-zinc-200 shadow-sm p-3 rounded-2xl flex items-center justify-between gap-4 transition-all duration-200">
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Trabajando en sitio</span>
            <span className="font-mono text-xs font-bold text-zinc-700">{ot.codigo_interno}</span>
          </div>
          
          {/* Progress Indicator */}
          <div className="flex items-center gap-1.5 bg-teal-50 px-2.5 py-1 rounded-xl border border-teal-100">
            <span className="text-[10px] text-teal-800 font-bold">{checklistCompletionPercentage}% completado</span>
          </div>

          {/* Time elapsed live */}
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Cronómetro</span>
            <LiveElapsed startTime={ot.fecha_inicio_real || ot.fecha_salida || ''} />
          </div>
        </div>
      )}

      {/* Header back button row */}
      <div className="flex items-center gap-3">
        <Link href="/tecnico" className="w-9 h-9 border border-zinc-200 rounded-xl bg-white hover:bg-zinc-50 active:scale-95 flex items-center justify-center text-zinc-700 font-bold transition-all shadow-2xs">
          ←
        </Link>
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
            {ot.codigo_interno} · {ot.cliente.nombre}
          </span>
          <h2 className="text-base font-extrabold text-zinc-950 leading-tight">
            {ot.titulo}
          </h2>
        </div>
      </div>

      {/* Stepper Dot Line Bar (Mockup-style) */}
      <div className="flex flex-col gap-3 mt-1.5">
        <div className="flex items-center gap-1.5 bg-zinc-100 p-1.5 rounded-xl border border-zinc-200/60">
          {steps.map((s, idx) => {
            const isActive = currentStepIndex === idx;
            const isCompleted = idx < currentStepIndex;
            return (
              <button
                key={s.id}
                type="button"
                disabled={
                  // Cannot click forward steps beyond progress
                  idx > currentStepIndex || 
                  (!arrived && idx > 0) ||
                  (s.id !== 'aceptar' && s.id !== 'seguridad' && !safetySubmitted && safetyItems.length > 0)
                }
                onClick={() => setCurrentStepIndex(idx)}
                className={`flex-1 h-1.5 rounded-full transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-teal-600' 
                    : isCompleted 
                      ? 'bg-emerald-500'
                      : 'bg-zinc-250'
                }`}
                title={s.label}
              />
            );
          })}
        </div>
        
        {/* Prev / Current / Next labels */}
        <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider text-zinc-400 px-1 mt-0.5 leading-none">
          <span className="w-1/3 text-left truncate">
            {currentStepIndex > 0 ? `← ${steps[currentStepIndex - 1].label}` : '—'}
          </span>
          <span className="w-1/3 text-center text-teal-600 font-extrabold text-xs">
            {steps[currentStepIndex].label}
          </span>
          <span className="w-1/3 text-right truncate">
            {currentStepIndex < steps.length - 1 ? `${steps[currentStepIndex + 1].label} →` : '—'}
          </span>
        </div>
      </div>

      {/* Stepper Content Panels Container */}
      <div className="min-h-[280px] flex flex-col gap-4">
        
        {/* STEP 1: Aceptar */}
        {activeStep.id === 'aceptar' && (
          <div className="flex flex-col gap-4 animate-fadeIn">
            <Card className="p-4 flex flex-col gap-3.5 border border-zinc-200/80 shadow-xs">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 pb-2">Datos del Servicio</h3>
              <div className="flex flex-col gap-2.5 text-xs text-zinc-700">
                <div className="flex justify-between py-1.5 border-b border-zinc-100">
                  <span className="text-zinc-400">Cliente</span>
                  <span className="font-bold text-zinc-800">{ot.cliente.nombre}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-zinc-100">
                  <span className="text-zinc-400">Dirección</span>
                  <span className="font-medium text-zinc-800">Cusco</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-zinc-100">
                  <span className="text-zinc-400">Equipo</span>
                  <span className="font-mono text-zinc-800">{ot.plantillas?.[0]?.titulo || ot.plantilla?.titulo || 'AC Split 60,000 BTU'}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-zinc-400">Programado</span>
                  <span className="font-medium text-zinc-800">
                    {ot.fecha_programada 
                      ? new Date(ot.fecha_programada).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </span>
                </div>
              </div>
            </Card>

            {/* Registros de Tiempo de Traslado */}
            {(ot.fecha_salida || ot.fecha_llegada) && (
              <Card className="p-4 flex flex-col gap-3 border border-zinc-200/80 shadow-xs bg-zinc-50/50">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wide border-b border-zinc-100 pb-2">Traslado Registrado</h3>
                <div className="flex flex-col gap-2.5 text-xs text-zinc-700">
                  {ot.fecha_salida && (
                    <div className="flex justify-between py-1 border-b border-zinc-100">
                      <span className="text-zinc-450">Hora de salida</span>
                      <span className="font-mono font-bold text-zinc-800 flex items-center gap-1">
                        {new Date(ot.fecha_salida).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded border border-emerald-100">GPS ✓</span>
                      </span>
                    </div>
                  )}
                  {ot.fecha_llegada && (
                    <div className="flex justify-between py-1">
                      <span className="text-zinc-450">Hora de llegada</span>
                      <span className="font-mono font-bold text-zinc-800 flex items-center gap-1">
                        {new Date(ot.fecha_llegada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                        <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1 py-0.5 rounded border border-emerald-100">GPS ✓</span>
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Historial de Equipos */}
            <Card className="p-3 shadow-xs border border-zinc-200/80">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex justify-between items-center text-xs font-bold text-zinc-700 hover:text-zinc-900 focus:outline-none cursor-pointer"
              >
                <span>📜 Historial de Intervenciones</span>
                <span className="text-zinc-400">{showHistory ? '▲ Ocultar' : '▼ Mostrar'}</span>
              </button>
              {showHistory && (
                <div className="flex flex-col gap-2.5 mt-3 pt-3 border-t border-zinc-100 max-h-48 overflow-y-auto">
                  {equipmentHistory.map((h, idx) => (
                    <div key={idx} className="text-xs border-b border-zinc-100 last:border-b-0 pb-2 last:pb-0">
                      <div className="flex justify-between items-center text-[10px] text-zinc-400 font-mono mb-0.5">
                        <span>📅 {h.fecha}</span>
                        <span className="font-semibold text-zinc-550">Téc: {h.tecnico}</span>
                      </div>
                      <h4 className="font-bold text-zinc-800">{h.servicio}</h4>
                      <p className="text-[11px] text-zinc-650 bg-zinc-50 p-1.5 rounded mt-1 border border-zinc-100 italic">"{h.nota}"</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Instrucciones de Acción */}
            {ot.estado === 'PROGRAMADA' && (
              <Card className="p-4 border border-zinc-200/80 shadow-xs bg-teal-50/10">
                <span className="text-xs font-bold text-teal-800 uppercase tracking-wide block mb-1">Acción Requerida</span>
                <p className="text-xs text-zinc-550 leading-relaxed">
                  Al aceptar la orden se registrará automáticamente tu hora de salida y tu ubicación de inicio de traslado. No necesitas escribir nada.
                </p>
              </Card>
            )}

            {ot.estado === 'EN_EJECUCION' && !ot.fecha_llegada && (
              <Card className="p-4 border border-zinc-200/80 shadow-xs bg-indigo-50/10">
                <span className="text-xs font-bold text-indigo-850 uppercase tracking-wide block mb-1">Acción Requerida</span>
                <p className="text-xs text-zinc-550 leading-relaxed">
                  Presiona el botón de confirmación cuando llegues físicamente al sitio del cliente para registrar la ubicación y la hora exacta de llegada.
                </p>
              </Card>
            )}

            {/* Botones de acción del paso 1 */}
            <div className="mt-1">
              {ot.estado === 'PROGRAMADA' && (
                <Button onClick={handleStartTransit} isLoading={submitting} className="w-full py-3 bg-teal-650 hover:bg-teal-700 text-white rounded-xl shadow-md text-sm font-bold active:scale-[0.99] transition-all cursor-pointer">
                  🚀 Iniciar Traslado (Aceptar OT)
                </Button>
              )}

              {ot.estado === 'EN_EJECUCION' && !ot.fecha_llegada && (
                <Button onClick={handleArriveSite} isLoading={submitting} className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-md text-sm font-bold active:scale-[0.99] transition-all cursor-pointer">
                  📍 Confirmar Llegada al Sitio
                </Button>
              )}

              {ot.estado === 'EN_EJECUCION' && ot.fecha_llegada && (
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center bg-emerald-50 text-emerald-800 p-3.5 rounded-xl border border-emerald-100 text-xs shadow-3xs font-medium">
                    <span className="flex items-center gap-1.5">✔️ Registro de traslado y llegada completado.</span>
                  </div>
                  <Button onClick={handleNextStep} className="w-full bg-zinc-800 hover:bg-zinc-900 text-white text-xs font-bold py-3.5 rounded-xl cursor-pointer">
                    Continuar al checklist
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Seguridad */}
        {activeStep.id === 'seguridad' && (
          <div className="flex flex-col gap-4 animate-fadeIn">
            {/* Blocker alert warning */}
            <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 rounded-xl p-3.5 text-xs text-rose-900 leading-normal font-medium shadow-2xs">
              <span className="text-lg shrink-0">⚠️</span>
              <span>Paso <strong>bloqueante</strong>. No puedes iniciar el checklist técnico sin completar esto.</span>
            </div>

            <Card className="p-4 flex flex-col gap-3 shadow-sm border border-zinc-200 bg-white">
              <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
                <span className="text-sm">🛡️</span>
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">Seguridad en Obra</h3>
              </div>

              {!safetySubmitted ? (
                <div className="flex flex-col gap-4">
                  <p className="text-[11px] text-zinc-500 leading-normal font-medium">
                    Complete los requisitos obligatorios de seguridad para habilitar los trabajos:
                  </p>
                  <div className="flex flex-col gap-3.5">
                    {safetyItems.map((item) => {
                      const res = safetyRespuestas[item.id] || { cumple: true, motivo_no_cumplimiento: '' };
                      return (
                        <div key={item.id} className="flex flex-col gap-2.5 bg-zinc-50/50 p-3 rounded-xl border border-zinc-200/60">
                          <div className="flex justify-between items-start gap-1">
                            <span className="text-xs font-bold text-zinc-800">{item.pregunta}</span>
                            {item.requerido && (
                              <span className="text-[8px] bg-red-100 text-red-700 px-1 py-0.5 rounded font-mono font-bold">Obligatorio</span>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setSafetyRespuestas({
                                  ...safetyRespuestas,
                                  [item.id]: { ...res, cumple: true }
                                });
                              }}
                              className={`py-1.5 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                res.cumple === true
                                  ? 'bg-emerald-600 text-white border-transparent shadow-sm'
                                  : 'bg-white text-zinc-650 border-zinc-200 hover:bg-zinc-100'
                              }`}
                            >
                              CUMPLE
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSafetyRespuestas({
                                  ...safetyRespuestas,
                                  [item.id]: { ...res, cumple: false }
                                });
                              }}
                              className={`py-1.5 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                res.cumple === false
                                  ? 'bg-red-650 text-white border-transparent shadow-sm'
                                  : 'bg-white text-zinc-650 border-zinc-200 hover:bg-zinc-100'
                              }`}
                            >
                              NO CUMPLE
                            </button>
                          </div>

                          {res.cumple === false && (
                            <div className="flex flex-col gap-1 mt-1">
                              <label className="text-[10px] text-red-700 font-bold">Justificación de no cumplimiento:</label>
                              <textarea
                                rows={2}
                                value={res.motivo_no_cumplimiento || ''}
                                onChange={(e) => {
                                  setSafetyRespuestas({
                                    ...safetyRespuestas,
                                    [item.id]: { ...res, motivo_no_cumplimiento: e.target.value }
                                  });
                                }}
                                className="w-full text-xs p-2 border border-red-200 rounded focus:ring-1 focus:ring-red-500 outline-none text-zinc-900 bg-white"
                                placeholder="Justificación técnica..."
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <Button onClick={handleSaveSafety} isLoading={submitting} className="w-full mt-1.5 py-3 bg-teal-650 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer">
                    ✔️ Confirmar Seguridad y Continuar
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center bg-emerald-50 text-emerald-800 p-2.5 rounded-lg border border-emerald-100 text-xs">
                    <span className="font-semibold">✔️ Seguridad Completada con éxito</span>
                    <button type="button" onClick={() => setSafetySubmitted(false)} className="text-[10px] text-teal-850 font-bold hover:underline cursor-pointer">
                      Editar
                    </button>
                  </div>
                  <Button onClick={handleNextStep} className="w-full bg-zinc-800 text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer">
                    Ir al siguiente paso
                  </Button>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* STEP 3: Checklist */}
        {activeStep.id === 'checklist' && (
          <div className="flex flex-col gap-4 animate-fadeIn">
            <Card className="p-4 flex flex-col gap-4 shadow-sm border border-zinc-200/80">
              <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
                <span className="text-base">📋</span>
                <h3 className="text-sm font-bold text-zinc-900">Checklist de Ejecución</h3>
              </div>

              {/* Progress Line Bar */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Progreso de Inspección</span>
                <div className="flex items-center gap-3.5">
                  <div className="flex-1 h-2 bg-zinc-100 border border-zinc-200/50 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-600 rounded-full transition-all duration-300" style={{ width: `${checklistCompletionPercentage}%` }} />
                  </div>
                  <span className="text-xs font-mono font-bold text-teal-700 shrink-0">{checklistCompletionPercentage}%</span>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {plantillasAsociadas.map((pt) => (
                  <div key={pt.id} className="flex flex-col gap-3">
                    {plantillasAsociadas.length > 1 && (
                      <div className="text-xs font-bold text-zinc-500 bg-zinc-100 px-2 py-1 rounded">
                        📋 {pt.titulo}
                      </div>
                    )}
                    
                    {pt.items.map((item) => {
                      const ans = checklistRespuestas[item.id] || {};
                      return (
                        <div key={item.id} className="flex flex-col gap-2.5 bg-zinc-50/60 p-3.5 rounded-xl border border-zinc-200/60">
                          <div className="flex justify-between items-start text-xs font-bold">
                            <span className="text-zinc-850 flex-1">{item.orden}. {item.pregunta}</span>
                            {item.requerido && (
                              <span className="text-[8px] bg-red-150/70 text-red-700 px-1 py-0.5 rounded font-mono font-bold">Obligatorio</span>
                            )}
                          </div>

                          {item.tipo_respuesta === 'SI_NO' && (
                            <div className="grid grid-cols-2 gap-2.5 mt-1.5">
                              <button
                                type="button"
                                onClick={() => updateChecklistItem(item.id, { valor_booleano: true })}
                                className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                  ans.valor_booleano === true
                                    ? 'bg-teal-650 border-teal-600 text-white shadow-xs'
                                    : 'bg-white text-zinc-650 border-zinc-200 hover:bg-zinc-50'
                                }`}
                              >
                                SÍ
                              </button>
                              <button
                                type="button"
                                onClick={() => updateChecklistItem(item.id, { valor_booleano: false })}
                                className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                  ans.valor_booleano === false
                                    ? 'bg-red-650 border-red-650 text-white shadow-xs'
                                    : 'bg-white text-zinc-650 border-zinc-200 hover:bg-zinc-50'
                                }`}
                              >
                                NO
                              </button>
                            </div>
                          )}

                          {item.tipo_respuesta === 'NUMERICO' && (
                            <input
                              type="number"
                              step="any"
                              placeholder="Valor numérico..."
                              className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white mt-1"
                              value={ans.valor_numerico !== undefined ? ans.valor_numerico : ''}
                              onChange={(e) =>
                                updateChecklistItem(item.id, {
                                  valor_numerico: e.target.value !== '' ? parseFloat(e.target.value) : undefined,
                                })
                              }
                            />
                          )}

                          {item.tipo_respuesta === 'ESCALA' && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => updateChecklistItem(item.id, { valor_numerico: n })}
                                  className={`w-7 h-7 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                    ans.valor_numerico === n
                                      ? 'bg-teal-600 text-white border-transparent'
                                      : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                                  }`}
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                          )}

                          {item.tipo_respuesta === 'TEXTO' && (
                            <div className="flex flex-col gap-2 mt-1">
                              <textarea
                                rows={2}
                                placeholder="Escribir detalles o tocar una respuesta rápida..."
                                className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                                value={ans.valor_texto || ''}
                                onChange={(e) => updateChecklistItem(item.id, { valor_texto: e.target.value })}
                              />
                              
                              {/* Quick replies chips */}
                              <div className="flex flex-wrap gap-1 mt-1">
                                {QUICK_REPLIES.flatMap(c => c.replies).map((reply) => (
                                  <button
                                    key={reply}
                                    type="button"
                                    onClick={() => updateChecklistItem(item.id, { valor_texto: reply })}
                                    className="text-[9px] bg-zinc-50 text-zinc-550 border border-zinc-200 hover:bg-zinc-100 hover:text-zinc-800 px-2 py-1 rounded-full font-medium transition-all cursor-pointer"
                                  >
                                    {reply}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {item.tipo_respuesta === 'FOTO' && (
                            <div className="flex flex-col gap-2 mt-1">
                              {ans.ruta_foto ? (
                                <div className="flex items-center justify-between p-2.5 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-800">
                                  <span className="truncate max-w-[200px] font-mono">📷 {ans.ruta_foto}</span>
                                  <button
                                    type="button"
                                    onClick={() => updateChecklistItem(item.id, { ruta_foto: undefined })}
                                    className="text-red-650 font-bold ml-2 text-[10px] cursor-pointer"
                                  >
                                    Quitar
                                  </button>
                                </div>
                              ) : (
                                <label className="flex flex-col items-center justify-center border border-dashed border-zinc-300 rounded-lg py-4 bg-white hover:bg-zinc-50 cursor-pointer transition-all">
                                  <span className="text-[10px] text-zinc-500 font-bold">📸 Capturar Evidencia</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={(e) => handleUploadPhoto(item.id, e)}
                                  />
                                </label>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* STEP 4: Repuestos */}
        {activeStep.id === 'repuestos' && (
          <div className="flex flex-col gap-4 animate-fadeIn">
            <Card className="p-4 flex flex-col gap-4 shadow-sm border border-zinc-200/80">
              <div className="flex justify-between items-center border-b border-zinc-100 pb-2">
                <h3 className="text-sm font-bold text-zinc-900">Repuestos Utilizados</h3>
                <button
                  type="button"
                  onClick={() => setShowSolicitudModal(true)}
                  className="text-[9.5px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-lg transition-all cursor-pointer hover:bg-red-100"
                >
                  🚨 Solicitar Repuesto Faltante
                </button>
              </div>

              {pendingParts.length > 0 && (
                <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex flex-col gap-1 text-[10px] text-red-800">
                  <span className="font-bold">⚠️ Pendientes por Proveer:</span>
                  {pendingParts.map((p, pIdx) => (
                    <div key={pIdx} className="flex justify-between font-mono text-[9.5px]">
                      <span>• {p.nombre || p.nombre_otro}</span>
                      <span>Cant: {p.amount || p.cantidad} (Solicitado ⚠)</span>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Agregar Repuesto del Inventario</label>
                {materialesCatalog.length === 0 ? (
                  <p className="text-xs text-zinc-450 italic">Catálogo vacío.</p>
                ) : (
                  <div className="flex flex-col gap-1 max-h-36 overflow-y-auto border border-zinc-200 rounded-lg p-1.5 bg-white">
                    {materialesCatalog.map((mat) => (
                      <div key={mat.id} className="flex justify-between items-center text-xs py-1 hover:bg-zinc-50 rounded px-1.5 border-b border-zinc-100/50 last:border-b-0">
                        <span className="font-semibold text-zinc-800 truncate max-w-[200px]">{mat.nombre}</span>
                        <button
                          type="button"
                          onClick={() => addMaterial(mat)}
                          className="px-2.5 py-0.5 text-[9px] font-bold bg-zinc-100 hover:bg-zinc-200 rounded text-zinc-800 cursor-pointer"
                        >
                          + Añadir
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {Object.keys(repuestosUsados).length > 0 && (
                <div className="flex flex-col gap-1.5 bg-zinc-50 p-2 rounded-lg border border-zinc-200/60 mt-1">
                  <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide px-1">Seleccionados</span>
                  {Object.values(repuestosUsados).map((r) => (
                    <div key={r.material_id} className="flex justify-between items-center text-xs py-1 border-b border-zinc-200/20 last:border-b-0 px-1">
                      <span className="font-semibold text-zinc-750 truncate max-w-[190px]">{r.nombre}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => removeMaterial(r.material_id)}
                          className="w-5.5 h-5.5 flex items-center justify-center bg-white border border-zinc-200 hover:bg-zinc-50 active:bg-zinc-100 rounded-md text-xs font-bold cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-bold w-4 text-center">{r.cantidad}</span>
                        <button
                          type="button"
                          onClick={() => addMaterial({ id: r.material_id, nombre: r.nombre } as any)}
                          className="w-5.5 h-5.5 flex items-center justify-center bg-white border border-zinc-200 hover:bg-zinc-50 active:bg-zinc-100 rounded-md text-xs font-bold cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            {pendingParts.length > 0 && (
              <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 p-3 rounded-xl leading-normal font-medium">
                <strong>Repuestos marcados como pendientes.</strong> La OT no podrá cerrarse definitivamente hasta resolverlos. Oficina ya fue notificada.
              </div>
            )}
          </div>
        )}

        {/* STEP 5: Cierre */}
        {activeStep.id === 'cierre' && (
          <div className="flex flex-col gap-4 animate-fadeIn">
            <Card className="p-4 flex flex-col gap-3.5 border border-zinc-200/80 shadow-xs">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 pb-2">Resumen de Trabajo</h3>
              <div className="flex flex-col gap-2 text-xs text-zinc-700">
                <div className="flex justify-between py-1 border-b border-zinc-100/50">
                  <span className="text-zinc-450">Tiempo de traslado</span>
                  <span className="font-mono font-semibold">{translationTime}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-100/50">
                  <span className="text-zinc-450">Tiempo en sitio</span>
                  <span className="font-mono font-semibold">{siteTime}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-100/50">
                  <span className="text-zinc-450">Checklist de seguridad</span>
                  <span className="font-mono font-semibold">
                    {safetyItems.length > 0 ? `${Object.keys(safetyRespuestas).length}/${safetyItems.length} ✓` : 'No aplica'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-zinc-100/50">
                  <span className="text-zinc-450">Checklist técnico</span>
                  <span className="font-mono font-semibold">{checklistCompletionPercentage}% completado</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-450">Repuestos usados</span>
                  <span className="font-mono font-semibold">{Object.keys(repuestosUsados).length} ítems</span>
                </div>
              </div>
            </Card>

            {/* Blocker alert warning if spares are pending */}
            {pendingParts.length > 0 && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl p-3.5 text-xs text-red-900 leading-normal font-medium shadow-2xs">
                <span className="text-lg shrink-0">⚠️</span>
                <span><strong>Cierre bloqueado.</strong> Resuelve el repuesto pendiente ({pendingParts[0].nombre || pendingParts[0].nombre_otro}) antes de cerrar.</span>
              </div>
            )}

            <Card className="p-4 flex flex-col gap-3.5 border border-zinc-200/80 shadow-xs">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 pb-2">Conformidad del Cliente</h3>
              
              {/* Satisfaction survey */}
              <div className="flex flex-col gap-1.5 mt-1 border-b border-zinc-100 pb-3">
                <label className="text-[10px] font-bold text-zinc-450 uppercase">Calificación de Satisfacción</label>
                <div className="flex gap-4.5 justify-center items-center py-2 bg-zinc-50 rounded-xl border border-zinc-200/60 mt-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`text-2xl transition-all cursor-pointer ${
                        rating !== null && rating >= star ? 'text-amber-500 scale-110' : 'text-zinc-300 hover:text-amber-400'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Digital Signature canvas area */}
              <div className="flex flex-col gap-1.5 mt-1.5">
                <label className="text-[10px] font-bold text-zinc-450 uppercase">Firma Digital del Cliente</label>
                <div className="border-2 border-dashed border-zinc-200 hover:border-zinc-300 rounded-xl bg-zinc-50/50 overflow-hidden shadow-inner mt-1 h-32 relative">
                  {!hasSignature && (
                    <div className="absolute inset-0 flex items-center justify-center text-zinc-400 text-xs font-bold tracking-wide pointer-events-none select-none">
                      Firme aquí ✍
                    </div>
                  )}
                  <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-full cursor-crosshair touch-none relative z-10"
                  />
                </div>
                {hasSignature && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer"
                    >
                      Borrar firma
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1.5 mt-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Observaciones del Técnico</label>
                <textarea
                  rows={2}
                  placeholder="Escribe observaciones finales del servicio..."
                  className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                  value={comentariosCierre}
                  onChange={(e) => setComentariosCierre(e.target.value)}
                />
              </div>
            </Card>
          </div>
        )}

      </div>

      {/* Stepper Navigation Footer Buttons (Only if arrived in site) */}
      {arrived && (
        <div className="flex justify-between items-center gap-4 mt-2 mb-6">
          <button
            type="button"
            disabled={currentStepIndex === 0}
            onClick={handlePrevStep}
            className="py-2.5 px-4 rounded-xl text-xs font-bold border border-zinc-200 bg-white hover:bg-zinc-50 active:bg-zinc-100 disabled:opacity-50 text-zinc-700 transition-all cursor-pointer"
          >
            Atrás
          </button>
          
          {currentStepIndex < steps.length - 1 ? (
            <Button
              onClick={handleNextStep}
              className="py-2.5 px-4 rounded-xl text-xs font-bold bg-teal-650 hover:bg-teal-700 text-white shadow-sm flex-1 justify-center cursor-pointer"
            >
              Siguiente
            </Button>
          ) : (
            <Button
              onClick={handleCloseOrder}
              isLoading={submitting}
              disabled={pendingParts.length > 0 || !hasSignature}
              className={`py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex-1 justify-center cursor-pointer ${
                (pendingParts.length > 0 || !hasSignature) ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
              }`}
            >
              🔒 Completar y Cerrar OT
            </Button>
          )}
        </div>
      )}

      {/* Request Spare Parts Modal Backdrop */}
      {showSolicitudModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4 text-zinc-900 animate-scaleUp">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-2">
              <h3 className="text-sm font-bold text-zinc-900">🚨 Solicitar Repuesto Faltante</h3>
              <button type="button" onClick={() => setShowSolicitudModal(false)} className="text-zinc-400 hover:text-zinc-705 font-bold text-sm cursor-pointer">✖️</button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Seleccione del Catálogo u Otro</label>
                <select
                  value={solicitarMatId}
                  onChange={(e) => setSolicitarMatId(e.target.value === 'otro' ? 'otro' : Number(e.target.value))}
                  className="w-full text-xs p-2.5 border border-zinc-200 rounded-lg focus:ring-1 focus:ring-red-500 outline-none bg-white cursor-pointer"
                >
                  <option value="otro">Otro (Escribir nombre manual)</option>
                  {materialesCatalog.map(m => (
                    <option key={m.id} value={m.id}>{m.nombre} (Cod: {m.codigo})</option>
                  ))}
                </select>
              </div>

              {solicitarMatId === 'otro' && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase">Nombre del Repuesto Faltante</label>
                  <input
                    type="text"
                    value={solicitarOtroNombre}
                    onChange={(e) => setSolicitarOtroNombre(e.target.value)}
                    className="w-full text-xs p-2.5 border border-zinc-200 rounded-lg focus:ring-1 focus:ring-red-500 outline-none bg-white"
                    placeholder="Ej. Conector SC/APC especial..."
                  />
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Cantidad Solicitada</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSolicitarCantidad(Math.max(1, solicitarCantidad - 1))}
                    className="w-8 h-8 flex items-center justify-center border border-zinc-200 hover:bg-zinc-50 rounded-lg active:bg-zinc-100 font-bold bg-white cursor-pointer"
                  >
                    -
                  </button>
                  <span className="text-sm font-bold w-6 text-center font-mono">{solicitarCantidad}</span>
                  <button
                    type="button"
                    onClick={() => setSolicitarCantidad(solicitarCantidad + 1)}
                    className="w-8 h-8 flex items-center justify-center border border-zinc-200 hover:bg-zinc-50 rounded-lg active:bg-zinc-100 font-bold bg-white cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShowSolicitudModal(false)}
                className="py-2 px-4 rounded-lg text-xs font-bold border border-zinc-200 hover:bg-zinc-50 text-zinc-700 bg-white cursor-pointer"
              >
                Cancelar
              </button>
              <Button
                onClick={handleSolicitarRepuesto}
                isLoading={submitting}
                className="py-2 px-4 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm cursor-pointer justify-center"
              >
                Solicitar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-Component to display elapsed time live
const LiveElapsed: React.FC<{ startTime: string }> = ({ startTime }) => {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const calc = () => {
      const start = new Date(startTime).getTime();
      const diffMs = Date.now() - start;
      if (isNaN(start)) {
        setElapsed('--:--');
        return;
      }
      const m = Math.floor(diffMs / 60000);
      const s = Math.floor((diffMs % 60000) / 1000);
      setElapsed(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return <span className="font-mono text-xs font-bold text-teal-600">{elapsed}</span>;
};
