'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { apiFetch } from '@/lib/api';
import { OrdenTrabajo, Cliente, PrioridadOT, PlantillaTrabajo } from '@/types';

interface EditarOtModalProps {
  isOpen: boolean;
  onClose: () => void;
  ot: OrdenTrabajo;
  onSuccess: () => void;
}

export const EditarOtModal: React.FC<EditarOtModalProps> = ({
  isOpen,
  onClose,
  ot,
  onSuccess,
}) => {
  const [titulo, setTitulo] = useState(ot.titulo || '');
  const [descripcion, setDescripcion] = useState(ot.descripcion || '');
  const [clienteId, setClienteId] = useState<string>(
    ot.cliente?.id ? String(ot.cliente.id) : ''
  );
  const [prioridad, setPrioridad] = useState<PrioridadOT>(ot.prioridad || 'media');
  const [codigoExterno, setCodigoExterno] = useState(ot.codigo_externo || '');
  const [tecnicoId, setTecnicoId] = useState<string>(
    ot.tecnico_asignado?.id ? String(ot.tecnico_asignado.id) : ''
  );
  const [fechaProgramada, setFechaProgramada] = useState<string>(
    ot.fecha_programada ? ot.fecha_programada.substring(0, 10) : ''
  );
  const [monto, setMonto] = useState<string>(ot.monto !== undefined ? String(ot.monto) : '0');

  // Plantillas
  const initialPlantillaIds = ot.plantillas && ot.plantillas.length > 0
    ? ot.plantillas.map((p) => p.id)
    : (ot.plantilla_id ? [ot.plantilla_id] : []);
  const [selectedPlantillas, setSelectedPlantillas] = useState<number[]>(initialPlantillaIds);

  // External data options
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tecnicos, setTecnicos] = useState<{ id: number; nombre: string; email: string }[]>([]);
  const [plantillas, setPlantillas] = useState<PlantillaTrabajo[]>([]);

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    // Diferido un microtask: evita setState síncrono dentro del efecto
    Promise.resolve().then(() => {

      // Reset fields to current OT
      setTitulo(ot.titulo || '');
      setDescripcion(ot.descripcion || '');
      setClienteId(ot.cliente?.id ? String(ot.cliente.id) : '');
      setPrioridad(ot.prioridad || 'media');
      setCodigoExterno(ot.codigo_externo || '');
      setTecnicoId(ot.tecnico_asignado?.id ? String(ot.tecnico_asignado.id) : '');
      setFechaProgramada(ot.fecha_programada ? ot.fecha_programada.substring(0, 10) : '');
      setMonto(ot.monto !== undefined ? String(ot.monto) : '0');
    
      const pIds = ot.plantillas && ot.plantillas.length > 0
        ? ot.plantillas.map((p) => p.id)
        : (ot.plantilla_id ? [ot.plantilla_id] : []);
      setSelectedPlantillas(pIds);
      setError(null);

      // Load available clients, technicians and templates
      async function loadSelectOptions() {
        setLoading(true);
        try {
          const [cls, tecs, plans] = await Promise.all([
            apiFetch<Cliente[]>('/clientes').catch(() => []),
            apiFetch<{ id: number; nombre: string; email: string }[]>(`/usuarios/tecnicos?empresa_id=${ot.empresa_id}`).catch(() => []),
            apiFetch<PlantillaTrabajo[]>('/plantillas').catch(() => []),
          ]);
          setClientes(cls || []);
          setTecnicos(tecs || []);
          setPlantillas(plans || []);
        } catch (err) {
          console.error('Error loading options for edit modal:', err);
        } finally {
          setLoading(false);
        }
      }

      loadSelectOptions();
    });
  }, [isOpen, ot]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      setError('El título de la orden es obligatorio');
      return;
    }
    if (!clienteId) {
      setError('Debe seleccionar un cliente');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await apiFetch(`/ordenes/${ot.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          titulo: titulo.trim(),
          descripcion: descripcion.trim() || null,
          cliente_id: Number(clienteId),
          prioridad,
          codigo_externo: codigoExterno.trim() || null,
          tecnico_id: tecnicoId ? Number(tecnicoId) : null,
          fecha_programada: fechaProgramada ? new Date(fechaProgramada).toISOString() : null,
          plantilla_ids: selectedPlantillas,
          monto: monto ? parseFloat(monto) : 0,
        }),
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar cambios de la orden');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Editar Orden de Trabajo #${ot.codigo_interno}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} isLoading={submitting}>
            Guardar Cambios
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3.5 text-xs max-h-[75vh] overflow-y-auto pr-1">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 font-medium rounded-xl text-xs">
            {error}
          </div>
        )}

        {/* Cliente */}
        <div>
          <label className="block font-semibold text-zinc-700 mb-1">Cliente *</label>
          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className="w-full h-10 border border-zinc-200 rounded-xl px-3 bg-white text-zinc-800 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            required
            disabled={loading}
          >
            <option value="">Seleccionar Cliente</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} {c.ruc ? `(${c.ruc})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Título */}
        <div>
          <label className="block font-semibold text-zinc-700 mb-1">Título / Servicio *</label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej: Mantenimiento preventivo de grupo electrógeno"
            className="w-full h-10 border border-zinc-200 rounded-xl px-3 bg-white text-zinc-800 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            required
          />
        </div>

        {/* Prioridad y Código Externo */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Prioridad *</label>
            <select
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value as PrioridadOT)}
              className="w-full h-10 border border-zinc-200 rounded-xl px-3 bg-white text-zinc-800 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            >
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="critica">Crítica</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Código Externo</label>
            <input
              type="text"
              value={codigoExterno}
              onChange={(e) => setCodigoExterno(e.target.value)}
              placeholder="Ej: TKT-10492"
              className="w-full h-10 border border-zinc-200 rounded-xl px-3 bg-white text-zinc-800 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            />
          </div>
        </div>

        {/* Técnico Asignado y Fecha Programada */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Técnico Asignado</label>
            <select
              value={tecnicoId}
              onChange={(e) => setTecnicoId(e.target.value)}
              className="w-full h-10 border border-zinc-200 rounded-xl px-3 bg-white text-zinc-800 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
              disabled={loading}
            >
              <option value="">Sin asignar</option>
              {tecnicos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Fecha Programada</label>
            <input
              type="date"
              value={fechaProgramada}
              onChange={(e) => setFechaProgramada(e.target.value)}
              className="w-full h-10 border border-zinc-200 rounded-xl px-3 bg-white text-zinc-800 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            />
          </div>
        </div>

        {/* Monto Presupuestado */}
        <div>
          <label className="block font-semibold text-zinc-700 mb-1">Monto / Presupuesto (S/.)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="0.00"
            className="w-full h-10 border border-zinc-200 rounded-xl px-3 bg-white text-zinc-800 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
          />
        </div>

        {/* Plantillas de Trabajo */}
        {plantillas.length > 0 && (
          <div>
            <label className="block font-semibold text-zinc-700 mb-1">Plantillas de Trabajo Vinculadas</label>
            <div className="max-h-32 overflow-y-auto border border-zinc-200 rounded-xl p-2.5 space-y-2 bg-zinc-50">
              {plantillas.map((p) => {
                const checked = selectedPlantillas.includes(p.id);
                return (
                  <label key={p.id} className="flex items-center gap-2.5 cursor-pointer text-zinc-700 hover:text-zinc-950">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPlantillas([...selectedPlantillas, p.id]);
                        } else {
                          setSelectedPlantillas(selectedPlantillas.filter((pid) => pid !== p.id));
                        }
                      }}
                      className="rounded border-zinc-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="truncate">
                      {p.titulo} <span className="text-zinc-400">({p.tiempo_estimado_minutos} min)</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Descripción */}
        <div>
          <label className="block font-semibold text-zinc-700 mb-1">Descripción / Instrucciones de Trabajo</label>
          <textarea
            rows={3}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Detalles técnicos, alcance del servicio o requerimientos especiales..."
            className="w-full border border-zinc-200 rounded-xl p-3 bg-white text-zinc-800 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 resize-none"
          />
        </div>
      </form>
    </Modal>
  );
};
