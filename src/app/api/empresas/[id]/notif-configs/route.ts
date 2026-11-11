import { createServiceClient, errorResponse } from '../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin'])
  if (roleErr) return roleErr

  if (user!.rol !== 'superadmin' && user!.empresa_id !== parseInt(id)) {
    return errorResponse('Sin permisos para ver esta configuración', 403)
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('empresa_notif_configs')
    .select('*')
    .eq('empresa_id', id)
    .order('evento')

  if (error) return errorResponse(error.message)
  return Response.json(data)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin'])
  if (roleErr) return roleErr

  if (user!.rol !== 'superadmin' && user!.empresa_id !== parseInt(id)) {
    return errorResponse('Sin permisos', 403)
  }

  const body = await request.json()
  if (!body.evento) return errorResponse('evento requerido', 400)
  if (!body.canal) return errorResponse('canal requerido', 400)
  if (!body.destino) return errorResponse('destino requerido', 400)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('empresa_notif_configs')
    .insert({ ...body, empresa_id: parseInt(id) })
    .select()
    .single()

  if (error) return errorResponse(error.message)
  return Response.json(data, { status: 201 })
}
