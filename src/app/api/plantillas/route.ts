import { createServiceClient, errorResponse } from '../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function GET() {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin', 'operador', 'tecnico'])
  if (rolesErr) return rolesErr

  const supabase = createServiceClient()
  let query = supabase
    .from('plantillas_trabajo')
    .select('*, items:plantilla_items(*)')
    .order('titulo')

  if (user!.rol !== 'superadmin' && user!.empresa_id) {
    query = query.eq('empresa_id', user!.empresa_id)
  }

  const { data, error } = await query
  if (error) return errorResponse(error.message)

  const normalized = (data ?? []).map((p) => ({
    ...p,
    items: Array.isArray(p.items)
      ? [...p.items].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      : [],
  }))
  return Response.json(normalized)
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin'])
  if (rolesErr) return rolesErr

  const supabase = createServiceClient()
  const body = await request.json()
  const { items, ...rest } = body
  const empresa_id = user!.rol !== 'superadmin' ? user!.empresa_id : (rest.empresa_id ?? user!.empresa_id)
  if (!empresa_id) return errorResponse('empresa_id es requerido', 400)

  const { data: created, error } = await supabase
    .from('plantillas_trabajo')
    .insert({
      titulo: rest.titulo,
      descripcion: rest.descripcion ?? null,
      tiempo_estimado_minutos: rest.tiempo_estimado_minutos ?? 60,
      empresa_id,
    })
    .select()
    .single()
  if (error) return errorResponse(error.message)

  let insertedItems: unknown[] = []
  if (Array.isArray(items) && items.length > 0) {
    const payloadItems = items.map((it: Record<string, unknown>, idx: number) => ({
      plantilla_id: created.id,
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
    insertedItems = itemsData ?? []
  }

  return Response.json({ ...created, items: insertedItems }, { status: 201 })
}
