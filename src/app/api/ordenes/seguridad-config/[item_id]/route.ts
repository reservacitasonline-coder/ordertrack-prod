import { createServiceClient, errorResponse } from '../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function DELETE(_request: Request, { params }: { params: Promise<{ item_id: string }> }) {
  const { item_id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  let query = supabase
    .from('seguridad_items')
    .delete()
    .eq('id', item_id)

  if (user!.rol !== 'superadmin' && user!.empresa_id) {
    query = query.eq('empresa_id', user!.empresa_id)
  }

  const { error } = await query
  if (error) return errorResponse(error.message)
  return new Response(null, { status: 204 })
}
