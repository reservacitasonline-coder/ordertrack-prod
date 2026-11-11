import { createServiceClient, errorResponse } from '../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (rolesErr) return rolesErr

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('ot_encuestas')
    .select('*')
    .eq('ot_id', id)
    .order('created_at', { ascending: false })

  if (error) return errorResponse(error.message)

  // Mapear puntuacion → calificacion y comentario → comentarios para compatibilidad con el frontend
  const mapped = (data ?? []).map((e: Record<string, unknown>) => ({
    ...e,
    calificacion: e.puntuacion,
    comentarios: e.comentario,
  }))

  return Response.json(mapped)
}
