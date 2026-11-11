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

  const { data: original, error: fetchError } = await supabase
    .from('plantillas_trabajo')
    .select('*, plantilla_items(*)')
    .eq('id', id)
    .single()
  if (fetchError) return errorResponse(fetchError.message, 404)

  const { plantilla_items: items, id: _id, ...rest } = original
  const { data: nueva, error: insertError } = await supabase
    .from('plantillas_trabajo')
    .insert({ ...rest, titulo: `${rest.titulo} (copia)` })
    .select()
    .single()
  if (insertError) return errorResponse(insertError.message)

  if (items?.length) {
    const newItems = items.map(({ id: _iid, plantilla_id: _pid, ...item }: Record<string, unknown>) => ({
      ...item,
      plantilla_id: nueva.id,
    }))
    await supabase.from('plantilla_items').insert(newItems)
  }

  return Response.json(nueva, { status: 201 })
}
