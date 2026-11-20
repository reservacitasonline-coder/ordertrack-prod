'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { apiFetch } from '@/lib/api';
import type { CategoriaSeguridad, PlantillaSeguridad, PlantillaSeguridadItem } from '@/types';

interface ItemConfig {
  orden: number;
  pregunta: string;
  tipo_respuesta: 'SI_NO' | 'ESCALA' | 'NUMERICO' | 'TEXTO' | 'FOTO';
  requerido: boolean;
}

interface Plantilla {
  id: number;
  titulo: string;
  descripcion: string | null;
  tiempo_estimado_minutos: number;
  items: {
    id: number;
    orden: number;
    pregunta: string;
    tipo_respuesta: ItemConfig['tipo_respuesta'];
    requerido: boolean;
  }[];
}

const CATEGORIA_LABELS: Record<CategoriaSeguridad, { label: string; icon: string; color: string }> = {
  ELECTRICO: { label: 'Riesgo Eléctrico', icon: '⚡', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  LOTO: { label: 'Bloqueo y Etiquetado (LOTO)', icon: '🔒', color: 'bg-red-50 text-red-800 border-red-200' },
  ALTURAS: { label: 'Trabajos en Altura', icon: '🧗', color: 'bg-blue-50 text-blue-800 border-blue-200' },
  EPP: { label: 'EPP Dieléctrico y Arco', icon: '🦺', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  GENERAL: { label: 'Seguridad General', icon: '🛡️', color: 'bg-zinc-100 text-zinc-800 border-zinc-200' },
  ESPACIO_CONFINADO: { label: 'Espacio Confinado', icon: '🚪', color: 'bg-purple-50 text-purple-800 border-purple-200' },
};

export default function PlantillasAdminPage() {
  const { user } = useAuth();
  const canManage = user?.rol === 'admin' || user?.rol === 'superadmin';
  const [activeTab, setActiveTab] = useState<'tecnicas' | 'seguridad'>('seguridad');

  // ── Tab 1: Plantillas Técnicas State ───────────────────────
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tiempoEstimado, setTiempoEstimado] = useState(60);
  const [items, setItems] = useState<ItemConfig[]>([]);

  const [newPregunta, setNewPregunta] = useState('');
  const [newPreguntaError, setNewPreguntaError] = useState<string | null>(null);
  const [newTipo, setNewTipo] = useState<ItemConfig['tipo_respuesta']>('SI_NO');
  const [newRequerido, setNewRequerido] = useState(true);
  const techInputRef = useRef<HTMLInputElement>(null);
  const techListRef = useRef<HTMLDivElement>(null);

  // ── Tab 2: Plantillas de Seguridad State ───────────────────
  const [plantillasSeguridad, setPlantillasSeguridad] = useState<PlantillaSeguridad[]>([]);
  const [isSegOpen, setIsSegOpen] = useState(false);
  const [editingSegId, setEditingSegId] = useState<number | null>(null);

  const [segTitulo, setSegTitulo] = useState('');
  const [segDescripcion, setSegDescripcion] = useState('');
  const [segCategoria, setSegCategoria] = useState<CategoriaSeguridad>('ELECTRICO');
  const [segEsDefault, setSegEsDefault] = useState(false);
  const [segItems, setSegItems] = useState<PlantillaSeguridadItem[]>([]);

  // Item temporal para agregar a la plantilla de seguridad
  const [newSegPregunta, setNewSegPregunta] = useState('');
  const [newSegPreguntaError, setNewSegPreguntaError] = useState<string | null>(null);
  const [newSegRequerido, setNewSegRequerido] = useState(true);
  const [newSegEsCritico, setNewSegEsCritico] = useState(true);
  const segInputRef = useRef<HTMLInputElement>(null);
  const segListRef = useRef<HTMLDivElement>(null);

  const fetchPlantillas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Plantilla[]>('/plantillas');
      setPlantillas(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar plantillas técnicas');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPlantillasSeguridad = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<PlantillaSeguridad[]>('/plantillas/seguridad');
      setPlantillasSeguridad(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar plantillas de seguridad');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      if (activeTab === 'tecnicas') {
        fetchPlantillas();
      } else {
        fetchPlantillasSeguridad();
      }
    });
  }, [activeTab, fetchPlantillas, fetchPlantillasSeguridad]);

  // ── Handlers Tab 1: Plantillas Técnicas ───────────────────
  const handleOpenCreate = () => {
    setEditingId(null);
    setTitulo('');
    setDescripcion('');
    setTiempoEstimado(60);
    setItems([]);
    setNewPregunta('');
    setNewPreguntaError(null);
    setIsOpen(true);
  };

  const handleOpenEdit = (plan: Plantilla) => {
    setEditingId(plan.id);
    setTitulo(plan.titulo);
    setDescripcion(plan.descripcion || '');
    setTiempoEstimado(plan.tiempo_estimado_minutos);
    setItems((plan.items || []).map((i) => ({
      orden: i.orden,
      pregunta: i.pregunta,
      tipo_respuesta: i.tipo_respuesta,
      requerido: i.requerido,
    })));
    setNewPregunta('');
    setNewPreguntaError(null);
    setIsOpen(true);
  };

  const handleAddItem = () => {
    const trimmed = newPregunta.trim();
    if (!trimmed) {
      setNewPreguntaError('Escribe la pregunta o ítem antes de agregarlo');
      techInputRef.current?.focus();
      return;
    }
    setNewPreguntaError(null);
    setItems((prev) => [
      ...prev,
      {
        orden: prev.length + 1,
        pregunta: trimmed,
        tipo_respuesta: newTipo,
        requerido: newRequerido,
      },
    ]);
    setNewPregunta('');
    setNewTipo('SI_NO');
    setNewRequerido(true);

    setTimeout(() => {
      if (techListRef.current) {
        techListRef.current.scrollTop = techListRef.current.scrollHeight;
      }
      techInputRef.current?.focus();
    }, 50);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index).map((item, idx) => ({ ...item, orden: idx + 1 })));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      alert('El título es requerido');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
        tiempo_estimado_minutos: Number(tiempoEstimado),
        items,
      };

      if (editingId) {
        await apiFetch(`/plantillas/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/plantillas', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setIsOpen(false);
      fetchPlantillas();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar plantilla');
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Está seguro de eliminar esta plantilla técnica?')) return;
    setLoading(true);
    try {
      await apiFetch(`/plantillas/${id}`, { method: 'DELETE' });
      fetchPlantillas();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar plantilla');
      setLoading(false);
    }
  };

  const handleDuplicate = async (id: number) => {
    setLoading(true);
    try {
      await apiFetch(`/plantillas/${id}/duplicar`, { method: 'POST' });
      fetchPlantillas();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al duplicar plantilla');
      setLoading(false);
    }
  };

  // ── Handlers Tab 2: Plantillas de Seguridad ───────────────
  const handleOpenSegCreate = () => {
    setEditingSegId(null);
    setSegTitulo('');
    setSegDescripcion('');
    setSegCategoria('ELECTRICO');
    setSegEsDefault(false);
    setSegItems([]);
    setNewSegPregunta('');
    setNewSegPreguntaError(null);
    setNewSegRequerido(true);
    setNewSegEsCritico(true);
    setIsSegOpen(true);
  };

  const handleOpenSegEdit = (plan: PlantillaSeguridad) => {
    setEditingSegId(plan.id);
    setSegTitulo(plan.titulo);
    setSegDescripcion(plan.descripcion || '');
    setSegCategoria(plan.categoria || 'ELECTRICO');
    setSegEsDefault(Boolean(plan.es_default));
    setSegItems(
      (plan.items || []).map((it, idx) => ({
        id: it.id,
        pregunta: it.pregunta,
        requerido: it.requerido,
        es_critico: it.es_critico,
        orden: it.orden || idx + 1,
      }))
    );
    setNewSegPregunta('');
    setNewSegPreguntaError(null);
    setNewSegRequerido(true);
    setNewSegEsCritico(true);
    setIsSegOpen(true);
  };

  const handleAddSegItem = () => {
    const trimmed = newSegPregunta.trim();
    if (!trimmed) {
      setNewSegPreguntaError('Por favor escribe la validación o pregunta antes de agregarla');
      segInputRef.current?.focus();
      return;
    }
    setNewSegPreguntaError(null);
    setSegItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        pregunta: trimmed,
        requerido: newSegRequerido,
        es_critico: newSegEsCritico,
        orden: prev.length + 1,
      },
    ]);
    setNewSegPregunta('');
    setNewSegRequerido(true);
    setNewSegEsCritico(true);

    // Auto-scroll list to bottom so the new item is immediately visible
    setTimeout(() => {
      if (segListRef.current) {
        segListRef.current.scrollTop = segListRef.current.scrollHeight;
      }
      segInputRef.current?.focus();
    }, 50);
  };

  const handleRemoveSegItem = (index: number) => {
    setSegItems(segItems.filter((_, idx) => idx !== index).map((item, idx) => ({ ...item, orden: idx + 1 })));
  };

  const handleSaveSeguridad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!segTitulo.trim()) {
      alert('El título de la plantilla de seguridad es requerido');
      return;
    }
    if (segItems.length === 0) {
      alert('Debe agregar al menos una pregunta o verificación a la plantilla de seguridad');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        titulo: segTitulo.trim(),
        descripcion: segDescripcion.trim() || null,
        categoria: segCategoria,
        es_default: segEsDefault,
        items: segItems,
      };

      if (editingSegId) {
        await apiFetch(`/plantillas/seguridad/${editingSegId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/plantillas/seguridad', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      setIsSegOpen(false);
      fetchPlantillasSeguridad();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar plantilla de seguridad');
      setLoading(false);
    }
  };

  const handleDeleteSeguridad = async (id: number) => {
    if (!confirm('¿Está seguro de eliminar esta plantilla de seguridad?')) return;
    setLoading(true);
    try {
      await apiFetch(`/plantillas/seguridad/${id}`, { method: 'DELETE' });
      fetchPlantillasSeguridad();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar plantilla de seguridad');
      setLoading(false);
    }
  };

  const handleDuplicateSeguridad = async (id: number) => {
    setLoading(true);
    try {
      await apiFetch(`/plantillas/seguridad/${id}/duplicar`, { method: 'POST' });
      fetchPlantillasSeguridad();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al duplicar plantilla de seguridad');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-zinc-900 pb-12">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-950 flex items-center gap-2">
            <span>Plantillas y Protocolos de Seguridad</span>
          </h1>
          <p className="text-xs text-zinc-500 mt-1 max-w-2xl">
            Configure protocolos de seguridad en campo (5 Reglas de Oro, EPP, LOTO, Alturas) y plantillas técnicas
            asociables dinámicamente a cada Orden de Trabajo.
          </p>
        </div>
        {canManage && (
          <div>
            {activeTab === 'seguridad' ? (
              <Button onClick={handleOpenSegCreate} className="bg-amber-600 hover:bg-amber-700 text-white shadow-xs">
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Nueva Plantilla de Seguridad
              </Button>
            ) : (
              <Button onClick={handleOpenCreate}>
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Nueva Plantilla Técnica
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200">
        <button
          type="button"
          onClick={() => setActiveTab('seguridad')}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'seguridad'
              ? 'border-amber-600 text-amber-700 bg-amber-50/40'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <span>🛡️</span>
          <span>Plantillas de Seguridad en Campo</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-mono">
            {plantillasSeguridad.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tecnicas')}
          className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'tecnicas'
              ? 'border-teal-600 text-teal-700 bg-teal-50/40'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <span>📋</span>
          <span>Plantillas Técnicas de Trabajo</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-mono">
            {plantillas.length}
          </span>
        </button>
      </div>

      {error && (
        <ErrorMessage
          message={error}
          retry={activeTab === 'seguridad' ? fetchPlantillasSeguridad : fetchPlantillas}
        />
      )}

      {/* Tab Content Loading */}
      {loading && plantillas.length === 0 && plantillasSeguridad.length === 0 ? (
        <div className="flex-1 flex flex-col justify-center items-center py-20">
          <Spinner size="lg" />
          <span className="text-xs text-zinc-500 font-medium mt-3">Cargando protocolos y plantillas...</span>
        </div>
      ) : activeTab === 'seguridad' ? (
        /* ── TAB 2: PLANTILLAS DE SEGURIDAD ───────────────────────── */
        plantillasSeguridad.length === 0 ? (
          <EmptyState
            title="Sin Plantillas de Seguridad"
            description="Aún no ha configurado plantillas de seguridad para su empresa. Haga clic en Nueva Plantilla de Seguridad para crear protocolos eléctricos, EPP, alturas o LOTO."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plantillasSeguridad.map((plan) => {
              const catInfo = CATEGORIA_LABELS[plan.categoria] || CATEGORIA_LABELS.GENERAL;
              const criticalCount = (plan.items || []).filter((i) => i.es_critico).length;

              return (
                <Card key={plan.id} className="flex flex-col gap-3.5 p-5 hover:border-zinc-300 transition-all shadow-xs">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${catInfo.color}`}>
                          <span>{catInfo.icon}</span>
                          <span>{catInfo.label}</span>
                        </span>
                        {plan.es_default && (
                          <span className="text-[10px] font-bold bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full border border-teal-200">
                            Predeterminada
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-zinc-950 text-base leading-snug mt-1">{plan.titulo}</h3>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDuplicateSeguridad(plan.id)}
                          className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-500 hover:text-zinc-800 transition-all cursor-pointer"
                          title="Duplicar Plantilla"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenSegEdit(plan)}
                          className="p-1.5 hover:bg-zinc-100 rounded-lg text-teal-600 hover:text-teal-800 transition-all cursor-pointer"
                          title="Editar Plantilla"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSeguridad(plan.id)}
                          className="p-1.5 hover:bg-zinc-100 rounded-lg text-red-600 hover:text-red-800 transition-all cursor-pointer"
                          title="Eliminar Plantilla"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {plan.descripcion && <p className="text-xs text-zinc-600 line-clamp-2">{plan.descripcion}</p>}

                  {/* Items Summary & List */}
                  <div className="border-t border-zinc-100 pt-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-zinc-500 uppercase tracking-wide">
                      <span>Verificaciones ({(plan.items || []).length})</span>
                      {criticalCount > 0 && (
                        <span className="text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded font-bold normal-case text-[10px]">
                          ⚠️ {criticalCount} {criticalCount === 1 ? 'crítico' : 'críticos'} (bloquea OT)
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
                      {(plan.items || []).map((it) => (
                        <div
                          key={it.id || it.orden}
                          className="flex items-start justify-between gap-2 text-xs text-zinc-700 bg-zinc-50/70 p-2 rounded-lg border border-zinc-100"
                        >
                          <span className="leading-snug">
                            <strong className="text-zinc-500">{it.orden}.</strong> {it.pregunta}
                          </span>
                          <div className="flex gap-1 shrink-0 mt-0.5">
                            {it.es_critico ? (
                              <span className="text-[9px] bg-red-100 text-red-800 font-bold px-1.5 py-0.5 rounded">
                                Crítico
                              </span>
                            ) : (
                              <span className="text-[9px] bg-zinc-200/80 text-zinc-600 font-medium px-1.5 py-0.5 rounded">
                                Preventivo
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : (
        /* ── TAB 1: PLANTILLAS TÉCNICAS ───────────────────────────── */
        plantillas.length === 0 ? (
          <EmptyState
            title="Sin Plantillas Técnicas"
            description="Aún no ha creado plantillas de trabajo para su empresa. Haga clic en Nueva Plantilla Técnica para iniciar."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plantillas.map((plan) => (
              <Card key={plan.id} className="flex flex-col gap-4 p-5 hover:border-zinc-300 transition-all shadow-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-zinc-950 text-base">{plan.titulo}</h3>
                    <span className="text-[10px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-md font-mono mt-1 inline-block">
                      ⏱️ Estimado: {plan.tiempo_estimado_minutos} min
                    </span>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleDuplicate(plan.id)}
                        className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-500 hover:text-zinc-800 transition-all cursor-pointer"
                        title="Duplicar"
                      >
                        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleOpenEdit(plan)}
                        className="p-1.5 hover:bg-zinc-100 rounded-lg text-teal-600 hover:text-teal-800 transition-all cursor-pointer"
                        title="Editar"
                      >
                        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(plan.id)}
                        className="p-1.5 hover:bg-zinc-100 rounded-lg text-red-600 hover:text-red-800 transition-all cursor-pointer"
                        title="Eliminar"
                      >
                        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                {plan.descripcion && <p className="text-xs text-zinc-500 line-clamp-2">{plan.descripcion}</p>}

                {/* Items List (Brief) */}
                <div className="border-t border-zinc-100 pt-3 flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
                    Preguntas del Checklist ({(plan.items || []).length})
                  </span>
                  <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                    {(plan.items || []).map((i) => (
                      <div
                        key={i.id}
                        className="flex justify-between items-center text-xs text-zinc-700 bg-zinc-50/50 p-1.5 rounded-md border border-zinc-100"
                      >
                        <span className="truncate max-w-[200px]">
                          {i.orden}. {i.pregunta}
                        </span>
                        <span className="text-[9px] bg-zinc-100 text-zinc-500 font-mono px-1 rounded-sm">
                          {i.tipo_respuesta} {i.requerido && '*'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* ── Modal Tab 1: Plantilla Técnica Editor ─────────────────── */}
      {isOpen && (
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title={editingId ? 'Editar Plantilla Técnica' : 'Nueva Plantilla Técnica'}
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>{editingId ? 'Guardar Cambios' : 'Crear Plantilla'}</Button>
            </>
          }
        >
          <form onSubmit={handleSave} className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto px-1">
            <Input
              label="Título de la Plantilla"
              placeholder="Ej: Mantenimiento Preventivo de Transformadores"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              required
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-600">Descripción</label>
              <textarea
                rows={2}
                placeholder="Detalles sobre el uso o alcance de esta plantilla..."
                className="w-full px-3 py-2 text-sm text-zinc-800 bg-white border border-zinc-200 focus:ring-teal-500 rounded-lg shadow-2xs placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-transparent transition-all"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>
            <Input
              label="Tiempo Estimado (Minutos)"
              type="number"
              value={tiempoEstimado}
              onChange={(e) => setTiempoEstimado(Number(e.target.value))}
              required
            />

            {/* Checklist Builder */}
            <div className="border-t border-zinc-200 pt-4 flex flex-col gap-3">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Tareas / Inspecciones</h3>

              {items.length > 0 && (
                <div ref={techListRef} className="flex flex-col gap-1.5 border border-zinc-200 rounded-xl p-2.5 bg-zinc-50 max-h-40 overflow-y-auto scroll-smooth">
                  {items.map((item, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center text-xs bg-white p-2 rounded-lg border border-zinc-100"
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold text-zinc-800">
                          {item.orden}. {item.pregunta}
                        </span>
                        <span className="text-[9px] text-zinc-400 font-mono mt-0.5">
                          Tipo: {item.tipo_respuesta} | Requerido: {item.requerido ? 'Sí' : 'No'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-500 font-bold px-2 py-1 hover:bg-red-50 rounded cursor-pointer"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-zinc-50/50 border border-zinc-200 rounded-xl p-3.5 flex flex-col gap-3.5">
                <Input
                  ref={techInputRef}
                  label="Pregunta / Item de Inspección"
                  placeholder="Ej: ¿Se midió la resistencia de aislamiento del devanado?"
                  value={newPregunta}
                  error={newPreguntaError || undefined}
                  onChange={(e) => {
                    setNewPregunta(e.target.value);
                    if (newPreguntaError) setNewPreguntaError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAddItem();
                    }
                  }}
                />

                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Tipo de Respuesta"
                    value={newTipo}
                    onChange={(e) => setNewTipo(e.target.value as ItemConfig['tipo_respuesta'])}
                    options={[
                      { value: 'SI_NO', label: 'Sí / No' },
                      { value: 'ESCALA', label: 'Escala (1-5)' },
                      { value: 'NUMERICO', label: 'Numérico' },
                      { value: 'TEXTO', label: 'Texto libre' },
                      { value: 'FOTO', label: 'Fotografía obligatoria' },
                    ]}
                  />
                  <Select
                    label="¿Es Obligatorio?"
                    value={newRequerido ? 'si' : 'no'}
                    onChange={(e) => setNewRequerido(e.target.value === 'si')}
                    options={[
                      { value: 'si', label: 'Sí' },
                      { value: 'no', label: 'No' },
                    ]}
                  />
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddItem}
                  className="w-full font-medium hover:bg-zinc-100 transition-all cursor-pointer"
                >
                  + Agregar Pregunta al Checklist
                </Button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal Tab 2: Plantilla de Seguridad Editor ────────────── */}
      {isSegOpen && (
        <Modal
          isOpen={isSegOpen}
          onClose={() => setIsSegOpen(false)}
          title={editingSegId ? 'Editar Plantilla de Seguridad' : 'Nueva Plantilla de Seguridad en Campo'}
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsSegOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveSeguridad} className="bg-amber-600 hover:bg-amber-700 text-white">
                {editingSegId ? 'Guardar Cambios' : 'Crear Plantilla de Seguridad'}
              </Button>
            </>
          }
        >
          <form onSubmit={handleSaveSeguridad} className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto px-1">
            <Input
              label="Título del Protocolo de Seguridad"
              placeholder="Ej: Seguridad Eléctrica - 5 Reglas de Oro y LOTO"
              value={segTitulo}
              onChange={(e) => setSegTitulo(e.target.value)}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Categoría de Riesgo"
                value={segCategoria}
                onChange={(e) => setSegCategoria(e.target.value as CategoriaSeguridad)}
                options={[
                  { value: 'ELECTRICO', label: '⚡ Riesgo Eléctrico' },
                  { value: 'LOTO', label: '🔒 Bloqueo y Etiquetado (LOTO)' },
                  { value: 'ALTURAS', label: '🧗 Trabajos en Altura' },
                  { value: 'EPP', label: '🦺 EPP Dieléctrico y Arco' },
                  { value: 'GENERAL', label: '🛡️ Seguridad General' },
                  { value: 'ESPACIO_CONFINADO', label: '🚪 Espacio Confinado' },
                ]}
              />

              <div className="flex flex-col gap-1.5 justify-end pb-1">
                <label className="text-xs font-semibold text-zinc-600">¿Asignación Predeterminada?</label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-800 mt-2">
                  <input
                    type="checkbox"
                    checked={segEsDefault}
                    onChange={(e) => setSegEsDefault(e.target.checked)}
                    className="rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Preseleccionar en nuevas OTs</span>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-600">Descripción y Normativa Aplicable</label>
              <textarea
                rows={2}
                placeholder="Ej: Cumplimiento RETIE / NFPA 70E para maniobras en baja y media tensión..."
                className="w-full px-3 py-2 text-sm text-zinc-800 bg-white border border-zinc-200 focus:ring-amber-500 rounded-lg shadow-2xs placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-transparent transition-all"
                value={segDescripcion}
                onChange={(e) => setSegDescripcion(e.target.value)}
              />
            </div>

            {/* Dynamic Safety Checklist Items Builder */}
            <div className="border-t border-zinc-200 pt-4 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wide">
                  Preguntas y Validaciones Obligatorias ({segItems.length})
                </h3>
              </div>

              {segItems.length > 0 && (
                <div ref={segListRef} className="flex flex-col gap-2 border border-zinc-200 rounded-xl p-2.5 bg-zinc-50 max-h-48 overflow-y-auto scroll-smooth">
                  {segItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-start text-xs bg-white p-2.5 rounded-lg border border-zinc-100 gap-2"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-zinc-900 leading-snug">
                          {item.orden}. {item.pregunta}
                        </span>
                        <div className="flex gap-2 text-[10px] text-zinc-500 mt-1">
                          <span className={item.requerido ? 'text-zinc-700 font-bold' : 'text-zinc-400'}>
                            {item.requerido ? '✓ Requerido' : 'Opcional'}
                          </span>
                          <span>•</span>
                          <span className={item.es_critico ? 'text-red-700 font-bold' : 'text-zinc-600'}>
                            {item.es_critico ? '⚠️ Crítico (bloquea)' : 'Informativo'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveSegItem(index)}
                        className="text-red-500 hover:text-red-700 font-bold px-2 py-1 hover:bg-red-50 rounded cursor-pointer shrink-0"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add item box */}
              <div className="bg-amber-50/40 border border-amber-200/60 rounded-xl p-3.5 flex flex-col gap-3">
                <Input
                  ref={segInputRef}
                  label="Nueva Validación de Seguridad"
                  placeholder="Ej: ¿Se comprobó la ausencia total de tensión en todas las fases?"
                  value={newSegPregunta}
                  error={newSegPreguntaError || undefined}
                  onChange={(e) => {
                    setNewSegPregunta(e.target.value);
                    if (newSegPreguntaError) setNewSegPreguntaError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      handleAddSegItem();
                    }
                  }}
                />

                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="¿Es Obligatorio?"
                    value={newSegRequerido ? 'si' : 'no'}
                    onChange={(e) => setNewSegRequerido(e.target.value === 'si')}
                    options={[
                      { value: 'si', label: 'Sí (Obligatorio)' },
                      { value: 'no', label: 'No (Opcional)' },
                    ]}
                  />

                  <Select
                    label="Nivel de Criticidad"
                    value={newSegEsCritico ? 'critico' : 'normal'}
                    onChange={(e) => setNewSegEsCritico(e.target.value === 'critico')}
                    options={[
                      { value: 'critico', label: '⚠️ Crítico (Bloquea OT)' },
                      { value: 'normal', label: 'Normal / Preventivo' },
                    ]}
                  />
                </div>

                <Button
                  type="button"
                  variant="primary"
                  onClick={handleAddSegItem}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-xs transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2 py-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Agregar Validación al Protocolo</span>
                </Button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
