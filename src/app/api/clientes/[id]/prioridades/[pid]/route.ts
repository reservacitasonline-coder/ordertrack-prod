import { createServiceClient, errorResponse } from '../../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; pid: string }> }) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin'])
  if (rolesErr) return rolesErr

  const { id, pid } = await params
  const supabase = createServiceClient()
  const body = await request.json()
  const { data, error } = await supabase
    .from('prioridad_cliente')
    .update(body)
    .eq('id', pid)
    .eq('cliente_id', id)
    .select()
    .single()

  if (error) return errorResponse(error.message)
  return Response.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; pid: string }> }) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin'])
  if (rolesErr) return rolesErr

  const { id, pid } = await params
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('prioridad_cliente')
    .delete()
    .eq('id', pid)
    .eq('cliente_id', id)

  if (error) return errorResponse(error.message)
  return new Response(null, { status: 204 })
}
