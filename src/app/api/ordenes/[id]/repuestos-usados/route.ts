import { createServiceClient, errorResponse, verifyOtAccess } from '../../../_lib/supabase-server'
import { getCurrentUser, requireAuth } from '@/lib/server-auth'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr

  const supabase = createServiceClient()
  const { error: accessErr } = await verifyOtAccess(supabase, id, user!, { requireAssignedTech: true })
  if (accessErr) return accessErr

  const { data, error } = await supabase
    .from('ot_repuestos_usados')
    .select('*, material:repuestos_materiales(id,nombre,codigo,unidad_medida)')
    .eq('ot_id', id)

  if (error) return errorResponse(error.message)
  return Response.json(data)
}
