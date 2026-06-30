'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { MOCK_TECNICOS_POR_EMPRESA } from '@/lib/constants';
import { apiFetch } from '@/lib/api';

interface AsignarModalProps {
  isOpen: boolean;
  onClose: () => void;
  otId: number;
  empresaId: number;
  onSuccess: () => void;
}

export const AsignarModal: React.FC<AsignarModalProps> = ({
  isOpen,
  onClose,
  otId,
  empresaId,
  onSuccess,
}) => {
  const [tecnicoId, setTecnicoId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch mock technicians based on tenant enterprise ID
  const tecnicos = MOCK_TECNICOS_POR_EMPRESA[empresaId] || [];

  const handleAsignar = async () => {
    if (!tecnicoId) {
      setError('Debe seleccionar un técnico');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await apiFetch(`/ordenes/${otId}/asignar`, {
        method: 'POST',
        body: JSON.stringify({
          tecnico_asignado_id: Number(tecnicoId),
        }),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al asignar el técnico');
    } finally {
      setIsLoading(false);
    }
  };

  const selectOptions = tecnicos.map((t) => ({
    value: t.id,
    label: `${t.nombre} (${t.email})`,
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Asignar Técnico de Campo"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleAsignar} isLoading={isLoading}>
            Confirmar Asignación
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs text-zinc-500 leading-relaxed">
          Seleccione un técnico calificado de su cuadrilla para asignarle esta Orden de Trabajo.
        </p>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
            {error}
          </div>
        )}

        {tecnicos.length === 0 ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium leading-relaxed">
            No hay técnicos registrados para esta empresa. Por favor, agregue técnicos en el panel administrativo del backend.
          </div>
        ) : (
          <Select
            label="Técnico Disponible"
            placeholder="Seleccione un técnico..."
            options={selectOptions}
            value={tecnicoId}
            onChange={(e) => setTecnicoId(e.target.value)}
          />
        )}
      </div>
    </Modal>
  );
};
