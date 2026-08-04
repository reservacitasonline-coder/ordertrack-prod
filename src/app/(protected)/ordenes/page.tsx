'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../layout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { AsignarModal } from '@/components/ordenes/AsignarModal';
import { TransicionModal } from '@/components/ordenes/TransicionModal';
import { KanbanBoard } from '@/components/ordenes/KanbanBoard';
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

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Keyboard shortcut '/' to focus search
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

  // Views - Default to 'lista'
  const [activeSubView, setActiveSubView] = useState<'lista' | 'ruteo' | 'kanban'>('lista');
  const [optimizedRutas, setOptimizedRutas] = useState<OrdenTrabajo[]>([]);
  const [loadingRutas, setLoadingRutas] = useState(false);

  // Pagination & Display limits
  const [pageSize] = useState<number>(100);
  const [page] = useState<number>(1);

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

  const [plantillasDisponibles, setPlantillasDisponibles] = useState<{id: number; titulo: string; tiempo_estimado_minutos: number}[]>([]);
  const [tecnicosDisponibles, setTecnicosDisponibles] = useState<{id: number; nombre: string; email: string}[]>([]);
  const [selectedPlantillaIds, setSelectedPlantillaIds] = useState<number[]>([]);

  // Assignment Modal
  const [selectedAsignar, setSelectedAsignar] = useState<{ id: number; empresaId: number } | null>(null);
  // Transition Modal
  const [selectedTransicion, setSelectedTransicion] = useState<{ id: number; estado: EstadoOT } | null>(null);

  const fetchFiltersAndList = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setError(null);
    try {
      const promises: [
        Promise<OrdenTrabajo[]>,
        Promise<Cliente[] | null>,
        Promise<{id: number; titulo: string; tiempo_estimado_minutos: number}[]>
      ] = [
        user?.rol === 'tecnico'
          ? apiFetch<OrdenTrabajo[]>('/ordenes')
          : apiFetch<OrdenTrabajo[]>(`/ordenes?page=${page}&page_size=${pageSize}`),
        user?.rol !== 'tecnico' ? apiFetch<Cliente[]>('/clientes') : Promise.resolve(null),
        apiFetch<{id: number; titulo: string; tiempo_estimado_minutos: number}[]>('/plantillas').catch(() => []),
      ];

      const [ordenesData, clientesData, plantillasData] = await Promise.all(promises);
      
      let finalOrdenes = Array.isArray(ordenesData) ? ordenesData : [];
      try {
        const stored = localStorage.getItem('mock_tecnico_ordenes');
        if (stored) {
          const localList: any[] = JSON.parse(stored);
          const existingIds = new Set(finalOrdenes.map((o) => o.id));
          const existingCodigos = new Set(finalOrdenes.map((o) => o.codigo_interno));

          const localOnly = localList
            .filter((l) => !existingIds.has(l.id) && !existingCodigos.has(l.codigo_interno))
            .map((l) => ({
              id: l.id || Date.now(),
              codigo_interno: l.codigo_interno || `OT-${l.id}`,
              titulo: l.equipo || l.titulo || 'Servicio Técnico',
              prioridad: l.prioridad || 'media',
              estado: l.estado || 'RECIBIDA',
              cliente_id: l.cliente_id || 1,
              cliente: l.cliente || { id: 1, nombre: l.ubicacion || 'Cliente' },
              creado_en: new Date().toISOString(),
              actualizado_en: new Date().toISOString(),
              plantillas: [],
            } as unknown as OrdenTrabajo));

          finalOrdenes = [...finalOrdenes, ...localOnly];
        }
      } catch (e) {
        console.error('Error merging local mock OTs:', e);
      }

      setOrdenes(finalOrdenes);
      if (clientesData) setClientes(clientesData);
      if (plantillasData) setPlantillasDisponibles(plantillasData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar las órdenes de trabajo');
    } finally {
      setLoading(false);
    }
  }, [user, page, pageSize]);

  useEffect(() => {
    fetchFiltersAndList();
  }, [fetchFiltersAndList]);

  // Load Technicians for modal
  const handleOpenCrear = async () => {
    setIsCrearOpen(true);
    setCrearError(null);
    try {
      const tecs = await apiFetch<{id: number; nombre: string; email: string}[]>('/usuarios/tecnicos');
      setTecnicosDisponibles(tecs || []);
    } catch {
      setTecnicosDisponibles([]);
    }
  };

  const togglePlantilla = (pId: number) => {
    setSelectedPlantillaIds((prev) =>
      prev.includes(pId) ? prev.filter((id) => id !== pId) : [...prev, pId]
    );
  };

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
      setCrearError(err instanceof Error ? err.message : 'Error al crear la orden de trabajo');
    } finally {
      setCrearLoading(false);
    }
  };

  // Filtered & Sorted OT List
  const filteredAndSortedOrdenes = useMemo(() => {
    let result = [...ordenes];

    if (filtroCliente) {
      result = result.filter((ot) => (ot as any).cliente_id === Number(filtroCliente) || ot.cliente.id === Number(filtroCliente));
    }
    if (filtroEstado) {
      result = result.filter((ot) => ot.estado === filtroEstado);
    }
    if (filtroPrioridad) {
      result = result.filter((ot) => ot.prioridad === filtroPrioridad);
    }
    if (filtroPlantilla) {
      const pid = Number(filtroPlantilla);
      result = result.filter((ot) =>
        ot.plantillas?.some((p) => p.id === pid) || (ot as any).plantilla_id === pid
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

    result.sort((a, b) => {
      const prioDiff = PRIORIDADES_ORDEN[b.prioridad] - PRIORIDADES_ORDEN[a.prioridad];
      if (prioDiff !== 0) return prioDiff;
      const dateA = new Date(a.fecha_recepcion || (a as any).creado_en || 0).getTime();
      const dateB = new Date(b.fecha_recepcion || (b as any).creado_en || 0).getTime();
      return dateB - dateA;
    });

    return result;
  }, [ordenes, filtroCliente, filtroEstado, filtroPrioridad, filtroPlantilla, searchQuery]);

  // Fetch optimized routes for 'ruteo' view
  useEffect(() => {
    if (activeSubView === 'ruteo') {
      setLoadingRutas(true);
      apiFetch<OrdenTrabajo[]>('/ordenes/ruteo-optimizado')
        .then((rutas) => {
          setOptimizedRutas(rutas || []);
        })
        .catch(() => {
          setOptimizedRutas(filteredAndSortedOrdenes);
        })
        .finally(() => setLoadingRutas(false));
    }
  }, [activeSubView, filteredAndSortedOrdenes]);

  const isOperator = user?.rol === 'admin' || user?.rol === 'operador' || user?.rol === 'superadmin';

  return (
    /* CONTENEDOR PRINCIPAL MOBILE-FIRST (ANCHO MÁXIMO 430px, CENTRADO, SIN SCROLL HORIZONTAL) */
    <div className="w-full max-w-[420px] mx-auto min-h-screen bg-zinc-50 border border-zinc-200/80 rounded-2xl sm:rounded-[24px] sm:shadow-2xl flex flex-col font-sans text-zinc-900 select-none pb-24 relative overflow-x-hidden">
      
      {/* Header Fijo/Compacto de la Sección Órdenes */}
      <header className="bg-white border-b border-zinc-200/80 p-4 flex flex-col gap-2 shadow-2xs">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 leading-snug">
            Órdenes de Trabajo
          </h1>
          <span className="text-xs font-bold text-green-700 bg-green-50 px-2.5 py-0.5 rounded-full border border-green-200">
            {filteredAndSortedOrdenes.length} OTs
          </span>
        </div>

        {/* Control Segmentado Lista / Ruteo / Kanban */}
        <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200 text-xs font-bold w-full h-10 items-center justify-between gap-1">
          <button
            type="button"
            onClick={() => setActiveSubView('lista')}
            className={`flex-1 h-8 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeSubView === 'lista' ? 'bg-white text-green-700 shadow-xs font-bold' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Lista
          </button>
          <button
            type="button"
            onClick={() => setActiveSubView('kanban')}
            className={`flex-1 h-8 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeSubView === 'kanban' ? 'bg-white text-green-700 shadow-xs font-bold' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Kanban
          </button>
          <button
            type="button"
            onClick={() => setActiveSubView('ruteo')}
            className={`flex-1 h-8 rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeSubView === 'ruteo' ? 'bg-white text-green-700 shadow-xs font-bold' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Ruteo
          </button>
        </div>
      </header>

      <div className="p-4 space-y-4">
        
        {/* Barra de Búsqueda y Filtros Accordion */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsFilterOpen((prev) => !prev)}
            className={`flex-1 h-11 px-3.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-between border cursor-pointer ${
              isFilterOpen || hasActiveFilters
                ? 'bg-green-50 text-green-800 border-green-300 ring-1 ring-green-500/20'
                : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-300'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="truncate">Buscar y Filtrar</span>
            </div>
            {hasActiveFilters && (
              <span className="bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ml-1">
                Filtros
              </span>
            )}
          </button>

          {isOperator && (
            <button
              onClick={handleOpenCrear}
              className="h-11 px-4 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1 shrink-0"
            >
              <span>+ OT</span>
            </button>
          )}
        </div>

        {/* Panel de Filtros Desplegable */}
        {isFilterOpen && (
          <div className="bg-white border border-zinc-200 rounded-[16px] p-4 shadow-xs space-y-3 animate-fadeIn">
            <div>
              <label className="text-[11px] font-bold text-zinc-600 block mb-1">Buscar por Código, Título o Cliente</label>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ej: OT-001, Mantenimiento..."
                className="w-full h-10 border border-zinc-200 rounded-xl px-3 text-xs bg-zinc-50 focus:outline-none focus:border-green-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Estado</label>
                <select
                  value={filtroEstado}
                  onChange={(e) => setFiltroEstado(e.target.value)}
                  className="w-full h-9 border border-zinc-200 rounded-lg px-2 text-xs bg-white focus:outline-none focus:border-green-600"
                >
                  <option value="">Todos los Estados</option>
                  {Object.entries(ESTADO_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-500 uppercase block mb-1">Prioridad</label>
                <select
                  value={filtroPrioridad}
                  onChange={(e) => setFiltroPrioridad(e.target.value)}
                  className="w-full h-9 border border-zinc-200 rounded-lg px-2 text-xs bg-white focus:outline-none focus:border-green-600"
                >
                  <option value="">Todas las Prioridades</option>
                  {Object.entries(PRIORIDAD_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="w-full h-9 border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
              >
                Limpiar Filtros
              </button>
            )}
          </div>
        )}

        {/* LISTA DE TARJETAS DE ÓRDENES */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-xs text-zinc-400 gap-2">
            <Spinner size="md" />
            <span>Cargando órdenes de trabajo...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700">
            ⚠️ {error}
          </div>
        ) : filteredAndSortedOrdenes.length === 0 ? (
          <EmptyState
            title="Sin órdenes de trabajo"
            description="No se encontraron órdenes que coincidan con los criterios."
          />
        ) : activeSubView === 'lista' ? (
          <div className="space-y-3">
            {filteredAndSortedOrdenes.map((ot) => {
              const prioColor = PRIORIDAD_COLORS[ot.prioridad];
              const stateColor = ESTADO_COLORS[ot.estado];
              const isOngoing = ot.estado === 'EN_EJECUCION';

              return (
                <div
                  key={ot.id}
                  className={`rounded-[16px] p-4 border transition-all space-y-3 shadow-xs ${
                    isOngoing
                      ? 'bg-[#FFF4E5] border-orange-200/90'
                      : 'bg-white border-zinc-200'
                  }`}
                >
                  {/* Encabezado Tarjeta */}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-zinc-800 bg-white/80 px-2 py-0.5 rounded border border-zinc-200 truncate max-w-[140px]">
                      {ot.codigo_interno}
                    </span>

                    {/* Badge de Estatus */}
                    {isOngoing ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-red-100 text-red-700 border border-red-200 shrink-0">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        En curso
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-green-50 text-green-800 border border-green-200 shrink-0">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        {ESTADO_LABELS[ot.estado] || 'Activa'}
                      </span>
                    )}
                  </div>

                  {/* Título & Cliente */}
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-zinc-900 leading-snug truncate">
                      {ot.titulo}
                    </h3>
                    <p className="text-xs text-zinc-600 truncate font-medium">
                      📍 Cliente: <strong className="text-zinc-800">{ot.cliente.nombre}</strong>
                    </p>
                  </div>

                  {/* Badges de Prioridad y Técnico */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-100">
                    <Badge bg={prioColor.bg} text={prioColor.text} border={prioColor.border} className="capitalize text-[10px]">
                      {PRIORIDAD_LABELS[ot.prioridad]}
                    </Badge>
                    <span className="text-[11px] font-medium text-zinc-500 truncate max-w-[150px]">
                      👤 {ot.tecnico_asignado?.nombre || 'Sin asignar'}
                    </span>
                  </div>

                  {/* Acciones de la Tarjeta */}
                  <div className="flex gap-2 w-full pt-1">
                    <Link
                      href={user?.rol === 'tecnico' ? `/tecnico/ordenes/${ot.id}` : `/ordenes/${ot.id}`}
                      className="flex-1 h-10 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-xl text-xs font-bold flex items-center justify-center transition-all active:scale-95"
                    >
                      Ver Ficha
                    </Link>

                    {isOperator && (
                      <button
                        onClick={() => setSelectedAsignar({ id: ot.id, empresaId: ot.empresa_id })}
                        className="flex-1 h-10 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold flex items-center justify-center transition-all active:scale-95 shadow-xs"
                      >
                        Asignar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : activeSubView === 'kanban' ? (
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
        ) : (
          /* Ruteo Diario */
          <div className="space-y-3">
            {loadingRutas ? (
              <div className="flex items-center justify-center py-8 text-xs text-zinc-400 gap-2">
                <Spinner size="md" />
                <span>Optimizando rutas de traslado...</span>
              </div>
            ) : (
              optimizedRutas.map((ot, idx) => (
                <div key={ot.id} className="bg-white border border-zinc-200 rounded-[16px] p-4 shadow-xs space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-green-600 text-white font-bold text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <h4 className="text-xs font-bold text-zinc-900 truncate flex-1">
                      {ot.titulo}
                    </h4>
                  </div>
                  <p className="text-xs text-zinc-600 truncate pl-8">
                    📍 {ot.cliente.nombre}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

      </div>

      {/* Modal de Creación de OT */}
      {isCrearOpen && (
        <Modal isOpen={isCrearOpen} onClose={() => setIsCrearOpen(false)} title="Crear Orden de Trabajo">
          <form onSubmit={handleCrearOTSubmit} className="space-y-3 text-xs">
            {crearError && (
              <div className="p-2 bg-red-50 text-red-700 font-bold rounded-lg">{crearError}</div>
            )}
            <div>
              <label className="block font-bold text-zinc-600 mb-1">Cliente *</label>
              <select
                value={crearClienteId}
                onChange={(e) => setCrearClienteId(e.target.value)}
                className="w-full h-10 border border-zinc-200 rounded-xl px-3 bg-white"
                required
              >
                <option value="">Seleccionar Cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold text-zinc-600 mb-1">Título / Equipo *</label>
              <input
                type="text"
                value={crearTitulo}
                onChange={(e) => setCrearTitulo(e.target.value)}
                className="w-full h-10 border border-zinc-200 rounded-xl px-3 bg-white"
                required
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCrearOpen(false)}
                className="flex-1 h-11 border border-zinc-200 rounded-xl font-bold text-zinc-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={crearLoading}
                className="flex-1 h-11 bg-green-600 text-white font-bold rounded-xl"
              >
                {crearLoading ? 'Guardando...' : 'Crear OT'}
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

    </div>
  );
}
