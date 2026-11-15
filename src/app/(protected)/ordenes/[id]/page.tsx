'use client';

import React, { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../../layout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { AsignarModal } from '@/components/ordenes/AsignarModal';
import { TransicionModal } from '@/components/ordenes/TransicionModal';
import { InformePdfModal } from '@/components/ordenes/InformePdfModal';
import { apiFetch } from '@/lib/api';
import { ESTADO_COLORS, ESTADO_LABELS, PRIORIDAD_COLORS, PRIORIDAD_LABELS } from '@/lib/constants';
import { OrdenTrabajo, OTEvento, OTNota, OTAdjunto, PlantillaTrabajo } from '@/types';

interface ChecklistRespuestaView {
  id?: number;
  plantilla_item_id: number;
  pregunta?: string;
  plantilla_item?: { id: number; pregunta: string; tipo_respuesta?: string };
  valor_booleano?: boolean | null;
  valor_numerico?: number | null;
  valor_texto?: string | null;
  ruta_foto?: string | null;
  foto_antes?: string | null;
  foto_despues?: string | null;
}

interface RepuestoUsadoView {
  id?: number;
  material_id: number;
  cantidad: string | number;
  foto_antes?: string | null;
  foto_despues?: string | null;
  material: {
    id: number;
    nombre: string;
    codigo: string;
    unidad_medida: string;
  };
}

interface SeguridadRespuestaView {
  id?: number;
  seguridad_item_id: number;
  cumple: boolean | null;
  justificacion?: string | null;
  motivo_no_cumplimiento?: string | null;
  seguridad_item?: {
    id: number;
    pregunta: string;
    es_critico?: boolean;
  };
}

interface EncuestaView {
  id?: number;
  calificacion: number;
  comentarios?: string | null;
}

export default function OrdenDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = useAuth();
  
  // Unwrap params using React.use()
  const unwrappedParams = use(params);
  const otId = Number(unwrappedParams.id);

  const getFileUrl = (filename: string | null) => {
    if (!filename) return '';
    // En producción los adjuntos tienen url_publica de Supabase Storage
    if (filename.startsWith('http://') || filename.startsWith('https://') || filename.startsWith('data:')) {
      return filename;
    }
    // Fallback: construir URL de Supabase Storage desde la ruta relativa sanitizando slashes
    const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
    const cleanPath = filename.replace(/^\/+/, '');
    return `${baseUrl}/storage/v1/object/public/adjuntos/${cleanPath}`;
  };

  const getQuestionText = (itemId: number) => {
    if (!ot?.plantillas) return `Item #${itemId}`;
    for (const p of ot.plantillas as PlantillaTrabajo[]) {
      const found = p.items?.find((i) => i.id === itemId);
      if (found) return found.pregunta;
    }
    return `Item #${itemId}`;
  };

  // States
  const [ot, setOt] = useState<OrdenTrabajo | null>(null);
  const [eventos, setEventos] = useState<OTEvento[]>([]);
  const [notas, setNotas] = useState<OTNota[]>([]);
  const [adjuntos, setAdjuntos] = useState<OTAdjunto[]>([]);
  const [checklistRespuestas, setChecklistRespuestas] = useState<ChecklistRespuestaView[]>([]);
  const [repuestosUsados, setRepuestosUsados] = useState<RepuestoUsadoView[]>([]);
  const [seguridadRespuestas, setSeguridadRespuestas] = useState<SeguridadRespuestaView[]>([]);
  const [encuestas, setEncuestas] = useState<EncuestaView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Notes action
  const [nuevaNota, setNuevaNota] = useState('');
  const [notaInterna, setNotaInterna] = useState(true);
  const [notaLoading, setNotaLoading] = useState(false);

  // Attachment upload action
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Modals
  const [isAsignarOpen, setIsAsignarOpen] = useState(false);
  const [isTransicionOpen, setIsTransicionOpen] = useState(false);
  const [isInformeOpen, setIsInformeOpen] = useState(false);

  const fetchAllOTDetails = useCallback(async () => {
    // Avoid synchronous cascading render trigger in useEffect
    await Promise.resolve();
    setLoading(true);
    setError(null);
    try {
      const [otData, eventosData, notasData, adjuntosData, checklistData, repuestosData, seguridadData, encuestasData] = await Promise.all([
        apiFetch<OrdenTrabajo>(`/ordenes/${otId}`),
        apiFetch<OTEvento[]>(`/ordenes/${otId}/eventos`),
        apiFetch<OTNota[]>(`/ordenes/${otId}/notas`),
        apiFetch<OTAdjunto[]>(`/ordenes/${otId}/adjuntos`),
        apiFetch<ChecklistRespuestaView[]>(`/ordenes/${otId}/checklist-respuestas`).catch(() => []),
        apiFetch<RepuestoUsadoView[]>(`/ordenes/${otId}/repuestos-usados`).catch(() => []),
        apiFetch<SeguridadRespuestaView[]>(`/ordenes/${otId}/seguridad-respuestas`).catch(() => []),
        apiFetch<EncuestaView[]>(`/ordenes/${otId}/encuestas`).catch(() => []),
      ]);
      setOt(otData);
      setEventos(eventosData);
      setChecklistRespuestas(checklistData);
      setRepuestosUsados(repuestosData);
      setSeguridadRespuestas(seguridadData);
      setEncuestas(encuestasData);
      
      // Filter internal notes client-side based on user role
      const filteredNotes = user?.rol === 'tecnico'
        ? notasData.filter((n) => !n.es_interna || n.usuario?.id === user.id)
        : notasData;
      setNotas(filteredNotes);
      
      setAdjuntos(adjuntosData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los detalles de la orden');
    } finally {
      setLoading(false);
    }
  }, [otId, user]);

  useEffect(() => {
    if (otId) {
      Promise.resolve().then(() => {
        fetchAllOTDetails();
      });
    }
  }, [otId, fetchAllOTDetails]);

  const handleAgregarNota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaNota.trim()) return;

    setNotaLoading(true);
    try {
      const created = await apiFetch<OTNota>(`/ordenes/${otId}/notas`, {
        method: 'POST',
        body: JSON.stringify({
          contenido: nuevaNota.trim(),
          es_interna: notaInterna,
        }),
      });

      // Insert at the top
      setNotas([created, ...notas]);
      setNuevaNota('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar la nota');
    } finally {
      setNotaLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadError(null);

      // Max 5MB check
      if (file.size > 5 * 1024 * 1024) {
        setUploadError('El archivo excede el tamaño máximo permitido de 5MB');
        setUploadFile(null);
        return;
      }

      // Allowed extensions check
      const allowedExt = ['.png', '.jpg', '.jpeg', '.pdf', '.txt'];
      const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!allowedExt.includes(fileExt)) {
        setUploadError('Extensión no permitida. Permitidas: PNG, JPG, JPEG, PDF, TXT');
        setUploadFile(null);
        return;
      }

      setUploadFile(file);
    }
  };

  const handleUploadAdjunto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploadLoading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const created = await apiFetch<OTAdjunto>(`/ordenes/${otId}/adjuntos`, {
        method: 'POST',
        body: formData,
      });

      setAdjuntos([created, ...adjuntos]);
      setUploadFile(null);
      // Reset input element
      const fileInput = document.getElementById('adjunto-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error al subir el archivo');
    } finally {
      setUploadLoading(false);
    }
  };

  const isOperator = user?.rol === 'admin' || user?.rol === 'superadmin' || user?.rol === 'operador';

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-20">
        <Spinner size="lg" />
        <span className="text-xs text-zinc-500 font-medium mt-3">Cargando ficha técnica...</span>
      </div>
    );
  }

  if (error || !ot) {
    return <ErrorMessage message={error || 'No se pudo cargar la orden de trabajo.'} retry={fetchAllOTDetails} />;
  }

  const prioColor = PRIORIDAD_COLORS[ot.prioridad];
  const stateColor = ESTADO_COLORS[ot.estado];

  return (
    <div className="flex flex-col gap-6">
      {/* Back link & breadcrumb */}
      <div className="flex justify-between items-center">
        <Link
          href="/ordenes"
          className="inline-flex items-center text-xs font-semibold text-zinc-500 hover:text-zinc-800 transition-colors"
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver al listado
        </Link>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsInformeOpen(true)}
            className="py-1.5 px-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-black transition-all print:hidden cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-xs"
          >
            📋 Generar Informe PDF
          </button>
          {isOperator && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setIsAsignarOpen(true)}>
                Asignar Técnico
              </Button>
              <Button size="sm" onClick={() => setIsTransicionOpen(true)}>
                Cambiar Estado
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Details card */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <div className="flex justify-between items-start gap-4">
              <div>
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">
                  Código Interno: {ot.codigo_interno}
                </span>
                <h1 className="text-lg font-bold text-zinc-950 mt-1">{ot.titulo}</h1>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <Badge bg={prioColor.bg} text={prioColor.text} border={prioColor.border} className="capitalize">
                  Prioridad {PRIORIDAD_LABELS[ot.prioridad]}
                </Badge>
                <Badge bg={stateColor.bg} text={stateColor.text} border={stateColor.border}>
                  {ESTADO_LABELS[ot.estado]}
                </Badge>
              </div>
            </div>

            <div className="border-t border-zinc-100 pt-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="font-semibold text-zinc-400 block mb-1">Cliente Contratante</span>
                <span className="text-zinc-800 font-medium">{ot.cliente.nombre}</span>
              </div>
              <div>
                <span className="font-semibold text-zinc-400 block mb-1">RUC Cliente</span>
                <span className="text-zinc-800 font-medium">{ot.cliente.ruc}</span>
              </div>
              <div>
                <span className="font-semibold text-zinc-400 block mb-1">Tipo de Orden (Plantilla)</span>
                <span className="text-indigo-800 font-semibold inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md text-[11px]">
                  📋 {ot.plantillas && ot.plantillas.length > 0 ? ot.plantillas.map(p => p.titulo).join(', ') : (ot.plantilla?.titulo || 'Mantto General')}
                </span>
              </div>
              <div>
                <span className="font-semibold text-zinc-400 block mb-1">Canal de Ingesta</span>
                <span className="text-zinc-800 font-medium capitalize">
                  {typeof ot.canal === 'object' && ot.canal !== null
                    ? (ot.canal as { nombre?: string }).nombre ?? 'Web'
                    : ot.canal}
                </span>
              </div>
              {ot.codigo_externo && (
                <div>
                  <span className="font-semibold text-zinc-400 block mb-1">Código del Cliente</span>
                  <span className="text-zinc-800 font-medium">{ot.codigo_externo}</span>
                </div>
              )}
              {ot.prioridad_origen && (
                <div>
                  <span className="font-semibold text-zinc-400 block mb-1">Prioridad Original</span>
                  <span className="text-zinc-800 font-medium uppercase">{ot.prioridad_origen}</span>
                </div>
              )}
              <div>
                <span className="font-semibold text-zinc-400 block mb-1">Técnico Asignado</span>
                <span className="text-zinc-800 font-semibold text-teal-700">
                  {ot.tecnico_asignado ? ot.tecnico_asignado.nombre : 'Sin Técnico Asignado'}
                </span>
              </div>
            </div>

            {ot.descripcion && (
              <div className="border-t border-zinc-100 pt-4 flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-zinc-400">Descripción del Trabajo / Comentario</span>
                <p className="text-xs text-zinc-700 leading-relaxed whitespace-pre-wrap bg-zinc-50 border border-zinc-100 p-3 rounded-lg">
                  {ot.descripcion}
                </p>
              </div>
            )}

            {/* Plantillas Asociadas */}
            {(ot.plantillas?.length > 0) && (
              <div className="border-t border-zinc-100 pt-4 flex flex-col gap-2">
                <span className="text-xs font-semibold text-zinc-400">
                  📋 Plantillas de Trabajo Asociadas ({ot.plantillas.length})
                </span>
                <div className="flex flex-wrap gap-2">
                  {ot.plantillas.map((p, idx) => (
                    <span
                      key={p.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                        idx === 0 ? 'bg-sky-50 text-sky-800 border-sky-200' :
                        idx === 1 ? 'bg-amber-50 text-amber-800 border-amber-200' :
                        'bg-purple-50 text-purple-800 border-purple-200'
                      }`}
                    >
                      {p.titulo}
                      <span className="text-[9px] opacity-60">⏱ {p.tiempo_estimado_minutos} min</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Resumen de Ejecución en Campo */}
          {(ot.fecha_salida || checklistRespuestas.length > 0 || repuestosUsados.length > 0 || ot.firma_cliente) && (
            <Card className="flex flex-col gap-5 p-5 border border-zinc-200">
              <h3 className="text-sm font-semibold text-zinc-900 border-b border-zinc-100 pb-2 flex items-center gap-1.5">
                <span>📋 Resumen de Ejecución en Campo</span>
              </h3>
              
              {/* Telemetría GPS e Hitos de Tiempo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-zinc-50 p-3.5 rounded-xl border border-zinc-200">
                {ot.fecha_salida && (
                  <div>
                    <span className="font-semibold text-zinc-400 block mb-0.5">🛫 Salida a Traslado</span>
                    <span className="text-zinc-800 font-medium">
                      {new Date(ot.fecha_salida).toLocaleString('es-ES')}
                    </span>
                    {ot.latitud_salida !== null && (
                      <span className="block text-[10px] text-zinc-400 font-mono mt-0.5">
                        GPS: {ot.latitud_salida}, {ot.longitud_salida}
                      </span>
                    )}
                  </div>
                )}
                {ot.fecha_llegada && (
                  <div>
                    <span className="font-semibold text-zinc-400 block mb-0.5">📍 Llegada al Sitio</span>
                    <span className="text-zinc-800 font-medium">
                      {new Date(ot.fecha_llegada).toLocaleString('es-ES')}
                    </span>
                    {ot.latitud_llegada !== null && (
                      <span className="block text-[10px] text-zinc-400 font-mono mt-0.5">
                        GPS: {ot.latitud_llegada}, {ot.longitud_llegada}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Respuestas del Checklist */}
              {checklistRespuestas.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide">Resultados del Checklist</span>
                  <div className="flex flex-col gap-2 bg-white rounded-lg">
                    {checklistRespuestas.map((ans, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs p-2.5 bg-zinc-50/50 rounded-lg border border-zinc-100">
                        <span className="font-semibold text-zinc-700 max-w-[240px]">
                          {ans.pregunta || ans.plantilla_item?.pregunta || getQuestionText(ans.plantilla_item_id)}
                        </span>
                        <span className="text-zinc-900 font-bold flex items-center gap-2">
                          {typeof ans.valor_booleano === 'boolean' && (ans.valor_booleano ? 'SÍ' : 'NO')}
                          {ans.valor_numerico !== null && ans.valor_numerico !== undefined && ans.valor_numerico}
                          {ans.valor_texto !== null && ans.valor_texto !== undefined && ans.valor_texto}
                          {ans.ruta_foto && (
                            <a
                              href={getFileUrl(ans.ruta_foto)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-teal-600 font-semibold hover:underline flex items-center gap-1"
                            >
                              📷 Ver Foto
                            </a>
                          )}
                          {ans.foto_antes && (
                            <a
                              href={getFileUrl(ans.foto_antes)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-teal-600 font-semibold hover:underline flex items-center gap-1"
                            >
                              📷 Antes
                            </a>
                          )}
                          {ans.foto_despues && (
                            <a
                              href={getFileUrl(ans.foto_despues)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-teal-600 font-semibold hover:underline flex items-center gap-1"
                            >
                              📷 Después
                            </a>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Materiales Consumidos */}
              {repuestosUsados.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide">Materiales y Repuestos Utilizados</span>
                  <div className="flex flex-col gap-1.5 bg-white rounded-lg">
                    {repuestosUsados.map((rep, idx) => (
                      <div key={idx} className="flex flex-col gap-2 p-2.5 bg-zinc-50/50 rounded-lg border border-zinc-100">
                        <div className="flex justify-between items-center text-xs">
                          <div className="flex flex-col">
                            <span className="font-semibold text-zinc-700">{rep.material.nombre}</span>
                            <span className="text-[10px] text-zinc-400 font-mono">Código: {rep.material.codigo}</span>
                          </div>
                          <Badge bg="bg-teal-50" text="text-teal-700" border="border-teal-200">
                            Cant: {parseFloat(String(rep.cantidad))} {rep.material.unidad_medida}
                          </Badge>
                        </div>
                        {(rep.foto_antes || rep.foto_despues) && (
                          <div className="flex gap-4.5 text-[10px] pt-1.5 border-t border-zinc-100 mt-1">
                            {rep.foto_antes && (
                              <a
                                href={getFileUrl(rep.foto_antes)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-teal-600 font-semibold hover:underline flex items-center gap-1"
                              >
                                📷 Evidencia Antes
                              </a>
                            )}
                            {rep.foto_despues && (
                              <a
                                href={getFileUrl(rep.foto_despues)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-teal-600 font-semibold hover:underline flex items-center gap-1"
                              >
                                📷 Evidencia Después
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Respuestas del Checklist de Seguridad Obligatorio */}
              {seguridadRespuestas.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide">Respuestas de Seguridad Obligatorias</span>
                  <div className="flex flex-col gap-2 bg-white rounded-lg">
                    {seguridadRespuestas.map((ans, idx) => (
                      <div key={idx} className="flex justify-between items-start text-xs p-2.5 bg-zinc-50/50 rounded-lg border border-zinc-100">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-zinc-700 max-w-[240px]">{ans.seguridad_item?.pregunta}</span>
                          {ans.cumple === false && (ans.justificacion || ans.motivo_no_cumplimiento) && (
                            <span className="text-[10px] text-orange-700 bg-orange-50 border border-orange-100 rounded px-1.5 py-0.5 mt-1 block">
                              <strong>Justificación NO cumple:</strong> &ldquo;{ans.justificacion || ans.motivo_no_cumplimiento}&rdquo;
                            </span>
                          )}
                        </div>
                        <Badge
                          bg={ans.cumple === true ? 'bg-emerald-50' : ans.cumple === false ? 'bg-red-50' : 'bg-zinc-100'}
                          text={ans.cumple === true ? 'text-emerald-700' : ans.cumple === false ? 'text-red-700' : 'text-zinc-600'}
                          border={ans.cumple === true ? 'border-emerald-200' : ans.cumple === false ? 'border-red-200' : 'border-zinc-300'}
                          className="font-bold uppercase tracking-wider text-[9px]"
                        >
                          {ans.cumple === true ? 'Cumple' : ans.cumple === false ? 'No cumple' : 'No aplica'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Encuesta de Calidad de Servicio */}
              {encuestas.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide">Encuesta de Calidad de Servicio</span>
                  <div className="flex flex-col gap-2.5 bg-white rounded-lg">
                    {encuestas.map((enc, idx) => (
                      <div key={idx} className="flex flex-col gap-1.5 p-3 bg-zinc-50/50 rounded-lg border border-zinc-100">
                        <div className="flex items-center gap-1">
                          <span className="text-zinc-600 font-bold text-xs">Calificación:</span>
                          <span className="text-amber-500 text-sm font-bold">
                            {'★'.repeat(enc.calificacion)}{'☆'.repeat(5 - enc.calificacion)}
                          </span>
                          <span className="text-zinc-500 font-semibold text-[10px] ml-1">({enc.calificacion} / 5)</span>
                        </div>
                        {enc.comentarios && (
                          <p className="text-xs text-zinc-600 bg-white border border-zinc-100 p-2 rounded leading-relaxed italic">
                            &ldquo;{enc.comentarios}&rdquo;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Firma de Cliente */}
              {/* Firma de Cliente */}
              {ot.firma_cliente && (
                <div className="flex flex-col gap-4 border-t border-zinc-100 pt-4">
                  <div>
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide block mb-2">Conformidad del Cliente</span>
                    <div className="bg-zinc-50 border border-zinc-150 rounded-xl p-3 flex flex-col gap-2.5 text-xs text-zinc-700 max-w-md">
                      {ot.firma_nombre_cliente && (
                        <p><strong>Nombre:</strong> {ot.firma_nombre_cliente}</p>
                      )}
                      {ot.firma_documento_cliente && (
                        <p><strong>Documento:</strong> {ot.firma_documento_cliente}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-4 items-start flex-wrap">
                    <div>
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide block mb-1">Firma Digital</span>
                      <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white max-w-xs p-2.5 shadow-sm">
                        <img src={getFileUrl(ot.firma_cliente)} alt="Firma del Cliente" className="max-h-24 object-contain mx-auto" />
                      </div>
                    </div>

                    {ot.firma_foto_evidencia && (
                      <div>
                        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide block mb-1">Foto de Evidencia de Cierre</span>
                        <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white max-w-xs p-2.5 shadow-sm">
                          <img src={getFileUrl(ot.firma_foto_evidencia)} alt="Evidencia Cierre" className="max-h-24 object-contain mx-auto" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Technical Notes / Bitácora Section */}
          <Card className="flex flex-col gap-5">
            <h3 className="text-sm font-semibold text-zinc-900">Bitácora / Notas Técnicas</h3>

            {/* Note form */}
            <form onSubmit={handleAgregarNota} className="flex flex-col gap-3">
              <textarea
                rows={2}
                placeholder="Escriba un comentario o nota de avance técnico..."
                className="w-full px-3 py-2 text-xs text-zinc-800 bg-white border border-zinc-200 focus:ring-teal-500 rounded-lg shadow-2xs placeholder-zinc-400 focus:outline-none focus:ring-1 focus:border-transparent transition-all"
                value={nuevaNota}
                onChange={(e) => setNuevaNota(e.target.value)}
                required
              />

              {user?.rol !== 'tecnico' && (
                <div className="flex items-center gap-2">
                  <input
                    id="nota-interna-cb"
                    type="checkbox"
                    checked={notaInterna}
                    onChange={(e) => setNotaInterna(e.target.checked)}
                    className="w-4 h-4 text-teal-600 border-zinc-300 rounded focus:ring-teal-500"
                  />
                  <label htmlFor="nota-interna-cb" className="text-xs font-medium text-zinc-500">
                    Nota interna (Solo visible para Operadores / Supervisores)
                  </label>
                </div>
              )}

              <Button type="submit" size="sm" isLoading={notaLoading} className="self-end">
                Guardar Avance
              </Button>
            </form>

            {/* Notes list */}
            <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1">
              {notas.length === 0 ? (
                <span className="text-xs text-zinc-400 italic text-center py-4">
                  No hay notas técnicas registradas en esta orden.
                </span>
              ) : (
                notas.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3 rounded-lg border text-xs leading-relaxed ${
                      n.es_interna
                        ? 'bg-amber-50/40 border-amber-200/50'
                        : 'bg-zinc-50/50 border-zinc-200/60'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1.5 text-[10px]">
                      <span className="font-semibold text-zinc-700">
                        {n.usuario?.nombre || 'Sistema'}{' '}
                        {n.es_interna && (
                          <span className="ml-1 text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-1 py-0.2 rounded-sm uppercase tracking-wide">
                            Interna
                          </span>
                        )}
                      </span>
                      <span className="text-zinc-400">
                        {new Date(n.created_at).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-zinc-800 whitespace-pre-wrap">{n.contenido}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Files & Timeline */}
        <div className="flex flex-col gap-6">
          
          {/* Attachments card */}
          <Card className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-zinc-900">Documentos Adjuntos</h3>

            {/* File upload form */}
            <form onSubmit={handleUploadAdjunto} className="flex flex-col gap-3">
              {uploadError && (
                <div className="p-2 bg-red-50 border border-red-200 rounded-md text-[10px] text-red-700 font-medium">
                  {uploadError}
                </div>
              )}

              <input
                id="adjunto-file-input"
                type="file"
                onChange={handleFileChange}
                className="text-xs text-zinc-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200 cursor-pointer w-full border border-dashed border-zinc-200 rounded-lg p-1.5 bg-zinc-50/50"
                accept=".png,.jpg,.jpeg,.pdf,.txt"
              />

              <Button type="submit" size="sm" isLoading={uploadLoading} disabled={!uploadFile} className="w-full">
                Subir Archivo
              </Button>
            </form>

            {/* Files list */}
            <div className="flex flex-col gap-2 mt-2">
              {adjuntos.length === 0 ? (
                <span className="text-xs text-zinc-400 italic text-center py-2">
                  Sin archivos adjuntos.
                </span>
              ) : (
                adjuntos.map((file) => (
                  <div
                    key={file.id}
                    className="p-2 border border-zinc-100 bg-white rounded-lg flex items-center justify-between gap-3 text-xs hover:border-zinc-200 transition-colors"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-zinc-800 block truncate max-w-[120px]" title={file.nombre_archivo}>
                        {file.nombre_archivo}
                      </span>
                      <span className="text-[9px] text-zinc-400 block mt-0.5">
                        {new Date(file.created_at).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                    {/* Action download */}
                    <a
                      href={file.url_publica || getFileUrl(file.ruta || null)}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={file.nombre_archivo}
                      className="text-[10px] text-teal-600 hover:text-teal-700 font-bold hover:bg-teal-50 border border-teal-100 hover:border-teal-200 p-1.5 rounded-lg transition-all"
                    >
                      Descargar
                    </a>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Immutable events log */}
          <Card className="flex flex-col gap-4 flex-1">
            <h3 className="text-sm font-semibold text-zinc-900">Historial de Auditoría</h3>

            <div className="relative border-l border-zinc-200 pl-4 ml-2 flex flex-col gap-5 max-h-[350px] overflow-y-auto pr-1">
              {eventos.length === 0 ? (
                <span className="text-xs text-zinc-400 italic text-center py-4">
                  Sin eventos registrados.
                </span>
              ) : (
                eventos.map((ev) => (
                  <div key={ev.id} className="relative text-xs leading-relaxed">
                    {/* Circle marker */}
                    <span className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-zinc-300 border border-white" />
                    
                    <div className="flex justify-between items-center text-[10px] text-zinc-400 mb-0.5">
                      <span className="font-semibold text-zinc-500">
                        {ev.usuario?.nombre || 'Sistema'}
                      </span>
                      <span>
                        {new Date(ev.created_at).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-zinc-800">
                      Estado: <span className="font-semibold">{ESTADO_LABELS[ev.estado_nuevo]}</span>
                      {ev.estado_anterior && (
                        <span className="text-zinc-400 text-[10px]"> (antes: {ESTADO_LABELS[ev.estado_anterior]})</span>
                      )}
                    </p>
                    {ev.comentario && (
                      <p className="text-[11px] text-zinc-500 italic mt-0.5">
                        &ldquo;{ev.comentario}&rdquo;
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

      </div>

      {/* Assignment Modal Hook */}
      {isAsignarOpen && ot && (
        <AsignarModal
          isOpen={isAsignarOpen}
          onClose={() => setIsAsignarOpen(false)}
          otId={ot.id}
          empresaId={ot.empresa_id}
          onSuccess={fetchAllOTDetails}
        />
      )}

      {/* Transition Modal Hook */}
      {isTransicionOpen && ot && (
        <TransicionModal
          isOpen={isTransicionOpen}
          onClose={() => setIsTransicionOpen(false)}
          otId={ot.id}
          estadoActual={ot.estado}
          onSuccess={fetchAllOTDetails}
        />
      )}

      {/* Informe PDF Modal Hook */}
      {isInformeOpen && ot && (
        <InformePdfModal
          isOpen={isInformeOpen}
          onClose={() => setIsInformeOpen(false)}
          ot={ot}
          checklistRespuestas={checklistRespuestas}
          repuestosUsados={repuestosUsados}
          seguridadRespuestas={seguridadRespuestas}
          notas={notas}
          eventos={eventos}
          getFileUrl={getFileUrl}
        />
      )}
    </div>
  );
}
