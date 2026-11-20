import { createServiceClient, errorResponse } from '../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr

  const supabase = createServiceClient()
  let query = supabase
    .from('plantillas_seguridad')
    .select('*, items:seguridad_items(*)')
    .eq('id', id)

  if (user!.rol !== 'superadmin' && user!.empresa_id) {
    query = query.eq('empresa_id', user!.empresa_id)
  }

  const { data, error } = await query.single()
  if (error || !data) return errorResponse(error?.message || 'Plantilla de seguridad no encontrada', 404)
  return Response.json(data)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  const body = await request.json()

  // Verify ownership
  let checkQuery = supabase.from('plantillas_seguridad').select('id, empresa_id').eq('id', id)
  if (user!.rol !== 'superadmin' && user!.empresa_id) {
    checkQuery = checkQuery.eq('empresa_id', user!.empresa_id)
  }
  const { data: existing } = await checkQuery.single()
  if (!existing) return errorResponse('Plantilla no encontrada', 404)

  const { titulo, descripcion, categoria, es_default, items } = body

  // Update header
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (titulo !== undefined) updateData.titulo = String(titulo).trim()
  if (descripcion !== undefined) updateData.descripcion = descripcion ? String(descripcion).trim() : null
  if (categoria !== undefined) updateData.categoria = categoria
  if (es_default !== undefined) updateData.es_default = Boolean(es_default)

  const { error: updErr } = await supabase
    .from('plantillas_seguridad')
    .update(updateData)
    .eq('id', id)

  if (updErr) return errorResponse(updErr.message)

  // Re-sync items if provided
  if (Array.isArray(items)) {
    // Delete existing items for this template
    await supabase.from('seguridad_items').delete().eq('plantilla_id', id)

    // Re-insert
    if (items.length > 0) {
      const itemsToInsert = items.map((it: { pregunta: string; requerido?: boolean; es_critico?: boolean; orden?: number }, idx: number) => ({
        empresa_id: existing.empresa_id,
        plantilla_id: Number(id),
        pregunta: it.pregunta.trim(),
        requerido: it.requerido ?? true,
        es_critico: it.es_critico ?? false,
        orden: it.orden ?? idx + 1,
      }))
      await supabase.from('seguridad_items').insert(itemsToInsert)
    }
  }

  const { data: updated } = await supabase
    .from('plantillas_seguridad')
    .select('*, items:seguridad_items(*)')
    .eq('id', id)
    .single()

  return Response.json(updated)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()

  let checkQuery = supabase.from('plantillas_seguridad').select('id, empresa_id').eq('id', id)
  if (user!.rol !== 'superadmin' && user!.empresa_id) {
    checkQuery = checkQuery.eq('empresa_id', user!.empresa_id)
  }
  const { data: existing } = await checkQuery.single()
  if (!existing) return errorResponse('Plantilla no encontrada', 404)

  // Delete items first
  await supabase.from('seguridad_items').delete().eq('plantilla_id', id)
  const { error } = await supabase.from('plantillas_seguridad').delete().eq('id', id)
  if (error) return errorResponse(error.message)

  return Response.json({ success: true, message: 'Plantilla de seguridad eliminada' })
}
