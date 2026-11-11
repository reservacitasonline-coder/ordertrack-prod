'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { apiFetch } from '@/lib/api';
import { Equipo, EquipoCategoria, EquipoTipo } from '@/types';

type Tab = 'equipos' | 'tipos' | 'categorias';

export default function EquiposPage() {
  const [activeTab, setActiveTab] = useState<Tab>('equipos');

  // ── Categorías ───────────────────────────────────────────────────────
  const [categorias, setCategorias] = useState<EquipoCategoria[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState<string | null>(null);
  const [catModal, setCatModal] = useState(false);
  const [catEditId, setCatEditId] = useState<number | null>(null);
  const [catNombre, setCatNombre] = useState('');
  const [catDesc, setCatDesc] = useState('');

  // ── Tipos ────────────────────────────────────────────────────────────
  const [tipos, setTipos] = useState<EquipoTipo[]>([]);
  const [tipoLoading, setTipoLoading] = useState(true);
  const [tipoError, setTipoError] = useState<string | null>(null);
  const [tipoModal, setTipoModal] = useState(false);
  const [tipoEditId, setTipoEditId] = useState<number | null>(null);
  const [tipoNombre, setTipoNombre] = useState('');
  const [tipoDesc, setTipoDesc] = useState('');
  const [tipoCategoriaId, setTipoCategoriaId] = useState('');

  // ── Equipos ──────────────────────────────────────────────────────────
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [equipoLoading, setEquipoLoading] = useState(true);
  const [equipoError, setEquipoError] = useState<string | null>(null);
  const [equipoModal, setEquipoModal] = useState(false);
  const [equipoEditId, setEquipoEditId] = useState<number | null>(null);
  const [equipoNombre, setEquipoNombre] = useState('');
  const [equipoSerie, setEquipoSerie] = useState('');
  const [equipoModelo, setEquipoModelo] = useState('');
  const [equipoMarca, setEquipoMarca] = useState('');
  const [equipoTipoId, setEquipoTipoId] = useState('');
  const [equipoClienteId, setEquipoClienteId] = useState('');
  const [clientes, setClientes] = useState<{ id: number; nombre: string }[]>([]);

  const fetchCategorias = useCallback(async () => {
    setCatLoading(true); setCatError(null);
    try {
      const data = await apiFetch<EquipoCategoria[]>('/equipos/categorias');
      setCategorias(data ?? []);
    } catch (e) {
      setCatError(e instanceof Error ? e.message : 'Error al cargar categorías');
    } finally { setCatLoading(false); }
  }, []);

  const fetchTipos = useCallback(async () => {
    setTipoLoading(true); setTipoError(null);
    try {
      const data = await apiFetch<EquipoTipo[]>('/equipos/tipos');
      setTipos(data ?? []);
    } catch (e) {
      setTipoError(e instanceof Error ? e.message : 'Error al cargar tipos');
    } finally { setTipoLoading(false); }
  }, []);

  const fetchEquipos = useCallback(async () => {
    setEquipoLoading(true); setEquipoError(null);
    try {
      const data = await apiFetch<Equipo[]>('/equipos');
      setEquipos(data ?? []);
    } catch (e) {
      setEquipoError(e instanceof Error ? e.message : 'Error al cargar equipos');
    } finally { setEquipoLoading(false); }
  }, []);

  useEffect(() => {
    fetchCategorias();
    fetchTipos();
    fetchEquipos();
    apiFetch<{ id: number; nombre: string }[]>('/clientes').then((d) => setClientes(d ?? [])).catch(() => {});
  }, [fetchCategorias, fetchTipos, fetchEquipos]);

  // ── Categorías handlers ──────────────────────────────────────────────
  const openCatCreate = () => { setCatEditId(null); setCatNombre(''); setCatDesc(''); setCatModal(true); };
  const openCatEdit = (c: EquipoCategoria) => { setCatEditId(c.id); setCatNombre(c.nombre); setCatDesc(c.descripcion ?? ''); setCatModal(true); };
  const handleCatSave = async () => {
    const payload = { nombre: catNombre, descripcion: catDesc || null };
    try {
      if (catEditId) {
        await apiFetch(`/equipos/categorias/${catEditId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiFetch('/equipos/categorias', { method: 'POST', body: JSON.stringify(payload) });
      }
      setCatModal(false);
      fetchCategorias();
    } catch (e) { alert(e instanceof Error ? e.message : 'Error al guardar'); }
  };
  const handleCatDelete = async (id: number) => {
    if (!confirm('¿Desactivar esta categoría?')) return;
    try {
      await apiFetch(`/equipos/categorias/${id}`, { method: 'DELETE' });
      fetchCategorias();
    } catch (e) { alert(e instanceof Error ? e.message : 'Error al eliminar'); }
  };

  // ── Tipos handlers ───────────────────────────────────────────────────
  const openTipoCreate = () => { setTipoEditId(null); setTipoNombre(''); setTipoDesc(''); setTipoCategoriaId(''); setTipoModal(true); };
  const openTipoEdit = (t: EquipoTipo) => { setTipoEditId(t.id); setTipoNombre(t.nombre); setTipoDesc(t.descripcion ?? ''); setTipoCategoriaId(String(t.categoria_id)); setTipoModal(true); };
  const handleTipoSave = async () => {
    if (!tipoCategoriaId) { alert('Selecciona una categoría'); return; }
    const payload = { nombre: tipoNombre, descripcion: tipoDesc || null, categoria_id: Number(tipoCategoriaId) };
    try {
      if (tipoEditId) {
        await apiFetch(`/equipos/tipos/${tipoEditId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiFetch('/equipos/tipos', { method: 'POST', body: JSON.stringify(payload) });
      }
      setTipoModal(false);
      fetchTipos();
    } catch (e) { alert(e instanceof Error ? e.message : 'Error al guardar'); }
  };
  const handleTipoDelete = async (id: number) => {
    if (!confirm('¿Desactivar este tipo?')) return;
    try {
      await apiFetch(`/equipos/tipos/${id}`, { method: 'DELETE' });
      fetchTipos();
    } catch (e) { alert(e instanceof Error ? e.message : 'Error al eliminar'); }
  };

  // ── Equipos handlers ─────────────────────────────────────────────────
  const openEquipoCreate = () => { setEquipoEditId(null); setEquipoNombre(''); setEquipoSerie(''); setEquipoModelo(''); setEquipoMarca(''); setEquipoTipoId(''); setEquipoClienteId(''); setEquipoModal(true); };
  const openEquipoEdit = (e: Equipo) => { setEquipoEditId(e.id); setEquipoNombre(e.nombre); setEquipoSerie(e.numero_serie ?? ''); setEquipoModelo(e.modelo ?? ''); setEquipoMarca(e.marca ?? ''); setEquipoTipoId(String(e.tipo_id)); setEquipoClienteId(String(e.cliente_id)); setEquipoModal(true); };
  const handleEquipoSave = async () => {
    if (!equipoTipoId) { alert('Selecciona un tipo'); return; }
    if (!equipoClienteId) { alert('Selecciona un cliente'); return; }
    if (!equipoNombre.trim()) { alert('El nombre es obligatorio'); return; }
    const payload = {
      nombre: equipoNombre,
      numero_serie: equipoSerie || null,
      modelo: equipoModelo || null,
      marca: equipoMarca || null,
      tipo_id: Number(equipoTipoId),
      cliente_id: Number(equipoClienteId),
    };
    try {
      if (equipoEditId) {
        await apiFetch(`/equipos/${equipoEditId}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await apiFetch('/equipos', { method: 'POST', body: JSON.stringify(payload) });
      }
      setEquipoModal(false);
      fetchEquipos();
    } catch (e) { alert(e instanceof Error ? e.message : 'Error al guardar'); }
  };
  const handleEquipoDelete = async (id: number) => {
    if (!confirm('¿Desactivar este equipo?')) return;
    try {
      await apiFetch(`/equipos/${id}`, { method: 'DELETE' });
      fetchEquipos();
    } catch (e) { alert(e instanceof Error ? e.message : 'Error al eliminar'); }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'equipos', label: 'Equipos' },
    { key: 'tipos', label: 'Tipos' },
    { key: 'categorias', label: 'Categorías' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestión de Equipos</h1>
        {activeTab === 'categorias' && <Button onClick={openCatCreate}>+ Nueva Categoría</Button>}
        {activeTab === 'tipos' && <Button onClick={openTipoCreate}>+ Nuevo Tipo</Button>}
        {activeTab === 'equipos' && <Button onClick={openEquipoCreate}>+ Nuevo Equipo</Button>}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Categorías tab ─────────────────────────────────────────────── */}
      {activeTab === 'categorias' && (
        <>
          {catLoading && <Spinner />}
          {catError && <ErrorMessage message={catError} />}
          {!catLoading && !catError && categorias.length === 0 && (
            <EmptyState title="Sin categorías" description="Crea la primera categoría de equipos." />
          )}
          {!catLoading && categorias.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categorias.map((c) => (
                <Card key={c.id} className="p-4 flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{c.nombre}</p>
                    {c.descripcion && <p className="text-sm text-gray-500 mt-1">{c.descripcion}</p>}
                  </div>
                  <div className="flex gap-2 ml-3 shrink-0">
                    <button onClick={() => openCatEdit(c)} className="text-blue-600 hover:underline text-sm">Editar</button>
                    <button onClick={() => handleCatDelete(c.id)} className="text-red-600 hover:underline text-sm">Eliminar</button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Tipos tab ──────────────────────────────────────────────────── */}
      {activeTab === 'tipos' && (
        <>
          {tipoLoading && <Spinner />}
          {tipoError && <ErrorMessage message={tipoError} />}
          {!tipoLoading && !tipoError && tipos.length === 0 && (
            <EmptyState title="Sin tipos" description="Crea el primer tipo de equipo." />
          )}
          {!tipoLoading && tipos.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tipos.map((t) => (
                <Card key={t.id} className="p-4 flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{t.nombre}</p>
                    {t.categoria && <p className="text-xs text-gray-500 mt-0.5">{t.categoria.nombre}</p>}
                    {t.descripcion && <p className="text-sm text-gray-500 mt-1">{t.descripcion}</p>}
                  </div>
                  <div className="flex gap-2 ml-3 shrink-0">
                    <button onClick={() => openTipoEdit(t)} className="text-blue-600 hover:underline text-sm">Editar</button>
                    <button onClick={() => handleTipoDelete(t.id)} className="text-red-600 hover:underline text-sm">Eliminar</button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Equipos tab ────────────────────────────────────────────────── */}
      {activeTab === 'equipos' && (
        <>
          {equipoLoading && <Spinner />}
          {equipoError && <ErrorMessage message={equipoError} />}
          {!equipoLoading && !equipoError && equipos.length === 0 && (
            <EmptyState title="Sin equipos" description="Registra el primer equipo de un cliente." />
          )}
          {!equipoLoading && equipos.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase text-gray-500 border-b dark:border-gray-700">
                  <tr>
                    <th className="py-2 pr-4">Nombre</th>
                    <th className="py-2 pr-4">Tipo</th>
                    <th className="py-2 pr-4">Cliente</th>
                    <th className="py-2 pr-4">Nº Serie</th>
                    <th className="py-2 pr-4">Marca / Modelo</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {equipos.map((e) => (
                    <tr key={e.id} className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-2 pr-4 font-medium text-gray-900 dark:text-white">{e.nombre}</td>
                      <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{(e.tipo as unknown as EquipoTipo)?.nombre ?? '—'}</td>
                      <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{(e as unknown as { cliente?: { nombre: string } }).cliente?.nombre ?? '—'}</td>
                      <td className="py-2 pr-4 text-gray-500">{e.numero_serie ?? '—'}</td>
                      <td className="py-2 pr-4 text-gray-500">{[e.marca, e.modelo].filter(Boolean).join(' / ') || '—'}</td>
                      <td className="py-2 flex gap-2">
                        <button onClick={() => openEquipoEdit(e)} className="text-blue-600 hover:underline text-sm">Editar</button>
                        <button onClick={() => handleEquipoDelete(e.id)} className="text-red-600 hover:underline text-sm">Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Modal Categoría ─────────────────────────────────────────────── */}
      <Modal isOpen={catModal} onClose={() => setCatModal(false)} title={catEditId ? 'Editar Categoría' : 'Nueva Categoría'}>
        <div className="space-y-4">
          <Input label="Nombre" value={catNombre} onChange={(e) => setCatNombre(e.target.value)} />
          <Input label="Descripción (opcional)" value={catDesc} onChange={(e) => setCatDesc(e.target.value)} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setCatModal(false)}>Cancelar</Button>
            <Button onClick={handleCatSave} disabled={!catNombre.trim()}>Guardar</Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Tipo ──────────────────────────────────────────────────── */}
      <Modal isOpen={tipoModal} onClose={() => setTipoModal(false)} title={tipoEditId ? 'Editar Tipo' : 'Nuevo Tipo'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoría</label>
            <select
              value={tipoCategoriaId}
              onChange={(e) => setTipoCategoriaId(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-600"
            >
              <option value="">Seleccionar...</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <Input label="Nombre" value={tipoNombre} onChange={(e) => setTipoNombre(e.target.value)} />
          <Input label="Descripción (opcional)" value={tipoDesc} onChange={(e) => setTipoDesc(e.target.value)} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setTipoModal(false)}>Cancelar</Button>
            <Button onClick={handleTipoSave} disabled={!tipoNombre.trim()}>Guardar</Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal Equipo ────────────────────────────────────────────────── */}
      <Modal isOpen={equipoModal} onClose={() => setEquipoModal(false)} title={equipoEditId ? 'Editar Equipo' : 'Nuevo Equipo'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cliente</label>
            <select
              value={equipoClienteId}
              onChange={(e) => setEquipoClienteId(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-600"
            >
              <option value="">Seleccionar...</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de equipo</label>
            <select
              value={equipoTipoId}
              onChange={(e) => setEquipoTipoId(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-600"
            >
              <option value="">Seleccionar...</option>
              {tipos.map((t) => <option key={t.id} value={t.id}>{t.categoria ? `${t.categoria.nombre} → ` : ''}{t.nombre}</option>)}
            </select>
          </div>
          <Input label="Nombre del equipo" value={equipoNombre} onChange={(e) => setEquipoNombre(e.target.value)} />
          <Input label="Nº de serie (opcional)" value={equipoSerie} onChange={(e) => setEquipoSerie(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Marca (opcional)" value={equipoMarca} onChange={(e) => setEquipoMarca(e.target.value)} />
            <Input label="Modelo (opcional)" value={equipoModelo} onChange={(e) => setEquipoModelo(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setEquipoModal(false)}>Cancelar</Button>
            <Button onClick={handleEquipoSave} disabled={!equipoNombre.trim() || !equipoTipoId || !equipoClienteId}>Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
