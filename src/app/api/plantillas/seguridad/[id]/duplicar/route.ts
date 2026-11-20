import { createServiceClient, errorResponse } from '../../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()

  // Fetch original
  let query = supabase.from('plantillas_seguridad').select('*, items:seguridad_items(*)').eq('id', id)
  if (user!.rol !== 'superadmin' && user!.empresa_id) {
    query = query.eq('empresa_id', user!.empresa_id)
  }
  const { data: original, error: origErr } = await query.single()
  if (origErr || !original) return errorResponse('Plantilla original no encontrada', 404)

  // Duplicate header
  const { data: copy, error: copyErr } = await supabase
    .from('plantillas_seguridad')
    .insert({
      empresa_id: original.empresa_id,
      titulo: `${original.titulo} (Copia)`,
      descripcion: original.descripcion,
      categoria: original.categoria,
      es_default: false,
    })
    .select()
    .single()

  if (copyErr || !copy) return errorResponse(`Error al duplicar plantilla: ${copyErr?.message}`)

  // Duplicate items
  if (Array.isArray(original.items) && original.items.length > 0) {
    const itemsCopy = original.items.map((it: { pregunta: string; requerido: boolean; es_critico: boolean; orden: number }) => ({
      empresa_id: original.empresa_id,
      plantilla_id: copy.id,
      pregunta: it.pregunta,
      requerido: it.requerido,
      es_critico: it.es_critico,
      orden: it.orden,
    }))
    await supabase.from('seguridad_items').insert(itemsCopy)
  }

  const { data: complete } = await supabase
    .from('plantillas_seguridad')
    .select('*, items:seguridad_items(*)')
    .eq('id', copy.id)
    .single()

  return Response.json(complete || copy, { status: 201 })
}
