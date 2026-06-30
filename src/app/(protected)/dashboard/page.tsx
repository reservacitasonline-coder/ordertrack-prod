'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '../layout';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { apiFetch } from '@/lib/api';
import { ESTADO_COLORS, ESTADO_LABELS, PRIORIDAD_COLORS, PRIORIDAD_LABELS } from '@/lib/constants';
import { DashboardConteos, OrdenTrabajo, Empresa } from '@/types';

export default function DashboardPage() {
  const { user } = useAuth();
  
  // Tenant states
  const [conteos, setConteos] = useState<DashboardConteos | null>(null);
  const [recientes, setRecientes] = useState<OrdenTrabajo[]>([]);

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
        const [conteosData, recientesData] = await Promise.all([
          apiFetch<DashboardConteos>('/dashboard/conteos'),
          apiFetch<OrdenTrabajo[]>('/dashboard/recientes'),
        ]);
        setConteos(conteosData);
        setRecientes(recientesData);
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
      <div className="flex flex-col gap-8">
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

  // --- RENDER TENANT USER DASHBOARD (Admin, Operador, Técnico) ---
  const totalOTs = conteos ? Object.values(conteos.por_estado).reduce((a, b) => a + b, 0) : 0;
  const enEjecucion = conteos?.por_estado['EN_EJECUCION'] || 0;
  const recibidas = conteos?.por_estado['RECIBIDA'] || 0;
  const completadas = conteos?.por_estado['COMPLETADA'] || 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-950">Resumen Operativo</h1>
        <p className="text-xs text-zinc-500 mt-1">
          Métricas clave y estado de Órdenes de Trabajo en tiempo real.
        </p>
      </div>

      {/* Aggregate Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-zinc-500">Total Órdenes</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-950">{totalOTs}</span>
            <span className="text-[10px] text-zinc-400">registradas</span>
          </div>
        </Card>
        <Card className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-zinc-500">Nuevas (Sin Revisar)</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-950">{recibidas}</span>
            <span className="text-[10px] text-blue-600 font-semibold">Pendientes</span>
          </div>
        </Card>
        <Card className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-zinc-500">En Ejecución</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-950">{enEjecucion}</span>
            <span className="text-[10px] text-emerald-600 font-semibold">En campo</span>
          </div>
        </Card>
        <Card className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-zinc-500">Completadas</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-950">{completadas}</span>
            <span className="text-[10px] text-green-600 font-semibold">Finalizadas</span>
          </div>
        </Card>
      </div>

      {/* Priority Breakdown & Active Statuses */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Priority Counts */}
        <Card className="lg:col-span-1 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-zinc-900">Prioridad del Contrato</h3>
          <div className="flex flex-col gap-3">
            {conteos &&
              Object.entries(conteos.por_prioridad).map(([prio, count]) => {
                const color = PRIORIDAD_COLORS[prio as keyof typeof PRIORIDAD_COLORS];
                return (
                  <div key={prio} className="flex items-center justify-between">
                    <Badge bg={color.bg} text={color.text} border={color.border} className="capitalize">
                      {PRIORIDAD_LABELS[prio as keyof typeof PRIORIDAD_LABELS]}
                    </Badge>
                    <span className="text-sm font-bold text-zinc-800">{count} OTs</span>
                  </div>
                );
              })}
          </div>
        </Card>

        {/* State Counts list */}
        <Card className="lg:col-span-2 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-zinc-900">Estado de Flujo</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {conteos &&
              Object.entries(conteos.por_estado).map(([estado, count]) => {
                const color = ESTADO_COLORS[estado as keyof typeof ESTADO_COLORS];
                return (
                  <div
                    key={estado}
                    className="p-3 border border-zinc-100 rounded-lg flex items-center justify-between bg-zinc-50/50"
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-[10px] font-semibold text-zinc-500 truncate">
                        {ESTADO_LABELS[estado as keyof typeof ESTADO_LABELS]}
                      </span>
                      <span className="text-base font-bold text-zinc-800">{count}</span>
                    </div>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${color.text.replace('text-', 'bg-')}`} />
                  </div>
                );
              })}
          </div>
        </Card>
      </div>

      {/* Recent OTs Table */}
      <Card className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold text-zinc-900">Órdenes Recientemente Modificadas</h3>
          <Link href="/ordenes" className="text-xs text-teal-600 hover:text-teal-700 font-semibold underline">
            Ver todas las órdenes
          </Link>
        </div>

        {recientes.length === 0 ? (
          <div className="text-center py-6 text-xs text-zinc-400">
            No se han registrado órdenes recientemente.
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
                    <th className="py-2.5 px-5">Última Modificación</th>
                    <th className="py-2.5 px-5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {recientes.map((ot) => {
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
              {recientes.map((ot) => {
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
