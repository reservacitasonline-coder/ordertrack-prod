import { createServiceClient, errorResponse } from '../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin'])
  if (rolesErr) return rolesErr

  const { id } = await params
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
