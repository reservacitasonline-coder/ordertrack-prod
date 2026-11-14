import { createServiceClient, errorResponse, verifyOtAccess } from '../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  const { ot, error: accessErr } = await verifyOtAccess(supabase, id, user!)
  if (accessErr || !ot) return accessErr!

  const { fecha_estimada } = await request.json()

  const { data: pendientes, error: fetchErr } = await supabase
    .from('ot_repuestos_pendientes')
    .select('*')
    .eq('ot_id', id)
    .eq('estado', 'SOLICITADO')

  if (fetchErr) return errorResponse(fetchErr.message)
  if (!pendientes?.length) return errorResponse('No hay repuestos pendientes en estado SOLICITADO', 400)

  for (const p of pendientes) {
    await supabase
      .from('ot_repuestos_pendientes')
      .update({ estado: 'EN_CAMINO', fecha_estimada })
      .eq('id', p.id)
  }

  await supabase.from('ot_eventos').insert({
    ot_id: parseInt(id),
    estado_anterior: ot.estado,
    estado_nuevo: ot.estado,
    usuario_id: user!.id,
    comentario: `Repuestos marcados EN_CAMINO. Fecha estimada: ${fecha_estimada}`,
    origen: 'manual',
  })

  const { data, error } = await supabase.from('ot_repuestos_pendientes').select('*').eq('ot_id', id)
  if (error) return errorResponse(error.message)
  return Response.json(data)
}
