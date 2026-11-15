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
  const body = await request.json()
  const { firma_base64, firma_nombre_cliente, firma_documento_cliente, firma_foto_evidencia, comentario } = body

  const { data: ot } = await supabase.from('ordenes_trabajo').select('*').eq('id', id).single()
  if (!ot) return errorResponse('Orden no encontrada', 404)
  if (ot.tecnico_asignado_id !== user!.id) return errorResponse('No tiene asignada esta orden', 403)

  if (!['EN_EJECUCION', 'ESPERANDO_REPUESTO', 'PRECIERRE'].includes(ot.estado)) {
    return errorResponse('La orden debe estar EN_EJECUCION o PRECIERRE para cerrarse', 400)
  }

  // Validate no pending parts
  const { data: pendientes } = await supabase
    .from('ot_repuestos_pendientes')
    .select('id')
    .eq('ot_id', id)
    .in('estado', ['SOLICITADO', 'EN_CAMINO'])
  if (pendientes?.length) return errorResponse('Existen repuestos pendientes sin entregar', 400)

  // Validate security checklist
  const { data: segItems } = await supabase.from('seguridad_items').select('id,pregunta,requerido').eq('empresa_id', ot.empresa_id)
  if (segItems?.length) {
    const { data: segResp } = await supabase.from('ot_seguridad_respuestas').select('seguridad_item_id').eq('ot_id', id)
    const respondedIds = new Set((segResp ?? []).map((r: { seguridad_item_id: number }) => r.seguridad_item_id))
    for (const item of segItems) {
      if (item.requerido && !respondedIds.has(item.id)) {
        return errorResponse(`Falta checklist de seguridad obligatorio: "${item.pregunta}"`, 400)
      }
    }
  }

  // Validate checklist if template(s) linked
  const { data: assocPlans } = await supabase
    .from('ot_plantillas_association')
    .select('plantilla_id')
    .eq('ot_id', id)
  const plantillaIds = Array.from(
    new Set([
      ...(ot.plantilla_id ? [ot.plantilla_id] : []),
      ...(assocPlans ?? []).map((a: { plantilla_id: number }) => a.plantilla_id),
    ])
  )
  if (plantillaIds.length > 0) {
    const { data: items } = await supabase
      .from('plantilla_items')
      .select('*')
      .in('plantilla_id', plantillaIds)
      .eq('requerido', true)
    if (items?.length) {
      const { data: resps } = await supabase.from('ot_checklist_respuestas').select('plantilla_item_id').eq('ot_id', id)
      const respondedIds = new Set((resps ?? []).map((r: { plantilla_item_id: number }) => r.plantilla_item_id))
      for (const item of items) {
        if (!respondedIds.has(item.id)) {
          return errorResponse(`Falta ítem obligatorio del checklist: "${item.pregunta}"`, 400)
        }
      }
    }
  }

  // Upload signature to Supabase Storage
  let firma_ruta: string | null = null
  if (firma_base64) {
    try {
      const base64Data = firma_base64.includes(',') ? firma_base64.split(',')[1] : firma_base64
      const buffer = Buffer.from(base64Data, 'base64')
      const sigName = `firmas/${id}/${crypto.randomUUID()}.png`
      await supabase.storage.from('adjuntos').upload(sigName, buffer, { contentType: 'image/png' })
      firma_ruta = sigName
    } catch {
      return errorResponse('Firma digital inválida', 400)
    }
  }

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .update({
      estado: 'COMPLETADA',
      fecha_cierre: new Date().toISOString(),
      firma_cliente: firma_ruta,
      firma_nombre_cliente,
      firma_documento_cliente,
      firma_foto_evidencia,
    })
    .eq('id', id)
    .select('*, cliente:clientes(id,nombre), canal:canal_ingreso(id,nombre)')
    .single()

  if (error) return errorResponse(error.message)

  await supabase.from('ot_eventos').insert({
    ot_id: parseInt(id),
    estado_anterior: ot.estado,
    estado_nuevo: 'COMPLETADA',
    usuario_id: user!.id,
    comentario: `Cierre completado. ${comentario || ''}`.trim(),
    origen: 'manual',
  })

  // Limpiar borrador de progreso del técnico del bucket privado
  await supabase.storage.from('borradores').remove([`${id}/progreso.json`]).catch(() => {})

  return Response.json(data)
}
