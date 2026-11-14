import { createServiceClient, errorResponse } from '../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function GET() {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin', 'operador', 'tecnico'])
  if (rolesErr) return rolesErr

  const supabase = createServiceClient()
  let query = supabase.from('repuestos_materiales').select('*').order('nombre')
  if (user!.rol !== 'superadmin' && user!.empresa_id) {
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
  const empresa_id = user!.rol !== 'superadmin' ? user!.empresa_id : (body.empresa_id ?? user!.empresa_id)
  if (!empresa_id) return errorResponse('empresa_id es requerido', 400)

  const { data, error } = await supabase
    .from('repuestos_materiales')
    .insert({ ...body, empresa_id })
    .select()
    .single()
  if (error) return errorResponse(error.message)
  return Response.json(data, { status: 201 })
}
