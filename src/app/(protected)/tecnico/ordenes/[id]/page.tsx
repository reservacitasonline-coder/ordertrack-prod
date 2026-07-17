'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../layout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { apiFetch } from '@/lib/api';
import { ESTADO_COLORS, ESTADO_LABELS, PRIORIDAD_COLORS, PRIORIDAD_LABELS } from '@/lib/constants';
import { OrdenTrabajo, PlantillaTrabajo, RepuestoMaterial, EstadoOT } from '@/types';

// Types for responses
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
        // Load OT
        otData = await apiFetch<OrdenTrabajo>(`/tecnico/ordenes/${id}`);
        // Load materials catalog
        catalogData = await apiFetch<RepuestoMaterial[]>('/repuestos');
        
        // Load all associated templates (many-to-many via otData.plantillas)
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
        plantillaData = loadedPlantillas[0] || null; // legacy compat

        // Cache in local storage
        localStorage.setItem(`cache_ot_${id}`, JSON.stringify(otData));
        localStorage.setItem(`cache_materiales`, JSON.stringify(catalogData));

        setPlantillasAsociadas(loadedPlantillas);
      } else {
        setIsOffline(true);
        // Load from cache
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
      
      if (plantillaData) {
        setPlantilla(plantillaData);
        // Merge items from ALL associated templates into a single checklist
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

        // Load cached answers or previous values
        const savedOffline = localStorage.getItem(`offline_checklist_${id}`);
        if (savedOffline) {
          const parsed = JSON.parse(savedOffline);
          Object.assign(initialAnswers, parsed);
        } else if (navigator.onLine) {
          // Fetch existing answers from backend
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
            // Set initial safety responses with cumple=true
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

      // Load mock equipment history for this customer / equipment
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
      // Clear queue and local storages
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

  // Geolocalizacion helper
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

  // 1-Tap Handlers
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
        // Simular cambio local
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
    // Validate safety responses
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

  // Checklist updates
  const updateChecklistItem = (itemId: number, fields: Partial<ChecklistAnswerInput>) => {
    const updated = {
      ...checklistRespuestas,
      [itemId]: { ...checklistRespuestas[itemId], ...fields },
    };
    setChecklistRespuestas(updated);
    // Cache locally
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
      // Offline simulation: read base64 or just save filename
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

  // Material updates (Steppers)
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

  // Signature canvas handlers
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

  // Initialise canvas setup
  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
      }
    }
  }, [ot]);

  // Handle closing order
  const handleCloseOrder = async () => {
    // 1. Validation checklist
    for (const val of Object.values(checklistRespuestas)) {
      if (val.requerido) {
        if (val.tipo_respuesta === 'SI_NO' && val.valor_booleano === undefined) {
          alert(`Falta completar el ítem obligatorio: "${val.pregunta}"`);
          return;
        }
        if (val.tipo_respuesta === 'NUMERICO' && val.valor_numerico === undefined) {
          alert(`Falta ingresar un valor numérico para: "${val.pregunta}"`);
          return;
        }
        if (val.tipo_respuesta === 'TEXTO' && (!val.valor_texto || val.valor_texto.trim() === '')) {
          alert(`Falta completar la respuesta de texto para: "${val.pregunta}"`);
          return;
        }
        if (val.tipo_respuesta === 'FOTO' && !val.ruta_foto) {
          alert(`Falta subir fotografía para: "${val.pregunta}"`);
          return;
        }
      }
    }

    // 2. Validate Signature
    if (!hasSignature) {
      alert('Debe registrar la firma de conformidad del cliente.');
      return;
    }

    setSubmitting(true);
    try {
      // Export signature as Base64 image
      const canvas = canvasRef.current;
      if (!canvas) return;
      const signatureBase64 = canvas.toDataURL('image/png');

      // First save checklists and repuestos to DB (or offline queue)
      await saveChecklistResponses();
      await saveRepuestosUsados();

      // Submit survey rating if customer rated it
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

      // Submit closure
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
        // Simular cierre local
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

  return (
    <div className="flex flex-col gap-5 max-w-md mx-auto px-1 py-3 text-zinc-900 pb-20">
      {/* Navigation */}
      <Link href="/tecnico" className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Volver a la bandeja
      </Link>

      {/* Main OT Info Card */}
      <Card className="flex flex-col gap-3.5 p-4 shadow-sm">
        <div className="flex justify-between items-center text-xs">
          <span className="font-bold font-mono text-zinc-700">{ot.codigo_interno}</span>
          <Badge bg={stateColor.bg} text={stateColor.text} border={stateColor.border}>
            {ESTADO_LABELS[ot.estado as keyof typeof ESTADO_LABELS] || ot.estado}
          </Badge>
        </div>

        <div>
          <h2 className="text-[17px] font-bold text-zinc-950 leading-snug">{ot.titulo}</h2>
          <p className="text-xs text-zinc-500 mt-1 font-medium">Cliente: {ot.cliente.nombre}</p>
          {ot.descripcion && <p className="text-xs text-zinc-600 bg-zinc-50 p-2.5 rounded-lg border border-zinc-100 mt-3 break-words whitespace-pre-wrap">{ot.descripcion}</p>}
        </div>
      </Card>

      {/* Historial de Equipos (Fase 2) */}
      <Card className="p-3 shadow-sm border border-zinc-200">
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex justify-between items-center text-xs font-bold text-zinc-700 hover:text-zinc-900 focus:outline-none"
        >
          <span>📜 Ver Historial de Intervenciones</span>
          <span className="text-zinc-400">{showHistory ? '▲ Ocultar' : '▼ Mostrar'}</span>
        </button>
        {showHistory && (
          <div className="flex flex-col gap-2.5 mt-3 pt-3 border-t border-zinc-100">
            {equipmentHistory.map((h, idx) => (
              <div key={idx} className="text-xs border-b border-zinc-100 last:border-b-0 pb-2 last:pb-0">
                <div className="flex justify-between items-center text-[10px] text-zinc-400 font-mono mb-0.5">
                  <span>📅 {h.fecha}</span>
                  <span className="font-semibold text-zinc-500">Téc: {h.tecnico}</span>
                </div>
                <h4 className="font-bold text-zinc-800">{h.servicio}</h4>
                <p className="text-[11px] text-zinc-600 bg-zinc-50 p-1.5 rounded mt-1 border border-zinc-100 italic">"{h.nota}"</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Telemetry Actions (1-Tap Buttons) */}
      {ot.estado === 'PROGRAMADA' && (
        <Card className="p-4 flex flex-col gap-3">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Inicio de Trabajo</h3>
          <Button onClick={handleStartTransit} isLoading={submitting} className="w-full py-4 text-sm font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-md">
            🚀 Iniciar Traslado (Aceptar OT)
          </Button>
        </Card>
      )}

      {ot.estado === 'EN_EJECUCION' && !ot.fecha_llegada && (
        <Card className="p-4 flex flex-col gap-3">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Llegada al Sitio</h3>
          <Button onClick={handleArriveSite} isLoading={submitting} className="w-full py-4 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md">
            📍 Confirmar Llegada al Sitio
          </Button>
        </Card>
      )}

      {/* Execution Panel (checklists, parts, signature) - Visible only when arrived */}
      {ot.estado === 'EN_EJECUCION' && ot.fecha_llegada && (
        <>
          {/* Checklist de Seguridad Obligatorio (Fase 1) */}
          {safetyItems.length > 0 && (
            <Card className="p-4 flex flex-col gap-3 shadow-sm border border-orange-200 bg-orange-50/20">
              <div className="flex items-center gap-2 border-b border-orange-100 pb-2">
                <span className="text-sm">🛡️</span>
                <h3 className="text-xs font-bold text-orange-950 uppercase tracking-wider">Checklist de Seguridad Obligatorio</h3>
              </div>

              {!safetySubmitted ? (
                <div className="flex flex-col gap-4">
                  <p className="text-[11px] text-orange-800 leading-normal font-semibold">
                    Complete el checklist de seguridad para habilitar la ficha de trabajo:
                  </p>
                  <div className="flex flex-col gap-3.5">
                    {safetyItems.map((item) => {
                      const res = safetyRespuestas[item.id] || { cumple: true, motivo_no_cumplimiento: '' };
                      return (
                        <div key={item.id} className="flex flex-col gap-2 bg-white p-3 rounded-lg border border-zinc-200">
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
                              className={`py-1.5 px-3 rounded-md text-xs font-bold border transition-all ${
                                res.cumple === true
                                  ? 'bg-emerald-600 text-white border-transparent shadow-sm'
                                  : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
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
                              className={`py-1.5 px-3 rounded-md text-xs font-bold border transition-all ${
                                res.cumple === false
                                  ? 'bg-red-600 text-white border-transparent shadow-sm'
                                  : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                              }`}
                            >
                              NO CUMPLE
                            </button>
                          </div>

                          {res.cumple === false && (
                            <div className="flex flex-col gap-1 mt-1">
                              <label className="text-[10px] text-red-700 font-bold">Justifique por qué no se cumple:</label>
                              <textarea
                                rows={2}
                                value={res.motivo_no_cumplimiento || ''}
                                onChange={(e) => {
                                  setSafetyRespuestas({
                                    ...safetyRespuestas,
                                    [item.id]: { ...res, motivo_no_cumplimiento: e.target.value }
                                  });
                                }}
                                className="w-full text-xs p-2 border border-red-200 rounded focus:ring-1 focus:ring-red-500 outline-none bg-red-50/10 text-zinc-900"
                                placeholder="Indique la justificación de seguridad aquí..."
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <Button onClick={handleSaveSafety} isLoading={submitting} className="w-full mt-1.5 py-3 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg shadow-sm">
                    ✔️ Confirmar Seguridad y Desbloquear
                  </Button>
                </div>
              ) : (
                <div className="flex justify-between items-center bg-emerald-50 text-emerald-800 p-2.5 rounded-lg border border-emerald-100 text-xs">
                  <span className="font-semibold">✔️ Seguridad Confirmada</span>
                  <button type="button" onClick={() => setSafetySubmitted(false)} className="text-[10px] text-teal-800 font-bold hover:underline">
                    Editar
                  </button>
                </div>
              )}
            </Card>
          )}

          {safetyItems.length > 0 && !safetySubmitted ? (
            <div className="bg-zinc-50 border border-zinc-200 border-dashed p-6 rounded-2xl text-center flex flex-col items-center justify-center gap-2">
              <span className="text-3xl">⚠️</span>
              <h4 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">Ficha de Reporte Bloqueada</h4>
              <p className="text-[11px] text-zinc-500 leading-normal max-w-[260px] mx-auto">
                Debe completar y confirmar el checklist de seguridad arriba para poder habilitar el checklist técnico, repuestos y cierre de la orden.
              </p>
            </div>
          ) : (
            <>
              {/* Checklist Panel — Multi-template support */}
              {(plantillasAsociadas.length > 0 || plantilla) && (() => {
                const plantillasToRender = plantillasAsociadas.length > 0 ? plantillasAsociadas : (plantilla ? [plantilla] : []);
                return (
                  <Card className="p-4 flex flex-col gap-4 shadow-sm">
                    <div className="flex items-center gap-2 border-b border-zinc-100 pb-2">
                      <span className="text-lg">📋</span>
                      <div>
                        <h3 className="text-sm font-bold text-zinc-900">Checklist Técnico</h3>
                        <span className="text-[10px] text-zinc-400">{plantillasToRender.length} plantilla{plantillasToRender.length > 1 ? 's' : ''} asignada{plantillasToRender.length > 1 ? 's' : ''}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-6">
                      {plantillasToRender.map((pt, ptIdx) => (
                        <div key={pt.id} className="flex flex-col gap-3">
                          {plantillasToRender.length > 1 && (
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${
                              ptIdx === 0 ? 'bg-sky-50 text-sky-800 border border-sky-200' :
                              ptIdx === 1 ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                              'bg-purple-50 text-purple-800 border border-purple-200'
                            }`}>
                              <span>{ptIdx === 0 ? '🔵' : ptIdx === 1 ? '🟡' : '🟣'}</span>
                              {pt.titulo}
                              <span className="ml-auto text-[9px] font-normal opacity-70">⏱ {pt.tiempo_estimado_minutos} min</span>
                            </div>
                          )}
                          <div className="flex flex-col gap-4">
                            {pt.items.map((item) => {
                              const ans = checklistRespuestas[item.id] || {};
                              return (
                                <div key={item.id} className="flex flex-col gap-2 bg-zinc-50/50 p-3 rounded-xl border border-zinc-200/80">
                                  <div className="flex justify-between items-start text-xs font-bold">
                                    <span className="text-zinc-800 flex-1">{item.orden}. {item.pregunta}</span>
                                    {item.requerido && (
                                      <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-sm border border-red-200 ml-1">
                                        Obligatorio
                                      </span>
                                    )}
                                  </div>

                                  {item.tipo_respuesta === 'SI_NO' && (
                                    <div className="grid grid-cols-2 gap-2 mt-1">
                                      <button
                                        type="button"
                                        onClick={() => updateChecklistItem(item.id, { valor_booleano: true })}
                                        className={`py-2 px-4 rounded-lg text-xs font-bold border transition-all ${
                                          ans.valor_booleano === true
                                            ? 'bg-teal-600 text-white border-transparent'
                                            : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                                        }`}
                                      >
                                        SÍ
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => updateChecklistItem(item.id, { valor_booleano: false })}
                                        className={`py-2 px-4 rounded-lg text-xs font-bold border transition-all ${
                                          ans.valor_booleano === false
                                            ? 'bg-red-600 text-white border-transparent'
                                            : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
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
                                      placeholder="Ingresar número..."
                                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
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
                                          className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all ${
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
                                    <textarea
                                      rows={2}
                                      placeholder="Observaciones o detalles..."
                                      className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                                      value={ans.valor_texto || ''}
                                      onChange={(e) => updateChecklistItem(item.id, { valor_texto: e.target.value })}
                                    />
                                  )}

                                  {item.tipo_respuesta === 'FOTO' && (
                                    <div className="flex flex-col gap-2 mt-1">
                                      {ans.ruta_foto ? (
                                        <div className="flex items-center justify-between p-2 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-800">
                                          <span className="truncate max-w-[200px] font-medium font-mono">📷 {ans.ruta_foto}</span>
                                          <button
                                            type="button"
                                            onClick={() => updateChecklistItem(item.id, { ruta_foto: undefined })}
                                            className="text-red-600 font-bold ml-2 text-[10px]"
                                          >
                                            Quitar
                                          </button>
                                        </div>
                                      ) : (
                                        <label className="flex flex-col items-center justify-center border border-dashed border-zinc-300 rounded-lg py-4 bg-white hover:bg-zinc-50 cursor-pointer transition-all">
                                          <span className="text-[11px] text-zinc-500 font-bold">📸 Capturar Evidencia</span>
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
                          {ptIdx < plantillasToRender.length - 1 && (
                            <div className="border-t border-dashed border-zinc-200 mt-2" />
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })()}


              {/* Repuestos / Materiales Usados */}
              <Card className="p-4 flex flex-col gap-3 shadow-sm">
                <div className="flex justify-between items-center border-b border-zinc-100 pb-2">
                  <h3 className="text-sm font-bold text-zinc-900">Repuestos y Materiales</h3>
                  <button
                    type="button"
                    onClick={() => setShowSolicitudModal(true)}
                    className="text-[10.5px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded transition-all"
                  >
                    🚨 Solicitar Repuesto Faltante
                  </button>
                </div>

                {pendingParts.length > 0 && (
                  <div className="bg-red-50 border border-red-100 p-2.5 rounded-lg flex flex-col gap-1 text-[11px] text-red-800">
                    <span className="font-bold">⚠️ Repuestos Faltantes Solicitados (Pausado):</span>
                    {pendingParts.map((p, pIdx) => (
                      <div key={pIdx} className="flex justify-between font-medium">
                        <span>• {p.nombre || p.nombre_otro}</span>
                        <span>Cant: {p.cantidad}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Catalog Selector */}
                <div className="flex flex-col gap-1.5 mt-1">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase">Agregar Repuesto del Catálogo</label>
                  {materialesCatalog.length === 0 ? (
                    <p className="text-xs text-zinc-400 italic">No hay repuestos configurados.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto border border-zinc-200 rounded-lg p-2 bg-white">
                      {materialesCatalog.map((mat) => (
                        <div key={mat.id} className="flex justify-between items-center text-xs p-1.5 hover:bg-zinc-50 rounded-md">
                          <div className="flex flex-col">
                            <span className="font-semibold text-zinc-800">{mat.nombre}</span>
                            <span className="text-[10px] text-zinc-400 font-mono">Código: {mat.codigo}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => addMaterial(mat)}
                            className="px-2.5 py-1 text-[10px] font-bold bg-zinc-100 hover:bg-zinc-200 rounded-md transition-all text-zinc-800"
                          >
                            + Agregar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Materials List with Steppers */}
                {Object.keys(repuestosUsados).length > 0 && (
                  <div className="flex flex-col gap-2 mt-3 bg-zinc-50 p-2.5 rounded-lg border border-zinc-100">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide block mb-1">Repuestos Seleccionados</span>
                    {Object.values(repuestosUsados).map((r) => (
                      <div key={r.material_id} className="flex justify-between items-center text-xs py-1 border-b border-zinc-100 last:border-b-0">
                        <span className="font-medium text-zinc-700">{r.nombre}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => removeMaterial(r.material_id)}
                            className="w-6 h-6 flex items-center justify-center bg-white border border-zinc-200 rounded-md active:bg-zinc-100 font-bold"
                          >
                            -
                          </button>
                          <span className="w-6 text-center font-bold">{r.cantidad}</span>
                          <button
                            type="button"
                            onClick={() => addMaterial({ id: r.material_id, nombre: r.nombre } as any)}
                            className="w-6 h-6 flex items-center justify-center bg-white border border-zinc-200 rounded-md active:bg-zinc-100 font-bold"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Signature & Cierre Canvas */}
              <Card className="p-4 flex flex-col gap-3 shadow-sm">
                <h3 className="text-sm font-bold text-zinc-900 border-b border-zinc-100 pb-2">Conformidad y Cierre</h3>
                
                {/* Encuesta de Satisfaccion del Cliente (Fase 2) */}
                <div className="flex flex-col gap-1.5 mt-1 border-b border-zinc-100 pb-3">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase">Calificación del Servicio (Encuesta del Cliente)</label>
                  <div className="flex gap-3 justify-center items-center py-2 bg-zinc-50 rounded-lg border border-zinc-100 mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`text-2xl transition-all ${
                          rating !== null && rating >= star ? 'text-amber-500 scale-110' : 'text-zinc-300 hover:text-amber-300'
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  {rating !== null && (
                    <span className="text-[10px] text-amber-600 font-bold text-center block">¡Gracias! Calificación: {rating} estrellas.</span>
                  )}
                </div>

                <div className="flex flex-col gap-1 mt-2">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase">Firma del Cliente (Dibujar en pantalla)</label>
                  <div className="relative border border-zinc-300 rounded-xl bg-white overflow-hidden shadow-inner mt-1.5 h-36">
                    <canvas
                      ref={canvasRef}
                      width={340}
                      height={140}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full h-full cursor-crosshair touch-none"
                    />
                  </div>
                  <div className="flex justify-end mt-1.5">
                    <button
                      type="button"
                      onClick={clearCanvas}
                      className="text-xs text-red-600 font-semibold hover:underline"
                    >
                      Borrar firma
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 mt-2">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase">Comentarios de Cierre (Opcional)</label>
                  <textarea
                    rows={2}
                    placeholder="Indique algún detalle final sobre el trabajo realizado..."
                    className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
                    value={comentariosCierre}
                    onChange={(e) => setComentariosCierre(e.target.value)}
                  />
                </div>

                {/* Big Close Button */}
                <Button
                  onClick={handleCloseOrder}
                  isLoading={submitting}
                  className="w-full py-4 text-sm font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-md mt-4 transition-all"
                >
                  🔒 Guardar y Cerrar OT
                </Button>
              </Card>
            </>
          )}
        </>
      )}

      {/* Solicitar Repuesto Faltante Modal Backdrop */}
      {showSolicitudModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4 text-zinc-900">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-2">
              <h3 className="text-sm font-bold text-zinc-900">🚨 Solicitar Repuesto Faltante</h3>
              <button type="button" onClick={() => setShowSolicitudModal(false)} className="text-zinc-400 hover:text-zinc-700 font-bold text-sm">✖️</button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Seleccione del Catálogo u Otro</label>
                <select
                  value={solicitarMatId}
                  onChange={(e) => setSolicitarMatId(e.target.value === 'otro' ? 'otro' : Number(e.target.value))}
                  className="w-full text-xs p-2.5 border border-zinc-200 rounded-lg focus:ring-1 focus:ring-red-500 outline-none bg-white"
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
                    className="w-full text-xs p-2.5 border border-zinc-200 rounded-lg focus:ring-1 focus:ring-red-500 outline-none"
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
                    className="w-8 h-8 flex items-center justify-center border border-zinc-200 rounded-lg active:bg-zinc-50 font-bold"
                  >
                    -
                  </button>
                  <span className="text-sm font-bold w-6 text-center">{solicitarCantidad}</span>
                  <button
                    type="button"
                    onClick={() => setSolicitarCantidad(solicitarCantidad + 1)}
                    className="w-8 h-8 flex items-center justify-center border border-zinc-200 rounded-lg active:bg-zinc-50 font-bold"
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
                className="py-2 px-4 rounded-lg text-xs font-bold border border-zinc-200 hover:bg-zinc-50 text-zinc-700"
              >
                Cancelar
              </button>
              <Button
                onClick={handleSolicitarRepuesto}
                isLoading={submitting}
                className="py-2 px-4 rounded-lg text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm"
              >
                🚀 Solicitar y Pausar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
