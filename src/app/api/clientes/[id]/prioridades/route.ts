import { createServiceClient, errorResponse } from '../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (rolesErr) return rolesErr

  const { id } = await params
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('prioridad_cliente')
    .select('*')
    .eq('cliente_id', id)
    .order('etiqueta_cliente')

  if (error) return errorResponse(error.message)
  return Response.json(data)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin'])
  if (rolesErr) return rolesErr

  const { id } = await params
  const supabase = createServiceClient()
  const body = await request.json()
  const { data, error } = await supabase
    .from('prioridad_cliente')
    .insert({ ...body, cliente_id: parseInt(id) })
    .select()
    .single()

  if (error) return errorResponse(error.message)
  return Response.json(data, { status: 201 })
}
