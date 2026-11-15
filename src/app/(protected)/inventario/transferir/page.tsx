'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '../../layout';

interface InventarioItem {
  id: number;
  material_id: number;
  tecnico_id: number;
  cantidad: number;
  cantidad_minima: number;
  material: {
    id: number;
    nombre: string;
    codigo: string;
    unidad_medida: string;
  };
}

interface Material {
  id: number;
  nombre: string;
  codigo: string;
}

interface Tecnico {
  id: number;
  nombre: string;
}

export default function InventarioTransferirPage() {
  const { user } = useAuth();

  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [selectedTecnicoId, setSelectedTecnicoId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transfer Form State
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [transferQty, setTransferQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.rol === 'admin' || user?.rol === 'superadmin' || user?.rol === 'operador';

  // Configuración de la empresa: ¿el técnico puede cargar su propio kit?
  const [autotransferencia, setAutotransferencia] = useState(true);
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const puedeConfigurar = user?.rol === 'admin' && Boolean(user?.empresa_id);
  const tecnicoBloqueado = user?.rol === 'tecnico' && !autotransferencia;

  useEffect(() => {
    if (!user?.empresa_id) return;
    apiFetch<{ tecnico_autotransferencia: boolean }>(`/empresas/${user.empresa_id}/config`)
      .then((cfg) => setAutotransferencia(cfg.tecnico_autotransferencia !== false))
      .catch((err) => console.error('No se pudo leer la configuración de la empresa:', err));
  }, [user?.empresa_id]);

  const handleToggleAutotransferencia = async () => {
    if (!user?.empresa_id || guardandoConfig) return;
    const nuevo = !autotransferencia;
    setGuardandoConfig(true);
    try {
      const cfg = await apiFetch<{ tecnico_autotransferencia: boolean }>(`/empresas/${user.empresa_id}/config`, {
        method: 'PUT',
        body: JSON.stringify({ tecnico_autotransferencia: nuevo }),
      });
      setAutotransferencia(cfg.tecnico_autotransferencia !== false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo guardar la configuración');
    } finally {
      setGuardandoConfig(false);
    }
  };

  const fetchInventoryAndMaterials = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const techId = user.rol === 'tecnico' ? user.id : (selectedTecnicoId ? Number(selectedTecnicoId) : null);

      const requests: Promise<unknown>[] = [apiFetch<Material[]>('/repuestos')];
      if (isAdmin) requests.push(apiFetch<Tecnico[]>('/usuarios/tecnicos'));
      if (techId) requests.push(apiFetch<InventarioItem[]>(`/inventario/tecnico/${techId}`));

      const results = await Promise.all(requests);
      const materialsData = results[0] as Material[];
      if (isAdmin) setTecnicos((results[1] as Tecnico[]) ?? []);
      const inventoryData = techId ? (results[isAdmin ? 2 : 1] as InventarioItem[]) : [];

      setInventario(inventoryData ?? []);
      setMateriales(materialsData ?? []);
      if (materialsData && materialsData.length > 0) {
        setSelectedMaterialId(String(materialsData[0].id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar inventario y catálogo');
    } finally {
      setLoading(false);
    }
  }, [user, selectedTecnicoId, isAdmin]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchInventoryAndMaterials();
    });
  }, [fetchInventoryAndMaterials]);

  const handleRegisterTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterialId || transferQty <= 0) {
      alert('Seleccione un repuesto y cantidad válidos');
      return;
    }

    const techId = user?.rol === 'tecnico' ? user.id : Number(selectedTecnicoId);
    if (!techId) { alert('Selecciona un técnico'); return; }

    setSubmitting(true);
    try {
      await apiFetch('/inventario/transferir', {
        method: 'POST',
        body: JSON.stringify({
          tecnico_id: user?.rol === 'tecnico' ? user.id : Number(selectedTecnicoId),
          material_id: Number(selectedMaterialId),
          cantidad: Number(transferQty)
        })
      });

      setTransferQty(1);
      alert('🚀 Carga de repuesto a vehículo registrada exitosamente');
      fetchInventoryAndMaterials();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al procesar la carga de vehículo');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    /* CONTENEDOR PRINCIPAL MOBILE-FIRST (ANCHO MÁXIMO 430px en móvil, amplio en desktop) */
    <div className="w-full max-w-[420px] md:max-w-4xl mx-auto min-h-screen bg-zinc-50 border border-zinc-200/80 rounded-2xl sm:rounded-[24px] sm:shadow-2xl flex flex-col font-sans text-zinc-900 select-none pb-24 relative overflow-x-hidden">
      
      {/* Header Normal de la Pantalla */}
      <header className="bg-white border-b border-zinc-200/80 pt-4 px-4 pb-3 flex flex-col gap-1 shadow-2xs">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200/80 w-fit">
          {isAdmin ? 'Administración' : 'Técnico de Campo'}
        </span>
        <h1 className="text-2xl font-black tracking-tight text-zinc-900 leading-snug">
          {isAdmin ? 'Kit Vehicular por Técnico' : 'Mi Vehículo'}
        </h1>
        <p className="text-xs text-zinc-500 font-medium">
          Control de repuestos y materiales asignados en el móvil
        </p>
      </header>

      <div className="px-4 py-3 space-y-4">

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* Configuración (solo admin de la empresa) */}
        {puedeConfigurar && (
          <div className="bg-white border border-zinc-200 rounded-[16px] p-4 shadow-xs flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold text-zinc-900">Técnicos cargan su propio kit</p>
              <p className="text-[11px] text-zinc-500 font-medium">
                {autotransferencia
                  ? 'Permitido: el técnico registra cargas sin aprobación.'
                  : 'Bloqueado: solo administración carga stock a los técnicos.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autotransferencia}
              aria-label="Permitir que los técnicos carguen su propio kit"
              disabled={guardandoConfig}
              onClick={handleToggleAutotransferencia}
              className={`relative shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 cursor-pointer ${
                autotransferencia ? 'bg-teal-600' : 'bg-zinc-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  autotransferencia ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>
        )}

        {tecnicoBloqueado && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-800">
            Su empresa no permite cargar repuestos por cuenta propia. Solicite la carga a un administrador.
          </div>
        )}

        {/* Selector de técnico (solo admin/operador) */}
        {isAdmin && (
          <div className="bg-white border border-zinc-200 rounded-[16px] p-4 shadow-xs space-y-2">
            <label className="block text-xs font-semibold text-zinc-600">Técnico</label>
            <select
              value={selectedTecnicoId}
              onChange={(e) => setSelectedTecnicoId(e.target.value)}
              className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-900 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
            >
              <option value="">Seleccionar técnico...</option>
              {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
        )}

        {/* 1. Tarjeta Formulario de Carga/Transferencia */}
        {!tecnicoBloqueado && (
        <div className="bg-white border border-zinc-200 rounded-[16px] p-4 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
            <span>📦</span>
            <span>Cargar Repuesto al Vehículo</span>
          </h2>

          <form onSubmit={handleRegisterTransfer} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1">
                Seleccionar Repuesto / Material
              </label>
              <select
                value={selectedMaterialId}
                onChange={(e) => setSelectedMaterialId(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-900 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
              >
                {materiales.map((mat) => (
                  <option key={mat.id} value={mat.id}>
                    {mat.codigo} - {mat.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1">
                Cantidad a Cargar
              </label>
              <input
                type="number"
                min="1"
                value={transferQty}
                onChange={(e) => setTransferQty(Number(e.target.value))}
                className="w-full h-10 px-3 bg-white border border-zinc-200 rounded-xl text-xs font-semibold text-zinc-900 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600"
              />
            </div>

            <div className="flex gap-3 w-full pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 h-11 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Procesando...' : 'Confirmar Carga'}
              </button>
            </div>
          </form>
        </div>
        )}

        {/* 2. Tarjeta Lista de Repuestos Disponibles en el Vehículo */}
        <div className="bg-white border border-zinc-200 rounded-[16px] p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              <span>🛠️</span>
              <span>Stock en el Vehículo</span>
            </h2>
            <span className="text-[11px] font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
              {inventario.length} Repuesto{inventario.length !== 1 ? 's' : ''}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8 text-xs text-zinc-400 gap-2">
              <svg className="animate-spin h-4 w-4 text-teal-600" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Cargando inventario del vehículo...</span>
            </div>
          ) : inventario.length === 0 ? (
            <p className="text-xs text-zinc-400 py-6 text-center italic">
              No tienes repuestos asignados en tu vehículo actualmente.
            </p>
          ) : (
            <div className="space-y-2">
              {inventario.map((item) => {
                const isLow = item.cantidad <= item.cantidad_minima;
                return (
                  <div
                    key={item.id}
                    className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-zinc-900 truncate">
                        {item.material?.nombre || 'Repuesto de Campo'}
                      </p>
                      <p className="text-[10px] font-mono text-zinc-400 truncate">
                        {item.material?.codigo || 'COD-000'} • Unid: {item.material?.unidad_medida || 'unidades'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-black px-2.5 py-1 rounded-lg border ${
                        isLow
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-teal-50 text-teal-700 border-teal-200'
                      }`}>
                        {item.cantidad} {item.material?.unidad_medida || 'unid'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
