import { createServiceClient, errorResponse, verifyOtAccess } from '../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  const { ot, error: accessErr } = await verifyOtAccess(supabase, id, user!)
  if (accessErr || !ot) return accessErr!

  // Solo tiene sentido con la orden en curso: nunca revivir una OT cerrada o anulada
  if (!['ESPERANDO_REPUESTO', 'EN_EJECUCION'].includes(ot.estado)) {
    return errorResponse(`No se pueden entregar repuestos con la orden en estado ${ot.estado}`, 400)
  }

  const { data: pendientes, error: pendErr } = await supabase
    .from('ot_repuestos_pendientes')
    .select('id')
    .eq('ot_id', id)
    .in('estado', ['SOLICITADO', 'EN_CAMINO'])
  if (pendErr) return errorResponse(pendErr.message)
  if (!pendientes?.length) return errorResponse('No hay repuestos pendientes por entregar', 400)

  const { error: updPendErr } = await supabase
    .from('ot_repuestos_pendientes')
    .update({ estado: 'ENTREGADO' })
    .eq('ot_id', id)
    .in('estado', ['SOLICITADO', 'EN_CAMINO'])
  if (updPendErr) return errorResponse(updPendErr.message)

  if (ot.estado === 'ESPERANDO_REPUESTO') {
    const { error: updOtErr } = await supabase
      .from('ordenes_trabajo')
      .update({ estado: 'EN_EJECUCION' })
      .eq('id', id)
      .eq('estado', 'ESPERANDO_REPUESTO')
    if (updOtErr) return errorResponse(updOtErr.message)
  }

  await supabase.from('ot_eventos').insert({
    ot_id: parseInt(id),
    estado_anterior: ot.estado,
    estado_nuevo: 'EN_EJECUCION',
    usuario_id: user!.id,
    comentario: 'Todos los repuestos entregados. OT reanuda EN_EJECUCION.',
    origen: 'manual',
  })

  const { data, error } = await supabase.from('ot_repuestos_pendientes').select('*').eq('ot_id', id)
  if (error) return errorResponse(error.message)
  return Response.json(data)
}
