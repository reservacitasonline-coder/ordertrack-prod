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

  let query = supabase
    .from('ot_notas')
    .select('*, usuario:usuarios(id,nombre)')
    .eq('ot_id', id)
    .order('id', { ascending: false })

  if (user!.rol === 'tecnico') {
    query = query.eq('es_interna', false)
  }

  const { data, error } = await query

  if (error) return errorResponse(error.message)
  return Response.json(data)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr

  const supabase = createServiceClient()
  const { error: accessErr } = await verifyOtAccess(supabase, id, user!, { requireAssignedTech: true })
  if (accessErr) return accessErr

  const { contenido, es_interna = false } = await request.json()
  const finalEsInterna = user!.rol === 'tecnico' ? false : Boolean(es_interna)

  const { data, error } = await supabase
    .from('ot_notas')
    .insert({ ot_id: parseInt(id), usuario_id: user!.id, contenido, es_interna: finalEsInterna })
    .select('*, usuario:usuarios(id,nombre)')
    .single()

  if (error) return errorResponse(error.message)
  return Response.json(data, { status: 201 })
}
