import { createServiceClient, errorResponse } from '../../../_lib/supabase-server'
import { getCurrentUser, requireAuth } from '../../../_lib/auth'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser(request)
  const authErr = requireAuth(user)
  if (authErr) return authErr

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('ot_eventos')
    .select('*, usuario:usuarios(id,nombre)')
    .eq('ot_id', id)
    .order('id', { ascending: false })

  if (error) return errorResponse(error.message)
  return Response.json(data)
}
