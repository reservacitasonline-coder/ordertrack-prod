'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../layout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { apiFetch } from '@/lib/api';
import { RepuestoMaterial } from '@/types';

export default function RepuestosCatalogPage() {
  const { user } = useAuth();
  const canManage = user?.rol === 'admin' || user?.rol === 'superadmin';
  const [repuestos, setRepuestos] = useState<RepuestoMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form Fields
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [precio, setPrecio] = useState('0.00');
  const [unidad, setUnidad] = useState('unidades');

  const fetchRepuestos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<RepuestoMaterial[]>('/repuestos');
      setRepuestos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el catálogo de repuestos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchRepuestos();
    });
  }, [fetchRepuestos]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setNombre('');
    setCodigo('');
    setPrecio('0.00');
    setUnidad('unidades');
    setIsOpen(true);
  };

  const handleOpenEdit = (rep: RepuestoMaterial) => {
    setEditingId(rep.id);
    setNombre(rep.nombre);
    setCodigo(rep.codigo);
    setPrecio(String(rep.precio_unitario));
    setUnidad(rep.unidad_medida);
    setIsOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !codigo.trim()) {
      alert('Nombre y código son obligatorios');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        nombre: nombre.trim(),
        codigo: codigo.trim(),
        precio_unitario: parseFloat(precio),
        unidad_medida: unidad.trim()
      };

      if (editingId) {
        await apiFetch(`/repuestos/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/repuestos', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      setIsOpen(false);
      fetchRepuestos();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar repuesto');
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Está seguro de eliminar este repuesto del catálogo?')) return;
    setLoading(true);
    try {
      await apiFetch(`/repuestos/${id}`, { method: 'DELETE' });
      fetchRepuestos();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar repuesto');
      setLoading(false);
    }
  };

  if (loading && repuestos.length === 0) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-20">
        <Spinner size="lg" />
        <span className="text-xs text-zinc-500 font-medium mt-3">Cargando catálogo de repuestos...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Title */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-zinc-950">Catálogo de Repuestos y Materiales</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Administre los materiales de inventario que los técnicos pueden consumir en el campo.
          </p>
        </div>
        {canManage && (
          <Button onClick={handleOpenCreate}>
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Agregar Material
          </Button>
        )}
      </div>

      {error && <ErrorMessage message={error} retry={fetchRepuestos} />}

      {/* List Card */}
      {repuestos.length === 0 ? (
        <EmptyState
          title="Catálogo Vacío"
          description="Aún no ha agregado materiales o repuestos. Haga clic en Agregar Material para configurar su catálogo."
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-5">Código</th>
                  <th className="py-3 px-5">Nombre</th>
                  {canManage && <th className="py-3 px-5">Precio Unitario</th>}
                  <th className="py-3 px-5">Unidad</th>
                  {canManage && <th className="py-3 px-5 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {repuestos.map((rep) => (
                  <tr key={rep.id} className="hover:bg-zinc-50/40 transition-colors">
                    <td className="py-4 px-5 font-mono font-bold text-zinc-700">{rep.codigo}</td>
                    <td className="py-4 px-5 text-zinc-950 font-semibold text-[13px]">{rep.nombre}</td>
                    {canManage && (
                      <td className="py-4 px-5 text-zinc-800 font-medium">${parseFloat(String(rep.precio_unitario)).toFixed(2)}</td>
                    )}
                    <td className="py-4 px-5 text-zinc-500 capitalize">{rep.unidad_medida}</td>
                    {canManage && (
                      <td className="py-4 px-5 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => handleOpenEdit(rep)}
                            className="text-[10px] text-teal-700 font-bold border border-teal-200 hover:bg-teal-50 px-2.5 py-1.5 rounded-lg transition-all"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(rep.id)}
                            className="text-[10px] text-red-700 font-bold border border-red-200 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-all"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Editor Modal */}
      {isOpen && (
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title={editingId ? 'Editar Repuesto / Material' : 'Agregar Nuevo Repuesto / Material'}
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                {editingId ? 'Guardar Cambios' : 'Registrar Repuesto'}
              </Button>
            </>
          }
        >
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <Input
              label="Código del Repuesto"
              placeholder="Ej: DISCO-SSD-1TB"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              required
            />
            <Input
              label="Nombre del Material"
              placeholder="Ej: Disco Estado Sólido 1TB"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Precio Unitario ($)"
                type="number"
                step="0.01"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                required
              />
              <Input
                label="Unidad de Medida"
                placeholder="Ej: unidades, metros, bolsas"
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                required
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
