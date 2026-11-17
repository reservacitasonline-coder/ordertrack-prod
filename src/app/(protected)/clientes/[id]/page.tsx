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
import { EditarClienteModal } from '@/components/clientes/EditarClienteModal';
import { apiFetch } from '@/lib/api';
import { PRIORIDAD_LABELS, PRIORIDAD_COLORS, ESTADO_LABELS, ESTADO_COLORS } from '@/lib/constants';
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
  const [activeTab, setActiveTab] = useState<'prioridades' | 'ordenes' | 'equipos'>('prioridades');
  const [isEditarOpen, setIsEditarOpen] = useState(false);

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
      setPrioridades(prioridadesData.filter((p) => p.activo));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar detalles del cliente y contrato');
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
        <span className="text-xs text-zinc-500 font-medium mt-3">Cargando contratos y ficha de cliente...</span>
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

  const c = cliente.contrato;

  // Estado del contrato badge
  const estadoContratoConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
    vigente: { label: 'Vigente', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    por_vencer: { label: 'Por Vencer', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    en_renovacion: { label: 'En Renovación', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    vencido: { label: 'Vencido', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  };

  const currentContratoState = c?.estado_contrato ? estadoContratoConfig[c.estado_contrato] || estadoContratoConfig.vigente : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/clientes"
            className="inline-flex items-center text-xs font-semibold text-zinc-500 hover:text-zinc-800 transition-colors mb-2"
          >
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Volver a Clientes & Contratos
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-950">{cliente.nombre}</h1>
            <Badge
              bg={cliente.activo ? 'bg-emerald-50' : 'bg-zinc-100'}
              text={cliente.activo ? 'text-emerald-700' : 'text-zinc-500'}
              border={cliente.activo ? 'border-emerald-200' : 'border-zinc-200'}
            >
              {cliente.activo ? 'Cliente Activo' : 'Inactivo'}
            </Badge>
          </div>
        </div>

        {/* Action buttons (Edit only by Admin) */}
        {isAdmin && (
          <Button onClick={() => setIsEditarOpen(true)} className="self-start sm:self-auto">
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            ✏️ Editar Cliente & Contrato
          </Button>
        )}
      </div>

      {/* Operative Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Órdenes Totales</span>
          <p className="text-2xl font-extrabold text-zinc-900 mt-1">{cliente.stats?.total_ordenes ?? 0}</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">OTs Activas en Curso</span>
          <p className="text-2xl font-extrabold text-amber-600 mt-1">{cliente.stats?.ordenes_activas ?? 0}</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">OTs Completadas</span>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">{cliente.stats?.ordenes_completadas ?? 0}</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs">
          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide">Equipos Registrados</span>
          <p className="text-2xl font-extrabold text-teal-600 mt-1">{cliente.stats?.total_equipos ?? 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Client & Contract Details */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          
          {/* Card 1: Ficha General de la Empresa */}
          <Card className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                🏢 Ficha de la Empresa
              </span>
            </div>
            
            <div className="border-t border-zinc-100 pt-3 flex flex-col gap-2.5 text-xs">
              <div>
                <span className="font-semibold text-zinc-400 block mb-0.5">RUC / Identificación Fiscal</span>
                <span className="text-zinc-900 font-mono font-semibold">{cliente.ruc}</span>
              </div>
              <div>
                <span className="font-semibold text-zinc-400 block mb-0.5">Correo Electrónico de Contacto</span>
                <span className="text-zinc-800 font-medium">{cliente.email || 'Sin correo registrado'}</span>
              </div>
              <div>
                <span className="font-semibold text-zinc-400 block mb-0.5">Teléfono Principal</span>
                <span className="text-zinc-800 font-medium">{cliente.telefono || 'Sin teléfono registrado'}</span>
              </div>
              <div>
                <span className="font-semibold text-zinc-400 block mb-0.5">Fecha de Alta en la Plataforma</span>
                <span className="text-zinc-600 font-medium">
                  {new Date(cliente.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>
          </Card>

          {/* Card 2: Contrato & SLA */}
          <Card className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider flex items-center gap-1.5">
                📜 Contrato de Servicio & SLA
              </span>
              {currentContratoState && (
                <Badge bg={currentContratoState.bg} text={currentContratoState.text} border={currentContratoState.border}>
                  {currentContratoState.label}
                </Badge>
              )}
            </div>

            <div className="border-t border-zinc-100 pt-3 flex flex-col gap-2.5 text-xs">
              <div>
                <span className="font-semibold text-zinc-400 block mb-0.5">Código de Contrato</span>
                <span className="text-zinc-900 font-mono font-bold">
                  {c?.codigo_contrato || 'Sin código asignado'}
                </span>
              </div>
              <div>
                <span className="font-semibold text-zinc-400 block mb-0.5">Tipo de Servicio / Cobertura</span>
                <span className="text-zinc-800 font-medium">
                  {c?.tipo_servicio || 'Mantenimiento Preventivo y Correctivo'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="font-semibold text-zinc-400 block mb-0.5">Inicio</span>
                  <span className="text-zinc-700 font-medium">
                    {c?.fecha_inicio ? new Date(c.fecha_inicio).toLocaleDateString('es-ES') : 'No def.'}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-zinc-400 block mb-0.5">Fin / Vencimiento</span>
                  <span className="text-zinc-700 font-medium">
                    {c?.fecha_fin ? new Date(c.fecha_fin).toLocaleDateString('es-ES') : 'No def.'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="font-semibold text-zinc-400 block mb-0.5">SLA Máx. Comprometido</span>
                  <span className="text-teal-700 font-bold">{c?.sla_horas_comprometido ? `${c.sla_horas_comprometido} hrs` : '24 hrs'}</span>
                </div>
                <div>
                  <span className="font-semibold text-zinc-400 block mb-0.5">Tarifa Mensual</span>
                  <span className="text-zinc-900 font-bold">
                    {c?.tarifa_mensual ? `${c.moneda === 'USD' ? '$' : 'S/.'} ${c.tarifa_mensual.toFixed(2)}` : 'A convenir'}
                  </span>
                </div>
              </div>
              {c?.contacto_comercial && (
                <div>
                  <span className="font-semibold text-zinc-400 block mb-0.5">Administrador del Contrato</span>
                  <span className="text-zinc-800 font-medium block">{c.contacto_comercial}</span>
                  {(c.telefono_comercial || c.email_comercial) && (
                    <span className="text-[11px] text-zinc-500 block mt-0.5">
                      {c.telefono_comercial ? `📞 ${c.telefono_comercial}` : ''} {c.email_comercial ? `✉️ ${c.email_comercial}` : ''}
                    </span>
                  )}
                </div>
              )}
              {c?.condiciones_pago && (
                <div>
                  <span className="font-semibold text-zinc-400 block mb-0.5">Condiciones de Pago</span>
                  <span className="text-zinc-700 font-medium">{c.condiciones_pago}</span>
                </div>
              )}
              {c?.observaciones && (
                <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-2.5 mt-1">
                  <span className="font-semibold text-zinc-500 block mb-1 text-[11px]">Cláusulas / Observaciones:</span>
                  <p className="text-zinc-700 text-[11px] leading-relaxed italic">{c.observaciones}</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Interactive Tabs */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card className="flex flex-col gap-5">
            {/* Tabs Bar */}
            <div className="flex border-b border-zinc-200 gap-6">
              <button
                onClick={() => setActiveTab('prioridades')}
                className={`pb-3 font-bold text-xs transition-colors cursor-pointer border-b-2 -mb-[1px] flex items-center gap-1.5 ${
                  activeTab === 'prioridades'
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800'
                }`}
              >
                ⚖️ Matriz de Prioridades (SLA)
                <span className="bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded-full text-[10px]">
                  {prioridades.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('ordenes')}
                className={`pb-3 font-bold text-xs transition-colors cursor-pointer border-b-2 -mb-[1px] flex items-center gap-1.5 ${
                  activeTab === 'ordenes'
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800'
                }`}
              >
                📋 Órdenes de Trabajo
                <span className="bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded-full text-[10px]">
                  {cliente.ultimas_ordenes?.length ?? 0}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('equipos')}
                className={`pb-3 font-bold text-xs transition-colors cursor-pointer border-b-2 -mb-[1px] flex items-center gap-1.5 ${
                  activeTab === 'equipos'
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800'
                }`}
              >
                ⚙️ Equipos en Campo
                <span className="bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded-full text-[10px]">
                  {cliente.equipos?.length ?? 0}
                </span>
              </button>
            </div>

            {/* TAB 1: Matriz de Equivalencias de Prioridad */}
            {activeTab === 'prioridades' && (
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">Mapeo de Prioridades Cliente → Contratista</h3>
                  <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                    Mapee los nombres de prioridad nativos que el cliente utiliza en sus sistemas (ej. &ldquo;URGENTE&rdquo; o &ldquo;P1&rdquo;) para traducirlos automáticamente a las prioridades del contratista y calcular el SLA pactado en el contrato.
                  </p>
                </div>

                {/* Formulario solo accesible para Admin */}
                {isAdmin && (
                  <form onSubmit={handleCrearPrioridad} className="bg-zinc-50/70 border border-zinc-200/70 rounded-xl p-3.5 flex flex-col sm:flex-row items-end gap-3">
                    <div className="flex-1 w-full">
                      <Input
                        label="Etiqueta Cliente (Ej. CRÍTICO, P1, URGENTE)"
                        placeholder="Escriba etiqueta..."
                        value={nuevaEtiqueta}
                        onChange={(e) => setNuevaEtiqueta(e.target.value)}
                        required
                      />
                    </div>
                    <div className="w-full sm:w-48">
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

                {prioridades.length === 0 ? (
                  <EmptyState
                    title="Sin Mapeos de Prioridad"
                    description="Este cliente no tiene equivalencias configuradas. Las OTs que ingresen por API tomarán la prioridad estándar por defecto."
                  />
                ) : (
                  <div className="overflow-x-auto border border-zinc-200 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-4">Etiqueta Nativa del Cliente</th>
                          <th className="py-2.5 px-4">Prioridad Interna (SLA Contrato)</th>
                          {isAdmin && <th className="py-2.5 px-4 text-right">Acción</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {prioridades.map((p) => {
                          const color = PRIORIDAD_COLORS[p.prioridad_interna];
                          return (
                            <tr key={p.id} className="hover:bg-zinc-50/40 transition-colors">
                              <td className="py-3 px-4 font-mono font-bold text-zinc-800 tracking-wider">
                                {p.etiqueta_cliente}
                              </td>
                              <td className="py-3 px-4">
                                <Badge bg={color.bg} text={color.text} border={color.border} className="capitalize">
                                  {PRIORIDAD_LABELS[p.prioridad_interna]}
                                </Badge>
                              </td>
                              {isAdmin && (
                                <td className="py-3 px-4 text-right">
                                  <button
                                    onClick={() => handleDesactivarPrioridad(p.id)}
                                    className="text-[10px] text-red-600 hover:text-red-700 font-bold border border-red-100 hover:bg-red-50 px-2 py-1 rounded-md transition-all cursor-pointer"
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
              </div>
            )}

            {/* TAB 2: Órdenes de Trabajo del Cliente */}
            {activeTab === 'ordenes' && (
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900">Órdenes de Trabajo del Cliente</h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Últimos servicios solicitados o ejecutados bajo contrato.</p>
                  </div>
                  <Link
                    href={`/ordenes`}
                    className="text-xs font-semibold text-teal-600 hover:text-teal-700"
                  >
                    Ver todas las OTs →
                  </Link>
                </div>

                {!cliente.ultimas_ordenes || cliente.ultimas_ordenes.length === 0 ? (
                  <EmptyState
                    title="Sin Órdenes de Trabajo"
                    description="No se registran órdenes de trabajo asociadas a este cliente."
                  />
                ) : (
                  <div className="overflow-x-auto border border-zinc-200 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-4">Código OT</th>
                          <th className="py-2.5 px-4">Título / Servicio</th>
                          <th className="py-2.5 px-4">Estado</th>
                          <th className="py-2.5 px-4">Prioridad</th>
                          <th className="py-2.5 px-4 text-right">Ficha</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {cliente.ultimas_ordenes.map((ot) => {
                          const stateColor = ESTADO_COLORS[ot.estado];
                          const prioColor = PRIORIDAD_COLORS[ot.prioridad];
                          return (
                            <tr key={ot.id} className="hover:bg-zinc-50/40 transition-colors">
                              <td className="py-3 px-4 font-mono font-bold text-zinc-900">{ot.codigo_interno}</td>
                              <td className="py-3 px-4 font-medium text-zinc-800 truncate max-w-[200px]">{ot.titulo}</td>
                              <td className="py-3 px-4">
                                <Badge bg={stateColor.bg} text={stateColor.text} border={stateColor.border}>
                                  {ESTADO_LABELS[ot.estado]}
                                </Badge>
                              </td>
                              <td className="py-3 px-4">
                                <Badge bg={prioColor.bg} text={prioColor.text} border={prioColor.border} className="capitalize">
                                  {PRIORIDAD_LABELS[ot.prioridad]}
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <Link
                                  href={`/ordenes/${ot.id}`}
                                  className="text-[11px] font-bold text-teal-600 hover:text-teal-700 hover:underline"
                                >
                                  Ver detalle →
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Equipos Registrados del Cliente */}
            {activeTab === 'equipos' && (
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900">Equipos e Instalaciones Vinculadas</h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Parque de maquinarias o activos asignados a este cliente.</p>
                  </div>
                  <Link
                    href={`/equipos?cliente_id=${cliente.id}`}
                    className="text-xs font-semibold text-teal-600 hover:text-teal-700"
                  >
                    Gestionar en Equipos →
                  </Link>
                </div>

                {!cliente.equipos || cliente.equipos.length === 0 ? (
                  <EmptyState
                    title="Sin Equipos Registrados"
                    description="No se han vinculado equipos o activos a este cliente aún."
                  />
                ) : (
                  <div className="overflow-x-auto border border-zinc-200 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-4">Nombre del Equipo</th>
                          <th className="py-2.5 px-4">Código Inventario</th>
                          <th className="py-2.5 px-4">Tipo / Categoría</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {cliente.equipos.map((eq) => (
                          <tr key={eq.id} className="hover:bg-zinc-50/40 transition-colors">
                            <td className="py-3 px-4 font-semibold text-zinc-900">{eq.nombre}</td>
                            <td className="py-3 px-4 font-mono text-zinc-600">{eq.codigo_inventario || 'S/N'}</td>
                            <td className="py-3 px-4 text-zinc-600">
                              {eq.tipo?.nombre || 'General'}
                              {eq.tipo?.categoria ? ` (${eq.tipo.categoria.nombre})` : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

      </div>

      {/* Modal de Edición de Cliente & Contrato (Solo visible si isAdmin) */}
      {isAdmin && isEditarOpen && (
        <EditarClienteModal
          isOpen={isEditarOpen}
          onClose={() => setIsEditarOpen(false)}
          cliente={cliente}
          onSuccess={fetchClienteAndPrioridades}
        />
      )}
    </div>
  );
}
