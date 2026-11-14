import { createServiceClient, errorResponse } from '../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr

  const { id } = await params
  if (user!.rol !== 'superadmin' && user!.empresa_id !== Number(id)) {
    return errorResponse('Sin permisos para esta acción', 403)
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase.from('empresas').select('*').eq('id', id).single()
  if (error) return errorResponse(error.message, 404)
  return Response.json(data)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin'])
  if (rolesErr) return rolesErr

  const { id } = await params
  const supabase = createServiceClient()
  const body = await request.json()
  const { data, error } = await supabase.from('empresas').update(body).eq('id', id).select().single()
  if (error) return errorResponse(error.message)
  return Response.json(data)
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return PUT(request, ctx)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin'])
  if (rolesErr) return rolesErr

  const { id } = await params
  const supabase = createServiceClient()
  // Soft-delete: desactivar empresa en lugar de borrar (preserva historial de OTs)
  const { data, error } = await supabase
    .from('empresas')
    .update({ activo: false })
    .eq('id', id)
    .select()
    .single()
  if (error) return errorResponse(error.message)
  return Response.json(data)
}
