import { createServiceClient, errorResponse } from '../../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin'])
  if (roleErr) return roleErr

  if (user!.rol !== 'superadmin' && user!.empresa_id !== parseInt(id)) {
    return errorResponse('Sin permisos', 403)
  }

  const supabase = createServiceClient()
  const body = await request.json()
  const updateData: Record<string, unknown> = {}
  if (body.notificar_via !== undefined || body.canal !== undefined) {
    updateData.notificar_via = body.notificar_via ?? body.canal
  }
  if (body.activar_notificaciones !== undefined || body.activo !== undefined) {
    updateData.activar_notificaciones = body.activar_notificaciones ?? body.activo
  }

  const { data, error } = await supabase
    .from('empresa_notif_configs')
    .update(updateData)
    .eq('id', cid)
    .eq('empresa_id', id)
    .select()
    .single()

  if (error) return errorResponse(error.message)
  return Response.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; cid: string }> }) {
  const { id, cid } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin'])
  if (roleErr) return roleErr

  if (user!.rol !== 'superadmin' && user!.empresa_id !== parseInt(id)) {
    return errorResponse('Sin permisos', 403)
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('empresa_notif_configs')
    .delete()
    .eq('id', cid)
    .eq('empresa_id', id)

  if (error) return errorResponse(error.message)
  return new Response(null, { status: 204 })
}
