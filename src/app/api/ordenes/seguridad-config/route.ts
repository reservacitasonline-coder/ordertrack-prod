import { createServiceClient, errorResponse } from '../../_lib/supabase-server'
import { getCurrentUser, requireAuth } from '@/lib/server-auth'

export async function GET(request: Request) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('seguridad_items')
    .select('*')
    .eq('empresa_id', user!.empresa_id)
    .order('orden', { ascending: true })

  if (error) return errorResponse(error.message)
  return Response.json(data)
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr

  const supabase = createServiceClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('seguridad_items')
    .insert({ ...body, empresa_id: user!.empresa_id })
    .select()
    .single()

  if (error) return errorResponse(error.message)
  return Response.json(data, { status: 201 })
}
