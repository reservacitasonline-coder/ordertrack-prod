import { createServiceClient, errorResponse } from '../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function GET() {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin'])
  if (rolesErr) return rolesErr

  const supabase = createServiceClient()
  let query = supabase
    .from('usuarios')
    .select('id, nombre, email, rol, empresa_id, activo')
    .order('nombre')

  // admin solo ve usuarios de su empresa
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
  const rolesErr = requireRoles(user!, ['superadmin', 'admin'])
  if (rolesErr) return rolesErr

  const supabase = createServiceClient()
  const body = await request.json()

  // admin solo puede crear usuarios en su empresa
  if (user!.rol !== 'superadmin') {
    body.empresa_id = user!.empresa_id
  }

  const { data, error } = await supabase.from('usuarios').insert(body).select().single()
  if (error) return errorResponse(error.message)
  return Response.json(data, { status: 201 })
}
