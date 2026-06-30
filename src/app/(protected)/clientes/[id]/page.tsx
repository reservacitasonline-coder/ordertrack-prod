'use client';

import React, { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../../layout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { EmptyState } from '@/components/ui/EmptyState';
import { apiFetch } from '@/lib/api';
import { PRIORIDAD_LABELS, PRIORIDAD_COLORS } from '@/lib/constants';
import { Cliente, PrioridadCliente, PrioridadOT } from '@/types';

export default function ClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = useAuth();
  
  // Unwrap params using React.use()
  const unwrappedParams = use(params);
  const clienteId = Number(unwrappedParams.id);

  // States
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [prioridades, setPrioridades] = useState<PrioridadCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create mapping state
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('');
  const [nuevaPrioridad, setNuevaPrioridad] = useState<PrioridadOT>('media');
  const [crearLoading, setCrearLoading] = useState(false);
  const [crearError, setCrearError] = useState<string | null>(null);

  const fetchClienteAndPrioridades = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [clienteData, prioridadesData] = await Promise.all([
        apiFetch<Cliente>(`/clientes/${clienteId}`),
        apiFetch<PrioridadCliente[]>(`/clientes/${clienteId}/prioridades`),
      ]);
      setCliente(clienteData);
      // Filter out deactivated/inactive mappings to present only the active matrix
      setPrioridades(prioridadesData.filter((p) => p.activo));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar equivalencias de prioridad');
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    if (clienteId) {
      Promise.resolve().then(() => {
        fetchClienteAndPrioridades();
      });
    }
  }, [clienteId, fetchClienteAndPrioridades]);

  const handleCrearPrioridad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaEtiqueta.trim() || !nuevaPrioridad) return;

    setCrearLoading(true);
    setCrearError(null);

    try {
      const created = await apiFetch<PrioridadCliente>(`/clientes/${clienteId}/prioridades`, {
        method: 'POST',
        body: JSON.stringify({
          etiqueta_cliente: nuevaEtiqueta.trim().toUpperCase(),
          prioridad_interna: nuevaPrioridad,
          activo: true,
        }),
      });

      setPrioridades([...prioridades, created]);
      setNuevaEtiqueta('');
      setNuevaPrioridad('media');
    } catch (err) {
      setCrearError(err instanceof Error ? err.message : 'Error al guardar mapeo');
    } finally {
      setCrearLoading(false);
    }
  };

  const handleDesactivarPrioridad = async (pid: number) => {
    try {
      await apiFetch(`/clientes/${clienteId}/prioridades/${pid}`, {
        method: 'DELETE',
      });
      // Filter it out from local state
      setPrioridades(prioridades.filter((p) => p.id !== pid));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar mapeo');
    }
  };

  const isAdmin = user?.rol === 'admin' || user?.rol === 'superadmin';

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-20">
        <Spinner size="lg" />
        <span className="text-xs text-zinc-500 font-medium mt-3">Cargando contratos y matriz de prioridades...</span>
      </div>
    );
  }

  if (error || !cliente) {
    return (
      <ErrorMessage
        message={error || 'No se pudo cargar la información del cliente.'}
        retry={fetchClienteAndPrioridades}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Back button */}
      <div>
        <Link
          href="/clientes"
          className="inline-flex items-center text-xs font-semibold text-zinc-500 hover:text-zinc-800 transition-colors"
        >
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver a Clientes
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Client profile card */}
        <div className="lg:col-span-1">
          <Card className="flex flex-col gap-4">
            <div>
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wide">
                Ficha de Cliente
              </span>
              <h2 className="text-base font-bold text-zinc-950 mt-1">{cliente.nombre}</h2>
            </div>
            
            <div className="border-t border-zinc-100 pt-4 flex flex-col gap-3 text-xs">
              <div>
                <span className="font-semibold text-zinc-400 block mb-1">RUC</span>
                <span className="text-zinc-800 font-medium">{cliente.ruc}</span>
              </div>
              <div>
                <span className="font-semibold text-zinc-400 block mb-1">Correo Electrónico</span>
                <span className="text-zinc-800 font-medium">{cliente.email || 'Sin registrar'}</span>
              </div>
              <div>
                <span className="font-semibold text-zinc-400 block mb-1">Teléfono</span>
                <span className="text-zinc-800 font-medium">{cliente.telefono || 'Sin registrar'}</span>
              </div>
              <div>
                <span className="font-semibold text-zinc-400 block mb-1">Estado en SaaS</span>
                <Badge
                  bg={cliente.activo ? 'bg-emerald-50' : 'bg-zinc-100'}
                  text={cliente.activo ? 'text-emerald-700' : 'text-zinc-500'}
                  border={cliente.activo ? 'border-emerald-200' : 'border-zinc-200'}
                  className="self-start mt-0.5"
                >
                  {cliente.activo ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Equivalency matrix */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card className="flex flex-col gap-5">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Matriz de Equivalencias de Prioridad</h3>
              <p className="text-[11px] text-zinc-500 mt-1">
                Mapee los estados de prioridad que vienen en los formatos nativos del cliente (ej. &ldquo;URGENTE&rdquo; o &ldquo;P1&rdquo;) a las prioridades internas del contratista para cálculos automáticos de SLA.
              </p>
            </div>

            {/* Inline creation form */}
            {isAdmin && (
              <form onSubmit={handleCrearPrioridad} className="bg-zinc-50/50 border border-zinc-200/60 rounded-xl p-4 flex flex-col sm:flex-row items-end gap-3.5">
                <div className="flex-1 w-full">
                  <Input
                    label="Etiqueta Cliente (Ej. URGENTE, P1)"
                    placeholder="Escriba etiqueta..."
                    value={nuevaEtiqueta}
                    onChange={(e) => setNuevaEtiqueta(e.target.value)}
                    required
                  />
                </div>
                <div className="w-full sm:w-44">
                  <Select
                    label="Prioridad Interna Mapeada"
                    value={nuevaPrioridad}
                    onChange={(e) => setNuevaPrioridad(e.target.value as PrioridadOT)}
                    options={Object.entries(PRIORIDAD_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                  />
                </div>
                <Button type="submit" size="sm" isLoading={crearLoading} className="w-full sm:w-auto h-[38px] shrink-0">
                  Agregar Mapeo
                </Button>
              </form>
            )}

            {crearError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                {crearError}
              </div>
            )}

            {/* Equivalency list */}
            {prioridades.length === 0 ? (
              <EmptyState
                title="Sin Mapeos de Prioridad"
                description="Este cliente no tiene equivalencias configuradas. OTs recibidas por API/ingesta automática podrían no priorizarse correctamente."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Etiqueta Nativa Cliente</th>
                      <th className="py-3 px-4">Mapeo Prioridad Interna (SLA)</th>
                      {isAdmin && <th className="py-3 px-4 text-right">Acción</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {prioridades.map((p) => {
                      const color = PRIORIDAD_COLORS[p.prioridad_interna];
                      return (
                        <tr key={p.id} className="hover:bg-zinc-50/20 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-zinc-800 tracking-wider">
                            {p.etiqueta_cliente}
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge bg={color.bg} text={color.text} border={color.border} className="capitalize">
                              {PRIORIDAD_LABELS[p.prioridad_interna]}
                            </Badge>
                          </td>
                          {isAdmin && (
                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={() => handleDesactivarPrioridad(p.id)}
                                className="text-[10px] text-red-600 hover:text-red-700 font-bold border border-red-100 hover:bg-red-50 px-2 py-1 rounded-md transition-all inline-block"
                              >
                                Eliminar
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

      </div>
    </div>
  );
}
