'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { apiFetch } from '@/lib/api';
import { Cliente, ContratoCliente } from '@/types';

interface EditarClienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: Cliente;
  onSuccess: () => void;
}

export const EditarClienteModal: React.FC<EditarClienteModalProps> = ({
  isOpen,
  onClose,
  cliente,
  onSuccess,
}) => {
  // Datos Generales
  const [nombre, setNombre] = useState(cliente.nombre || '');
  const [ruc, setRuc] = useState(cliente.ruc || '');
  const [email, setEmail] = useState(cliente.email || '');
  const [telefono, setTelefono] = useState(cliente.telefono || '');
  const [activo, setActivo] = useState(cliente.activo ?? true);

  // Datos de Contrato
  const c = cliente.contrato || {};
  const [codigoContrato, setCodigoContrato] = useState(c.codigo_contrato || '');
  const [tipoServicio, setTipoServicio] = useState(c.tipo_servicio || 'Mantenimiento Preventivo y Correctivo');
  const [estadoContrato, setEstadoContrato] = useState<ContratoCliente['estado_contrato']>(c.estado_contrato || 'vigente');
  const [fechaInicio, setFechaInicio] = useState(c.fecha_inicio || '');
  const [fechaFin, setFechaFin] = useState(c.fecha_fin || '');
  const [slaHoras, setSlaHoras] = useState<string>(c.sla_horas_comprometido !== undefined ? String(c.sla_horas_comprometido) : '24');
  const [tarifaMensual, setTarifaMensual] = useState<string>(c.tarifa_mensual !== undefined ? String(c.tarifa_mensual) : '');
  const [moneda, setMoneda] = useState(c.moneda || 'PEN');
  const [contactoComercial, setContactoComercial] = useState(c.contacto_comercial || '');
  const [telefonoComercial, setTelefonoComercial] = useState(c.telefono_comercial || '');
  const [emailComercial, setEmailComercial] = useState(c.email_comercial || '');
  const [condicionesPago, setCondicionesPago] = useState(c.condiciones_pago || 'Factura a 30 días');
  const [observaciones, setObservaciones] = useState(c.observaciones || '');

  const [activeTab, setActiveTab] = useState<'empresa' | 'contrato'>('empresa');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    Promise.resolve().then(() => {
      setNombre(cliente.nombre || '');
      setRuc(cliente.ruc || '');
      setEmail(cliente.email || '');
      setTelefono(cliente.telefono || '');
      setActivo(cliente.activo ?? true);

      const cont = cliente.contrato || {};
      setCodigoContrato(cont.codigo_contrato || '');
      setTipoServicio(cont.tipo_servicio || 'Mantenimiento Preventivo y Correctivo');
      setEstadoContrato(cont.estado_contrato || 'vigente');
      setFechaInicio(cont.fecha_inicio || '');
      setFechaFin(cont.fecha_fin || '');
      setSlaHoras(cont.sla_horas_comprometido !== undefined ? String(cont.sla_horas_comprometido) : '24');
      setTarifaMensual(cont.tarifa_mensual !== undefined ? String(cont.tarifa_mensual) : '');
      setMoneda(cont.moneda || 'PEN');
      setContactoComercial(cont.contacto_comercial || '');
      setTelefonoComercial(cont.telefono_comercial || '');
      setEmailComercial(cont.email_comercial || '');
      setCondicionesPago(cont.condiciones_pago || 'Factura a 30 días');
      setObservaciones(cont.observaciones || '');
      setError(null);
    });
  }, [isOpen, cliente]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !ruc.trim()) {
      setError('El nombre y el RUC son obligatorios');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const contratoPayload: ContratoCliente = {
        codigo_contrato: codigoContrato.trim() || undefined,
        tipo_servicio: tipoServicio.trim() || undefined,
        estado_contrato: estadoContrato,
        fecha_inicio: fechaInicio || undefined,
        fecha_fin: fechaFin || undefined,
        sla_horas_comprometido: slaHoras ? Number(slaHoras) : undefined,
        tarifa_mensual: tarifaMensual ? parseFloat(tarifaMensual) : undefined,
        moneda,
        contacto_comercial: contactoComercial.trim() || undefined,
        telefono_comercial: telefonoComercial.trim() || undefined,
        email_comercial: emailComercial.trim() || undefined,
        condiciones_pago: condicionesPago.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
      };

      await apiFetch(`/clientes/${cliente.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nombre: nombre.trim(),
          ruc: ruc.trim(),
          email: email.trim() || null,
          telefono: telefono.trim() || null,
          activo,
          contrato: contratoPayload,
        }),
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el cliente');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Editar Cliente & Contrato: ${cliente.nombre}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} isLoading={submitting}>
            Guardar Cambios
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-h-[75vh] overflow-y-auto pr-1 text-xs">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
            {error}
          </div>
        )}

        {/* Tab switch */}
        <div className="flex border-b border-zinc-200 gap-4 mb-1">
          <button
            type="button"
            onClick={() => setActiveTab('empresa')}
            className={`pb-2 font-bold text-xs transition-colors cursor-pointer border-b-2 -mb-[1px] ${
              activeTab === 'empresa'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            🏢 Datos de la Empresa
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('contrato')}
            className={`pb-2 font-bold text-xs transition-colors cursor-pointer border-b-2 -mb-[1px] ${
              activeTab === 'contrato'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            📋 Términos del Contrato & SLA
          </button>
        </div>

        {activeTab === 'empresa' && (
          <div className="flex flex-col gap-3.5">
            <Input
              label="Razón Social / Nombre Comercial *"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Minera del Sur S.A."
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="RUC *"
                value={ruc}
                onChange={(e) => setRuc(e.target.value)}
                placeholder="Ej: 20987654321"
                required
                maxLength={20}
              />
              <Input
                label="Teléfono Principal"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej: +51 1 456-7890"
              />
            </div>

            <Input
              label="Correo Electrónico de Contacto"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ej: contacto@cliente.com"
            />

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-zinc-800 font-semibold select-none">
                <input
                  type="checkbox"
                  checked={activo}
                  onChange={(e) => setActivo(e.target.checked)}
                  className="rounded border-zinc-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
                />
                <span>Cliente Activo en la Plataforma</span>
              </label>
              <p className="text-[11px] text-zinc-400 mt-0.5 ml-6">
                Los clientes inactivos no pueden seleccionarse para nuevas órdenes de trabajo.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'contrato' && (
          <div className="flex flex-col gap-3.5">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Código o N° de Contrato"
                value={codigoContrato}
                onChange={(e) => setCodigoContrato(e.target.value)}
                placeholder="Ej: CTR-2026-MIN01"
              />
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Estado de Vigencia</label>
                <select
                  value={estadoContrato}
                  onChange={(e) => setEstadoContrato(e.target.value as ContratoCliente['estado_contrato'])}
                  className="w-full h-10 border border-zinc-200 rounded-xl px-3 bg-white text-zinc-800 focus:outline-none focus:border-teal-600"
                >
                  <option value="vigente">Vigente (Activo)</option>
                  <option value="por_vencer">Por Vencer</option>
                  <option value="en_renovacion">En Renovación</option>
                  <option value="vencido">Vencido</option>
                </select>
              </div>
            </div>

            <Input
              label="Tipo de Servicio / Cobertura Contratada"
              value={tipoServicio}
              onChange={(e) => setTipoServicio(e.target.value)}
              placeholder="Ej: Mantenimiento Preventivo, Correctivo y Soporte 24/7"
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Fecha de Inicio</label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full h-10 border border-zinc-200 rounded-xl px-3 bg-white text-zinc-800 focus:outline-none focus:border-teal-600"
                />
              </div>
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Fecha de Vencimiento / Fin</label>
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="w-full h-10 border border-zinc-200 rounded-xl px-3 bg-white text-zinc-800 focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">SLA Máx. (Horas)</label>
                <input
                  type="number"
                  min="1"
                  value={slaHoras}
                  onChange={(e) => setSlaHoras(e.target.value)}
                  placeholder="24"
                  className="w-full h-10 border border-zinc-200 rounded-xl px-3 bg-white text-zinc-800 focus:outline-none focus:border-teal-600"
                />
              </div>
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Moneda</label>
                <select
                  value={moneda}
                  onChange={(e) => setMoneda(e.target.value)}
                  className="w-full h-10 border border-zinc-200 rounded-xl px-3 bg-white text-zinc-800 focus:outline-none focus:border-teal-600"
                >
                  <option value="PEN">Soles (PEN)</option>
                  <option value="USD">Dólares (USD)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Tarifa Mensual</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={tarifaMensual}
                  onChange={(e) => setTarifaMensual(e.target.value)}
                  placeholder="0.00"
                  className="w-full h-10 border border-zinc-200 rounded-xl px-3 bg-white text-zinc-800 focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Administrador del Contrato (Cliente)"
                value={contactoComercial}
                onChange={(e) => setContactoComercial(e.target.value)}
                placeholder="Ej: Ing. Jorge Valdivia"
              />
              <Input
                label="Teléfono Directo del Administrador"
                value={telefonoComercial}
                onChange={(e) => setTelefonoComercial(e.target.value)}
                placeholder="Ej: +51 987 654 321"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Correo del Administrador"
                type="email"
                value={emailComercial}
                onChange={(e) => setEmailComercial(e.target.value)}
                placeholder="Ej: jvaldivia@cliente.com"
              />
              <Input
                label="Condiciones de Pago"
                value={condicionesPago}
                onChange={(e) => setCondicionesPago(e.target.value)}
                placeholder="Ej: 30 días fecha factura"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 mb-1">Observaciones o Cláusulas Relevantes</label>
              <textarea
                rows={2}
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Penalidades por SLA, exclusiones de repuestos o acuerdos específicos..."
                className="w-full border border-zinc-200 rounded-xl p-2.5 bg-white text-zinc-800 focus:outline-none focus:border-teal-600 resize-none"
              />
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
};
