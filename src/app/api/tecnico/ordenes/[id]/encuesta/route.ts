import { createServiceClient, errorResponse } from '../../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['tecnico'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  const { puntuacion, comentario } = await request.json()

  const { data: ot } = await supabase.from('ordenes_trabajo').select('tecnico_asignado_id').eq('id', id).single()
  if (!ot || ot.tecnico_asignado_id !== user!.id) return errorResponse('No tiene asignada esta orden', 403)

  if (puntuacion < 1 || puntuacion > 5) return errorResponse('La puntuación debe estar entre 1 y 5', 400)

  const { data, error } = await supabase
    .from('ot_encuestas')
    .insert({ ot_id: parseInt(id), puntuacion, comentario: comentario ?? null })
    .select()
    .single()

  if (error) return errorResponse(error.message)
  return Response.json(data, { status: 201 })
}
