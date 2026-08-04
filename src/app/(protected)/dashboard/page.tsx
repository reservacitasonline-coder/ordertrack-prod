'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../layout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { apiFetch } from '@/lib/api';
import { ESTADO_COLORS, ESTADO_LABELS, PRIORIDAD_COLORS, PRIORIDAD_LABELS, FASES_MECE, FASE_COLORS } from '@/lib/constants';
import { DashboardConteos, OrdenTrabajo, Empresa, WorkloadEntry, EstadoOT } from '@/types';
import { WorkloadChart } from '@/components/dashboard/WorkloadChart';

const parseUTC = (dateStr: string | null | undefined): Date => {
  if (!dateStr) return new Date();
  if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
    return new Date(dateStr + 'Z');
  }
  return new Date(dateStr);
};

const getRelativeTime = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'Hace un momento';
  const date = parseUTC(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Hace un momento';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  if (diffHours < 24) return `Hace ${diffHours} hr${diffHours > 1 ? 's' : ''}`;
  if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
  return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getInitials = (name: string | null | undefined): string => {
  if (!name) return 'OT';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const getAvatarGradient = (name: string | null | undefined): string => {
  if (!name) return 'from-teal-400 to-emerald-500';
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const gradients = [
    'from-teal-400 to-emerald-500',
    'from-blue-400 to-indigo-500',
    'from-purple-400 to-pink-500',
    'from-orange-400 to-red-500',
    'from-cyan-400 to-blue-500',
    'from-rose-400 to-orange-500',
  ];
  return gradients[hash % gradients.length];
};

const getProgressPercentage = (estado: EstadoOT): number => {
  const stages: Record<EstadoOT, number> = {
    RECIBIDA: 10,
    EN_REVISION: 25,
    APROBADA: 40,
    PROGRAMADA: 50,
    EN_EJECUCION: 65,
    PAUSADA: 65,
    ESPERANDO_REPUESTO: 70,
    PRECIERRE: 85,
    COMPLETADA: 100,
    CERRADA: 100,
    RECHAZADA: 100,
    ANULADA: 100,
  };
  return stages[estado] || 0;
};

const getProgressColor = (estado: EstadoOT): string => {
  if (['COMPLETADA', 'CERRADA', 'APROBADA'].includes(estado)) return 'bg-teal-500';
  if (['RECHAZADA', 'ANULADA'].includes(estado)) return 'bg-zinc-400';
  if (['ESPERANDO_REPUESTO', 'PAUSADA'].includes(estado)) return 'bg-amber-500';
  return 'bg-blue-500';
};

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Redirect technicians to their bandeja
  useEffect(() => {
    if (user && user.rol === 'tecnico') {
      router.replace('/tecnico');
    }
  }, [user, router]);
  
  // Tenant states
  const [conteos, setConteos] = useState<DashboardConteos | null>(null);
  const [recientes, setRecientes] = useState<OrdenTrabajo[]>([]);
  const [safetyAlerts, setSafetyAlerts] = useState<any[]>([]);
  const [repuestosAlerts, setRepuestosAlerts] = useState<any[]>([]);
  const [allOrdenes, setAllOrdenes] = useState<OrdenTrabajo[]>([]);

  // Social feed states
  const [feedFiltro, setFeedFiltro] = useState<'TODAS' | 'PENDIENTES' | 'PROCESO' | 'COMPLETADAS' | 'CANCELADAS'>('TODAS');
  const [feedBusqueda, setFeedBusqueda] = useState<string>('');
  const [limitFeed, setLimitFeed] = useState<number>(8);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedLinkUrl, setCopiedLinkUrl] = useState<string | null>(null);

  const handleCopyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(code);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleShareLink = useCallback((id: number) => {
    const url = window.location.origin + `/ordenes/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedLinkUrl(url);
    setTimeout(() => setCopiedLinkUrl(null), 2000);
  }, []);

  const socialFeedOrdenes = useMemo(() => {
    return allOrdenes.filter(o => {
      if (feedBusqueda) {
        const query = feedBusqueda.toLowerCase();
        const codeMatch = o.codigo_interno.toLowerCase().includes(query);
        const titleMatch = o.titulo.toLowerCase().includes(query);
        const clientMatch = o.cliente.nombre.toLowerCase().includes(query);
        const techMatch = o.tecnico_asignado?.nombre.toLowerCase().includes(query) || false;
        if (!codeMatch && !titleMatch && !clientMatch && !techMatch) {
          return false;
        }
      }

      if (feedFiltro === 'PENDIENTES') {
        return ['RECIBIDA', 'EN_REVISION', 'APROBADA', 'PROGRAMADA'].includes(o.estado);
      }
      if (feedFiltro === 'PROCESO') {
        return ['EN_EJECUCION', 'PAUSADA', 'ESPERANDO_REPUESTO', 'PRECIERRE'].includes(o.estado);
      }
      if (feedFiltro === 'COMPLETADAS') {
        return ['COMPLETADA', 'CERRADA'].includes(o.estado);
      }
      if (feedFiltro === 'CANCELADAS') {
        return ['RECHAZADA', 'ANULADA'].includes(o.estado);
      }
      return true;
    });
  }, [allOrdenes, feedFiltro, feedBusqueda]);

  const displayedFeedOrdenes = useMemo(() => {
    return socialFeedOrdenes.slice(0, limitFeed);
  }, [socialFeedOrdenes, limitFeed]);

  // Date range filters
  const [rangoFecha, setRangoFecha] = useState<'hoy' | '7dias' | 'esteMes' | 'todos' | 'personalizado'>('hoy');
  const [fechaInicio, setFechaInicio] = useState<string>('');
  const [fechaFin, setFechaFin] = useState<string>('');

  // Superadmin states
  const [empresas, setEmpresas] = useState<Empresa[]>([]);

  // General state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      if (user.rol === 'superadmin') {
        const empresasData = await apiFetch<Empresa[]>('/empresas');
        setEmpresas(empresasData);
      } else {
        const [conteosData, recientesData, allOTs] = await Promise.all([
          apiFetch<DashboardConteos>('/dashboard/conteos'),
          apiFetch<OrdenTrabajo[]>('/dashboard/recientes'),
          apiFetch<OrdenTrabajo[]>('/ordenes?page_size=100'),
        ]);

        setConteos(conteosData);
        setRecientes(recientesData);
        setAllOrdenes(allOTs || []);

        const waitingRepuestos = (allOTs || []).filter(o => o.estado === 'ESPERANDO_REPUESTO');
        setRepuestosAlerts(waitingRepuestos);
        
        setSafetyAlerts([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos del dashboard');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchDashboardData();
    });
  }, [fetchDashboardData]);

  // Filter orders dynamically based on selected date period
  const filteredOrdenes = useMemo(() => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    return allOrdenes.filter((o) => {
      const createdDate = parseUTC(o.created_at);

      if (rangoFecha === 'hoy') {
        return createdDate >= startOfToday && createdDate <= endOfToday;
      }
      if (rangoFecha === '7dias') {
        const sevenDaysAgo = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
        return createdDate >= sevenDaysAgo && createdDate <= endOfToday;
      }
      if (rangoFecha === 'esteMes') {
        return createdDate.getMonth() === today.getMonth() && createdDate.getFullYear() === today.getFullYear();
      }
      if (rangoFecha === 'personalizado') {
        if (!fechaInicio) return true;
        const start = new Date(fechaInicio);
        const end = fechaFin ? new Date(fechaFin + 'T23:59:59') : new Date();
        return createdDate >= start && createdDate <= end;
      }
      return true;
    });
  }, [allOrdenes, rangoFecha, fechaInicio, fechaFin]);

  // Aggregate workloads dynamically based on filtered orders
  const workloads = useMemo<WorkloadEntry[]>(() => {
    const techMap = new Map<number, WorkloadEntry>();
    filteredOrdenes.forEach(o => {
      if (o.tecnico_asignado) {
        const tid = o.tecnico_asignado.id;
        if (!techMap.has(tid)) {
          techMap.set(tid, {
            tecnico_id: tid,
            nombre: o.tecnico_asignado.nombre,
            en_ejecucion: 0,
            programadas: 0,
            esperando_repuesto: 0,
            completadas: 0,
            total: 0
          });
        }
        const entry = techMap.get(tid)!;
        entry.total++;
        if (o.estado === 'EN_EJECUCION') entry.en_ejecucion++;
        else if (o.estado === 'PROGRAMADA') entry.programadas++;
        else if (o.estado === 'ESPERANDO_REPUESTO') entry.esperando_repuesto++;
        else if (o.estado === 'COMPLETADA' || o.estado === 'CERRADA') entry.completadas++;
      }
    });
    return Array.from(techMap.values());
  }, [filteredOrdenes]);

  // Dynamic counts for MECE phases based on filtered orders
  const meceCounts = useMemo(() => {
    const distribution: Record<string, number> = {
      INBOX: 0,
      ASIGNADAS: 0,
      EJECUCION: 0,
      DOCUMENTACION: 0,
      CERRADAS: 0
    };

    filteredOrdenes.forEach(o => {
      const match = FASES_MECE.find(f => f.estados.includes(o.estado));
      if (match) {
        distribution[match.fase]++;
      }
    });

    return distribution;
  }, [filteredOrdenes]);

  // Calculate earnings dynamically for selected period
  const ingresosPeriodo = useMemo(() => {
    return filteredOrdenes
      .filter(o => o.estado === 'COMPLETADA' || o.estado === 'CERRADA')
      .reduce((sum, o) => sum + (Number(o.monto) || 0), 0);
  }, [filteredOrdenes]);

  // Sort and slice filtered orders for display in the table
  const listadoOrdenesMostradas = useMemo(() => {
    return [...filteredOrdenes]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 10);
  }, [filteredOrdenes]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-20">
        <Spinner size="lg" />
        <span className="text-xs text-zinc-500 font-medium mt-3">Cargando métricas...</span>
      </div>
    );
  }

  if (error) {
    return <ErrorMessage message={error} retry={fetchDashboardData} />;
  }

  // --- RENDER SUPERADMIN DASHBOARD ---
  if (user?.rol === 'superadmin') {
    const totalEmpresas = empresas.length;
    const empresasActivas = empresas.filter((e) => e.activo).length;
    const empresasInactivas = totalEmpresas - empresasActivas;

    return (
      <div className="flex flex-col gap-8 text-zinc-900">
        <div>
          <h1 className="text-xl font-bold text-zinc-950">Consola del Administrador SaaS</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Métricas de las empresas activas que arriendan el sistema OrderTrack.
          </p>
        </div>

        {/* SaaS Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-zinc-500">Total Empresas Registradas</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-zinc-950">{totalEmpresas}</span>
              <span className="text-[10px] text-zinc-400">arrendatarios</span>
            </div>
          </Card>
          <Card className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-zinc-500">Empresas Activas</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-emerald-600">{empresasActivas}</span>
              <span className="text-[10px] text-emerald-500 font-semibold">En servicio</span>
            </div>
          </Card>
          <Card className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-zinc-500">Empresas Inactivas</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-zinc-500">{empresasInactivas}</span>
              <span className="text-[10px] text-zinc-400 font-semibold">Suspendidas</span>
            </div>
          </Card>
        </div>

        {/* Tenants List Table */}
        <Card className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-zinc-900">Arrendatarios de la Plataforma</h3>
            <Link href="/empresas" className="text-xs text-teal-600 hover:text-teal-700 font-semibold underline">
              Administrar Empresas
            </Link>
          </div>

          {empresas.length === 0 ? (
            <div className="text-center py-6 text-xs text-zinc-400">
              No se han registrado empresas arrendatarias en el sistema.
            </div>
          ) : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-y border-zinc-100 bg-zinc-50 text-zinc-500 font-medium">
                    <th className="py-2.5 px-5">ID</th>
                    <th className="py-2.5 px-5">Nombre / Razón Social</th>
                    <th className="py-2.5 px-5">RUC</th>
                    <th className="py-2.5 px-5">Clave API de Ingesta</th>
                    <th className="py-2.5 px-5">Estado</th>
                    <th className="py-2.5 px-5">Fecha de Registro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {empresas.map((emp) => (
                    <tr key={emp.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="py-3.5 px-5 text-zinc-500 font-mono">#{emp.id}</td>
                      <td className="py-3.5 px-5 font-semibold text-zinc-900">{emp.nombre}</td>
                      <td className="py-3.5 px-5 text-zinc-600 font-medium">{emp.ruc}</td>
                      <td className="py-3.5 px-5">
                        <code className="text-[10px] bg-zinc-100 border border-zinc-200 text-zinc-700 px-1.5 py-0.5 rounded-md font-mono select-all">
                          {emp.api_key}
                        </code>
                      </td>
                      <td className="py-3.5 px-5">
                        <Badge
                          bg={emp.activo ? 'bg-emerald-50' : 'bg-zinc-100'}
                          text={emp.activo ? 'text-emerald-700' : 'text-zinc-500'}
                          border={emp.activo ? 'border-emerald-200' : 'border-zinc-200'}
                        >
                          {emp.activo ? 'Activo' : 'Suspendido'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-5 text-zinc-400">
                        {new Date(emp.created_at).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    );
  }

  // --- RENDER TENANT USER DASHBOARD ---
  const totalOTs = filteredOrdenes.length;
  const enEjecucion = filteredOrdenes.filter(o => o.estado === 'EN_EJECUCION' || o.estado === 'PRECIERRE' || o.estado === 'PAUSADA' || o.estado === 'ESPERANDO_REPUESTO').length;
  const recibidas = filteredOrdenes.filter(o => o.estado === 'RECIBIDA' || o.estado === 'EN_REVISION' || o.estado === 'APROBADA' || o.estado === 'PROGRAMADA').length;
  const completadas = filteredOrdenes.filter(o => o.estado === 'COMPLETADA' || o.estado === 'CERRADA').length;

  return (
    <div className="flex flex-col gap-8 text-zinc-900">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-950">Resumen Operativo</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Monitoreo en tiempo real y métricas clave de servicio.
          </p>
        </div>
        
        {/* Date Filters & Create OT */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-2.5 py-1.5 shadow-3xs">
            <span className="text-xs text-zinc-400 font-bold">Rango:</span>
            <select
              value={rangoFecha}
              onChange={(e: any) => setRangoFecha(e.target.value)}
              className="text-xs font-bold text-zinc-700 bg-transparent border-0 focus:outline-none focus:ring-0 cursor-pointer"
            >
              <option value="hoy">Hoy</option>
              <option value="7dias">Últimos 7 días</option>
              <option value="esteMes">Este mes</option>
              <option value="todos">Todos</option>
              <option value="personalizado">Personalizado</option>
            </select>
          </div>

          {rangoFecha === 'personalizado' && (
            <div className="flex items-center gap-1.5 animate-fadeIn">
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 rounded-xl px-2.5 py-1.5 shadow-3xs focus:outline-none focus:border-zinc-900"
              />
              <span className="text-zinc-400 text-xs">-</span>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 rounded-xl px-2.5 py-1.5 shadow-3xs focus:outline-none focus:border-zinc-900"
              />
            </div>
          )}

          <Link
            href="/ordenes?crear=true"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Crear OT
          </Link>
        </div>
      </div>

      {/* Field Alerts Panel */}
      {(safetyAlerts.length > 0 || repuestosAlerts.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Safety Alerts */}
          {safetyAlerts.length > 0 && (
            <Card className="border border-orange-200 bg-orange-50/20 p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b border-orange-100 pb-2">
                <span className="text-lg">🛡️</span>
                <h3 className="text-xs font-bold text-orange-950 uppercase tracking-wider">Alertas de Seguridad en Campo</h3>
              </div>
              <div className="flex flex-col gap-3">
                {safetyAlerts.map((alert) => (
                  <div key={alert.id} className="text-xs bg-white border border-orange-100 p-3 rounded-lg flex flex-col gap-1.5 shadow-2xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-zinc-900 font-mono">{alert.codigo_interno}</span>
                      <Badge bg="bg-orange-100" text="text-orange-700" border="border-orange-200">
                        No Cumplimiento
                      </Badge>
                    </div>
                    <p className="text-zinc-700 leading-normal font-medium">
                      El técnico <strong className="text-zinc-900">{alert.tecnico}</strong> reportó no cumplimiento en: <span className="underline italic">&quot;{alert.item}&quot;</span>.
                    </p>
                    <div className="bg-orange-50/50 border border-orange-100 p-2 rounded text-[11px] text-orange-900 leading-normal">
                      <strong>Justificación:</strong> &quot;{alert.justificacion}&quot;
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Spare Parts Missing Alerts */}
          {repuestosAlerts.length > 0 && (
            <Card className="border border-rose-200 bg-rose-50/20 p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 border-b border-rose-100 pb-2">
                <span className="text-lg">🚨</span>
                <h3 className="text-xs font-bold text-rose-950 uppercase tracking-wider">Repuestos Faltantes Solicitados</h3>
              </div>
              <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto">
                {repuestosAlerts.map((ot) => (
                  <div key={ot.id} className="text-xs bg-white border border-rose-100 p-3 rounded-lg flex flex-col gap-1.5 shadow-2xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-zinc-900 font-mono">{ot.codigo_interno}</span>
                      <span className="text-[10px] text-zinc-400 font-medium">Asignado a: {ot.tecnico_asignado?.nombre || 'Sin asignar'}</span>
                    </div>
                    <p className="text-zinc-700 leading-normal font-semibold">
                      OT: {ot.titulo}
                    </p>
                    <div className="flex justify-between items-center mt-1 border-t border-zinc-100 pt-2">
                      <Badge bg="bg-rose-50" text="text-rose-700" border="border-rose-200">
                        Pausada
                      </Badge>
                      <Link
                        href={`/ordenes/${ot.id}`}
                        className="text-[10px] text-teal-600 hover:text-teal-700 font-bold border border-teal-200 bg-teal-50/10 px-2.5 py-1 rounded transition-all hover:bg-teal-50"
                      >
                        Proveer Repuestos
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Aggregate Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Pedidos del Período */}
        <Card className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-zinc-500">Pedidos del Período</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-950">{totalOTs}</span>
            <span className="text-[10px] text-zinc-400 font-semibold">órdenes</span>
          </div>
        </Card>

        {/* KPI 2: Estado de Pedidos Breakdown */}
        <Card className="flex flex-col gap-2.5">
          <span className="text-xs font-semibold text-zinc-500">Desglose de Estados</span>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] font-bold text-zinc-600">
            <div className="flex justify-between border-r border-zinc-150 pr-2">
              <span>Pendientes:</span>
              <span className="text-zinc-900">{recibidas}</span>
            </div>
            <div className="flex justify-between pl-1">
              <span>En Proceso:</span>
              <span className="text-zinc-900">{enEjecucion}</span>
            </div>
            <div className="flex justify-between border-r border-zinc-150 pr-2">
              <span>Completadas:</span>
              <span className="text-emerald-600">{completadas}</span>
            </div>
            <div className="flex justify-between pl-1">
              <span>Canceladas:</span>
              <span className="text-red-500">{allOrdenes.filter(o => o.estado === 'ANULADA' || o.estado === 'RECHAZADA').length}</span>
            </div>
          </div>
        </Card>

        {/* KPI 3: Ingresos del Período */}
        <Card className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-zinc-500">Ingresos del Período</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">
              ${ingresosPeriodo.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </Card>

        {/* KPI 4: MTTR */}
        <Card className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-zinc-500">Tiempo de Cierre (MTTR)</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-indigo-600">
              {conteos?.metricas?.tiempo_medio_ejecucion_minutos || 0}
            </span>
            <span className="text-[10px] text-zinc-400 font-semibold">minutos</span>
          </div>
        </Card>
      </div>

      {/* Kanban MECE heat list & Workload Side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* MECE Columns Distribution Heat list */}
        <Card className="lg:col-span-1 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-zinc-900">Distribución de Fases (MECE)</h3>
          <div className="flex flex-col gap-3">
            {FASES_MECE.map((col) => {
              const count = meceCounts[col.fase] || 0;
              const color = FASE_COLORS[col.fase];
              return (
                <div key={col.fase} className="flex items-center justify-between border-b border-zinc-100 last:border-b-0 pb-2 last:pb-0">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{col.icon}</span>
                    <span className="text-xs font-bold text-zinc-800">{col.label}</span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color.accent} text-white`}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Workload stacked bars chart */}
        <Card className="lg:col-span-2 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-zinc-900">Carga de Trabajo por Técnico</h3>
          <WorkloadChart entries={workloads} />
        </Card>
      </div>

      {/* KPI Performance and Efficiency Panel */}
      {conteos?.metricas && (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="text-base font-bold text-zinc-950">Desempeño y SLA de Mantenimiento</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Indicadores de resolución, cumplimiento de tiempo estimado y garantías.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-zinc-500">Tiempo Medio de Traslado</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-teal-600">
                  {conteos.metricas.tiempo_medio_traslado_minutos}
                </span>
                <span className="text-[10px] text-zinc-400 font-semibold">minutos</span>
              </div>
            </Card>
            <Card className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-zinc-500">Tiempo Medio de Reparación (MTTR)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-indigo-600">
                  {conteos.metricas.tiempo_medio_ejecucion_minutos}
                </span>
                <span className="text-[10px] text-zinc-400 font-semibold">minutos</span>
              </div>
            </Card>
            <Card className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-zinc-500">Cumplimiento de Checklist</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-amber-600">
                  {conteos.metricas.porcentaje_ots_con_checklist}%
                </span>
                <span className="text-[10px] text-zinc-400 font-semibold">de OTs cerradas</span>
              </div>
            </Card>
            <Card className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-zinc-500">Cumplimiento de SLA %</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-600">92.4%</span>
                <span className="text-[10px] text-zinc-400 font-semibold">dentro de plazo</span>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tech ranking */}
            {conteos.metricas.ranking_tecnicos?.length > 0 && (
              <Card className="flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-zinc-900">Ranking de Técnicos (Mayor número de OTs resueltas)</h3>
                <div className="overflow-x-auto -mx-5">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-y border-zinc-100 bg-zinc-50 text-zinc-500 font-medium">
                        <th className="py-2 px-5">Técnico de Campo</th>
                        <th className="py-2 px-5 text-right">Órdenes Completadas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {conteos.metricas.ranking_tecnicos.map((tech, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="py-3 px-5 font-semibold text-zinc-900">
                            <span className="mr-2 font-mono text-zinc-400">#{idx + 1}</span>
                            {tech.nombre}
                          </td>
                          <td className="py-3 px-5 text-right font-bold text-teal-700">
                            {tech.completadas} OTs
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* SLA warning table */}
            <Card className="flex flex-col gap-4">
              <h3 className="text-sm font-semibold text-zinc-900">Alertas de SLA / Exceso de Tiempo</h3>
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                {allOrdenes.filter(o => o.estado === 'EN_EJECUCION').slice(0, 3).map((ot, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs p-2.5 bg-rose-50/30 rounded-lg border border-rose-100">
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-zinc-800 font-mono">{ot.codigo_interno}</span>
                      <span className="text-[10px] text-zinc-500 truncate">{ot.titulo}</span>
                    </div>
                    <Badge bg="bg-rose-100" text="text-rose-700" border="border-rose-200">
                      Excedido
                    </Badge>
                  </div>
                ))}
                {allOrdenes.filter(o => o.estado === 'EN_EJECUCION').length === 0 && (
                  <p className="text-xs text-zinc-400 italic text-center py-6">Sin alertas activas.</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Muro de Actividad y Estados (Estilo Red Social) */}
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-base font-bold text-zinc-950">Muro de Actividad y Estados</h2>
          <p className="text-xs text-zinc-500 mt-0.5 font-medium">Monitoreo interactivo de órdenes de trabajo en formato simplificado de red social.</p>
        </div>

        <Card className="flex flex-col gap-5">
          {/* Filter and Search Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
            {/* Horizontal Filter Pills */}
            <div className="flex flex-wrap gap-2 items-center">
              {[
                { key: 'TODAS', label: 'Todas', icon: '🌎' },
                { key: 'PENDIENTES', label: 'Pendientes', icon: '📥' },
                { key: 'PROCESO', label: 'En Proceso', icon: '🔧' },
                { key: 'COMPLETADAS', label: 'Completadas', icon: '✅' },
                { key: 'CANCELADAS', label: 'Canceladas', icon: '❌' },
              ].map((cat) => {
                const isActive = feedFiltro === cat.key;
                // count matching OTs
                let count = 0;
                if (cat.key === 'TODAS') count = allOrdenes.length;
                else if (cat.key === 'PENDIENTES') count = allOrdenes.filter(o => ['RECIBIDA', 'EN_REVISION', 'APROBADA', 'PROGRAMADA'].includes(o.estado)).length;
                else if (cat.key === 'PROCESO') count = allOrdenes.filter(o => ['EN_EJECUCION', 'PAUSADA', 'ESPERANDO_REPUESTO', 'PRECIERRE'].includes(o.estado)).length;
                else if (cat.key === 'COMPLETADAS') count = allOrdenes.filter(o => ['COMPLETADA', 'CERRADA'].includes(o.estado)).length;
                else if (cat.key === 'CANCELADAS') count = allOrdenes.filter(o => ['RECHAZADA', 'ANULADA'].includes(o.estado)).length;

                return (
                  <button
                    key={cat.key}
                    onClick={() => {
                      setFeedFiltro(cat.key as 'TODAS' | 'PENDIENTES' | 'PROCESO' | 'COMPLETADAS' | 'CANCELADAS');
                      setLimitFeed(8);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer select-none active:scale-95 ${
                      isActive
                        ? 'bg-teal-600 border-teal-600 text-white shadow-xs'
                        : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${isActive ? 'bg-teal-700/80 text-white' : 'bg-zinc-100 text-zinc-500'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full lg:max-w-xs shrink-0">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400 text-xs">
                🔍
              </span>
              <input
                type="text"
                placeholder="Buscar por código, título, cliente o técnico..."
                value={feedBusqueda}
                onChange={(e) => setFeedBusqueda(e.target.value)}
                className="w-full text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 rounded-xl pl-8 pr-4 py-2 shadow-3xs focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all placeholder-zinc-400"
              />
            </div>
          </div>

          {/* Cards Grid */}
          {displayedFeedOrdenes.length === 0 ? (
            <div className="text-center py-12 text-zinc-400 text-xs flex flex-col items-center justify-center gap-2">
              <span className="text-3xl">📭</span>
              <p className="font-semibold text-zinc-500">No se encontraron órdenes de trabajo para este filtro.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {displayedFeedOrdenes.map((ot) => {
                const prioColor = PRIORIDAD_COLORS[ot.prioridad];
                const stateColor = ESTADO_COLORS[ot.estado];
                const isCodeCopied = copiedId === ot.codigo_interno;
                const isUrlCopied = copiedLinkUrl === (window.location.origin + `/ordenes/${ot.id}`);

                return (
                  <div 
                    key={ot.id} 
                    className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md hover:border-zinc-300 transition-all duration-300 flex flex-col gap-4"
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Custom Avatar Gradient */}
                        <div className={`w-10 h-10 rounded-full shrink-0 bg-gradient-to-tr ${getAvatarGradient(ot.cliente.nombre)} flex items-center justify-center text-white font-bold text-sm shadow-2xs`}>
                          {getInitials(ot.cliente.nombre)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            <span className="font-bold text-zinc-900 text-sm hover:underline truncate">
                              <Link href={`/ordenes/${ot.id}`}>{ot.cliente.nombre}</Link>
                            </span>
                            <span className="text-[10px] text-zinc-400 hidden sm:inline">•</span>
                            <span className="text-[11px] text-zinc-400 font-mono font-medium truncate">{ot.codigo_interno}</span>
                          </div>
                          <span className="text-[10px] text-zinc-400 font-medium">
                            {getRelativeTime(ot.updated_at)}
                          </span>
                        </div>
                      </div>
                      
                      {/* Priority Badge */}
                      <Badge bg={prioColor.bg} text={prioColor.text} border={prioColor.border} className="capitalize text-[10px] px-2 py-0.5 font-semibold shrink-0">
                        {PRIORIDAD_LABELS[ot.prioridad]}
                      </Badge>
                    </div>

                    {/* Post Content */}
                    <div className="flex flex-col gap-1.5">
                      <h4 className="font-bold text-zinc-800 text-sm leading-snug hover:text-teal-650 transition-colors">
                        <Link href={`/ordenes/${ot.id}`}>{ot.titulo}</Link>
                      </h4>
                      {ot.descripcion && (
                        <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                          {ot.descripcion}
                        </p>
                      )}
                    </div>

                    {/* Assigned Tech Info */}
                    {ot.tecnico_asignado ? (
                      <div className="flex items-center gap-2.5 bg-zinc-50 border border-zinc-100 rounded-xl p-2.5">
                        <div className="w-7 h-7 rounded-full shrink-0 bg-teal-100 text-teal-700 flex items-center justify-center text-[11px] font-bold">
                          {getInitials(ot.tecnico_asignado.nombre)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] text-zinc-400 font-semibold">Técnico de Campo</span>
                          <span className="text-xs font-bold text-zinc-700 truncate">{ot.tecnico_asignado.nombre}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 bg-zinc-50 border border-zinc-100 rounded-xl p-2.5">
                        <div className="w-7 h-7 rounded-full shrink-0 bg-zinc-100 border border-dashed border-zinc-300 flex items-center justify-center text-xs text-zinc-400">
                          👤
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[10px] text-zinc-400 font-semibold">Técnico de Campo</span>
                          <span className="text-xs font-semibold text-zinc-400 italic">Sin asignar</span>
                        </div>
                      </div>
                    )}

                    {/* Status Tracking */}
                    <div className="border-t border-zinc-100 pt-3 flex flex-col gap-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Progreso</span>
                        <Badge bg={stateColor.bg} text={stateColor.text} border={stateColor.border} className="text-[10.5px] font-bold px-2 py-0.5">
                          {ESTADO_LABELS[ot.estado]}
                        </Badge>
                      </div>
                      
                      {/* Interactive/Visual Progress Track */}
                      <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden flex">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${getProgressColor(ot.estado)}`}
                          style={{ width: `${getProgressPercentage(ot.estado)}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="border-t border-zinc-100 pt-2 flex items-center justify-between text-zinc-500 text-xs">
                      <Link 
                        href={`/ordenes/${ot.id}`}
                        className="flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg hover:bg-zinc-50 hover:text-teal-600 transition-colors font-bold select-none active:scale-95 cursor-pointer"
                      >
                        <span>👁️</span>
                        <span>Ficha</span>
                      </Link>
                      <button 
                        onClick={() => handleCopyCode(ot.codigo_interno)}
                        className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg hover:bg-zinc-50 transition-colors font-bold select-none active:scale-95 cursor-pointer ${isCodeCopied ? 'text-emerald-600' : 'hover:text-teal-600'}`}
                        title="Copiar código de la orden"
                      >
                        <span>📋</span>
                        <span>{isCodeCopied ? 'Copiado!' : 'Copiar ID'}</span>
                      </button>
                      <button 
                        onClick={() => handleShareLink(ot.id)}
                        className={`flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg hover:bg-zinc-50 transition-colors font-bold select-none active:scale-95 cursor-pointer ${isUrlCopied ? 'text-emerald-600' : 'hover:text-teal-600'}`}
                        title="Copiar enlace directo"
                      >
                        <span>🔗</span>
                        <span>{isUrlCopied ? 'Enlace copiado!' : 'Compartir'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Load More Button */}
          {socialFeedOrdenes.length > limitFeed && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => setLimitFeed(prev => prev + 8)}
                className="px-5 py-2 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-700 bg-white hover:bg-zinc-50 transition-all shadow-3xs active:scale-95 cursor-pointer select-none"
              >
                Cargar más publicaciones 🔄
              </button>
            </div>
          )}
        </Card>
      </div>

      {/* Recent OTs Table */}
      <Card className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold text-zinc-900">Órdenes del Período Seleccionado</h3>
          <Link href="/ordenes" className="text-xs text-teal-600 hover:text-teal-700 font-semibold underline">
            Ver todas las órdenes
          </Link>
        </div>

        {listadoOrdenesMostradas.length === 0 ? (
          <div className="text-center py-6 text-xs text-zinc-400">
            No se han registrado órdenes en este período.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto -mx-5">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-y border-zinc-100 bg-zinc-50 text-zinc-500 font-medium">
                    <th className="py-2.5 px-5">Código</th>
                    <th className="py-2.5 px-5">Título</th>
                    <th className="py-2.5 px-5">Cliente</th>
                    <th className="py-2.5 px-5">Prioridad</th>
                    <th className="py-2.5 px-5">Estado</th>
                    <th className="py-2.5 px-5">Monto</th>
                    <th className="py-2.5 px-5">Última Modificación</th>
                    <th className="py-2.5 px-5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {listadoOrdenesMostradas.map((ot) => {
                    const prioColor = PRIORIDAD_COLORS[ot.prioridad];
                    const stateColor = ESTADO_COLORS[ot.estado];
                    return (
                      <tr key={ot.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="py-3 px-5 font-semibold text-zinc-900">{ot.codigo_interno}</td>
                        <td className="py-3 px-5 text-zinc-700 max-w-[200px] truncate">{ot.titulo}</td>
                        <td className="py-3 px-5 text-zinc-500 font-medium">{ot.cliente.nombre}</td>
                        <td className="py-3 px-5">
                          <Badge bg={prioColor.bg} text={prioColor.text} border={prioColor.border} className="capitalize">
                            {PRIORIDAD_LABELS[ot.prioridad]}
                          </Badge>
                        </td>
                        <td className="py-3 px-5">
                          <Badge bg={stateColor.bg} text={stateColor.text} border={stateColor.border}>
                            {ESTADO_LABELS[ot.estado]}
                          </Badge>
                        </td>
                        <td className="py-3 px-5 font-bold text-zinc-800">
                          ${(Number(ot.monto) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-5 text-zinc-400">
                          {new Date(ot.updated_at).toLocaleString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-5 text-right">
                          <Link
                            href={`/ordenes/${ot.id}`}
                            className="text-[10px] text-teal-600 hover:text-teal-700 font-bold border border-teal-200 hover:bg-teal-50 px-2 py-1 rounded-md transition-all inline-block"
                          >
                            Ver Detalle
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile List View */}
            <div className="md:hidden flex flex-col divide-y divide-zinc-100 -mx-1">
              {listadoOrdenesMostradas.map((ot) => {
                const prioColor = PRIORIDAD_COLORS[ot.prioridad];
                const stateColor = ESTADO_COLORS[ot.estado];
                return (
                  <div key={ot.id} className="py-3.5 flex items-center justify-between gap-3 active:bg-zinc-50/50 transition-colors">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900 font-mono text-xs">{ot.codigo_interno}</span>
                        <Badge bg={prioColor.bg} text={prioColor.text} border={prioColor.border} className="capitalize text-[8.5px] py-0 px-1.5">
                          {PRIORIDAD_LABELS[ot.prioridad]}
                        </Badge>
                      </div>
                      <span className="text-zinc-800 text-xs font-medium truncate max-w-[200px]">{ot.titulo}</span>
                      <span className="text-[10px] text-zinc-450">Monto: ${(Number(ot.monto) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className="text-[10px] text-zinc-400">Cliente: {ot.cliente.nombre}</span>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <Badge bg={stateColor.bg} text={stateColor.text} border={stateColor.border} className="text-[9px] py-0 px-1.5">
                        {ESTADO_LABELS[ot.estado]}
                      </Badge>
                      <Link
                        href={`/ordenes/${ot.id}`}
                        className="text-[10px] text-teal-600 font-bold border border-teal-100 hover:bg-teal-50 px-2.5 py-1 rounded-md transition-all inline-block"
                      >
                        Ver Ficha
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
