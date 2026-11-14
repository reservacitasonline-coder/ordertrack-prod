'use client';

import React, { useState, useRef } from 'react';
import { OrdenTrabajo, OTEvento, OTNota } from '@/types';
import { ESTADO_LABELS, PRIORIDAD_LABELS } from '@/lib/constants';

export interface ChecklistRespuestaItem {
  id?: number;
  plantilla_item_id: number;
  pregunta?: string | null;
  plantilla_item?: { id: number; pregunta: string; tipo_respuesta?: string; orden?: number } | null;
  valor_booleano?: boolean | null;
  valor_texto?: string | null;
  valor_numerico?: number | null;
  foto_antes?: string | null;
  foto_despues?: string | null;
  ruta_foto?: string | null;
}

export interface RepuestoUsadoItem {
  id?: number;
  material_id: number;
  cantidad: string | number;
  foto_antes?: string | null;
  foto_despues?: string | null;
  material?: {
    id: number;
    nombre: string;
    codigo: string;
    unidad_medida: string;
  } | null;
}

export interface SeguridadRespuestaItem {
  id?: number;
  seguridad_item_id: number;
  cumple?: boolean | null;
  motivo_no_cumplimiento?: string | null;
  respuesta?: string | null;
  justificacion?: string | null;
  ruta_foto?: string | null;
  seguridad_item?: {
    id: number;
    pregunta: string;
    requerido?: boolean;
    es_critico?: boolean;
  } | null;
}

interface InformePdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  ot: OrdenTrabajo;
  checklistRespuestas: ChecklistRespuestaItem[];
  repuestosUsados: RepuestoUsadoItem[];
  seguridadRespuestas: SeguridadRespuestaItem[];
  notas: OTNota[];
  eventos: OTEvento[];
  getFileUrl: (filename: string | null) => string;
}

export const InformePdfModal: React.FC<InformePdfModalProps> = ({
  isOpen,
  onClose,
  ot,
  checklistRespuestas,
  repuestosUsados,
  seguridadRespuestas,
  notas,
  eventos,
  getFileUrl,
}) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoSize, setLogoSize] = useState<number>(80);
  const [includeSafety, setIncludeSafety] = useState(true);
  const [includeTechnical, setIncludeTechnical] = useState(true);
  const [includeSpares, setIncludeSpares] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeSignatures, setIncludeSignatures] = useState(true);
  const [includeEvents, setIncludeEvents] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerPrint = () => {
    window.print();
  };

  // Helper to format date cleanly
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white print:static">
      {/* Dynamic Print CSS override to isolate printing to the document wrapper only */}
      <style jsx global>{`
        @media print {
          html, body {
            background-color: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
          }
          /* Hide EVERYTHING in the page */
          body > * {
            display: none !important;
          }
          /* Display ONLY this modal container */
          #print-modal-root {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
          }
          #print-modal-root * {
            visibility: visible;
          }
          /* Hide Sidebar */
          .print-sidebar {
            display: none !important;
          }
          /* Main sheet takes full size */
          .print-preview-container {
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
            width: 100% !important;
            height: auto !important;
          }
          .print-sheet {
            width: 100% !important;
            max-width: 100% !important;
            min-height: 0 !important;
            border: none !important;
            box-shadow: none !important;
            padding: 20mm !important;
            margin: 0 !important;
            page-break-after: avoid;
          }
          .page-break {
            page-break-before: always;
          }
          .avoid-break {
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div
        id="print-modal-root"
        className="bg-white rounded-3xl w-full max-w-6xl h-[90vh] flex overflow-hidden shadow-2xl print:shadow-none print:w-full print:h-auto print:rounded-none print:overflow-visible"
      >
        {/* Left Config Panel */}
        <div className="print-sidebar w-80 bg-zinc-50 border-r border-zinc-200 p-6 flex flex-col gap-6 shrink-0 overflow-y-auto">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold text-zinc-950">Informe Técnico</h2>
            <p className="text-xs text-zinc-550 font-semibold">Configuración de exportación PDF</p>
          </div>

          <hr className="border-zinc-200" />

          {/* Logo Section */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-black text-zinc-700 uppercase tracking-wider">Logo de Empresa</span>
            {logoUrl ? (
              <div className="relative border border-zinc-200 rounded-xl p-2.5 flex items-center justify-between bg-white shadow-3xs">
                <img src={logoUrl} alt="Logo preview" className="max-h-10 object-contain rounded" />
                <button
                  onClick={() => setLogoUrl(null)}
                  className="text-red-500 text-xs font-bold hover:underline cursor-pointer"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 border-2 border-dashed border-zinc-250 hover:border-zinc-400 rounded-xl bg-white text-xs font-black text-zinc-500 flex flex-col gap-1.5 items-center justify-center transition-all cursor-pointer"
              >
                <span>➕ Cargar Logotipo</span>
                <span className="text-[10px] text-zinc-400 font-bold">PNG o JPG (Máx. 2MB)</span>
              </button>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleLogoUpload}
              accept="image/*"
              className="hidden"
            />

            {logoUrl && (
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs text-zinc-650 font-bold">
                  <span>Tamaño del Logo</span>
                  <span>{logoSize}px</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="140"
                  value={logoSize}
                  onChange={(e) => setLogoSize(Number(e.target.value))}
                  className="w-full accent-zinc-900 h-1.5 bg-zinc-200 rounded-lg cursor-pointer"
                />
              </div>
            )}
          </div>

          <hr className="border-zinc-200" />

          {/* Options checkboxes */}
          <div className="flex flex-col gap-3.5">
            <span className="text-xs font-black text-zinc-700 uppercase tracking-wider">Secciones a Incluir</span>
            
            <label className="flex items-center gap-3 text-xs font-semibold text-zinc-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeSafety}
                onChange={(e) => setIncludeSafety(e.target.checked)}
                className="w-4 h-4 rounded text-zinc-950 accent-zinc-950"
              />
              <span>Checklist de Seguridad</span>
            </label>

            <label className="flex items-center gap-3 text-xs font-semibold text-zinc-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeTechnical}
                onChange={(e) => setIncludeTechnical(e.target.checked)}
                className="w-4 h-4 rounded text-zinc-950 accent-zinc-950"
              />
              <span>Checklist Técnico</span>
            </label>

            <label className="flex items-center gap-3 text-xs font-semibold text-zinc-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeSpares}
                onChange={(e) => setIncludeSpares(e.target.checked)}
                className="w-4 h-4 rounded text-zinc-950 accent-zinc-950"
              />
              <span>Repuestos y Materiales</span>
            </label>

            <label className="flex items-center gap-3 text-xs font-semibold text-zinc-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeNotes}
                onChange={(e) => setIncludeNotes(e.target.checked)}
                className="w-4 h-4 rounded text-zinc-950 accent-zinc-950"
              />
              <span>Bitácora / Notas de Campo</span>
            </label>

            <label className="flex items-center gap-3 text-xs font-semibold text-zinc-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeSignatures}
                onChange={(e) => setIncludeSignatures(e.target.checked)}
                className="w-4 h-4 rounded text-zinc-950 accent-zinc-950"
              />
              <span>Firmas y Conformidad</span>
            </label>

            <label className="flex items-center gap-3 text-xs font-semibold text-zinc-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeEvents}
                onChange={(e) => setIncludeEvents(e.target.checked)}
                className="w-4 h-4 rounded text-zinc-950 accent-zinc-950"
              />
              <span>Historial de Eventos</span>
            </label>
          </div>

          <div className="mt-auto flex flex-col gap-3">
            <button
              onClick={triggerPrint}
              className="w-full h-12 bg-zinc-900 hover:bg-zinc-950 text-white rounded-xl text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 shadow-md"
            >
              <span>🖨️</span>
              <span>Imprimir / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="w-full h-11 bg-white hover:bg-zinc-50 border border-zinc-250 text-zinc-700 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
            >
              Volver al Detalle
            </button>
          </div>
        </div>

        {/* Right Preview Area */}
        <div className="print-preview-container flex-1 bg-zinc-150 p-8 overflow-y-auto flex justify-center print:bg-white print:p-0 print:overflow-visible">
          {/* Printable sheet container */}
          <div className="print-sheet w-[794px] min-h-[1123px] bg-white border border-zinc-250 p-12 shadow-md flex flex-col gap-8 print:border-none print:shadow-none print:w-full print:p-0 print:min-h-0 print:gap-7">
            
            {/* Report Header */}
            <div className="flex justify-between items-start border-b-2 border-zinc-900 pb-5">
              <div className="flex flex-col gap-2">
                {logoUrl ? (
                  <img src={logoUrl} alt="Company Logo" style={{ height: `${logoSize}px` }} className="object-contain self-start mb-2" />
                ) : (
                  <div className="h-10 px-3 border-2 border-dashed border-zinc-300 rounded flex items-center justify-center text-[10px] text-zinc-450 font-bold uppercase tracking-wider mb-2">
                    [ LOGOTIPO DE EMPRESA ]
                  </div>
                )}
                <h1 className="text-xl font-black tracking-tight text-zinc-900">INFORME TÉCNICO DE TRABAJO</h1>
                <span className="text-xs text-zinc-500 font-bold">Orden de Trabajo ID: #{ot.codigo_interno}</span>
              </div>
              <div className="flex flex-col items-end gap-1.5 text-right">
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-black border uppercase tracking-wider ${
                  ot.estado === 'COMPLETADA' || ot.estado === 'CERRADA'
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-amber-50 border-amber-200 text-amber-700'
                }`}>
                  {ESTADO_LABELS[ot.estado] || ot.estado}
                </span>
                <span className="text-[10px] text-zinc-450 font-semibold mt-1">Generado: {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
              </div>
            </div>

            {/* General Info Section */}
            <div className="avoid-break bg-zinc-50 border border-zinc-150 rounded-2xl p-5 flex flex-col gap-4">
              <h2 className="text-xs font-black text-zinc-700 uppercase tracking-widest border-b border-zinc-200 pb-1.5">Información General</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
                <div>
                  <span className="text-zinc-450 block font-bold">Cliente</span>
                  <span className="font-bold text-zinc-800">{ot.cliente?.nombre || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-zinc-450 block font-bold">Ubicación / Dirección</span>
                  <span className="font-semibold text-zinc-700">{ot.cliente?.direccion || 'Sede de cliente'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-zinc-450 block font-bold">Servicio / Equipo</span>
                  <span className="font-bold text-zinc-800">{ot.titulo}</span>
                </div>
                <div>
                  <span className="text-zinc-450 block font-bold">Técnico Encargado</span>
                  <span className="font-bold text-zinc-800">{ot.tecnico_asignado?.nombre || 'No asignado'}</span>
                </div>
                <div>
                  <span className="text-zinc-450 block font-bold">Prioridad</span>
                  <span className="font-bold text-zinc-700 capitalize">{PRIORIDAD_LABELS[ot.prioridad] || ot.prioridad}</span>
                </div>
                <div>
                  <span className="text-zinc-450 block font-bold">Fecha Programada</span>
                  <span className="font-semibold text-zinc-700">{formatDate(ot.fecha_programada)}</span>
                </div>
                <div>
                  <span className="text-zinc-450 block font-bold">Fecha de Finalización</span>
                  <span className="font-semibold text-zinc-700">{formatDate(ot.fecha_cierre)}</span>
                </div>
              </div>
            </div>

            {/* Safety Checklist Section */}
            {includeSafety && seguridadRespuestas.length > 0 && (
              <div className="avoid-break flex flex-col gap-3">
                <h2 className="text-xs font-black text-zinc-700 uppercase tracking-widest border-b border-zinc-200 pb-1.5">1. Control de Seguridad (EPP y Bloqueo)</h2>
                <div className="flex flex-col gap-2 bg-zinc-50 border border-zinc-150 rounded-2xl p-3">
                  {seguridadRespuestas.map((ans, idx) => {
                    const isSi = ans.cumple === true || ans.respuesta === 'si';
                    const isNo = ans.cumple === false || ans.respuesta === 'no';
                    const justif = ans.motivo_no_cumplimiento || ans.justificacion;
                    return (
                      <div key={idx} className="flex flex-col gap-1.5 p-2 bg-white rounded-xl border border-zinc-100 text-xs">
                        <div className="flex justify-between items-center font-bold">
                          <span className="text-zinc-800">{ans.seguridad_item?.pregunta || `Pregunta de seguridad #${ans.seguridad_item_id}`}</span>
                          <span className={`px-2 py-0.5 rounded uppercase text-[9px] ${
                            isSi ? 'bg-green-50 border border-green-200 text-green-700' :
                            isNo ? 'bg-red-50 border border-red-200 text-red-700' :
                            'bg-zinc-100 border border-zinc-200 text-zinc-650'
                          }`}>
                            {isSi ? 'Cumple (SÍ)' : isNo ? 'No Cumple (NO)' : 'No Aplica (N/A)'}
                          </span>
                        </div>
                        {justif && (
                          <div className="text-[10px] text-zinc-550 border-t border-zinc-50 pt-1 font-semibold italic bg-amber-50/40 p-1.5 rounded">
                            Justificación: {justif}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Technical Checklist Section */}
            {includeTechnical && checklistRespuestas.length > 0 && (
              <div className="avoid-break flex flex-col gap-3">
                <h2 className="text-xs font-black text-zinc-700 uppercase tracking-widest border-b border-zinc-200 pb-1.5">2. Resultados de la Inspección Técnica</h2>
                <div className="flex flex-col gap-2">
                  <table className="w-full text-left text-xs border border-zinc-200 rounded-xl overflow-hidden border-collapse">
                    <thead>
                      <tr className="bg-zinc-100 border-b border-zinc-200 text-zinc-600">
                        <th className="p-3 font-bold">Punto de Inspección</th>
                        <th className="p-3 font-bold text-center">Estado</th>
                        <th className="p-3 font-bold text-center">Evidencia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                      {checklistRespuestas.map((ans, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50/50">
                          <td className="p-3 font-bold text-zinc-800">{ans.pregunta || ans.plantilla_item?.pregunta || `Item #${ans.plantilla_item_id}`}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black tracking-wide ${
                              ans.valor_booleano ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
                            }`}>
                              {ans.valor_booleano ? 'OK / CORRECTO' : 'PENDIENTE / DEFECTUOSO'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex gap-2 justify-center">
                              {ans.foto_antes && (
                                <a
                                  href={getFileUrl(ans.foto_antes)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-teal-600 font-bold hover:underline"
                                >
                                  Antes
                                </a>
                              )}
                              {ans.foto_despues && (
                                <a
                                  href={getFileUrl(ans.foto_despues)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-teal-600 font-bold hover:underline"
                                >
                                  Después
                                </a>
                              )}
                              {!ans.foto_antes && !ans.foto_despues && <span className="text-zinc-400 text-[10px]">Sin fotos</span>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Spares Section */}
            {includeSpares && repuestosUsados.length > 0 && (
              <div className="avoid-break flex flex-col gap-3">
                <h2 className="text-xs font-black text-zinc-700 uppercase tracking-widest border-b border-zinc-200 pb-1.5">3. Consumo de Materiales y Repuestos</h2>
                <table className="w-full text-left text-xs border border-zinc-200 rounded-xl overflow-hidden border-collapse">
                  <thead>
                    <tr className="bg-zinc-100 border-b border-zinc-200 text-zinc-600">
                      <th className="p-3 font-bold">Repuesto</th>
                      <th className="p-3 font-bold">Código</th>
                      <th className="p-3 font-bold text-center">Cantidad</th>
                      <th className="p-3 font-bold text-center">Evidencia Fotos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {repuestosUsados.map((rep, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50/50">
                        <td className="p-3 font-bold text-zinc-800">{rep.material?.nombre}</td>
                        <td className="p-3 text-zinc-550 font-mono">{rep.material?.codigo}</td>
                        <td className="p-3 text-center font-bold text-zinc-800">
                          {parseFloat(String(rep.cantidad))} {rep.material?.unidad_medida}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex gap-2 justify-center">
                            {rep.foto_antes && (
                              <a
                                href={getFileUrl(rep.foto_antes)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-teal-600 font-bold hover:underline"
                              >
                                Antes
                              </a>
                            )}
                            {rep.foto_despues && (
                              <a
                                href={getFileUrl(rep.foto_despues)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-teal-600 font-bold hover:underline"
                              >
                                Después
                              </a>
                            )}
                            {!rep.foto_antes && !rep.foto_despues && <span className="text-zinc-400 text-[10px]">Sin fotos</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Notes Section */}
            {includeNotes && notas.length > 0 && (
              <div className="avoid-break flex flex-col gap-3">
                <h2 className="text-xs font-black text-zinc-700 uppercase tracking-widest border-b border-zinc-200 pb-1.5">4. Historial de Observaciones y Avances (Bitácora)</h2>
                <div className="flex flex-col gap-3 bg-zinc-50 border border-zinc-150 rounded-2xl p-4">
                  {notas.map((n) => (
                    <div key={n.id} className="bg-white border border-zinc-100 rounded-xl p-3 flex flex-col gap-1 text-xs">
                      <div className="flex justify-between items-center text-[10px] text-zinc-400 font-bold uppercase">
                        <span>{n.usuario?.nombre || 'Técnico'} ({n.usuario?.rol})</span>
                        <span>{formatDate(n.created_at)}</span>
                      </div>
                      <p className="text-zinc-800 font-semibold leading-relaxed whitespace-pre-wrap">{n.contenido}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Events Audit Log */}
            {includeEvents && eventos.length > 0 && (
              <div className="avoid-break flex flex-col gap-3">
                <h2 className="text-xs font-black text-zinc-700 uppercase tracking-widest border-b border-zinc-200 pb-1.5">5. Historial de Eventos e Hitos (Auditoría)</h2>
                <div className="flex flex-col gap-2">
                  {eventos.map((ev) => (
                    <div key={ev.id} className="flex justify-between items-center text-xs p-2.5 border-b border-zinc-100 hover:bg-zinc-50/55">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-zinc-800">{ev.estado_nuevo}</span>
                          {ev.estado_anterior && (
                            <span className="text-[10px] text-zinc-400">
                              (Anterior: {ev.estado_anterior})
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-450 font-bold">{ev.comentario}</span>
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono text-right">{formatDate(ev.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Conformity and Signature Section */}
            {includeSignatures && ot.firma_cliente && (
              <div className="avoid-break flex flex-col gap-4 border-t-2 border-zinc-900 pt-5 mt-auto">
                <h2 className="text-xs font-black text-zinc-700 uppercase tracking-widest pb-1 border-b border-zinc-200">6. Firma de Conformidad y Cierre</h2>
                
                <div className="grid grid-cols-2 gap-6 text-xs text-zinc-700">
                  <div className="bg-zinc-50 border border-zinc-150 rounded-xl p-3.5 flex flex-col gap-2.5">
                    <span className="text-[10px] font-black text-zinc-455 uppercase tracking-wider block mb-1">Datos del Receptor</span>
                    {ot.firma_nombre_cliente && (
                      <p><strong>Nombre y Apellidos:</strong> {ot.firma_nombre_cliente}</p>
                    )}
                    {ot.firma_documento_cliente && (
                      <p><strong>Identificación (Documento):</strong> {ot.firma_documento_cliente}</p>
                    )}
                    <p><strong>Fecha de Cierre:</strong> {formatDate(ot.fecha_cierre)}</p>
                  </div>

                  <div className="flex gap-4 items-center justify-between">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-black text-zinc-455 uppercase tracking-wider block mb-2">Firma Digital del Cliente</span>
                      <div className="border border-zinc-200 rounded-xl bg-white p-2 shadow-sm max-w-[150px]">
                        <img src={getFileUrl(ot.firma_cliente)} alt="Firma del Cliente" className="max-h-16 object-contain" />
                      </div>
                    </div>

                    {ot.firma_foto_evidencia && (
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-black text-zinc-455 uppercase tracking-wider block mb-2">Evidencia Fotográfica Final</span>
                        <div className="border border-zinc-200 rounded-xl bg-white p-2 shadow-sm max-w-[150px]">
                          <img src={getFileUrl(ot.firma_foto_evidencia)} alt="Evidencia Final" className="max-h-16 object-contain" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Footer watermark */}
            <div className="flex justify-between items-center text-[9px] text-zinc-400 font-bold border-t border-zinc-100 pt-3.5 mt-auto avoid-break">
              <span>OrderTrack Sistema de Gestión de Servicios de Terreno</span>
              <span>Página 1 de 1</span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
