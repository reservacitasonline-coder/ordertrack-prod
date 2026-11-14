import { createServiceClient, errorResponse } from '../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin'])
  if (rolesErr) return rolesErr

  const { id } = await params
  const supabase = createServiceClient()

  let query = supabase
    .from('plantillas_trabajo')
    .select('*, plantilla_items(*)')
    .eq('id', id)

  if (user!.rol !== 'superadmin' && user!.empresa_id) {
    query = query.eq('empresa_id', user!.empresa_id)
  }

  const { data: original, error: fetchError } = await query.single()
  if (fetchError || !original) return errorResponse('Plantilla no encontrada', 404)

  const { plantilla_items: items, ...rest } = original
  delete (rest as Record<string, unknown>).id
  delete (rest as Record<string, unknown>).created_at
  delete (rest as Record<string, unknown>).updated_at

  const { data: nueva, error: insertError } = await supabase
    .from('plantillas_trabajo')
    .insert({ ...rest, titulo: `${rest.titulo} (copia)` })
    .select()
    .single()
  if (insertError) return errorResponse(insertError.message)

  let insertedItems: unknown[] = []
  if (items?.length) {
    const newItems = items.map((item: Record<string, unknown>) => {
      const copy: Record<string, unknown> = { ...item, plantilla_id: nueva.id }
      delete copy.id
      delete copy.created_at
      return copy
    })
    const { data: itemsData } = await supabase.from('plantilla_items').insert(newItems).select()
    insertedItems = itemsData ?? []
  }

  return Response.json({ ...nueva, items: insertedItems }, { status: 201 })
}
