'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { TRANSICIONES_PERMITIDAS, ESTADO_LABELS } from '@/lib/constants';
import { apiFetch } from '@/lib/api';
import { EstadoOT } from '@/types';

interface TransicionModalProps {
  isOpen: boolean;
  onClose: () => void;
  otId: number;
  estadoActual: EstadoOT;
  onSuccess: () => void;
}

export const TransicionModal: React.FC<TransicionModalProps> = ({
  isOpen,
  onClose,
  otId,
  estadoActual,
  onSuccess,
}) => {
  const [nuevoEstado, setNuevoEstado] = useState<string>('');
  const [comentario, setComentario] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transiciones = TRANSICIONES_PERMITIDAS[estadoActual] || [];

  const handleTransicion = async () => {
    if (!nuevoEstado) {
      setError('Debe seleccionar un nuevo estado');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await apiFetch(`/ordenes/${otId}/transicion`, {
        method: 'POST',
        body: JSON.stringify({
          estado_nuevo: nuevoEstado as EstadoOT,
          comentario: comentario.trim() || undefined,
        }),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al transicionar el estado');
    } finally {
      setIsLoading(false);
    }
  };

  const selectOptions = transiciones.map((t) => ({
    value: t,
    label: ESTADO_LABELS[t],
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transicionar Estado de la OT"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleTransicion} isLoading={isLoading} disabled={transiciones.length === 0}>
            Transicionar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs text-zinc-500 leading-relaxed">
          Estado actual: <span className="font-semibold text-zinc-800">{ESTADO_LABELS[estadoActual]}</span>.
        </p>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
            {error}
          </div>
        )}

        {transiciones.length === 0 ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium leading-relaxed">
            No se permiten transiciones automáticas o manuales desde este estado final ({ESTADO_LABELS[estadoActual]}).
          </div>
        ) : (
          <>
            <Select
              label="Nuevo Estado"
              placeholder="Seleccione el próximo paso..."
              options={selectOptions}
              value={nuevoEstado}
              onChange={(e) => setNuevoEstado(e.target.value)}
            />

            <Input
              label="Comentario de Transición"
              placeholder="Describa el motivo del cambio..."
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
            />
          </>
        )}
      </div>
    </Modal>
  );
};
