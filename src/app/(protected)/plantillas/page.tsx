'use client';

import React, { useEffect, useState, useCallback } from 'react';
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

interface SeguridadItem {
  id: number;
  pregunta: string;
  requerido: boolean;
  es_critico: boolean;
  orden: number;
}

export default function PlantillasAdminPage() {
  const { user } = useAuth();
  const canManage = user?.rol === 'admin' || user?.rol === 'superadmin';
  const [activeTab, setActiveTab] = useState<'tecnicas' | 'seguridad'>('tecnicas');

  // Tab 1: Plantillas Tecnicas State
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
  const [newTipo, setNewTipo] = useState<ItemConfig['tipo_respuesta']>('SI_NO');
  const [newRequerido, setNewRequerido] = useState(true);

  // Tab 2: Seguridad State
  const [seguridadItems, setSeguridadItems] = useState<SeguridadItem[]>([]);
  const [isSegOpen, setIsSegOpen] = useState(false);
  
  const [segPregunta, setSegPregunta] = useState('');
  const [segRequerido, setSegRequerido] = useState(true);
  const [segEsCritico, setSegEsCritico] = useState(true);
  const [segOrden, setSegOrden] = useState(1);

  const fetchPlantillas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Plantilla[]>('/plantillas');
      setPlantillas(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar plantillas');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSeguridadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<SeguridadItem[]>('/ordenes/seguridad-config');
      setSeguridadItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar ítems de seguridad');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      if (activeTab === 'tecnicas') {
        fetchPlantillas();
      } else {
        fetchSeguridadItems();
      }
    });
  }, [activeTab, fetchPlantillas, fetchSeguridadItems]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setTitulo('');
    setDescripcion('');
    setTiempoEstimado(60);
    setItems([]);
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
      requerido: i.requerido
    })));
    setIsOpen(true);
  };

  const handleAddItem = () => {
    if (!newPregunta.trim()) return;
    setItems([
      ...items,
      {
        orden: items.length + 1,
        pregunta: newPregunta.trim(),
        tipo_respuesta: newTipo,
        requerido: newRequerido
      }
    ]);
    setNewPregunta('');
    setNewTipo('SI_NO');
    setNewRequerido(true);
  };

  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, idx) => idx !== index).map((item, idx) => ({
      ...item,
      orden: idx + 1
    }));
    setItems(updated);
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
        descripcion: descripcion.trim() || undefined,
        tiempo_estimado_minutos: Number(tiempoEstimado),
        items
      };

      if (editingId) {
        await apiFetch(`/plantillas/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/plantillas', {
          method: 'POST',
          body: JSON.stringify(payload)
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
    if (!confirm('¿Está seguro de eliminar esta plantilla de checklist?')) return;
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

  // Tab 2 Handlers
  const handleOpenSegCreate = () => {
    setSegPregunta('');
    setSegRequerido(true);
    setSegEsCritico(true);
    setSegOrden(seguridadItems.length + 1);
    setIsSegOpen(true);
  };

  const handleSaveSeguridadItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!segPregunta.trim()) {
      alert('La pregunta es requerida');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        pregunta: segPregunta.trim(),
        requerido: segRequerido,
        es_critico: segEsCritico,
        orden: Number(segOrden)
      };

      await apiFetch('/ordenes/seguridad-config', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setIsSegOpen(false);
      fetchSeguridadItems();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar ítem de seguridad');
      setLoading(false);
    }
  };

  const handleDeleteSeguridadItem = async (itemId: number) => {
    if (!confirm('¿Está seguro de eliminar este ítem de seguridad config?')) return;
    setLoading(true);
    try {
      await apiFetch(`/ordenes/seguridad-config/${itemId}`, { method: 'DELETE' });
      fetchSeguridadItems();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar ítem de seguridad');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-zinc-900">
      {/* Title */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-zinc-950">Plantillas y Configuración de Campo</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Gestione plantillas técnicas de trabajo y checklists obligatorios de seguridad en campo.
          </p>
        </div>
        {canManage && (activeTab === 'tecnicas' ? (
          <Button onClick={handleOpenCreate}>
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nueva Plantilla
          </Button>
        ) : (
          <Button onClick={handleOpenSegCreate} className="bg-orange-600 hover:bg-orange-700">
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo Ítem Seguridad
          </Button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-200">
        <button
          type="button"
          onClick={() => setActiveTab('tecnicas')}
          className={`py-2.5 px-5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'tecnicas'
              ? 'border-teal-600 text-teal-600'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          📋 Plantillas Técnicas
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('seguridad')}
          className={`py-2.5 px-5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'seguridad'
              ? 'border-orange-600 text-orange-600'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          🛡️ Checklist de Seguridad Obligatorio
        </button>
      </div>

      {error && <ErrorMessage message={error} retry={activeTab === 'tecnicas' ? fetchPlantillas : fetchSeguridadItems} />}

      {loading && plantillas.length === 0 && seguridadItems.length === 0 ? (
        <div className="flex-1 flex flex-col justify-center items-center py-20">
          <Spinner size="lg" />
          <span className="text-xs text-zinc-500 font-medium mt-3">Cargando configuraciones...</span>
        </div>
      ) : activeTab === 'tecnicas' ? (
        /* Tab 1: Technical checklists */
        plantillas.length === 0 ? (
          <EmptyState
            title="Sin Plantillas Configuradas"
            description="Aún no ha creado plantillas de trabajo para su empresa. Haga clic en Nueva Plantilla para iniciar."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plantillas.map((plan) => (
              <Card key={plan.id} className="flex flex-col gap-4 p-5 hover:border-zinc-300 transition-all shadow-sm">
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
                        className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-500 hover:text-zinc-800 transition-all"
                        title="Duplicar"
                      >
                        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleOpenEdit(plan)}
                        className="p-1.5 hover:bg-zinc-100 rounded-lg text-teal-600 hover:text-teal-800 transition-all"
                        title="Editar"
                      >
                        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(plan.id)}
                        className="p-1.5 hover:bg-zinc-100 rounded-lg text-red-600 hover:text-red-800 transition-all"
                        title="Eliminar"
                      >
                        <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                {plan.descripcion && (
                  <p className="text-xs text-zinc-500 line-clamp-2">{plan.descripcion}</p>
                )}

                {/* Items List (Brief) */}
                <div className="border-t border-zinc-100 pt-3 flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Preguntas del Checklist ({(plan.items || []).length})</span>
                  <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                    {(plan.items || []).map((i) => (
                      <div key={i.id} className="flex justify-between items-center text-xs text-zinc-700 bg-zinc-50/50 p-1.5 rounded-md border border-zinc-100">
                        <span className="truncate max-w-[200px]">{i.orden}. {i.pregunta}</span>
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
      ) : (
        /* Tab 2: Safety Checklists configuration */
        seguridadItems.length === 0 ? (
          <EmptyState
            title="Sin Ítems de Seguridad"
            description="Aún no ha configurado ítems obligatorios de seguridad en campo. Haga clic en Nuevo Ítem Seguridad para agregar el primero."
          />
        ) : (
          <div className="flex flex-col gap-3 max-w-xl">
            {seguridadItems.map((item) => (
              <Card key={item.id} className="flex justify-between items-center p-4 hover:border-zinc-300 transition-all shadow-sm">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">Orden: {item.orden}</span>
                    <span className="font-semibold text-zinc-800 text-sm">{item.pregunta}</span>
                  </div>
                  <div className="flex gap-2.5 mt-1">
                    {item.requerido && (
                      <span className="text-[9px] bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-100 font-bold">Requerido</span>
                    )}
                    {item.es_critico && (
                      <span className="text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-100 font-bold">⚠️ Crítico</span>
                    )}
                  </div>
                </div>
                {canManage && (
                  <button
                    onClick={() => handleDeleteSeguridadItem(item.id)}
                    className="p-2 hover:bg-red-50 rounded-lg text-red-500 hover:text-red-800 transition-all"
                    title="Eliminar Ítem"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </Card>
            ))}
          </div>
        )
      )}

      {/* Editor Modal for Tab 1 */}
      {isOpen && (
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title={editingId ? 'Editar Plantilla de Trabajo' : 'Nueva Plantilla de Trabajo'}
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {editingId ? 'Guardar Cambios' : 'Crear Plantilla'}
              </Button>
            </>
          }
        >
          <form onSubmit={handleSave} className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto px-1">
            <Input
              label="Título de la Plantilla"
              placeholder="Ej: Mantenimiento de Generador Eléctrico"
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
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Creador de Checklist</h3>
              
              {/* Added Items */}
              {items.length > 0 && (
                <div className="flex flex-col gap-1.5 border border-zinc-200 rounded-xl p-2.5 bg-zinc-50 max-h-40 overflow-y-auto">
                  {items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center text-xs bg-white p-2 rounded-lg border border-zinc-100">
                      <div className="flex flex-col">
                        <span className="font-semibold text-zinc-800">{item.orden}. {item.pregunta}</span>
                        <span className="text-[9px] text-zinc-400 font-mono mt-0.5">
                          Tipo: {item.tipo_respuesta} | Requerido: {item.requerido ? 'Sí' : 'No'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-red-500 font-bold px-2 py-1 hover:bg-red-50 rounded"
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Item Form */}
              <div className="bg-zinc-50/50 border border-zinc-200 rounded-xl p-3.5 flex flex-col gap-3.5">
                <Input
                  label="Pregunta / Item de Inspección"
                  placeholder="Ej: ¿El filtro de aceite fue reemplazado?"
                  value={newPregunta}
                  onChange={(e) => setNewPregunta(e.target.value)}
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
                      { value: 'FOTO', label: 'Fotografía obligatoria' }
                    ]}
                  />
                  <Select
                    label="¿Es Obligatorio?"
                    value={newRequerido ? 'si' : 'no'}
                    onChange={(e) => setNewRequerido(e.target.value === 'si')}
                    options={[
                      { value: 'si', label: 'Sí' },
                      { value: 'no', label: 'No' }
                    ]}
                  />
                </div>

                <Button type="button" variant="secondary" onClick={handleAddItem} className="w-full">
                  + Agregar Pregunta al Checklist
                </Button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Editor Modal for Tab 2 (Seguridad config) */}
      {isSegOpen && (
        <Modal
          isOpen={isSegOpen}
          onClose={() => setIsSegOpen(false)}
          title="Agregar Ítem de Seguridad Obligatorio"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsSegOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveSeguridadItem} className="bg-orange-600 hover:bg-orange-700">
                Guardar Ítem
              </Button>
            </>
          }
        >
          <form onSubmit={handleSaveSeguridadItem} className="flex flex-col gap-4">
            <Input
              label="Pregunta de Seguridad Obligatoria"
              placeholder="Ej: ¿Cuenta con arnés de seguridad homologado?"
              value={segPregunta}
              onChange={(e) => setSegPregunta(e.target.value)}
              required
            />
            
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="¿Es Obligatorio?"
                value={segRequerido ? 'si' : 'no'}
                onChange={(e) => setSegRequerido(e.target.value === 'si')}
                options={[
                  { value: 'si', label: 'Sí' },
                  { value: 'no', label: 'No' }
                ]}
              />
              <Select
                label="¿Es Crítico? (Bloquea OT)"
                value={segEsCritico ? 'si' : 'no'}
                onChange={(e) => setSegEsCritico(e.target.value === 'si')}
                options={[
                  { value: 'si', label: 'Sí' },
                  { value: 'no', label: 'No' }
                ]}
              />
            </div>

            <Input
              label="Orden de Visualización"
              type="number"
              value={segOrden}
              onChange={(e) => setSegOrden(Number(e.target.value))}
              required
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
