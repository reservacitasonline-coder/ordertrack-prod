'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { EmptyState } from '@/components/ui/EmptyState';
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

export default function InventarioTransferirPage() {
  const { user } = useAuth();
  
  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transfer Form State
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [transferQty, setTransferQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const fetchInventoryAndMaterials = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // For technicians, query their own user ID, otherwise query default tech Alpha ID 4 from seed
      const techId = user.rol === 'tecnico' ? user.id : 4;
      
      const [inventoryData, materialsData] = await Promise.all([
        apiFetch<InventarioItem[]>(`/inventario/tecnico/${techId}`),
        apiFetch<Material[]>('/repuestos'),
      ]);
      
      setInventario(inventoryData);
      setMateriales(materialsData);
      if (materialsData.length > 0) {
        setSelectedMaterialId(String(materialsData[0].id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar inventario y catálogo');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInventoryAndMaterials();
  }, [fetchInventoryAndMaterials]);

  const handleRegisterTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterialId || transferQty <= 0) {
      alert('Seleccione un repuesto y cantidad válidos');
      return;
    }

    setSubmitting(true);
    try {
      const techId = user?.rol === 'tecnico' ? user.id : 4; // Target tech
      
      await apiFetch('/inventario/transferir', {
        method: 'POST',
        body: JSON.stringify({
          tecnico_id: techId,
          material_id: Number(selectedMaterialId),
          cantidad: Number(transferQty)
        })
      });

      setTransferQty(1);
      alert('🚀 Transferencia de Inventario registrada exitosamente');
      fetchInventoryAndMaterials();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al procesar la transferencia');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && inventario.length === 0) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-20">
        <Spinner size="lg" />
        <span className="text-xs text-zinc-500 font-medium mt-3">Cargando inventario kit vehicular...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 text-zinc-900 max-w-5xl animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-950">Kit Vehicular y Transferencia de Stock</h1>
        <p className="text-xs text-zinc-500 mt-1">
          Visualice el stock actual de su vehículo técnico y registre transferencias de inventario desde el almacén central.
        </p>
      </div>

      {error && <ErrorMessage message={error} retry={fetchInventoryAndMaterials} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Kit Stock Display */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <h2 className="text-sm font-bold text-zinc-700">📦 Repuestos Disponibles en Vehículo</h2>
          
          {inventario.length === 0 ? (
            <EmptyState
              title="Kit de Vehículo Vacío"
              description="Aún no cuenta con repuestos ni herramientas registradas en su vehículo."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inventario.map((item) => {
                const isLowStock = item.cantidad <= item.cantidad_minima;
                return (
                  <Card key={item.id} className={`p-4 flex flex-col gap-3 transition-all hover:border-zinc-300 shadow-2xs ${
                    isLowStock ? 'border-amber-200 bg-amber-50/10' : ''
                  }`}>
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <span className="font-bold text-zinc-900 text-sm leading-tight">{item.material.nombre}</span>
                        <span className="text-[10px] text-zinc-400 font-mono mt-0.5">Cod: {item.material.codigo}</span>
                      </div>
                      {isLowStock && (
                        <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded border border-amber-200">
                          ⚠️ Stock Bajo
                        </span>
                      )}
                    </div>
                    
                    <div className="flex justify-between items-baseline mt-1.5">
                      <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Stock Actual</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black text-zinc-950">{item.cantidad}</span>
                        <span className="text-[10px] text-zinc-500 font-bold lowercase">{item.material.unidad_medida}</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-zinc-400 border-t border-zinc-100 pt-2 flex justify-between">
                      <span>Mínimo requerido: {item.cantidad_minima}</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Transfer Request Box */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <h2 className="text-sm font-bold text-zinc-700">🚚 Cargar Stock a Vehículo</h2>
          
          <Card className="p-5 flex flex-col gap-4 shadow-sm border border-zinc-200">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Registrar Transferencia</span>
            
            <form onSubmit={handleRegisterTransfer} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-600">Almacén Origen</label>
                <div className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg bg-zinc-50 text-zinc-500 font-medium select-none">
                  🏢 Almacén Central de Distribución
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-600">Técnico Destinatario</label>
                <div className="w-full px-3 py-2 text-xs border border-zinc-200 rounded-lg bg-zinc-50 text-zinc-500 font-medium select-none">
                  👤 {user?.nombre || 'Técnico de Campo'}
                </div>
              </div>

              <Select
                label="Seleccionar Material / Repuesto"
                value={selectedMaterialId}
                onChange={(e) => setSelectedMaterialId(e.target.value)}
                options={materiales.map((m) => ({ value: m.id, label: `${m.nombre} (${m.codigo})` }))}
                required
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-600">Cantidad a Transferir</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setTransferQty(Math.max(1, transferQty - 1))}
                    className="w-9 h-9 flex items-center justify-center border border-zinc-200 rounded-lg active:bg-zinc-50 font-bold"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={transferQty}
                    onChange={(e) => setTransferQty(Math.max(1, Number(e.target.value)))}
                    className="w-16 h-9 text-center text-sm font-bold border border-zinc-200 rounded-lg outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setTransferQty(transferQty + 1)}
                    className="w-9 h-9 flex items-center justify-center border border-zinc-200 rounded-lg active:bg-zinc-50 font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                isLoading={submitting}
                className="w-full mt-2 bg-teal-600 hover:bg-teal-700 font-bold shadow-sm"
              >
                🚀 Registrar Carga a Vehículo
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
