import { createServiceClient, errorResponse } from '../../../_lib/supabase-server'
import { getCurrentUser, requireAuth } from '@/lib/server-auth'

export async function DELETE(request: Request, { params }: { params: Promise<{ item_id: string }> }) {
  const { item_id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('seguridad_items')
    .delete()
    .eq('id', item_id)
    .eq('empresa_id', user!.empresa_id)

  if (error) return errorResponse(error.message)
  return new Response(null, { status: 204 })
}
