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

  await supabase
    .from('ot_repuestos_pendientes')
    .update({ estado: 'ENTREGADO' })
    .eq('ot_id', id)

  await supabase
    .from('ordenes_trabajo')
    .update({ estado: 'EN_EJECUCION' })
    .eq('id', id)

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
