import { createServiceClient, errorResponse } from '../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '../../../_lib/auth'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(request)
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()

  const { data: ot, error: fetchErr } = await supabase
    .from('ordenes_trabajo')
    .select('estado,empresa_id')
    .eq('id', id)
    .single()
  if (fetchErr) return errorResponse('Orden no encontrada', 404)

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
