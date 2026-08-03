'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../layout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { AsignarModal } from '@/components/ordenes/AsignarModal';
import { TransicionModal } from '@/components/ordenes/TransicionModal';
import { KanbanBoard } from '@/components/ordenes/KanbanBoard';
import { apiFetch } from '@/lib/api';
import { ESTADO_COLORS, ESTADO_LABELS, PRIORIDAD_COLORS, PRIORIDAD_LABELS, MOCK_TECNICOS_POR_EMPRESA } from '@/lib/constants';
import { OrdenTrabajo, Cliente, PrioridadOT, EstadoOT, Usuario } from '@/types';

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

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Keyboard shortcut '/' to focus search & open accordion
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsFilterOpen(true);
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
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

  // Routing View States - Default to 'lista' (lista first, kanban second)
  const [activeSubView, setActiveSubView] = useState<'lista' | 'ruteo' | 'kanban'>('lista');
  const [optimizedRutas, setOptimizedRutas] = useState<OrdenTrabajo[]>([]);
  const [loadingRutas, setLoadingRutas] = useState(false);

  // Pagination & Display limits
  const [pageSize, setPageSize] = useState<number>(100);
  const [page, setPage] = useState<number>(1);

  // Filters
  const [filtroCliente, setFiltroCliente] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroPrioridad, setFiltroPrioridad] = useState('');
  const [filtroPlantilla, setFiltroPlantilla] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const hasActiveFilters = Boolean(filtroCliente || filtroEstado || filtroPrioridad || filtroPlantilla || searchQuery.trim());

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

  // Plantillas & Tecnicos available for selection
  const [plantillasDisponibles, setPlantillasDisponibles] = useState<{id: number; titulo: string; tiempo_estimado_minutos: number}[]>([]);
  const [tecnicosDisponibles, setTecnicosDisponibles] = useState<{id: number; nombre: string; email: string}[]>([]);
  const [selectedPlantillaIds, setSelectedPlantillaIds] = useState<number[]>([]);

  // Assignment Modal
  const [selectedAsignar, setSelectedAsignar] = useState<{ id: number; empresaId: number } | null>(null);
  // Transition Modal
  const [selectedTransicion, setSelectedTransicion] = useState<{ id: number; estado: EstadoOT } | null>(null);

  const fetchFiltersAndList = useCallback(async () => {
    // Avoid synchronous cascading render trigger in useEffect
    await Promise.resolve();
    setLoading(true);
    setError(null);
    try {
      // Parallel fetches with page_size parameter to ensure all tickets are loaded
      const promises: [
        Promise<OrdenTrabajo[]>,
        Promise<Cliente[] | null>,
        Promise<{id: number; titulo: string; tiempo_estimado_minutos: number}[]>
      ] = [
        user?.rol === 'tecnico'
          ? apiFetch<OrdenTrabajo[]>('/ordenes')
          : apiFetch<OrdenTrabajo[]>(`/ordenes?page=${page}&page_size=${pageSize}`),
        // Only load clients if non-technician
        user?.rol !== 'tecnico' ? apiFetch<Cliente[]>('/clientes') : Promise.resolve(null),
        apiFetch<{id: number; titulo: string; tiempo_estimado_minutos: number}[]>('/plantillas').catch(() => []),
      ];

      const [ordenesData, clientesData, plantillasData] = await Promise.all(promises);
      setOrdenes(ordenesData);
      if (clientesData) setClientes(clientesData);
      if (plantillasData) setPlantillasDisponibles(plantillasData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar las órdenes de trabajo');
    } finally {
      setLoading(false);
    }
  }, [user, page, pageSize]);

  const fetchOptimizedRutas = useCallback(async () => {
    setLoadingRutas(true);
    try {
      const data = await apiFetch<OrdenTrabajo[]>('/ordenes/planificar-ruta');
      setOptimizedRutas(data);
    } catch (err) {
      console.error('Error al cargar la ruta optimizada:', err);
    } finally {
      setLoadingRutas(false);
    }
  }, []);

  useEffect(() => {
    if (activeSubView === 'ruteo') {
      fetchOptimizedRutas();
    }
  }, [activeSubView, fetchOptimizedRutas]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchFiltersAndList();
    });
  }, [fetchFiltersAndList]);

  // Client-side filtering & sorting by SLA Priority
  const filteredAndSortedOrdenes = useMemo(() => {
    let result = [...ordenes];

    // Filter by Client
    if (filtroCliente) {
      result = result.filter((ot) => ot.cliente.id === Number(filtroCliente));
    }
    // Filter by Status
    if (filtroEstado) {
      result = result.filter((ot) => ot.estado === filtroEstado);
    }
    // Filter by Priority
    if (filtroPrioridad) {
      result = result.filter((ot) => ot.prioridad === filtroPrioridad);
    }
    // Filter by Template / Order Type
    if (filtroPlantilla) {
      const pId = Number(filtroPlantilla);
      result = result.filter(
        (ot) =>
          ot.plantilla_id === pId ||
          ot.plantilla?.id === pId ||
          (ot.plantillas && ot.plantillas.some((p) => p.id === pId))
      );
    }
    // Search query (code, title, client, or template title)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (ot) =>
          ot.codigo_interno.toLowerCase().includes(q) ||
          ot.titulo.toLowerCase().includes(q) ||
          (ot.codigo_externo && ot.codigo_externo.toLowerCase().includes(q)) ||
          ot.cliente.nombre.toLowerCase().includes(q) ||
          (ot.plantilla?.titulo && ot.plantilla.titulo.toLowerCase().includes(q)) ||
          (ot.plantillas && ot.plantillas.some((p) => p.titulo.toLowerCase().includes(q)))
      );
    }

    // Sort by Priority SLA (critica -> alta -> media -> baja)
    return result.sort((a, b) => PRIORIDADES_ORDEN[b.prioridad] - PRIORIDADES_ORDEN[a.prioridad]);
  }, [ordenes, filtroCliente, filtroEstado, filtroPrioridad, filtroPlantilla, searchQuery]);

  const handleCrearOT = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crearClienteId || !crearTitulo || !crearPrioridad) {
      setCrearError('Complete los campos requeridos (Cliente, Título y Prioridad)');
      return;
    }

    setCrearLoading(true);
    setCrearError(null);

    try {
      const newOt = await apiFetch<OrdenTrabajo>('/ordenes', {
        method: 'POST',
        body: JSON.stringify({
          cliente_id: Number(crearClienteId),
          titulo: crearTitulo.trim(),
          codigo_externo: crearCodigoExterno.trim() || undefined,
          prioridad: crearPrioridad,
          estado: crearEstado || 'RECIBIDA',
          tecnico_asignado_id: crearTecnicoId ? Number(crearTecnicoId) : undefined,
          fecha_programada: crearFechaProgramada ? new Date(crearFechaProgramada).toISOString() : undefined,
          plantilla_id: selectedPlantillaIds.length > 0 ? selectedPlantillaIds[0] : undefined,
          plantilla_ids: selectedPlantillaIds.length > 0 ? selectedPlantillaIds : undefined,
          descripcion: crearDescripcion.trim() || undefined,
        }),
      });

      // Sync created OT into localStorage mock array for technician tray
      try {
        const stored = localStorage.getItem('mock_tecnico_ordenes');
        let otsList: any[] = [];
        if (stored) {
          try {
            otsList = JSON.parse(stored);
          } catch {
            otsList = [];
          }
        }
        const clientObj = clientes.find((c) => c.id === Number(crearClienteId));
        const newMock = {
          id: newOt.id || Date.now(),
          codigo_interno: newOt.codigo_interno || `OT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
          equipo: newOt.titulo || crearTitulo || 'Servicio Técnico',
          ubicacion: clientObj?.nombre || 'Sede de Cliente',
          prioridad: newOt.prioridad || crearPrioridad || 'media',
          slaRestanteMinutos: 180,
          estado: newOt.estado || 'RECIBIDA',
          tecnico_asignado_id: newOt.tecnico_asignado?.id || (crearTecnicoId ? Number(crearTecnicoId) : undefined),
        };
        const existsIndex = otsList.findIndex((o: any) => o.id === newMock.id || o.codigo_interno === newMock.codigo_interno);
        if (existsIndex >= 0) {
          otsList[existsIndex] = { ...otsList[existsIndex], ...newMock };
        } else {
          otsList.unshift(newMock);
        }
        localStorage.setItem('mock_tecnico_ordenes', JSON.stringify(otsList));
      } catch (e) {
        console.error('Error caching new OT to localStorage:', e);
      }

      // Clear form
      setCrearClienteId('');
      setCrearTitulo('');
      setCrearCodigoExterno('');
      setCrearPrioridad('media');
      setCrearEstado('RECIBIDA');
      setCrearTecnicoId('');
      setCrearFechaProgramada('');
      setCrearDescripcion('');
      setSelectedPlantillaIds([]);
      setIsCrearOpen(false);

      // Refresh list
      fetchFiltersAndList();
    } catch (err) {
      setCrearError(err instanceof Error ? err.message : 'Error al registrar orden de trabajo');
    } finally {
      setCrearLoading(false);
    }
  };

  const handleOpenCrear = useCallback(async () => {
    setIsCrearOpen(true);
    setCrearError(null);
    setCrearClienteId('');
    setCrearTitulo('');
    setCrearCodigoExterno('');
    setCrearPrioridad('media');
    setCrearEstado('RECIBIDA');
    setCrearTecnicoId('');
    setCrearFechaProgramada('');
    setCrearDescripcion('');
    setSelectedPlantillaIds([]);

    try {
      const [plantillasData, usuariosData] = await Promise.all([
        apiFetch<{id: number; titulo: string; tiempo_estimado_minutos: number}[]>('/plantillas').catch(() => []),
        apiFetch<Usuario[]>('/usuarios').catch(() => []),
      ]);
      setPlantillasDisponibles(plantillasData);

      const techList = usuariosData
        .filter((u) => u.activo && (u.rol === 'tecnico' || u.rol === 'admin' || u.rol === 'operador'))
        .map((u) => ({ id: u.id, nombre: u.nombre, email: u.email }));

      if (techList.length > 0) {
        setTecnicosDisponibles(techList);
      } else {
        const mockTechs = MOCK_TECNICOS_POR_EMPRESA[user?.empresa_id || 1] || [];
        setTecnicosDisponibles(mockTechs);
      }
    } catch {
      setPlantillasDisponibles([]);
      const mockTechs = MOCK_TECNICOS_POR_EMPRESA[user?.empresa_id || 1] || [];
      setTecnicosDisponibles(mockTechs);
    }
  }, [user?.empresa_id]);

  // Check URL query parameters or custom event for quick-create trigger (?crear=true)
  useEffect(() => {
    const handleCustomOpen = () => {
      handleOpenCrear();
    };
    window.addEventListener('open-crear-ot', handleCustomOpen);

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('crear') === 'true') {
        handleOpenCrear();
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }
    }

    return () => {
      window.removeEventListener('open-crear-ot', handleCustomOpen);
    };
  }, [handleOpenCrear]);

  const togglePlantilla = (id: number) => {
    setSelectedPlantillaIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const isOperator = user?.rol === 'admin' || user?.rol === 'superadmin' || user?.rol === 'operador';

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-20">
        <Spinner size="lg" />
        <span className="text-xs text-zinc-500 font-medium mt-3">Cargando catálogo de órdenes...</span>
      </div>
    );
  }

  if (error) {
    return <ErrorMessage message={error} retry={fetchFiltersAndList} />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Title section & action button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-950">Órdenes de Trabajo</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Gestión y seguimiento de OTs priorizadas contractualmente por SLA.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Sub-view selector tabs */}
          {user?.rol !== 'tecnico' && (
            <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 text-xs font-semibold print:hidden">
              <button
                type="button"
                onClick={() => setActiveSubView('lista')}
                className={`px-3 py-1.5 rounded-md transition-all inline-flex items-center gap-1.5 ${
                  activeSubView === 'lista' ? 'bg-white text-teal-700 shadow-2xs font-bold' : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Lista
              </button>
              <button
                type="button"
                onClick={() => setActiveSubView('kanban')}
                className={`px-3 py-1.5 rounded-md transition-all inline-flex items-center gap-1.5 ${
                  activeSubView === 'kanban' ? 'bg-white text-teal-700 shadow-2xs font-bold' : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                Kanban
              </button>
              <button
                type="button"
                onClick={() => setActiveSubView('ruteo')}
                className={`px-3 py-1.5 rounded-md transition-all inline-flex items-center gap-1.5 ${
                  activeSubView === 'ruteo' ? 'bg-white text-teal-700 shadow-2xs font-bold' : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Ruteo Diario
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search & Filter Accordion Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setIsFilterOpen((prev) => !prev)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer border ${
            isFilterOpen || hasActiveFilters
              ? 'bg-teal-50 text-teal-800 border-teal-200/90 ring-2 ring-teal-500/20'
              : 'bg-white text-zinc-700 hover:text-zinc-950 border-zinc-200 hover:border-zinc-300'
          }`}
        >
          {/* Lupa (Magnifying Glass) Icon */}
          <svg className="w-4 h-4 text-teal-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span>Buscar y Filtrar</span>
          {hasActiveFilters && (
            <span className="bg-teal-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full ml-1">
              Filtros activos
            </span>
          )}
          {/* Accordion Arrow Icon */}
          <svg
            className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ml-1 ${isFilterOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOperator && (
          <Button onClick={handleOpenCrear} size="sm" className="h-[38px] px-3.5 text-xs font-bold bg-teal-600 hover:bg-teal-700">
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Crear OT
          </Button>
        )}
      </div>

      {/* Accordion Downward Body */}
      {isFilterOpen && (
        <Card className="flex flex-col md:flex-row md:items-end gap-3 flex-wrap transition-all duration-200 border-teal-200/80 shadow-sm animate-fadeIn">
          <div className="flex-1 min-w-[200px]">
            <Input
              ref={searchInputRef}
              label="Buscar por Código / Título"
              placeholder="Buscar... (Presiona '/' para enfocar)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {user?.rol !== 'tecnico' && (
            <div className="w-full md:w-44">
              <Select
                label="Cliente"
                placeholder="Todos los clientes"
                value={filtroCliente}
                onChange={(e) => setFiltroCliente(e.target.value)}
                options={clientes.map((c) => ({ value: c.id, label: c.nombre }))}
              />
            </div>
          )}

          <div className="w-full md:w-40">
            <Select
              label="Tipo / Plantilla"
              placeholder="Todos los tipos"
              value={filtroPlantilla}
              onChange={(e) => setFiltroPlantilla(e.target.value)}
              options={plantillasDisponibles.map((p) => ({ value: p.id, label: p.titulo }))}
            />
          </div>

          <div className="w-full md:w-32">
            <Select
              label="Estado"
              placeholder="Todos"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              options={Object.entries(ESTADO_LABELS).map(([k, v]) => ({ value: k, label: v }))}
            />
          </div>

          <div className="w-full md:w-32">
            <Select
              label="Prioridad"
              placeholder="Todas"
              value={filtroPrioridad}
              onChange={(e) => setFiltroPrioridad(e.target.value)}
              options={Object.entries(PRIORIDAD_LABELS).map(([k, v]) => ({ value: k, label: v }))}
            />
          </div>

          {hasActiveFilters && (
            <div className="shrink-0">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleResetFilters}
                className="h-[38px] px-3 text-xs"
              >
                <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Limpiar
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Ticket Counter & Pagination Summary Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-600 bg-zinc-50/80 p-3 rounded-xl border border-zinc-200/80">
        <div className="flex items-center gap-2 font-medium">
          <span className="inline-flex items-center justify-center bg-teal-100 text-teal-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
            {filteredAndSortedOrdenes.length} {filteredAndSortedOrdenes.length === 1 ? 'ticket' : 'tickets'}
          </span>
          <span>
            {hasActiveFilters
              ? `filtrados de un total de ${ordenes.length} en esta página`
              : `registrados en el sistema`}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 font-normal">Mostrar:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="bg-white border border-zinc-200 rounded-md px-2 py-1 text-xs font-semibold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value={20}>20 por pág.</option>
              <option value={50}>50 por pág.</option>
              <option value={100}>100 (Todos)</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-2 py-1 rounded border border-zinc-200 bg-white text-zinc-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-100 text-xs"
            >
              ◀ Ant
            </button>
            <span className="px-2 font-semibold text-zinc-800">
              Pág. {page}
            </span>
            <button
              type="button"
              disabled={ordenes.length < pageSize}
              onClick={() => setPage((p) => p + 1)}
              className="px-2 py-1 rounded border border-zinc-200 bg-white text-zinc-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-100 text-xs"
            >
              Sig ▶
            </button>
          </div>
        </div>
      </div>

      {/* Orders Grid / Table */}
      {activeSubView === 'lista' ? (
        filteredAndSortedOrdenes.length === 0 ? (
          <EmptyState
            title="Sin Órdenes de Trabajo"
            description={
              hasActiveFilters
                ? "No se encontraron órdenes que coincidan con los filtros aplicados."
                : "No hay órdenes de trabajo registradas en el sistema."
            }
            action={
              hasActiveFilters ? (
                <Button variant="secondary" size="sm" onClick={handleResetFilters}>
                  Limpiar Filtros
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-5">Código</th>
                      <th className="py-3 px-5">Título / Descripción</th>
                      <th className="py-3 px-5">Tipo de Orden</th>
                      <th className="py-3 px-5">Cliente</th>
                      <th className="py-3 px-5">Prioridad SLA</th>
                      <th className="py-3 px-5">Estado</th>
                      <th className="py-3 px-5">Asignado A</th>
                      <th className="py-3 px-5">Ingreso</th>
                      <th className="py-3 px-5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredAndSortedOrdenes.map((ot) => {
                      const prioColor = PRIORIDAD_COLORS[ot.prioridad];
                      const stateColor = ESTADO_COLORS[ot.estado];
                      return (
                        <tr key={ot.id} className="hover:bg-zinc-50/40 transition-colors">
                          {/* Code */}
                          <td className="py-4 px-5 font-semibold text-zinc-900 leading-none">
                            {ot.codigo_interno}
                            {ot.codigo_externo && (
                              <span className="block text-[9px] font-normal text-zinc-400 mt-1.5">
                                Ext: {ot.codigo_externo}
                              </span>
                            )}
                          </td>
                          {/* Title */}
                          <td className="py-4 px-5">
                            <span className="font-medium text-zinc-950 text-[13px] block truncate max-w-[220px]">
                              {ot.titulo}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-medium tracking-wide uppercase mt-1 inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                              Vía {ot.canal}
                            </span>
                          </td>
                          {/* Tipo de Orden (Plantilla) */}
                          <td className="py-4 px-5">
                            {ot.plantillas && ot.plantillas.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {ot.plantillas.map((p) => (
                                  <span
                                    key={p.id}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60 max-w-[170px] truncate"
                                    title={p.titulo}
                                  >
                                    <span className="shrink-0 text-[9px]">📋</span>
                                    <span className="truncate">{p.titulo}</span>
                                  </span>
                                ))}
                              </div>
                            ) : ot.plantilla?.titulo ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60 max-w-[170px] truncate"
                                title={ot.plantilla.titulo}
                              >
                                <span className="shrink-0 text-[9px]">📋</span>
                                <span className="truncate">{ot.plantilla.titulo}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-100 text-zinc-500 border border-zinc-200/60">
                                Mantto General
                              </span>
                            )}
                          </td>
                          {/* Client */}
                          <td className="py-4 px-5 text-zinc-600 font-medium">{ot.cliente.nombre}</td>
                          {/* Priority */}
                          <td className="py-4 px-5">
                            <Badge bg={prioColor.bg} text={prioColor.text} border={prioColor.border} className="capitalize">
                              {PRIORIDAD_LABELS[ot.prioridad]}
                            </Badge>
                          </td>
                          {/* Status */}
                          <td className="py-4 px-5">
                            <button
                              onClick={() => setSelectedTransicion({ id: ot.id, estado: ot.estado })}
                              className="hover:scale-105 active:scale-[0.98] transition-transform duration-100"
                              title="Cambiar estado"
                            >
                              <Badge bg={stateColor.bg} text={stateColor.text} border={stateColor.border} className="cursor-pointer">
                                {ESTADO_LABELS[ot.estado]}
                              </Badge>
                            </button>
                          </td>
                          {/* Assigned to */}
                          <td className="py-4 px-5 text-zinc-700 font-medium">
                            {ot.tecnico_asignado ? (
                              <span className="text-zinc-800">{ot.tecnico_asignado.nombre}</span>
                            ) : (
                              <span className="text-zinc-400 italic">Sin Asignar</span>
                            )}
                          </td>
                          {/* Reception date */}
                          <td className="py-4 px-5 text-zinc-400">
                            {new Date(ot.fecha_recepcion).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              year: '2-digit',
                            })}
                          </td>
                          {/* Actions */}
                          <td className="py-4 px-5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              {isOperator && (
                                <button
                                  onClick={() => setSelectedAsignar({ id: ot.id, empresaId: ot.empresa_id })}
                                  className="text-[10px] text-teal-700 font-bold border border-teal-200 hover:bg-teal-50 px-2 py-1 rounded-md transition-all shrink-0"
                                >
                                  Asignar
                                </button>
                              )}
                              <Link
                                href={`/ordenes/${ot.id}`}
                                className="text-[10px] text-zinc-700 font-bold border border-zinc-200 hover:bg-zinc-50 px-2 py-1 rounded-md transition-all shrink-0"
                              >
                                Ver Ficha
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Mobile Card List View (Visible on Mobile Only) */}
          <div className="md:hidden flex flex-col gap-3.5">
            {filteredAndSortedOrdenes.map((ot) => {
              const prioColor = PRIORIDAD_COLORS[ot.prioridad];
              const stateColor = ESTADO_COLORS[ot.estado];
              return (
                <Card key={ot.id} className="flex flex-col gap-3.5 p-4 active:bg-zinc-50/50 transition-colors shadow-xs">
                  {/* Header: Code & Date */}
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-zinc-900 font-mono text-[13px]">
                      {ot.codigo_interno}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-medium">
                      {new Date(ot.fecha_recepcion).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: '2-digit',
                        year: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Title & Client */}
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-zinc-950 text-sm leading-snug break-words">
                      {ot.titulo}
                    </span>

                    {/* Tipo de orden / Plantilla */}
                    {((ot.plantillas && ot.plantillas.length > 0) || ot.plantilla?.titulo) ? (
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md w-fit max-w-full truncate">
                        <span className="shrink-0 text-[10px]">📋</span>
                        <span className="truncate">
                          {ot.plantillas && ot.plantillas.length > 0
                            ? ot.plantillas.map((p) => p.titulo).join(', ')
                            : ot.plantilla?.titulo}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] font-medium text-zinc-400 bg-zinc-50 border border-zinc-100 px-2 py-0.5 rounded-md w-fit">
                        <span className="shrink-0 text-[9px]">📋</span>
                        <span>Mantto General</span>
                      </div>
                    )}

                    <span className="text-[10.5px] text-zinc-500 font-medium mt-0.5">
                      Cliente: <span className="text-zinc-800">{ot.cliente.nombre}</span>
                    </span>
                  </div>

                  {/* Badges & Assignment */}
                  <div className="flex flex-wrap gap-2 items-center text-[10.5px]">
                    <Badge bg={prioColor.bg} text={prioColor.text} border={prioColor.border} className="capitalize">
                      {PRIORIDAD_LABELS[ot.prioridad]}
                    </Badge>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTransicion({ id: ot.id, estado: ot.estado });
                      }}
                      className="active:scale-95 transition-transform"
                    >
                      <Badge bg={stateColor.bg} text={stateColor.text} border={stateColor.border}>
                        {ESTADO_LABELS[ot.estado]}
                      </Badge>
                    </button>

                    <div className="ml-auto text-zinc-500 font-medium">
                      {ot.tecnico_asignado ? (
                        <span className="text-zinc-800 font-semibold">{ot.tecnico_asignado.nombre}</span>
                      ) : (
                        <span className="text-zinc-400 italic">Sin asignar</span>
                      )}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="border-t border-zinc-100 pt-3 flex items-center justify-between mt-1">
                    <Link
                      href={`/ordenes/${ot.id}`}
                      className="text-xs text-zinc-700 font-bold border border-zinc-200 hover:bg-zinc-50 px-3 py-1.5 rounded-lg transition-all"
                    >
                      Ver Ficha
                    </Link>

                    {isOperator && (
                      <button
                        onClick={() => setSelectedAsignar({ id: ot.id, empresaId: ot.empresa_id })}
                        className="text-xs text-teal-700 font-bold border border-teal-200 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-all"
                      >
                        Asignar Técnico
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )) : activeSubView === 'kanban' ? (
        <KanbanBoard
          ordenes={filteredAndSortedOrdenes}
          onTransition={async (otId, estadoNuevo) => {
            try {
              await apiFetch(`/ordenes/${otId}/transicion`, {
                method: 'POST',
                body: JSON.stringify({ estado_nuevo: estadoNuevo }),
              });
              fetchFiltersAndList();
            } catch (err) {
              console.error('Error en transición Kanban:', err);
            }
          }}
        />
      ) : loadingRutas ? (
      <div className="flex flex-col justify-center items-center py-20">
        <Spinner size="lg" />
        <span className="text-xs text-zinc-500 font-medium mt-3">Optimizando rutas de traslado hoy...</span>
      </div>
    ) : (
      /* Ruteo Diario View */
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-zinc-900">
        {/* Timeline of sequences */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {(() => {
            const groups: Record<string, OrdenTrabajo[]> = {};
            optimizedRutas.forEach((ot) => {
              const name = ot.tecnico_asignado?.nombre || 'Técnicos Sin Asignar / Pendientes';
              if (!groups[name]) groups[name] = [];
              groups[name].push(ot);
            });

            const groupEntries = Object.entries(groups);
            if (groupEntries.length === 0) {
              return (
                <Card className="p-6 text-center text-xs text-zinc-500 font-medium">
                  No hay rutas planificadas para hoy (se requieren órdenes en estado PROGRAMADA, EN_EJECUCION o ESPERANDO_REPUESTO).
                </Card>
              );
            }

            return groupEntries.map(([techName, ots]) => (
              <Card key={techName} className="flex flex-col gap-4 p-5 shadow-sm">
                <div className="flex justify-between items-center border-b border-zinc-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">👤</span>
                    <h3 className="font-bold text-zinc-900 text-sm">{techName}</h3>
                  </div>
                  <Badge bg="bg-teal-50" text="text-teal-700" border="border-teal-200" className="font-bold text-[10px]">
                    {ots.length} Paradas planificadas
                  </Badge>
                </div>

                <div className="relative border-l-2 border-zinc-200 pl-6 ml-3 flex flex-col gap-6 my-2">
                  {ots.map((ot, idx) => {
                    const prioColor = PRIORIDAD_COLORS[ot.prioridad];
                    const stateColor = ESTADO_COLORS[ot.estado];
                    return (
                      <div key={ot.id} className="relative flex flex-col gap-1 text-xs animate-fade-in">
                        {/* Circular stop counter indicator */}
                        <div className="absolute -left-[35px] top-0.5 w-6 h-6 rounded-full bg-teal-600 border-2 border-white text-white font-bold flex items-center justify-center text-[10px] shadow-sm">
                          {idx + 1}
                        </div>
                        
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-zinc-900 text-sm hover:underline">
                              <Link href={`/ordenes/${ot.id}`}>{ot.titulo}</Link>
                            </span>
                            <span className="text-zinc-500 font-medium">Cliente: <strong className="text-zinc-800">{ot.cliente.nombre}</strong></span>
                            <span className="text-[10px] text-zinc-400 font-mono">📍 Lat/Lng: -33.456, -70.648 (RM Santiago)</span>
                          </div>
                          <div className="flex flex-col gap-1 items-end shrink-0">
                            <Badge bg={prioColor.bg} text={prioColor.text} border={prioColor.border} className="text-[9px] font-bold">
                              {PRIORIDAD_LABELS[ot.prioridad]}
                            </Badge>
                            <Badge bg={stateColor.bg} text={stateColor.text} border={stateColor.border} className="text-[9px]">
                              {ESTADO_LABELS[ot.estado]}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ));
          })()}
        </div>

        {/* Map mockup */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <Card className="p-4 bg-zinc-900 text-white flex flex-col gap-4 h-[450px] relative overflow-hidden shadow-md">
            <div className="z-10 flex flex-col gap-1">
              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest font-mono">Vista Satelital del Ruteo</span>
              <h3 className="text-sm font-bold">Ruta Metropolitana Optimizada</h3>
            </div>

            {/* Grid map drawing using CSS grid/shapes */}
            <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

            {/* SVG visual path mapping representation */}
            <div className="flex-1 flex items-center justify-center relative">
              {/* SVG connection lines */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                <path d="M 50 150 L 120 80 L 220 180 L 180 280" fill="none" stroke="#0ea5e9" strokeWidth="3" strokeDasharray="6" />
                <path d="M 50 150 L 150 250 L 250 100" fill="none" stroke="#f43f5e" strokeWidth="3" strokeDasharray="6" />
              </svg>

              {/* Simulated markers */}
              <div className="absolute top-[80px] left-[120px] flex flex-col items-center">
                <span className="w-5 h-5 rounded-full bg-sky-500 border-2 border-white flex items-center justify-center text-[9px] font-bold shadow-md">1</span>
                <span className="text-[8px] bg-zinc-800/80 px-1 rounded mt-0.5 whitespace-nowrap">Parada 1</span>
              </div>

              <div className="absolute top-[180px] left-[220px] flex flex-col items-center">
                <span className="w-5 h-5 rounded-full bg-sky-500 border-2 border-white flex items-center justify-center text-[9px] font-bold shadow-md">2</span>
                <span className="text-[8px] bg-zinc-800/80 px-1 rounded mt-0.5 whitespace-nowrap">Parada 2</span>
              </div>

              <div className="absolute top-[280px] left-[180px] flex flex-col items-center">
                <span className="w-5 h-5 rounded-full bg-sky-500 border-2 border-white flex items-center justify-center text-[9px] font-bold shadow-md">3</span>
                <span className="text-[8px] bg-zinc-800/80 px-1 rounded mt-0.5 whitespace-nowrap">Parada 3</span>
              </div>

              {/* Base center station icon */}
              <div className="absolute top-[150px] left-[50px] flex flex-col items-center">
                <span className="w-6 h-6 rounded-full bg-teal-500 border-2 border-white flex items-center justify-center text-xs shadow-md">🏢</span>
                <span className="text-[8px] bg-teal-900 px-1 rounded mt-0.5 font-bold whitespace-nowrap">Centro Despacho</span>
              </div>
            </div>

            <div className="z-10 bg-zinc-900 p-3 rounded-xl border border-zinc-900 text-xs flex flex-col gap-1 mt-auto">
              <div className="flex justify-between items-center text-[10px] text-zinc-400 uppercase font-mono">
                <span>Distancia total</span>
                <span>Tiempo estimado</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-bold text-teal-400">42.8 km</span>
                <span className="text-sm font-bold text-teal-400">1h 15m</span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-1 leading-normal">
                Ruta estructurada para agrupar paradas por vecindad geográfica, minimizando el kilometraje y consumo de combustible.
              </p>
            </div>
          </Card>
        </div>
      </div>
    )}

      {/* Manual creation Modal */}
      {isCrearOpen && (
        <Modal
          isOpen={isCrearOpen}
          isDirty={!!crearClienteId || !!crearTitulo || !!crearCodigoExterno || !!crearTecnicoId || !!crearFechaProgramada || !!crearDescripcion || selectedPlantillaIds.length > 0}
          onClose={() => setIsCrearOpen(false)}
          title="Crear Nueva Orden de Trabajo Completa"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsCrearOpen(false)} disabled={crearLoading}>
                Cancelar
              </Button>
              <Button onClick={handleCrearOT} isLoading={crearLoading}>
                Crear Orden
              </Button>
            </>
          }
        >
          <form onSubmit={handleCrearOT} className="flex flex-col gap-4">
            {crearError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-medium">
                {crearError}
              </div>
            )}

            {/* General Info */}
            <div className="p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-xl space-y-3">
              <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wide">1. Información Principal</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select
                  label="Cliente Relacionado (Requerido)"
                  placeholder="Seleccione el cliente..."
                  value={crearClienteId}
                  onChange={(e) => setCrearClienteId(e.target.value)}
                  options={clientes.map((c) => ({ value: c.id, label: c.nombre }))}
                  required
                />
                <Input
                  label="Código Externo / Ticket (Opcional)"
                  placeholder="Ej: INC-9842, WO-2026"
                  value={crearCodigoExterno}
                  onChange={(e) => setCrearCodigoExterno(e.target.value)}
                />
              </div>

              <Input
                label="Título de la Orden (Requerido)"
                placeholder="Ej: Mantenimiento Preventivo de Enlace Fibra"
                value={crearTitulo}
                onChange={(e) => setCrearTitulo(e.target.value)}
                required
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select
                  label="Prioridad Interna SLA (Requerido)"
                  value={crearPrioridad}
                  onChange={(e) => setCrearPrioridad(e.target.value as PrioridadOT)}
                  options={Object.entries(PRIORIDAD_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                  required
                />
                <Select
                  label="Estado Inicial"
                  value={crearEstado}
                  onChange={(e) => setCrearEstado(e.target.value as EstadoOT)}
                  options={[
                    { value: 'RECIBIDA', label: 'RECIBIDA (Inbox)' },
                    { value: 'EN_REVISION', label: 'EN REVISIÓN (Triage)' },
                    { value: 'APROBADA', label: 'APROBADA (Lista p/ Programar)' },
                    { value: 'PROGRAMADA', label: 'PROGRAMADA (Agendada)' },
                    { value: 'EN_EJECUCION', label: 'EN EJECUCIÓN (Terreno)' },
                  ]}
                />
              </div>
            </div>

            {/* Assignment and Schedule */}
            <div className="p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-xl space-y-3">
              <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wide">2. Asignación y Fecha</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select
                  label="Técnico Asignado (Opcional)"
                  placeholder="Sin asignar (Pendiente)"
                  value={crearTecnicoId}
                  onChange={(e) => setCrearTecnicoId(e.target.value)}
                  options={tecnicosDisponibles.map((t) => ({ value: t.id, label: `${t.nombre} (${t.email})` }))}
                />
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-600">Fecha / Hora Programada (Opcional)</label>
                  <input
                    type="datetime-local"
                    className="w-full px-3 py-2 text-sm text-zinc-800 bg-white border border-zinc-200 focus:ring-teal-500 rounded-lg shadow-2xs focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-transparent transition-all"
                    value={crearFechaProgramada}
                    onChange={(e) => setCrearFechaProgramada(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Templates */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-600">
                Plantillas de Trabajo Asociadas
                <span className="ml-1.5 text-zinc-400 font-normal">(seleccione una o más)</span>
              </label>
              {plantillasDisponibles.length === 0 ? (
                <div className="text-xs text-zinc-400 italic py-1">No hay plantillas configuradas aún.</div>
              ) : (
                <div className="flex flex-col gap-2 max-h-36 overflow-y-auto pr-1">
                  {plantillasDisponibles.map((p) => {
                    const isChecked = selectedPlantillaIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                          isChecked
                            ? 'border-teal-400 bg-teal-50/60 ring-1 ring-teal-400/30'
                            : 'border-zinc-200 hover:border-zinc-300 bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePlantilla(p.id)}
                          className="mt-0.5 h-3.5 w-3.5 rounded accent-teal-600 shrink-0"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className={`text-xs font-semibold truncate ${isChecked ? 'text-teal-800' : 'text-zinc-700'}`}>
                            {p.titulo}
                          </span>
                          <span className="text-[10px] text-zinc-400">⏱ {p.tiempo_estimado_minutos} min estimados</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
              {selectedPlantillaIds.length > 0 && (
                <span className="text-[10px] text-teal-700 font-semibold">
                  ✓ {selectedPlantillaIds.length} plantilla{selectedPlantillaIds.length > 1 ? 's' : ''} seleccionada{selectedPlantillaIds.length > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-600">Descripción Técnica / Detalles</label>
              <textarea
                rows={3}
                placeholder="Detalles del problema, routers afectados, indicaciones de acceso..."
                className="w-full px-3 py-2 text-sm text-zinc-800 bg-white border border-zinc-200 focus:ring-teal-500 rounded-lg shadow-2xs placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-transparent transition-all"
                value={crearDescripcion}
                onChange={(e) => setCrearDescripcion(e.target.value)}
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Assignment Modal Hook */}
      {selectedAsignar && (
        <AsignarModal
          isOpen={!!selectedAsignar}
          onClose={() => setSelectedAsignar(null)}
          otId={selectedAsignar.id}
          empresaId={selectedAsignar.empresaId}
          onSuccess={fetchFiltersAndList}
        />
      )}

      {/* Transition Modal Hook */}
      {selectedTransicion && (
        <TransicionModal
          isOpen={!!selectedTransicion}
          onClose={() => setSelectedTransicion(null)}
          otId={selectedTransicion.id}
          estadoActual={selectedTransicion.estado}
          onSuccess={fetchFiltersAndList}
        />
      )}
    </div>
  );
}
