import { createServiceClient, errorResponse } from '../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function GET() {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin'])
  if (rolesErr) return rolesErr

  const supabase = createServiceClient()
  const { data, error } = await supabase.from('empresas').select('*').order('nombre')
  if (error) return errorResponse(error.message)
  return Response.json(data)
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin'])
  if (rolesErr) return rolesErr

  const supabase = createServiceClient()
  const body = await request.json()
  if (!body.api_key) {
    body.api_key = crypto.randomUUID()
  }
  const { data, error } = await supabase.from('empresas').insert(body).select().single()
  if (error) return errorResponse(error.message)
  return Response.json(data, { status: 201 })
}
