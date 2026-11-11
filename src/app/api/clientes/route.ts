import { createServiceClient, errorResponse } from '../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function GET() {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (rolesErr) return rolesErr

  const supabase = createServiceClient()
  let query = supabase.from('clientes').select('*').order('nombre')
  if (user!.rol !== 'superadmin') {
    query = query.eq('empresa_id', user!.empresa_id)
  }
  const { data, error } = await query
  if (error) return errorResponse(error.message)
  return Response.json(data)
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (rolesErr) return rolesErr

  const supabase = createServiceClient()
  const body = await request.json()

  // Inyectar empresa_id del usuario autenticado si no viene en el body
  if (!body.empresa_id && user!.empresa_id) {
    body.empresa_id = user!.empresa_id
  }

  const { data, error } = await supabase.from('clientes').insert(body).select().single()
  if (error) return errorResponse(error.message)
  return Response.json(data, { status: 201 })
}
