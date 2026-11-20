import { createServiceClient, errorResponse } from '../../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

const FIRMA_MIN_BYTES = 150
const FIRMA_MAX_BYTES = 1024 * 1024

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

  // Validate security checklist (validates linked safety templates if present, otherwise company general)
  let segItemsToValidate: { id: number; pregunta: string; requerido: boolean }[] = []
  try {
    const { data: linkedTemplates } = await supabase
      .from('ot_seguridad_plantillas')
      .select('plantilla_id')
      .eq('ot_id', id)

    if (linkedTemplates && linkedTemplates.length > 0) {
      const pids = linkedTemplates.map((r: { plantilla_id: number }) => r.plantilla_id)
      const { data: items } = await supabase
        .from('seguridad_items')
        .select('id,pregunta,requerido')
        .in('plantilla_id', pids)
      if (items && items.length > 0) {
        segItemsToValidate = items
      }
    }
  } catch {
    // Fallback if table does not exist
  }

  if (segItemsToValidate.length === 0) {
    const { data: segItems } = await supabase
      .from('seguridad_items')
      .select('id,pregunta,requerido')
      .eq('empresa_id', ot.empresa_id)
    segItemsToValidate = segItems ?? []
  }

  if (segItemsToValidate.length) {
    const { data: segResp } = await supabase.from('ot_seguridad_respuestas').select('seguridad_item_id').eq('ot_id', id)
    const respondedIds = new Set((segResp ?? []).map((r: { seguridad_item_id: number }) => r.seguridad_item_id))
    for (const item of segItemsToValidate) {
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

  // Firma real obligatoria: sin firma del cliente la orden no cierra
  if (typeof firma_base64 !== 'string' || !firma_base64.trim()) {
    return errorResponse('Falta la firma del cliente', 400)
  }
  if (!String(firma_nombre_cliente ?? '').trim() || !String(firma_documento_cliente ?? '').trim()) {
    return errorResponse('Faltan el nombre y el documento de quien firma', 400)
  }
  const base64Data = firma_base64.includes(',') ? firma_base64.split(',')[1] : firma_base64
  const buffer = Buffer.from(base64Data, 'base64')
  const esPng = buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  // Un PNG de 1 píxel pesa ~70 bytes; un trazo real, varios cientos como mínimo
  if (!esPng || buffer.length < FIRMA_MIN_BYTES) {
    return errorResponse('La firma no es válida. Pida al cliente que firme de nuevo.', 400)
  }
  if (buffer.length > FIRMA_MAX_BYTES) return errorResponse('La firma excede el tamaño permitido', 400)

  const firma_ruta = `firmas/${id}/${crypto.randomUUID()}.png`
  const { error: firmaErr } = await supabase.storage
    .from('adjuntos')
    .upload(firma_ruta, buffer, { contentType: 'image/png' })
  if (firmaErr) return errorResponse(`No se pudo guardar la firma: ${firmaErr.message}`)

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
