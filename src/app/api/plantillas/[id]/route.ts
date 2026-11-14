import { createServiceClient, errorResponse } from '../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin', 'operador', 'tecnico'])
  if (rolesErr) return rolesErr

  const { id } = await params
  const supabase = createServiceClient()
  let query = supabase
    .from('plantillas_trabajo')
    .select('*, items:plantilla_items(*)')
    .eq('id', id)

  if (user!.rol !== 'superadmin' && user!.empresa_id) {
    query = query.eq('empresa_id', user!.empresa_id)
  }

  const { data, error } = await query.single()
  if (error || !data) return errorResponse('Plantilla no encontrada', 404)

  const items = Array.isArray(data.items)
    ? [...data.items].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    : []

  return Response.json({ ...data, items, plantilla_items: items })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin'])
  if (rolesErr) return rolesErr

  const { id } = await params
  const supabase = createServiceClient()

  let existingQuery = supabase.from('plantillas_trabajo').select('id, empresa_id').eq('id', id)
  if (user!.rol !== 'superadmin' && user!.empresa_id) {
    existingQuery = existingQuery.eq('empresa_id', user!.empresa_id)
  }
  const { data: existing } = await existingQuery.single()
  if (!existing) return errorResponse('Plantilla no encontrada', 404)

  const body = await request.json()
  const { items, ...rest } = body
  delete rest.empresa_id

  const { data: updated, error } = await supabase
    .from('plantillas_trabajo')
    .update({
      ...(rest.titulo !== undefined ? { titulo: rest.titulo } : {}),
      ...(rest.descripcion !== undefined ? { descripcion: rest.descripcion } : {}),
      ...(rest.tiempo_estimado_minutos !== undefined
        ? { tiempo_estimado_minutos: rest.tiempo_estimado_minutos }
        : {}),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) return errorResponse(error.message)

  let finalItems: unknown[] = []
  if (Array.isArray(items)) {
    await supabase.from('plantilla_items').delete().eq('plantilla_id', id)
    if (items.length > 0) {
      const payloadItems = items.map((it: Record<string, unknown>, idx: number) => ({
        plantilla_id: Number(id),
        pregunta: String(it.pregunta ?? ''),
        tipo_respuesta: it.tipo_respuesta ?? 'SI_NO',
        requerido: it.requerido ?? true,
        orden: typeof it.orden === 'number' ? it.orden : idx + 1,
      }))
      const { data: itemsData, error: itemsErr } = await supabase
        .from('plantilla_items')
        .insert(payloadItems)
        .select()
      if (itemsErr) return errorResponse(itemsErr.message)
      finalItems = itemsData ?? []
    }
  } else {
    const { data: existingItems } = await supabase
      .from('plantilla_items')
      .select('*')
      .eq('plantilla_id', id)
      .order('orden')
    finalItems = existingItems ?? []
  }

  return Response.json({ ...updated, items: finalItems })
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return PUT(request, ctx)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin'])
  if (rolesErr) return rolesErr

  const { id } = await params
  const supabase = createServiceClient()
  let query = supabase.from('plantillas_trabajo').delete().eq('id', id)
  if (user!.rol !== 'superadmin' && user!.empresa_id) {
    query = query.eq('empresa_id', user!.empresa_id)
  }
  const { error } = await query
  if (error) return errorResponse(error.message)
  return new Response(null, { status: 204 })
}
