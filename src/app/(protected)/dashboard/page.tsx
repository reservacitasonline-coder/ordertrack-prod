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
import { DashboardConteos, OrdenTrabajo, Empresa, WorkloadEntry } from '@/types';
import { WorkloadChart } from '@/components/dashboard/WorkloadChart';

const parseUTC = (dateStr: string | null | undefined): Date => {
  if (!dateStr) return new Date();
  if (!dateStr.endsWith('Z') && !dateStr.includes('+')) {
    return new Date(dateStr + 'Z');
  }
  return new Date(dateStr);
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
                      El técnico <strong className="text-zinc-900">{alert.tecnico}</strong> reportó no cumplimiento en: <span className="underline italic">"{alert.item}"</span>.
                    </p>
                    <div className="bg-orange-50/50 border border-orange-100 p-2 rounded text-[11px] text-orange-900 leading-normal">
                      <strong>Justificación:</strong> "{alert.justificacion}"
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
