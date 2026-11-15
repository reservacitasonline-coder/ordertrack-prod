'use client';

import React, { useEffect, useState, useCallback, Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { apiFetch } from '@/lib/api';
import { Equipo, EquipoCategoria, EquipoTipo } from '@/types';

type Tab = 'equipos' | 'tipos' | 'categorias';

function EquiposContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clienteIdParam = searchParams.get('cliente_id');

  const { user } = useAuth();
  const canManage = user?.rol === 'admin' || user?.rol === 'superadmin';
  const [activeTab, setActiveTab] = useState<Tab>('equipos');

  // Filter & Search
  const [clienteFiltro, setClienteFiltro] = useState<string>(clienteIdParam || '');
  const [busqueda, setBusqueda] = useState('');

  // ── Clientes ──────────────────────────────────────────────────────────
  const [clientes, setClientes] = useState<{ id: number; nombre: string; ruc?: string }[]>([]);

  // ── Categorías ───────────────────────────────────────────────────────
  const [categorias, setCategorias] = useState<EquipoCategoria[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState<string | null>(null);
  const [catModal, setCatModal] = useState(false);
  const [catEditId, setCatEditId] = useState<number | null>(null);
  const [catNombre, setCatNombre] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catSaving, setCatSaving] = useState(false);

  // ── Tipos ────────────────────────────────────────────────────────────
  const [tipos, setTipos] = useState<EquipoTipo[]>([]);
  const [tipoLoading, setTipoLoading] = useState(true);
  const [tipoError, setTipoError] = useState<string | null>(null);
  const [tipoModal, setTipoModal] = useState(false);
  const [tipoEditId, setTipoEditId] = useState<number | null>(null);
  const [tipoNombre, setTipoNombre] = useState('');
  const [tipoDesc, setTipoDesc] = useState('');
  const [tipoCategoriaId, setTipoCategoriaId] = useState('');
  const [tipoSaving, setTipoSaving] = useState(false);

  // ── Equipos ──────────────────────────────────────────────────────────
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [equipoLoading, setEquipoLoading] = useState(true);
  const [equipoError, setEquipoError] = useState<string | null>(null);
  const [equipoModal, setEquipoModal] = useState(false);
  const [equipoEditId, setEquipoEditId] = useState<number | null>(null);
  const [equipoSaving, setEquipoSaving] = useState(false);
  const [equipoModalError, setEquipoModalError] = useState<string | null>(null);

  // Form Fields
  const [equipoNombre, setEquipoNombre] = useState('');
  const [equipoSerie, setEquipoSerie] = useState('');
  const [equipoModelo, setEquipoModelo] = useState('');
  const [equipoMarca, setEquipoMarca] = useState('');
  const [equipoTipoId, setEquipoTipoId] = useState('');
  const [equipoClienteId, setEquipoClienteId] = useState(clienteIdParam || '');
  const [equipoArea, setEquipoArea] = useState('');
  const [equipoUbicacion, setEquipoUbicacion] = useState('');
  const [equipoEstado, setEquipoEstado] = useState('OPERATIVO');

  // Quick Tipo Creator inside Equipo Modal
  const [mostrarCrearTipoRapido, setMostrarCrearTipoRapido] = useState(false);
  const [nuevoTipoNombre, setNuevoTipoNombre] = useState('');
  const [nuevoTipoCatId, setNuevoTipoCatId] = useState('');
  const [creandoTipoRapido, setCreandoTipoRapido] = useState(false);

  // Sync with searchParams if URL changes
  useEffect(() => {
    if (clienteIdParam) {
      setClienteFiltro(clienteIdParam);
    }
  }, [clienteIdParam]);

  const fetchCategorias = useCallback(async () => {
    setCatLoading(true);
    setCatError(null);
    try {
      const data = await apiFetch<EquipoCategoria[]>('/equipos/categorias');
      setCategorias(data ?? []);
    } catch (e) {
      setCatError(e instanceof Error ? e.message : 'Error al cargar categorías');
    } finally {
      setCatLoading(false);
    }
  }, []);

  const fetchTipos = useCallback(async () => {
    setTipoLoading(true);
    setTipoError(null);
    try {
      const data = await apiFetch<EquipoTipo[]>('/equipos/tipos');
      setTipos(data ?? []);
    } catch (e) {
      setTipoError(e instanceof Error ? e.message : 'Error al cargar tipos');
    } finally {
      setTipoLoading(false);
    }
  }, []);

  const fetchEquipos = useCallback(async (clienteId?: string) => {
    setEquipoLoading(true);
    setEquipoError(null);
    try {
      const endpoint = clienteId ? `/equipos?cliente_id=${clienteId}` : '/equipos';
      const data = await apiFetch<Equipo[]>(endpoint);
      setEquipos(data ?? []);
    } catch (e) {
      setEquipoError(e instanceof Error ? e.message : 'Error al cargar equipos');
    } finally {
      setEquipoLoading(false);
    }
  }, []);

  const fetchClientes = useCallback(async () => {
    try {
      const data = await apiFetch<{ id: number; nombre: string; ruc?: string }[]>('/clientes');
      setClientes(data ?? []);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchCategorias();
      fetchTipos();
      fetchClientes();
    });
  }, [fetchCategorias, fetchTipos, fetchClientes]);

  useEffect(() => {
    fetchEquipos(clienteFiltro || undefined);
  }, [clienteFiltro, fetchEquipos]);

  // Client selected for filter
  const clienteSeleccionado = useMemo(() => {
    if (!clienteFiltro) return null;
    return clientes.find((c) => String(c.id) === String(clienteFiltro)) || null;
  }, [clientes, clienteFiltro]);

  // Filtered Equipos in UI
  const equiposFiltrados = useMemo(() => {
    if (!busqueda.trim()) return equipos;
    const q = busqueda.toLowerCase().trim();
    return equipos.filter((e) => {
      const matchNombre = e.nombre.toLowerCase().includes(q);
      const matchSerie = (e.numero_serie || '').toLowerCase().includes(q);
      const matchMarca = (e.marca || '').toLowerCase().includes(q);
      const matchModelo = (e.modelo || '').toLowerCase().includes(q);
      const matchArea = (e.area || '').toLowerCase().includes(q);
      const matchCliente = (e.cliente?.nombre || '').toLowerCase().includes(q);
      const matchTipo = (e.tipo?.nombre || '').toLowerCase().includes(q);
      return matchNombre || matchSerie || matchMarca || matchModelo || matchArea || matchCliente || matchTipo;
    });
  }, [equipos, busqueda]);

  // ── Categorías handlers ──────────────────────────────────────────────
  const openCatCreate = () => {
    setCatEditId(null);
    setCatNombre('');
    setCatDesc('');
    setCatModal(true);
  };
  const openCatEdit = (c: EquipoCategoria) => {
    setCatEditId(c.id);
    setCatNombre(c.nombre);
    setCatDesc(c.descripcion ?? '');
    setCatModal(true);
  };
  const handleCatSave = async () => {
    if (!catNombre.trim()) return;
    setCatSaving(true);
    const payload = { nombre: catNombre.trim(), descripcion: catDesc.trim() || null };
    try {
      if (catEditId) {
        await apiFetch(`/equipos/categorias/${catEditId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiFetch('/equipos/categorias', { method: 'POST', body: JSON.stringify(payload) });
      }
      setCatModal(false);
      fetchCategorias();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al guardar categoría');
    } finally {
      setCatSaving(false);
    }
  };
  const handleCatDelete = async (id: number) => {
    if (!confirm('¿Desea desactivar esta categoría de equipos?')) return;
    try {
      await apiFetch(`/equipos/categorias/${id}`, { method: 'DELETE' });
      fetchCategorias();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al eliminar');
    }
  };

  // ── Tipos handlers ───────────────────────────────────────────────────
  const openTipoCreate = () => {
    setTipoEditId(null);
    setTipoNombre('');
    setTipoDesc('');
    setTipoCategoriaId(categorias[0] ? String(categorias[0].id) : '');
    setTipoModal(true);
  };
  const openTipoEdit = (t: EquipoTipo) => {
    setTipoEditId(t.id);
    setTipoNombre(t.nombre);
    setTipoDesc(t.descripcion ?? '');
    setTipoCategoriaId(String(t.categoria_id));
    setTipoModal(true);
  };
  const handleTipoSave = async () => {
    if (!tipoCategoriaId) {
      alert('Selecciona una categoría');
      return;
    }
    if (!tipoNombre.trim()) {
      alert('Ingresa el nombre del tipo');
      return;
    }
    setTipoSaving(true);
    const payload = {
      nombre: tipoNombre.trim(),
      descripcion: tipoDesc.trim() || null,
      categoria_id: Number(tipoCategoriaId),
    };
    try {
      if (tipoEditId) {
        await apiFetch(`/equipos/tipos/${tipoEditId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiFetch('/equipos/tipos', { method: 'POST', body: JSON.stringify(payload) });
      }
      setTipoModal(false);
      fetchTipos();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al guardar tipo');
    } finally {
      setTipoSaving(false);
    }
  };
  const handleTipoDelete = async (id: number) => {
    if (!confirm('¿Desea desactivar este tipo de equipo?')) return;
    try {
      await apiFetch(`/equipos/tipos/${id}`, { method: 'DELETE' });
      fetchTipos();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al eliminar');
    }
  };

  // ── Quick Tipo Creation inside Equipo Modal ─────────────────────────
  const handleCrearTipoRapido = async () => {
    if (!nuevoTipoNombre.trim()) return;
    setCreandoTipoRapido(true);
    try {
      let catId = nuevoTipoCatId ? Number(nuevoTipoCatId) : (categorias[0]?.id || null);
      if (!catId) {
        // Create default category if none exists
        const resCat = await apiFetch<EquipoCategoria>('/equipos/categorias', {
          method: 'POST',
          body: JSON.stringify({ nombre: 'General y Equipos', icono: '🔧' }),
        });
        catId = resCat.id;
        fetchCategorias();
      }

      const resTipo = await apiFetch<EquipoTipo>('/equipos/tipos', {
        method: 'POST',
        body: JSON.stringify({
          nombre: nuevoTipoNombre.trim(),
          categoria_id: catId,
        }),
      });

      await fetchTipos();
      setEquipoTipoId(String(resTipo.id));
      setNuevoTipoNombre('');
      setMostrarCrearTipoRapido(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al crear tipo rápido');
    } finally {
      setCreandoTipoRapido(false);
    }
  };

  // ── Equipos handlers ─────────────────────────────────────────────────
  const openEquipoCreate = () => {
    setEquipoEditId(null);
    setEquipoNombre('');
    setEquipoSerie('');
    setEquipoModelo('');
    setEquipoMarca('');
    setEquipoArea('');
    setEquipoUbicacion('');
    setEquipoEstado('OPERATIVO');
    // Preselect client from URL or active filter
    setEquipoClienteId(clienteFiltro || (clientes[0] ? String(clientes[0].id) : ''));
    setEquipoTipoId(tipos[0] ? String(tipos[0].id) : '');
    setEquipoModalError(null);
    setMostrarCrearTipoRapido(false);
    setEquipoModal(true);
  };

  const openEquipoEdit = (e: Equipo) => {
    setEquipoEditId(e.id);
    setEquipoNombre(e.nombre);
    setEquipoSerie(e.numero_serie ?? '');
    setEquipoModelo(e.modelo ?? '');
    setEquipoMarca(e.marca ?? '');
    setEquipoTipoId(String(e.tipo_id));
    setEquipoClienteId(String(e.cliente_id));
    setEquipoArea(e.area ?? '');
    setEquipoUbicacion(e.ubicacion_detalle ?? '');
    setEquipoEstado(e.estado_operativo ?? 'OPERATIVO');
    setEquipoModalError(null);
    setMostrarCrearTipoRapido(false);
    setEquipoModal(true);
  };

  const handleEquipoSave = async () => {
    if (!equipoClienteId) {
      setEquipoModalError('Debes seleccionar un cliente.');
      return;
    }
    if (!equipoTipoId) {
      setEquipoModalError('Debes seleccionar un tipo de equipo.');
      return;
    }
    if (!equipoNombre.trim()) {
      setEquipoModalError('El nombre del equipo es obligatorio.');
      return;
    }

    setEquipoSaving(true);
    setEquipoModalError(null);

    const payload = {
      nombre: equipoNombre.trim(),
      cliente_id: Number(equipoClienteId),
      tipo_id: Number(equipoTipoId),
      numero_serie: equipoSerie.trim() || null,
      modelo: equipoModelo.trim() || null,
      marca: equipoMarca.trim() || null,
      area: equipoArea.trim() || null,
      ubicacion_detalle: equipoUbicacion.trim() || null,
      estado_operativo: equipoEstado,
    };

    try {
      if (equipoEditId) {
        await apiFetch(`/equipos/${equipoEditId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/equipos', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setEquipoModal(false);
      fetchEquipos(clienteFiltro || undefined);
    } catch (e) {
      setEquipoModalError(e instanceof Error ? e.message : 'Error al guardar el equipo');
    } finally {
      setEquipoSaving(false);
    }
  };

  const handleEquipoDelete = async (id: number) => {
    if (!confirm('¿Desea dar de baja este equipo del inventario?')) return;
    try {
      await apiFetch(`/equipos/${id}`, { method: 'DELETE' });
      fetchEquipos(clienteFiltro || undefined);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al eliminar equipo');
    }
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'equipos', label: 'Equipos en Campo', count: equipos.length },
    { key: 'tipos', label: 'Tipos de Equipo', count: tipos.length },
    { key: 'categorias', label: 'Categorías', count: categorias.length },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-zinc-950">Gestión de Equipos</h1>
            {clienteSeleccionado && (
              <Badge bg="bg-teal-50" text="text-teal-700" border="border-teal-200">
                Cliente: {clienteSeleccionado.nombre}
              </Badge>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Catálogo e inventario de maquinarias, activos y equipos instalados en sedes de clientes.
          </p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            {activeTab === 'categorias' && (
              <Button onClick={openCatCreate}>
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Nueva Categoría
              </Button>
            )}
            {activeTab === 'tipos' && (
              <Button onClick={openTipoCreate}>
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Nuevo Tipo
              </Button>
            )}
            {activeTab === 'equipos' && (
              <Button onClick={openEquipoCreate}>
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Nuevo Equipo
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Filter notification if cliente_id is present */}
      {clienteSeleccionado && (
        <div className="flex items-center justify-between p-3.5 bg-teal-50/70 border border-teal-200 rounded-xl text-xs text-teal-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="text-base">🏢</span>
            <span>
              Filtrando activos del cliente: <strong>{clienteSeleccionado.nombre}</strong> (RUC: {clienteSeleccionado.ruc || 'S/N'})
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/clientes/${clienteSeleccionado.id}`}
              className="text-xs text-teal-700 hover:text-teal-900 font-semibold hover:underline"
            >
              Ver Ficha de Cliente →
            </Link>
            <button
              onClick={() => {
                setClienteFiltro('');
                router.replace('/equipos');
              }}
              className="text-xs text-zinc-600 hover:text-zinc-950 font-bold bg-white px-2.5 py-1 rounded-lg border border-zinc-200 shadow-2xs transition-all cursor-pointer"
            >
              Ver Todos los Clientes ✕
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 gap-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`pb-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === t.key
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === t.key ? 'bg-teal-100 text-teal-800' : 'bg-zinc-100 text-zinc-600'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Equipos Tab ──────────────────────────────────────────────── */}
      {activeTab === 'equipos' && (
        <div className="flex flex-col gap-4">
          {/* Controls: Search & Client Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-zinc-200 shadow-2xs">
            <div className="flex-1 max-w-md relative">
              <input
                type="text"
                placeholder="Buscar por nombre, serie, marca, modelo o cliente..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs text-zinc-800 bg-zinc-50/50 border border-zinc-200 rounded-lg placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
              />
              <svg className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-medium shrink-0">Cliente:</span>
              <select
                value={clienteFiltro}
                onChange={(e) => {
                  const val = e.target.value;
                  setClienteFiltro(val);
                  if (val) {
                    router.replace(`/equipos?cliente_id=${val}`);
                  } else {
                    router.replace('/equipos');
                  }
                }}
                className="text-xs bg-zinc-50 border border-zinc-200 text-zinc-800 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all font-medium"
              >
                <option value="">Todos los clientes ({clientes.length})</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Loading / Error / Empty States */}
          {equipoLoading && (
            <div className="flex flex-col justify-center items-center py-16">
              <Spinner size="lg" />
              <span className="text-xs text-zinc-500 font-medium mt-3">Cargando inventario de equipos...</span>
            </div>
          )}

          {equipoError && <ErrorMessage message={equipoError} retry={() => fetchEquipos(clienteFiltro || undefined)} />}

          {!equipoLoading && !equipoError && equiposFiltrados.length === 0 && (
            <EmptyState
              title={busqueda ? 'No se encontraron equipos' : 'Sin equipos registrados'}
              description={
                busqueda
                  ? 'No hay equipos que coincidan con la búsqueda actual.'
                  : clienteSeleccionado
                  ? `El cliente "${clienteSeleccionado.nombre}" aún no tiene equipos vinculados.`
                  : 'Aún no se han registrado equipos para su empresa. Haga clic en "+ Nuevo Equipo" para comenzar.'
              }
              action={
                canManage && !busqueda ? (
                  <Button onClick={openEquipoCreate}>
                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Registrar Primer Equipo
                  </Button>
                ) : undefined
              }
            />
          )}

          {/* Equipos Table */}
          {!equipoLoading && !equipoError && equiposFiltrados.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Equipo / Activo</th>
                      <th className="py-3 px-4">Tipo & Categoría</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Nº Serie & Marca</th>
                      <th className="py-3 px-4">Ubicación / Área</th>
                      <th className="py-3 px-4">Estado</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {equiposFiltrados.map((e) => {
                      const tipoLabel = e.tipo?.nombre ?? 'General';
                      const catLabel = e.tipo?.categoria?.nombre;
                      const clienteNombre = e.cliente?.nombre ?? clientes.find((c) => c.id === e.cliente_id)?.nombre ?? `Cliente #${e.cliente_id}`;
                      const estado = e.estado_operativo || 'OPERATIVO';

                      let estadoBadge = { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Operativo' };
                      if (estado === 'EN_MANTENIMIENTO') {
                        estadoBadge = { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Mantenimiento' };
                      } else if (estado === 'FUERA_DE_SERVICIO') {
                        estadoBadge = { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'Fuera de Servicio' };
                      }

                      return (
                        <tr key={e.id} className="hover:bg-zinc-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-zinc-900 block">{e.nombre}</span>
                            <span className="text-[10px] text-zinc-400">ID #{e.id}</span>
                          </td>
                          <td className="py-3.5 px-4 text-zinc-600">
                            <span className="font-medium text-zinc-800 block">{tipoLabel}</span>
                            {catLabel && <span className="text-[10px] text-zinc-400">{catLabel}</span>}
                          </td>
                          <td className="py-3.5 px-4 text-zinc-700">
                            <Link
                              href={`/clientes/${e.cliente_id}`}
                              className="font-medium text-teal-700 hover:text-teal-900 hover:underline inline-flex items-center gap-1"
                            >
                              {clienteNombre}
                            </Link>
                          </td>
                          <td className="py-3.5 px-4 text-zinc-600">
                            <span className="font-mono text-zinc-800 text-[11px] block">
                              {e.numero_serie || '—'}
                            </span>
                            <span className="text-[10px] text-zinc-400">
                              {[e.marca, e.modelo].filter(Boolean).join(' / ') || 'Marca no esp.'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-zinc-600">
                            <span className="block">{e.area || '—'}</span>
                            {e.ubicacion_detalle && (
                              <span className="text-[10px] text-zinc-400 block">{e.ubicacion_detalle}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge bg={estadoBadge.bg} text={estadoBadge.text} border={estadoBadge.border}>
                              {estadoBadge.label}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {canManage && (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => openEquipoEdit(e)}
                                  className="text-zinc-600 hover:text-zinc-900 font-medium px-2 py-1 rounded-md hover:bg-zinc-100 transition-colors cursor-pointer"
                                  title="Editar equipo"
                                >
                                  ✏️ Editar
                                </button>
                                <button
                                  onClick={() => handleEquipoDelete(e.id)}
                                  className="text-rose-600 hover:text-rose-800 font-medium px-2 py-1 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Desactivar equipo"
                                >
                                  🗑️
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tipos Tab ────────────────────────────────────────────────── */}
      {activeTab === 'tipos' && (
        <div className="flex flex-col gap-4">
          {tipoLoading && (
            <div className="flex flex-col justify-center items-center py-16">
              <Spinner size="lg" />
              <span className="text-xs text-zinc-500 font-medium mt-3">Cargando tipos de equipos...</span>
            </div>
          )}
          {tipoError && <ErrorMessage message={tipoError} retry={fetchTipos} />}
          {!tipoLoading && !tipoError && tipos.length === 0 && (
            <EmptyState
              title="Sin tipos de equipo"
              description="Define los tipos de equipos (ej. Aire Acondicionado, Generador, Bomba) para clasificarlos."
              action={
                canManage ? (
                  <Button onClick={openTipoCreate}>
                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Crear Primer Tipo
                  </Button>
                ) : undefined
              }
            />
          )}

          {!tipoLoading && tipos.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tipos.map((t) => (
                <Card key={t.id} className="p-4 flex flex-col justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-start gap-2">
                      <p className="font-semibold text-zinc-900 text-sm">{t.nombre}</p>
                      {t.categoria && (
                        <Badge bg="bg-teal-50" text="text-teal-700" border="border-teal-200">
                          {t.categoria.nombre}
                        </Badge>
                      )}
                    </div>
                    {t.descripcion && <p className="text-xs text-zinc-500 mt-1">{t.descripcion}</p>}
                  </div>

                  {canManage && (
                    <div className="flex justify-end gap-2 border-t border-zinc-100 pt-2.5">
                      <button onClick={() => openTipoEdit(t)} className="text-xs text-zinc-700 hover:text-zinc-950 font-medium px-2 py-1 rounded hover:bg-zinc-100 transition-colors">
                        Editar
                      </button>
                      <button onClick={() => handleTipoDelete(t.id)} className="text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-1 rounded hover:bg-rose-50 transition-colors">
                        Desactivar
                      </button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Categorías Tab ───────────────────────────────────────────── */}
      {activeTab === 'categorias' && (
        <div className="flex flex-col gap-4">
          {catLoading && (
            <div className="flex flex-col justify-center items-center py-16">
              <Spinner size="lg" />
              <span className="text-xs text-zinc-500 font-medium mt-3">Cargando categorías...</span>
            </div>
          )}
          {catError && <ErrorMessage message={catError} retry={fetchCategorias} />}
          {!catLoading && !catError && categorias.length === 0 && (
            <EmptyState
              title="Sin categorías"
              description="Crea categorías macro (ej. HVAC, Eléctrico, Sanitarios) para agrupar los tipos de activos."
              action={
                canManage ? (
                  <Button onClick={openCatCreate}>
                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Crear Primera Categoría
                  </Button>
                ) : undefined
              }
            />
          )}

          {!catLoading && categorias.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categorias.map((c) => (
                <Card key={c.id} className="p-4 flex flex-col justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <p className="font-semibold text-zinc-900 text-sm">{c.nombre}</p>
                    {c.descripcion && <p className="text-xs text-zinc-500">{c.descripcion}</p>}
                  </div>
                  {canManage && (
                    <div className="flex justify-end gap-2 border-t border-zinc-100 pt-2.5">
                      <button onClick={() => openCatEdit(c)} className="text-xs text-zinc-700 hover:text-zinc-950 font-medium px-2 py-1 rounded hover:bg-zinc-100 transition-colors">
                        Editar
                      </button>
                      <button onClick={() => handleCatDelete(c.id)} className="text-xs text-rose-600 hover:text-rose-800 font-medium px-2 py-1 rounded hover:bg-rose-50 transition-colors">
                        Desactivar
                      </button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modal Equipo (Nuevo / Editar) ────────────────────────────── */}
      <Modal
        isOpen={equipoModal}
        onClose={() => setEquipoModal(false)}
        title={equipoEditId ? 'Editar Equipo / Activo' : 'Registrar Nuevo Equipo'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEquipoModal(false)} disabled={equipoSaving}>
              Cancelar
            </Button>
            <Button
              onClick={handleEquipoSave}
              isLoading={equipoSaving}
              disabled={!equipoNombre.trim() || !equipoTipoId || !equipoClienteId}
            >
              {equipoEditId ? 'Guardar Cambios' : 'Registrar Equipo'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {equipoModalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
              {equipoModalError}
            </div>
          )}

          {/* Cliente selector */}
          <Select
            label="Cliente Asignado (Requerido)"
            value={equipoClienteId}
            onChange={(e) => setEquipoClienteId(e.target.value)}
            placeholder="Seleccionar cliente..."
            options={clientes.map((c) => ({
              value: String(c.id),
              label: `${c.nombre} (RUC: ${c.ruc || 'S/N'})`,
            }))}
            required
          />

          {/* Tipo selector with Quick Creator */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-600">Tipo de Equipo (Requerido)</label>
              <button
                type="button"
                onClick={() => setMostrarCrearTipoRapido(!mostrarCrearTipoRapido)}
                className="text-[11px] text-teal-600 hover:text-teal-800 font-bold hover:underline cursor-pointer"
              >
                {mostrarCrearTipoRapido ? 'Cerrar creador' : '+ Crear nuevo tipo'}
              </button>
            </div>

            {/* Inline Quick Tipo Creator */}
            {mostrarCrearTipoRapido ? (
              <div className="p-3 bg-teal-50/60 border border-teal-200 rounded-lg flex flex-col gap-2">
                <span className="text-[11px] font-bold text-teal-900">Crear Tipo de Equipo al Vuelo</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Nombre del tipo (ej. Chiller)"
                    value={nuevoTipoNombre}
                    onChange={(e) => setNuevoTipoNombre(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 bg-white border border-teal-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <select
                    value={nuevoTipoCatId}
                    onChange={(e) => setNuevoTipoCatId(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 bg-white border border-teal-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="">Categoría...</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2 mt-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setMostrarCrearTipoRapido(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCrearTipoRapido}
                    isLoading={creandoTipoRapido}
                    disabled={!nuevoTipoNombre.trim()}
                  >
                    Guardar Tipo
                  </Button>
                </div>
              </div>
            ) : (
              <Select
                value={equipoTipoId}
                onChange={(e) => setEquipoTipoId(e.target.value)}
                placeholder={tipos.length === 0 ? 'Sin tipos disponibles (Crea uno arriba)' : 'Seleccionar tipo de equipo...'}
                options={tipos.map((t) => ({
                  value: String(t.id),
                  label: `${t.categoria ? `${t.categoria.nombre} → ` : ''}${t.nombre}`,
                }))}
                required
              />
            )}

            {tipos.length === 0 && !mostrarCrearTipoRapido && (
              <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                ⚠️ Aún no hay tipos de equipos configurados. Haz clic en <strong>+ Crear nuevo tipo</strong> para añadir uno.
              </p>
            )}
          </div>

          {/* Nombre */}
          <Input
            label="Nombre o Identificador del Equipo (Requerido)"
            placeholder="Ej: Grupo Electrógeno 150 kVA - Tablero Principal"
            value={equipoNombre}
            onChange={(e) => setEquipoNombre(e.target.value)}
            required
          />

          {/* Nº Serie & Estado Operativo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Nº de Serie / Chasis (Opcional)"
              placeholder="Ej: SN-4928174"
              value={equipoSerie}
              onChange={(e) => setEquipoSerie(e.target.value)}
            />
            <Select
              label="Estado Operativo"
              value={equipoEstado}
              onChange={(e) => setEquipoEstado(e.target.value)}
              options={[
                { value: 'OPERATIVO', label: '🟢 Operativo' },
                { value: 'EN_MANTENIMIENTO', label: '🟡 En Mantenimiento' },
                { value: 'FUERA_DE_SERVICIO', label: '🔴 Fuera de Servicio' },
              ]}
            />
          </div>

          {/* Marca & Modelo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Marca (Opcional)"
              placeholder="Ej: Caterpillar, York, Carrier"
              value={equipoMarca}
              onChange={(e) => setEquipoMarca(e.target.value)}
            />
            <Input
              label="Modelo (Opcional)"
              placeholder="Ej: C15 Acert / YVAA-0200"
              value={equipoModelo}
              onChange={(e) => setEquipoModelo(e.target.value)}
            />
          </div>

          {/* Área / Sede & Ubicación física */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Área o Sede (Opcional)"
              placeholder="Ej: Planta Arequipa / Piso 2"
              value={equipoArea}
              onChange={(e) => setEquipoArea(e.target.value)}
            />
            <Input
              label="Ubicación Detallada (Opcional)"
              placeholder="Ej: Cuarto eléctrico 04"
              value={equipoUbicacion}
              onChange={(e) => setEquipoUbicacion(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* ── Modal Categoría ─────────────────────────────────────────── */}
      <Modal
        isOpen={catModal}
        onClose={() => setCatModal(false)}
        title={catEditId ? 'Editar Categoría' : 'Nueva Categoría de Equipos'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCatModal(false)} disabled={catSaving}>
              Cancelar
            </Button>
            <Button onClick={handleCatSave} isLoading={catSaving} disabled={!catNombre.trim()}>
              Guardar Categoría
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input
            label="Nombre de la Categoría (Requerido)"
            placeholder="Ej: Climatización y HVAC"
            value={catNombre}
            onChange={(e) => setCatNombre(e.target.value)}
            required
          />
          <Input
            label="Descripción o Ícono (Opcional)"
            placeholder="Ej: Equipos de frío, chillers y splits"
            value={catDesc}
            onChange={(e) => setCatDesc(e.target.value)}
          />
        </div>
      </Modal>

      {/* ── Modal Tipo ──────────────────────────────────────────────── */}
      <Modal
        isOpen={tipoModal}
        onClose={() => setTipoModal(false)}
        title={tipoEditId ? 'Editar Tipo de Equipo' : 'Nuevo Tipo de Equipo'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTipoModal(false)} disabled={tipoSaving}>
              Cancelar
            </Button>
            <Button onClick={handleTipoSave} isLoading={tipoSaving} disabled={!tipoNombre.trim() || !tipoCategoriaId}>
              Guardar Tipo
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Select
            label="Categoría (Requerido)"
            value={tipoCategoriaId}
            onChange={(e) => setTipoCategoriaId(e.target.value)}
            placeholder="Seleccionar categoría..."
            options={categorias.map((c) => ({
              value: String(c.id),
              label: c.nombre,
            }))}
            required
          />
          <Input
            label="Nombre del Tipo (Requerido)"
            placeholder="Ej: Grupo Electrógeno / Generador"
            value={tipoNombre}
            onChange={(e) => setTipoNombre(e.target.value)}
            required
          />
          <Input
            label="Descripción (Opcional)"
            placeholder="Ej: Motores diésel estacionarios de respaldo"
            value={tipoDesc}
            onChange={(e) => setTipoDesc(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}

export default function EquiposPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex flex-col justify-center items-center py-20">
          <Spinner size="lg" />
          <span className="text-xs text-zinc-500 font-medium mt-3">Cargando módulo de equipos...</span>
        </div>
      }
    >
      <EquiposContent />
    </Suspense>
  );
}
