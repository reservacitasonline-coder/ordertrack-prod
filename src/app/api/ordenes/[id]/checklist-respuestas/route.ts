import { createServiceClient, errorResponse } from '../../../_lib/supabase-server'
import { getCurrentUser, requireAuth } from '@/lib/server-auth'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('ot_checklist_respuestas')
    .select('*, plantilla_item:plantilla_items(id,pregunta,tipo_respuesta,orden)')
    .eq('ot_id', id)

  if (error) return errorResponse(error.message)
  return Response.json(data)
}
