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
import { ESTADO_COLORS, ESTADO_LABELS, PRIORIDAD_COLORS, PRIORIDAD_LABELS, FASES_MECE } from '@/lib/constants';
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

  // Redirect technicians to their operational inbox
  useEffect(() => {
    if (user && user.rol === 'tecnico') {
      router.replace('/tecnico');
    }
  }, [user, router]);

  // Tenant states
  const [conteos, setConteos] = useState<DashboardConteos | null>(null);
  const [safetyAlerts, setSafetyAlerts] = useState<{ id: number; codigo_interno: string; tecnico: string; item: string; justificacion: string }[]>([]);
  const [repuestosAlerts, setRepuestosAlerts] = useState<OrdenTrabajo[]>([]);
  const [allOrdenes, setAllOrdenes] = useState<OrdenTrabajo[]>([]);

  // Date range filters
  const [rangoFecha, setRangoFecha] = useState<'hoy' | '7dias' | 'esteMes' | 'todos' | 'personalizado'>('esteMes');
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
        setEmpresas(empresasData || []);
      } else {
        const [conteosData, allOTs] = await Promise.all([
          apiFetch<DashboardConteos>('/dashboard/conteos'),
          apiFetch<OrdenTrabajo[]>('/ordenes?page_size=100'),
        ]);

        setConteos(conteosData);
        setAllOrdenes(allOTs || []);

        const waitingRepuestos = (allOTs || []).filter((o) => o.estado === 'ESPERANDO_REPUESTO');
        setRepuestosAlerts(waitingRepuestos);
        setSafetyAlerts([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al sincronizar datos del panel');
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
    filteredOrdenes.forEach((o) => {
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
            total: 0,
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
      CERRADAS: 0,
    };

    filteredOrdenes.forEach((o) => {
      const match = FASES_MECE.find((f) => f.estados.includes(o.estado));
      if (match) {
        distribution[match.fase]++;
      }
    });

    return distribution;
  }, [filteredOrdenes]);

  // Operational metrics
  const totalOTs = filteredOrdenes.length;
  const enEjecucion = filteredOrdenes.filter((o) =>
    ['EN_EJECUCION', 'PRECIERRE', 'PAUSADA', 'ESPERANDO_REPUESTO'].includes(o.estado)
  ).length;
  const recibidas = filteredOrdenes.filter((o) =>
    ['RECIBIDA', 'EN_REVISION', 'APROBADA', 'PROGRAMADA'].includes(o.estado)
  ).length;
  const completadas = filteredOrdenes.filter((o) =>
    ['COMPLETADA', 'CERRADA'].includes(o.estado)
  ).length;

  const tasaResolucion = totalOTs > 0 ? Math.round((completadas / totalOTs) * 100) : 0;

  // Calculate earnings dynamically for selected period
  const ingresosPeriodo = useMemo(() => {
    return filteredOrdenes
      .filter((o) => o.estado === 'COMPLETADA' || o.estado === 'CERRADA')
      .reduce((sum, o) => sum + (Number(o.monto) || 0), 0);
  }, [filteredOrdenes]);

  const ticketPromedio = completadas > 0 ? ingresosPeriodo / completadas : 0;

  // Sort and slice filtered orders for display in the table
  const listadoOrdenesMostradas = useMemo(() => {
    return [...filteredOrdenes]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 8);
  }, [filteredOrdenes]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-24">
        <Spinner size="lg" />
        <span className="text-xs text-zinc-500 font-medium tracking-wide mt-3">
          Sincronizando telemetría operativa...
        </span>
      </div>
    );
  }

  if (error) {
    return <ErrorMessage message={error} retry={fetchDashboardData} />;
  }

  // =========================================================================
  // --- SUPERADMIN VIEW: CONSOLA DE GESTIÓN GLOBAL SAAS ---
  // =========================================================================
  if (user?.rol === 'superadmin') {
    const totalEmpresas = empresas.length;
    const empresasActivas = empresas.filter((e) => e.activo).length;
    const empresasInactivas = totalEmpresas - empresasActivas;
    const tasaActividad = totalEmpresas > 0 ? Math.round((empresasActivas / totalEmpresas) * 100) : 100;

    return (
      <div className="flex flex-col gap-6 text-zinc-900 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-zinc-200 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-zinc-950 tracking-tight">Consola Ejecutiva de Plataforma SaaS</h1>
              <Badge bg="bg-zinc-100" text="text-zinc-800" border="border-zinc-200">
                Superadmin
              </Badge>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Supervisión consolidada de inquilinos corporativos, licencias activas y métricas de infraestructura.
            </p>
          </div>
          <Link
            href="/empresas"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Gestionar Empresas
          </Link>
        </div>

        {/* Executive SaaS KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 flex flex-col justify-between gap-3 border border-zinc-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Total Inquilinos Registrados
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-zinc-950 tabular-nums">{totalEmpresas}</span>
              <span className="text-xs text-zinc-500 font-medium">contratistas</span>
            </div>
            <div className="text-[11px] text-zinc-400 border-t border-zinc-100 pt-2">
              Empresas dadas de alta en base de datos
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between gap-3 border border-zinc-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Empresas Operativas
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-zinc-950 tabular-nums">{empresasActivas}</span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                En servicio
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 border-t border-zinc-100 pt-2">
              Acceso habilitado al servicio de campo
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between gap-3 border border-zinc-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Cuentas Suspendidas
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-zinc-950 tabular-nums">{empresasInactivas}</span>
              <span className="text-xs text-zinc-500 font-medium">inactivas</span>
            </div>
            <div className="text-[11px] text-zinc-400 border-t border-zinc-100 pt-2">
              Sin consumo de recursos ni licencias activas
            </div>
          </Card>

          <Card className="p-4 flex flex-col justify-between gap-3 border border-zinc-200/90 shadow-2xs">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Ratio de Actividad Plataforma
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold text-zinc-950 tabular-nums">{tasaActividad}%</span>
              <span className="text-xs text-zinc-600 font-medium">efectividad</span>
            </div>
            <div className="text-[11px] text-zinc-400 border-t border-zinc-100 pt-2">
              Proporción de cuentas activas sobre el padrón
            </div>
          </Card>
        </div>

        {/* Tenants List Table */}
        <Card className="p-0 border border-zinc-200/90 overflow-hidden shadow-2xs">
          <div className="px-5 py-4 border-b border-zinc-200 flex justify-between items-center bg-zinc-50/50">
            <div>
              <h2 className="text-sm font-semibold text-zinc-950">Directorio de Empresas Arrendatarias</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Control de inquilinos, licencias e identificadores fiscales.</p>
            </div>
            <Link
              href="/empresas"
              className="text-xs text-zinc-700 hover:text-zinc-950 font-semibold underline underline-offset-4"
            >
              Ver todas las empresas →
            </Link>
          </div>

          {empresas.length === 0 ? (
            <div className="text-center py-12 text-xs text-zinc-400">
              No se registran empresas arrendatarias configuradas en la plataforma.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/80 text-zinc-500 font-medium text-[11px]">
                    <th className="py-2.5 px-5">ID</th>
                    <th className="py-2.5 px-5">Razón Social / Inquilino</th>
                    <th className="py-2.5 px-5">RUC Fiscal</th>
                    <th className="py-2.5 px-5">Estado Operativo</th>
                    <th className="py-2.5 px-5">Fecha de Alta</th>
                    <th className="py-2.5 px-5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {empresas.map((emp) => (
                    <tr key={emp.id} className="hover:bg-zinc-50/60 transition-colors">
                      <td className="py-3 px-5 text-zinc-400 font-mono text-[11px]">#{emp.id}</td>
                      <td className="py-3 px-5 font-semibold text-zinc-900">{emp.nombre}</td>
                      <td className="py-3 px-5 text-zinc-600 font-mono text-[11px]">{emp.ruc}</td>
                      <td className="py-3 px-5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            emp.activo
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200/70'
                              : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                          }`}
                        >
                          {emp.activo ? 'Operativo' : 'Suspendido'}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-zinc-500 text-[11px]">
                        {new Date(emp.created_at).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <Link
                          href={`/empresas/${emp.id}`}
                          className="text-[11px] font-semibold text-zinc-700 hover:text-zinc-950 border border-zinc-200 hover:bg-zinc-50 px-2.5 py-1 rounded transition-colors inline-block"
                        >
                          Detalle Tenant
                        </Link>
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

  // =========================================================================
  // --- TENANT VIEW: DASHBOARD EJECUTIVO CORPORATIVO ---
  // =========================================================================
  return (
    <div className="flex flex-col gap-6 text-zinc-900 max-w-7xl">
      {/* 1. Header & Executive Control Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-5 border-b border-zinc-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-zinc-950 tracking-tight">Panel de Control Operativo</h1>
            <span className="text-[10px] font-semibold tracking-wider uppercase text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
              Telemetría en Vivo
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Supervisión integral de servicios técnicos, rendimiento de cuadrillas en campo y cumplimiento de SLA.
          </p>
        </div>

        {/* Date Filter & Fast Action */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Segmented Filter Pills */}
          <div className="inline-flex p-0.5 bg-zinc-100 border border-zinc-200 rounded-lg text-xs">
            <button
              onClick={() => setRangoFecha('hoy')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                rangoFecha === 'hoy'
                  ? 'bg-white text-zinc-950 shadow-2xs font-semibold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => setRangoFecha('7dias')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                rangoFecha === '7dias'
                  ? 'bg-white text-zinc-950 shadow-2xs font-semibold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              7 Días
            </button>
            <button
              onClick={() => setRangoFecha('esteMes')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                rangoFecha === 'esteMes'
                  ? 'bg-white text-zinc-950 shadow-2xs font-semibold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Este Mes
            </button>
            <button
              onClick={() => setRangoFecha('todos')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                rangoFecha === 'todos'
                  ? 'bg-white text-zinc-950 shadow-2xs font-semibold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Histórico
            </button>
            <button
              onClick={() => setRangoFecha('personalizado')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer ${
                rangoFecha === 'personalizado'
                  ? 'bg-white text-zinc-950 shadow-2xs font-semibold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Rango...
            </button>
          </div>

          {/* Custom Date Pickers */}
          {rangoFecha === 'personalizado' && (
            <div className="flex items-center gap-1.5 text-xs">
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-zinc-800 text-xs shadow-2xs focus:outline-none focus:ring-1 focus:ring-zinc-950"
              />
              <span className="text-zinc-400">-</span>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-zinc-200 rounded-lg text-zinc-800 text-xs shadow-2xs focus:outline-none focus:ring-1 focus:ring-zinc-950"
              />
            </div>
          )}

          <Link
            href="/ordenes?crear=true"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition-all shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nueva Orden
          </Link>
        </div>
      </div>

      {/* 2. Executive KPI Telemetry Strip (4 Primary Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Volumen de Servicios */}
        <Card className="p-4 flex flex-col justify-between gap-3 border border-zinc-200/90 shadow-2xs">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Volumen de Servicios
            </span>
            <span className="text-[10px] font-mono text-zinc-400">OTs</span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-zinc-950 tabular-nums">{totalOTs}</span>
              <span className="text-xs text-zinc-500 font-medium">órdenes en período</span>
            </div>
            {/* Resolution Progress Bar */}
            <div className="mt-2.5">
              <div className="flex justify-between text-[10px] font-medium text-zinc-500 mb-1">
                <span>Tasa de Resolución</span>
                <span className="font-semibold text-zinc-800">{tasaResolucion}%</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  style={{ width: `${tasaResolucion}%` }}
                  className="h-full bg-zinc-900 rounded-full transition-all duration-500"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-between items-center text-[10px] text-zinc-500 border-t border-zinc-100 pt-2 font-medium">
            <span>{completadas} resueltas</span>
            <span>·</span>
            <span>{enEjecucion} en campo</span>
            <span>·</span>
            <span>{recibidas} pendientes</span>
          </div>
        </Card>

        {/* KPI 2: Valor Económico de Operación */}
        <Card className="p-4 flex flex-col justify-between gap-3 border border-zinc-200/90 shadow-2xs">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Facturación / Valor Ejecutado
            </span>
            <span className="text-[10px] font-mono text-zinc-400">USD</span>
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-zinc-950 tabular-nums">
                ${ingresosPeriodo.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Valor acumulado por servicios completados y cerrados.
            </p>
          </div>
          <div className="flex justify-between items-center text-[10px] text-zinc-500 border-t border-zinc-100 pt-2 font-medium">
            <span>Ticket Promedio:</span>
            <span className="font-semibold text-zinc-900 tabular-nums">
              ${ticketPromedio.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </Card>

        {/* KPI 3: Tiempo Medio de Reparación (MTTR) */}
        <Card className="p-4 flex flex-col justify-between gap-3 border border-zinc-200/90 shadow-2xs">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Tiempo Medio de Reparación (MTTR)
            </span>
            <span className="text-[10px] font-mono text-zinc-400">Minutos</span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-zinc-950 tabular-nums">
                {conteos?.metricas?.tiempo_medio_ejecucion_minutos || 0}
              </span>
              <span className="text-xs text-zinc-500 font-medium">minutos en sitio</span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Duración promedio de intervención técnica desde llegada hasta precierre.
            </p>
          </div>
          <div className="flex justify-between items-center text-[10px] text-zinc-500 border-t border-zinc-100 pt-2 font-medium">
            <span>Traslado Promedio:</span>
            <span className="font-semibold text-zinc-900 tabular-nums">
              {conteos?.metricas?.tiempo_medio_traslado_minutos || 0} min
            </span>
          </div>
        </Card>

        {/* KPI 4: Confiabilidad y Seguridad */}
        <Card className="p-4 flex flex-col justify-between gap-3 border border-zinc-200/90 shadow-2xs">
          <div className="flex justify-between items-start">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Gobernanza y Checklist
            </span>
            <span className="text-[10px] font-mono text-zinc-400">% Conforme</span>
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-zinc-950 tabular-nums">
                {conteos?.metricas?.porcentaje_ots_con_checklist || 0}%
              </span>
              <span className="text-xs text-zinc-500 font-medium">adherencia</span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              Órdenes cerradas con validación de seguridad y firma digital registrada.
            </p>
          </div>
          <div className="flex justify-between items-center text-[10px] text-zinc-500 border-t border-zinc-100 pt-2 font-medium">
            <span>Excepciones de Repuestos:</span>
            <span className={`font-semibold tabular-nums ${repuestosAlerts.length > 0 ? 'text-amber-700' : 'text-zinc-700'}`}>
              {repuestosAlerts.length} pendientes
            </span>
          </div>
        </Card>
      </div>

      {/* 3. Management by Exception: Alertas Operativas Críticas */}
      {repuestosAlerts.length > 0 && (
        <Card className="p-4 border border-amber-200/90 bg-amber-50/30 flex flex-col gap-3 shadow-2xs">
          <div className="flex items-center justify-between border-b border-amber-200/60 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <h2 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                Gestión de Excepciones: Órdenes Detenidas por Repuestos
              </h2>
            </div>
            <span className="text-[11px] text-amber-800 font-medium">
              {repuestosAlerts.length} orden(es) requieren suministro inmediato
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {repuestosAlerts.map((ot) => (
              <div
                key={ot.id}
                className="bg-white border border-amber-200/70 p-3 rounded-lg flex flex-col justify-between gap-2 shadow-2xs"
              >
                <div>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="font-mono text-xs font-bold text-zinc-900">{ot.codigo_interno}</span>
                    <span className="text-[10px] text-zinc-400 truncate max-w-[120px]">
                      {ot.tecnico_asignado?.nombre || 'Sin asignar'}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-zinc-800 line-clamp-1">{ot.titulo}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5 truncate">Cliente: {ot.cliente?.nombre}</p>
                </div>
                <div className="flex justify-end pt-2 border-t border-zinc-100">
                  <Link
                    href={`/ordenes/${ot.id}`}
                    className="text-[11px] text-zinc-800 hover:text-zinc-950 font-semibold underline underline-offset-2 inline-flex items-center gap-1"
                  >
                    Proveer Repuesto →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 4. MECE Operational Conversion Pipeline (Cadena de Valor del Servicio) */}
      <Card className="p-5 border border-zinc-200/90 shadow-2xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-950">Embudo de Maduración Operativa</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Seguimiento por etapas del ciclo de vida de las órdenes de servicio.
            </p>
          </div>
          <span className="text-xs font-mono text-zinc-400">Total en Proceso: {totalOTs}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
          {FASES_MECE.map((col, idx) => {
            const count = meceCounts[col.fase] || 0;
            const pct = totalOTs > 0 ? Math.round((count / totalOTs) * 100) : 0;

            return (
              <div
                key={col.fase}
                className="bg-zinc-50/70 border border-zinc-200/80 rounded-xl p-3 flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                  <span>0{idx + 1}. {col.label}</span>
                  <span className="text-zinc-400 font-mono text-[10px]">{pct}%</span>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-2xl font-bold text-zinc-950 tabular-nums">{count}</span>
                  <span className="text-[11px] text-zinc-400">OTs</span>
                </div>
                {/* Micro Progress Bar */}
                <div className="w-full h-1 bg-zinc-200 rounded-full overflow-hidden mt-1">
                  <div
                    style={{ width: `${pct}%` }}
                    className="h-full bg-zinc-700 rounded-full transition-all duration-300"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 5. Workload Capacity & Field Productivity Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workload Stacked Analysis */}
        <Card className="lg:col-span-2 p-5 border border-zinc-200/90 shadow-2xs flex flex-col gap-4">
          <div className="flex justify-between items-baseline">
            <div>
              <h2 className="text-sm font-semibold text-zinc-950">Distribución de Capacidad por Técnico</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Carga asignada, servicios en ejecución y balance de cuadrillas.
              </p>
            </div>
            <span className="text-xs font-mono text-zinc-400">{workloads.length} técnicos activos</span>
          </div>
          <WorkloadChart entries={workloads} />
        </Card>

        {/* Technician Productivity Ranking */}
        <Card className="p-5 border border-zinc-200/90 shadow-2xs flex flex-col justify-between gap-4">
          <div>
            <div className="flex justify-between items-baseline mb-2">
              <h2 className="text-sm font-semibold text-zinc-950">Rendimiento de Cuadrillas</h2>
              <span className="text-[10px] uppercase font-semibold text-zinc-400">Top Ejecutores</span>
            </div>
            <p className="text-xs text-zinc-500 mb-3">
              Mayor volumen de órdenes resueltas en el período.
            </p>

            {conteos?.metricas?.ranking_tecnicos && conteos.metricas.ranking_tecnicos.length > 0 ? (
              <div className="divide-y divide-zinc-100 border-t border-zinc-100">
                {conteos.metricas.ranking_tecnicos.map((tech, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-zinc-100 text-zinc-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-zinc-900 truncate">{tech.nombre}</span>
                    </div>
                    <span className="font-mono font-bold text-zinc-900 tabular-nums shrink-0">
                      {tech.completadas} <span className="text-[10px] font-normal text-zinc-400">OTs</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-zinc-400">
                Sin datos de resolución por técnico en este período.
              </div>
            )}
          </div>

          <div className="border-t border-zinc-100 pt-3 flex justify-between items-center text-xs text-zinc-500">
            <span>Cumplimiento estándar</span>
            <span className="font-semibold text-zinc-800">100% de trazabilidad</span>
          </div>
        </Card>
      </div>

      {/* 6. Recent Orders Executive Ledger */}
      <Card className="p-0 border border-zinc-200/90 overflow-hidden shadow-2xs">
        <div className="px-5 py-4 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between bg-zinc-50/50 gap-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-950">Bitácora de Órdenes del Período</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Últimas intervenciones registradas con estado operacional y valor financiero.
            </p>
          </div>
          <Link
            href="/ordenes"
            className="text-xs text-zinc-700 hover:text-zinc-950 font-semibold underline underline-offset-4"
          >
            Ver maestro completo de órdenes →
          </Link>
        </div>

        {listadoOrdenesMostradas.length === 0 ? (
          <div className="text-center py-12 text-xs text-zinc-400">
            No se han registrado órdenes en el período seleccionado.
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50/80 text-zinc-500 font-medium text-[11px]">
                    <th className="py-2.5 px-5">Código OT</th>
                    <th className="py-2.5 px-5">Servicio / Equipo</th>
                    <th className="py-2.5 px-5">Cliente Asignado</th>
                    <th className="py-2.5 px-5">Prioridad</th>
                    <th className="py-2.5 px-5">Estado</th>
                    <th className="py-2.5 px-5 text-right">Monto</th>
                    <th className="py-2.5 px-5">Última Actividad</th>
                    <th className="py-2.5 px-5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {listadoOrdenesMostradas.map((ot) => {
                    const prioColor = PRIORIDAD_COLORS[ot.prioridad];
                    const stateColor = ESTADO_COLORS[ot.estado];
                    return (
                      <tr key={ot.id} className="hover:bg-zinc-50/60 transition-colors">
                        <td className="py-3 px-5 font-mono font-semibold text-zinc-900 text-[11px]">
                          {ot.codigo_interno}
                        </td>
                        <td className="py-3 px-5 text-zinc-800 font-medium max-w-[220px] truncate">
                          {ot.titulo}
                        </td>
                        <td className="py-3 px-5 text-zinc-600">
                          <Link
                            href={`/clientes/${ot.cliente?.id || ''}`}
                            className="hover:underline hover:text-zinc-950"
                          >
                            {ot.cliente?.nombre || 'Cliente General'}
                          </Link>
                        </td>
                        <td className="py-3 px-5">
                          <Badge bg={prioColor.bg} text={prioColor.text} border={prioColor.border} className="capitalize text-[10px]">
                            {PRIORIDAD_LABELS[ot.prioridad]}
                          </Badge>
                        </td>
                        <td className="py-3 px-5">
                          <Badge bg={stateColor.bg} text={stateColor.text} border={stateColor.border} className="text-[10px]">
                            {ESTADO_LABELS[ot.estado]}
                          </Badge>
                        </td>
                        <td className="py-3 px-5 text-right font-mono font-semibold text-zinc-900 tabular-nums">
                          ${(Number(ot.monto) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-5 text-zinc-500 text-[11px]">
                          {new Date(ot.updated_at).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-5 text-right">
                          <Link
                            href={`/ordenes/${ot.id}`}
                            className="text-[11px] font-semibold text-zinc-700 hover:text-zinc-950 border border-zinc-200 hover:bg-zinc-50 px-2 py-1 rounded transition-colors inline-block"
                          >
                            Detalle →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden flex flex-col divide-y divide-zinc-100">
              {listadoOrdenesMostradas.map((ot) => {
                const prioColor = PRIORIDAD_COLORS[ot.prioridad];
                const stateColor = ESTADO_COLORS[ot.estado];
                return (
                  <div key={ot.id} className="p-4 flex items-center justify-between gap-3 active:bg-zinc-50">
                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-xs text-zinc-900">{ot.codigo_interno}</span>
                        <Badge bg={prioColor.bg} text={prioColor.text} border={prioColor.border} className="text-[9px]">
                          {PRIORIDAD_LABELS[ot.prioridad]}
                        </Badge>
                      </div>
                      <span className="text-xs font-medium text-zinc-900 truncate">{ot.titulo}</span>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                        <span>{ot.cliente?.nombre}</span>
                        <span>·</span>
                        <span className="font-mono font-semibold text-zinc-800">
                          ${(Number(ot.monto) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <Badge bg={stateColor.bg} text={stateColor.text} border={stateColor.border} className="text-[10px]">
                        {ESTADO_LABELS[ot.estado]}
                      </Badge>
                      <Link
                        href={`/ordenes/${ot.id}`}
                        className="text-[10px] font-semibold text-zinc-700 border border-zinc-200 px-2 py-1 rounded"
                      >
                        Ver Detalle
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
