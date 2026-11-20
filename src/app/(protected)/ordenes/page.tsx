'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../layout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { AsignarModal } from '@/components/ordenes/AsignarModal';
import { TransicionModal } from '@/components/ordenes/TransicionModal';
import { EditarOtModal } from '@/components/ordenes/EditarOtModal';
import { apiFetch } from '@/lib/api';
import { ESTADO_COLORS, ESTADO_LABELS, PRIORIDAD_COLORS, PRIORIDAD_LABELS } from '@/lib/constants';
import { OrdenTrabajo, Cliente, PrioridadOT, EstadoOT } from '@/types';

const PRIORIDADES_ORDEN: Record<PrioridadOT, number> = {
  critica: 4,
  alta: 3,
  media: 2,
  baja: 1,
};

export default function OrdenesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Calendario Semanal para Técnico
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const weeklyDays = useMemo(() => {
    const days = [];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const today = new Date();
    const currentDayOfWeek = today.getDay();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - currentDayOfWeek);
    sunday.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(sunday);
      dayDate.setDate(sunday.getDate() + i);
      const dateStr = dayDate.toISOString().split('T')[0];
      days.push({
        dayShort: dayNames[i],
        dayNumber: dayDate.getDate(),
        isToday: dateStr === todayStr,
        dateStr,
      });
    }
    return days;
  }, []);

  const secondaryDateText = useMemo(() => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    const formatted = now.toLocaleDateString('es-ES', options);
    return `Hoy, ${formatted}`;
  }, []);

  // Keyboard shortcut '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // States
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Display limits
  const [pageSize] = useState<number>(100);
  const [page] = useState<number>(1);

  // Filters
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroPrioridad, setFiltroPrioridad] = useState('');
  const [filtroPlantilla, setFiltroPlantilla] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const hasActiveFilters = Boolean(
    filtroCliente || filtroEstado || filtroPrioridad || filtroPlantilla || searchQuery.trim()
  );

  const handleResetFilters = useCallback(() => {
    setFiltroCliente('');
    setFiltroEstado('');
    setFiltroPrioridad('');
    setFiltroPlantilla('');
    setSearchQuery('');
  }, []);

  // Modals state for full OT creation
  const [isCrearOpen, setIsCrearOpen] = useState(false);
  const [crearClienteId, setCrearClienteId] = useState('');
  const [crearTitulo, setCrearTitulo] = useState('');
  const [crearCodigoExterno, setCrearCodigoExterno] = useState('');
  const [crearPrioridad, setCrearPrioridad] = useState<PrioridadOT>('media');
  const [crearEstado, setCrearEstado] = useState<EstadoOT>('RECIBIDA');
  const [crearTecnicoId, setCrearTecnicoId] = useState('');
  const [crearFechaProgramada, setCrearFechaProgramada] = useState('');
  const [crearDescripcion, setCrearDescripcion] = useState('');
  const [crearLoading, setCrearLoading] = useState(false);
  const [crearError, setCrearError] = useState<string | null>(null);

  const [plantillasDisponibles, setPlantillasDisponibles] = useState<{ id: number; titulo: string; tiempo_estimado_minutos: number }[]>([]);
  const [tecnicosDisponibles, setTecnicosDisponibles] = useState<{ id: number; nombre: string; email: string; empresa_id: number | null }[]>([]);
  const [selectedPlantillaIds, setSelectedPlantillaIds] = useState<number[]>([]);

  // Assignment Modal
  const [selectedAsignar, setSelectedAsignar] = useState<{ id: number; empresaId: number } | null>(null);
  // Transition Modal
  const [selectedTransicion, setSelectedTransicion] = useState<{ id: number; estado: EstadoOT } | null>(null);
  // Edit Modal
  const [selectedEditar, setSelectedEditar] = useState<OrdenTrabajo | null>(null);

  const fetchFiltersAndList = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setError(null);
    try {
      const promises: [
        Promise<OrdenTrabajo[]>,
        Promise<Cliente[] | null>,
        Promise<{ id: number; titulo: string; tiempo_estimado_minutos: number }[]>
      ] = [
        user?.rol === 'tecnico'
          ? apiFetch<OrdenTrabajo[]>('/ordenes')
          : apiFetch<OrdenTrabajo[]>(`/ordenes?page=${page}&page_size=${pageSize}`),
        user?.rol !== 'tecnico' ? apiFetch<Cliente[]>('/clientes') : Promise.resolve(null),
        apiFetch<{ id: number; titulo: string; tiempo_estimado_minutos: number }[]>('/plantillas').catch(() => []),
      ];

      const [ordenesData, clientesData, plantillasData] = await Promise.all(promises);
      const finalOrdenes = Array.isArray(ordenesData) ? ordenesData : [];

      setOrdenes(finalOrdenes);
      if (clientesData) setClientes(clientesData);
      if (plantillasData) setPlantillasDisponibles(plantillasData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al sincronizar las órdenes de trabajo');
    } finally {
      setLoading(false);
    }
  }, [user, page, pageSize]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchFiltersAndList();
    });
  }, [fetchFiltersAndList]);

  // Load Technicians for modal
  const handleOpenCrear = useCallback(async () => {
    setIsCrearOpen(true);
    setCrearError(null);
    try {
      const tecs = await apiFetch<{ id: number; nombre: string; email: string; empresa_id: number | null }[]>('/usuarios/tecnicos');
      setTecnicosDisponibles(tecs || []);
    } catch {
      setTecnicosDisponibles([]);
    }
  }, []);

  useEffect(() => {
    const onOpenCrear = () => {
      handleOpenCrear();
    };
    window.addEventListener('open-crear-ot', onOpenCrear);
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('crear') === 'true') {
      Promise.resolve().then(() => {
        handleOpenCrear();
      });
    }
    return () => window.removeEventListener('open-crear-ot', onOpenCrear);
  }, [handleOpenCrear]);

  const handleCrearOTSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crearClienteId || !crearTitulo.trim()) {
      setCrearError('El cliente y el título son obligatorios');
      return;
    }

    setCrearLoading(true);
    setCrearError(null);

    try {
      await apiFetch('/ordenes', {
        method: 'POST',
        body: JSON.stringify({
          cliente_id: Number(crearClienteId),
          titulo: crearTitulo.trim(),
          codigo_externo: crearCodigoExterno.trim() || undefined,
          prioridad: crearPrioridad,
          estado: crearEstado,
          tecnico_id: crearTecnicoId ? Number(crearTecnicoId) : undefined,
          fecha_programada: crearFechaProgramada || undefined,
          descripcion: crearDescripcion.trim() || undefined,
          plantilla_ids: selectedPlantillaIds,
        }),
      });

      setIsCrearOpen(false);
      setCrearClienteId('');
      setCrearTitulo('');
      setCrearCodigoExterno('');
      setCrearPrioridad('media');
      setCrearEstado('RECIBIDA');
      setCrearTecnicoId('');
      setCrearFechaProgramada('');
      setCrearDescripcion('');
      setSelectedPlantillaIds([]);
      fetchFiltersAndList();
    } catch (err) {
      setCrearError(err instanceof Error ? err.message : 'Error al registrar la orden');
    } finally {
      setCrearLoading(false);
    }
  };

  // Filtered & Sorted OT List
  const filteredAndSortedOrdenes = useMemo(() => {
    let result = [...ordenes];

    if (filtroCliente) {
      result = result.filter((ot) => ot.cliente.id === Number(filtroCliente));
    }
    if (filtroEstado) {
      result = result.filter((ot) => ot.estado === filtroEstado);
    }
    if (filtroPrioridad) {
      result = result.filter((ot) => ot.prioridad === filtroPrioridad);
    }
    if (filtroPlantilla) {
      const pid = Number(filtroPlantilla);
      result = result.filter(
        (ot) => ot.plantillas?.some((p) => p.id === pid) || ot.plantilla_id === pid
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (ot) =>
          ot.codigo_interno.toLowerCase().includes(q) ||
          ot.titulo.toLowerCase().includes(q) ||
          ot.cliente.nombre.toLowerCase().includes(q) ||
          (ot.tecnico_asignado && ot.tecnico_asignado.nombre.toLowerCase().includes(q))
      );
    }

    if (user?.rol === 'tecnico' && selectedDateStr) {
      result = result.filter((ot) => {
        const dateStr = ot.fecha_programada || ot.created_at || '';
        return dateStr && dateStr.startsWith(selectedDateStr);
      });
    }

    result.sort((a, b) => {
      const prioDiff = PRIORIDADES_ORDEN[b.prioridad] - PRIORIDADES_ORDEN[a.prioridad];
      if (prioDiff !== 0) return prioDiff;
      const dateA = new Date(a.fecha_recepcion || 0).getTime();
      const dateB = new Date(b.fecha_recepcion || 0).getTime();
      return dateB - dateA;
    });

    return result;
  }, [ordenes, filtroCliente, filtroEstado, filtroPrioridad, filtroPlantilla, searchQuery, selectedDateStr, user]);

  // Count of displayed OTs
  const totalCount = filteredAndSortedOrdenes.length;

  const isOperator = user?.rol === 'admin' || user?.rol === 'operador' || user?.rol === 'superadmin';
  const isTecnico = user?.rol === 'tecnico';

  return (
    <div className="flex flex-col gap-6 text-zinc-900 max-w-7xl mx-auto w-full">
      {/* 1. Header & Executive Control Bar (Estilo Dashboard) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-zinc-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-zinc-950 tracking-tight">
              {isTecnico ? 'Histórico de Órdenes' : 'Órdenes de Trabajo'}
            </h1>
            <span className="text-[10px] font-semibold tracking-wider uppercase text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200 tabular-nums">
              {totalCount} OTs
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            {isTecnico
              ? 'Bitácora y trazabilidad de servicios técnicos asignados en campo.'
              : 'Gestión operativa, asignación de cuadrillas y seguimiento de servicios en terreno.'}
          </p>
        </div>

        {/* Action Button */}
        {isOperator && (
          <button
            onClick={handleOpenCrear}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nueva Orden
          </button>
        )}
      </div>

      {/* Calendario Semanal en caso de Técnico */}
      {isTecnico && (
        <Card className="p-3 border border-zinc-200/90 shadow-2xs flex flex-col gap-2">
          <div className="flex justify-between items-center w-full gap-1 overflow-x-auto">
            {weeklyDays.map((day) => {
              const isSelected = selectedDateStr === day.dateStr;
              return (
                <button
                  key={day.dateStr}
                  type="button"
                  onClick={() => setSelectedDateStr(day.dateStr)}
                  className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all duration-150 cursor-pointer min-w-[50px] ${
                    isSelected
                      ? 'bg-teal-600 text-white font-semibold shadow-xs'
                      : 'text-zinc-600 hover:bg-zinc-100'
                  }`}
                >
                  <span className={`text-[10px] uppercase tracking-wider ${isSelected ? 'text-teal-100' : 'text-zinc-400'}`}>
                    {day.dayShort}
                  </span>
                  <span className={`text-xs font-bold mt-0.5 ${isSelected ? 'text-white' : 'text-zinc-900'}`}>
                    {day.dayNumber}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="text-[11px] text-zinc-500 font-medium px-1 border-t border-zinc-100 pt-1.5">
            {secondaryDateText}
          </div>
        </Card>
      )}

      {/* 2. Executive Filter and Search Card */}
      <Card className="p-4 border border-zinc-200/90 shadow-2xs flex flex-col gap-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Main Search Input */}
          <div className="flex-1 relative">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por código OT, servicio, cliente o técnico asignado... (Presiona '/' para enfocar)"
              className="w-full pl-9 pr-4 py-2 text-xs text-zinc-900 bg-zinc-50/60 border border-zinc-200 rounded-lg placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-950 focus:bg-white transition-all font-medium"
            />
            <svg
              className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Filters Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Cliente */}
            <select
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.target.value)}
              className="text-xs bg-white border border-zinc-200 text-zinc-800 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-zinc-950 transition-all font-medium cursor-pointer"
            >
              <option value="">Todos los Clientes ({clientes.length})</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>

            {/* Estado */}
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="text-xs bg-white border border-zinc-200 text-zinc-800 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-zinc-950 transition-all font-medium cursor-pointer"
            >
              <option value="">Todos los Estados</option>
              {Object.entries(ESTADO_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>

            {/* Prioridad */}
            <select
              value={filtroPrioridad}
              onChange={(e) => setFiltroPrioridad(e.target.value)}
              className="text-xs bg-white border border-zinc-200 text-zinc-800 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-zinc-950 transition-all font-medium cursor-pointer"
            >
              <option value="">Todas las Prioridades</option>
              {Object.entries(PRIORIDAD_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>

            {/* Clear Button */}
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="px-2.5 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer"
                title="Restablecer todos los filtros"
              >
                Limpiar ✕
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* 3. Content Area: Lista Ejecutiva (Tabla) */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-xs text-zinc-400 gap-2">
          <Spinner size="lg" />
          <span className="font-medium tracking-wide">Cargando órdenes de trabajo...</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
          ⚠️ {error}
        </div>
      ) : filteredAndSortedOrdenes.length === 0 ? (
        <EmptyState
          title="Sin órdenes de trabajo"
          description={
            hasActiveFilters
              ? 'No se encontraron órdenes que coincidan con los filtros aplicados.'
              : 'Aún no se han registrado órdenes de trabajo en el sistema.'
          }
        />
      ) : (
        /* VISTA TABLA (Estilo Ejecutivo Idéntico al Dashboard - Sin scroll horizontal) */
        <Card className="p-0 border border-zinc-200/90 overflow-hidden shadow-2xs">
          {/* Vista Tabla Desktop/Tablet - Ajustada al 100% de ancho sin desbordamiento */}
          <div className="hidden md:block w-full">
            <table className="w-full text-left text-xs border-collapse table-fixed">
              <colgroup>
                <col className="w-[100px]" />
                <col className="w-auto" />
                <col className="w-[150px]" />
                <col className="w-[130px]" />
                <col className="w-[90px]" />
                <col className="w-[115px]" />
                <col className="w-[100px]" />
                <col className="w-[125px]" />
              </colgroup>
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/80 text-zinc-500 font-medium text-[11px]">
                  <th className="py-2.5 px-3">Código OT</th>
                  <th className="py-2.5 px-3">Servicio / Equipo</th>
                  <th className="py-2.5 px-3">Cliente</th>
                  <th className="py-2.5 px-3">Técnico</th>
                  <th className="py-2.5 px-3">Prioridad</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredAndSortedOrdenes.map((ot) => {
                  const prioColor = PRIORIDAD_COLORS[ot.prioridad];
                  const stateColor = ESTADO_COLORS[ot.estado];
                  return (
                    <tr key={ot.id} className="hover:bg-zinc-50/60 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[11px] truncate">
                        <Link
                          href={isTecnico ? `/tecnico/ordenes/${ot.id}` : `/ordenes/${ot.id}`}
                          className="font-semibold text-zinc-900 hover:text-teal-600 hover:underline transition-colors block truncate"
                          title={`Ver detalle de orden ${ot.codigo_interno}`}
                        >
                          {ot.codigo_interno}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-zinc-800 font-medium truncate" title={ot.titulo}>
                        {ot.titulo}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-600 font-medium truncate" title={ot.cliente?.nombre}>
                        <Link
                          href={`/clientes/${ot.cliente?.id || ''}`}
                          className="hover:underline hover:text-zinc-950 truncate block"
                        >
                          {ot.cliente?.nombre ?? '—'}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-zinc-600 truncate" title={ot.tecnico_asignado?.nombre || 'Sin asignar'}>
                        {ot.tecnico_asignado?.nombre || (
                          <span className="text-zinc-400 italic">Sin asignar</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge bg={prioColor.bg} text={prioColor.text} border={prioColor.border} className="capitalize text-[10px]">
                          {PRIORIDAD_LABELS[ot.prioridad]}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge bg={stateColor.bg} text={stateColor.text} border={stateColor.border} className="text-[10px]">
                          {ESTADO_LABELS[ot.estado]}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-zinc-500 font-mono text-[11px] truncate">
                        {ot.fecha_programada
                          ? ot.fecha_programada.substring(0, 10).split('-').reverse().join('/')
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {isOperator ? (
                          <div className="inline-flex items-center justify-end gap-1 w-full">
                            <button
                              onClick={() => setSelectedEditar(ot)}
                              className="text-[11px] font-semibold text-zinc-700 hover:text-zinc-950 border border-zinc-200 hover:bg-zinc-50 px-2 py-0.5 rounded transition-colors cursor-pointer"
                              title="Editar orden"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => setSelectedAsignar({ id: ot.id, empresaId: ot.empresa_id })}
                              className="text-[11px] font-semibold bg-teal-600 hover:bg-teal-700 text-white px-2 py-0.5 rounded transition-colors cursor-pointer"
                            >
                              Asignar
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-zinc-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Vista Mobile Compacta - Sin scroll horizontal */}
          <div className="md:hidden divide-y divide-zinc-100">
            {filteredAndSortedOrdenes.map((ot) => {
              const prioColor = PRIORIDAD_COLORS[ot.prioridad];
              const stateColor = ESTADO_COLORS[ot.estado];
              return (
                <div key={ot.id} className="p-3.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={isTecnico ? `/tecnico/ordenes/${ot.id}` : `/ordenes/${ot.id}`}
                      className="font-mono font-semibold text-xs text-zinc-900 hover:text-teal-600 bg-zinc-100 hover:bg-zinc-200 px-2 py-0.5 rounded border border-zinc-200 transition-colors"
                      title={`Ver detalle de orden ${ot.codigo_interno}`}
                    >
                      {ot.codigo_interno}
                    </Link>
                    <div className="flex items-center gap-1.5">
                      <Badge bg={prioColor.bg} text={prioColor.text} border={prioColor.border} className="text-[10px]">
                        {PRIORIDAD_LABELS[ot.prioridad]}
                      </Badge>
                      <Badge bg={stateColor.bg} text={stateColor.text} border={stateColor.border} className="text-[10px]">
                        {ESTADO_LABELS[ot.estado]}
                      </Badge>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-900 truncate">{ot.titulo}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
                      Cliente: <span className="font-medium text-zinc-800">{ot.cliente?.nombre ?? '—'}</span>
                    </p>
                    <p className="text-[11px] text-zinc-500 truncate">
                      Técnico: <span className="font-medium text-zinc-800">{ot.tecnico_asignado?.nombre || 'Sin asignar'}</span>
                      {ot.fecha_programada && (
                        <span className="font-mono text-zinc-400 ml-2">
                          · {ot.fecha_programada.substring(0, 10).split('-').reverse().join('/')}
                        </span>
                      )}
                    </p>
                  </div>
                  {isOperator && (
                    <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-zinc-100">
                      <button
                        onClick={() => setSelectedEditar(ot)}
                        className="text-xs font-semibold text-zinc-700 hover:text-zinc-950 border border-zinc-200 hover:bg-zinc-50 px-2.5 py-1 rounded transition-colors cursor-pointer"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setSelectedAsignar({ id: ot.id, empresaId: ot.empresa_id })}
                        className="text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white px-2.5 py-1 rounded transition-colors cursor-pointer"
                      >
                        Asignar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Modal de Creación de OT */}
      {isCrearOpen && (
        <Modal isOpen={isCrearOpen} onClose={() => setIsCrearOpen(false)} title="Registrar Nueva Orden de Trabajo">
          <form onSubmit={handleCrearOTSubmit} className="space-y-3.5 text-xs max-h-[75vh] overflow-y-auto pr-1">
            {crearError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 font-semibold rounded-lg">
                {crearError}
              </div>
            )}
            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Cliente *</label>
              <select
                value={crearClienteId}
                onChange={(e) => setCrearClienteId(e.target.value)}
                className="w-full h-10 border border-zinc-200 rounded-lg px-3 bg-white text-zinc-800 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 font-medium"
                required
              >
                <option value="">Seleccionar Cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Título del Servicio / Equipo *</label>
              <input
                type="text"
                value={crearTitulo}
                onChange={(e) => setCrearTitulo(e.target.value)}
                placeholder="Ej: Mantenimiento Preventivo Grupo Electrógeno"
                className="w-full h-10 border border-zinc-200 rounded-lg px-3 bg-white text-zinc-800 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Prioridad</label>
                <select
                  value={crearPrioridad}
                  onChange={(e) => setCrearPrioridad(e.target.value as PrioridadOT)}
                  className="w-full h-10 border border-zinc-200 rounded-lg px-3 bg-white text-zinc-800 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 font-medium"
                >
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="critica">Crítica</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Código Externo (Opc.)</label>
                <input
                  type="text"
                  value={crearCodigoExterno}
                  onChange={(e) => setCrearCodigoExterno(e.target.value)}
                  placeholder="Ej: INC-902"
                  className="w-full h-10 border border-zinc-200 rounded-lg px-3 bg-white text-zinc-800 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Técnico Asignado (Opc.)</label>
                <select
                  value={crearTecnicoId}
                  onChange={(e) => {
                    setCrearTecnicoId(e.target.value);
                    setCrearEstado(e.target.value ? 'PROGRAMADA' : 'RECIBIDA');
                  }}
                  className="w-full h-10 border border-zinc-200 rounded-lg px-3 bg-white text-zinc-800 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 font-medium"
                >
                  <option value="">Sin asignar aún</option>
                  {tecnicosDisponibles
                    .filter((t) => {
                      const empresaCliente = clientes.find((c) => String(c.id) === String(crearClienteId))?.empresa_id;
                      return !empresaCliente || t.empresa_id === empresaCliente;
                    })
                    .map((t) => (
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
                  value={crearFechaProgramada}
                  onChange={(e) => setCrearFechaProgramada(e.target.value)}
                  className="w-full h-10 border border-zinc-200 rounded-lg px-3 bg-white text-zinc-800 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 font-medium"
                />
              </div>
            </div>

            {plantillasDisponibles.length > 0 && (
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Plantillas de Protocolo</label>
                <div className="max-h-28 overflow-y-auto border border-zinc-200 rounded-lg p-2.5 space-y-1.5 bg-zinc-50/60">
                  {plantillasDisponibles.map((p) => {
                    const checked = selectedPlantillaIds.includes(p.id);
                    return (
                      <label key={p.id} className="flex items-center gap-2 cursor-pointer text-zinc-700 text-xs">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPlantillaIds([...selectedPlantillaIds, p.id]);
                            } else {
                              setSelectedPlantillaIds(selectedPlantillaIds.filter((id) => id !== p.id));
                            }
                          }}
                          className="rounded border-zinc-300 text-teal-600 focus:ring-teal-500"
                        />
                        <span className="truncate">{p.titulo} ({p.tiempo_estimado_minutos} min)</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Descripción / Alcance</label>
              <textarea
                rows={2}
                value={crearDescripcion}
                onChange={(e) => setCrearDescripcion(e.target.value)}
                placeholder="Detalle del requerimiento técnico..."
                className="w-full border border-zinc-200 rounded-lg p-2.5 bg-white text-zinc-800 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-950 font-medium"
              />
            </div>

            <div className="flex gap-2.5 pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setIsCrearOpen(false)}
                className="flex-1 h-10 border border-zinc-200 hover:bg-zinc-50 rounded-lg font-semibold text-zinc-700 text-xs cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={crearLoading}
                className="flex-1 h-10 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg text-xs shadow-2xs transition-colors cursor-pointer"
              >
                {crearLoading ? 'Guardando...' : 'Guardar Orden'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal de Asignación */}
      {selectedAsignar && (
        <AsignarModal
          isOpen={!!selectedAsignar}
          onClose={() => setSelectedAsignar(null)}
          otId={selectedAsignar.id}
          empresaId={selectedAsignar.empresaId}
          onSuccess={fetchFiltersAndList}
        />
      )}

      {/* Modal de Transición */}
      {selectedTransicion && (
        <TransicionModal
          isOpen={!!selectedTransicion}
          onClose={() => setSelectedTransicion(null)}
          otId={selectedTransicion.id}
          estadoActual={selectedTransicion.estado}
          onSuccess={fetchFiltersAndList}
        />
      )}

      {/* Modal de Edición de OT */}
      {selectedEditar && (
        <EditarOtModal
          isOpen={!!selectedEditar}
          onClose={() => setSelectedEditar(null)}
          ot={selectedEditar}
          onSuccess={fetchFiltersAndList}
        />
      )}
    </div>
  );
}
