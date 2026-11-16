import { createServiceClient, errorResponse, verifyOtAccess } from '../../../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

const BUCKET_NAME = 'borradores'
const MAX_PAYLOAD_SIZE = 512 * 1024 // 512 KB

const ALLOWED_KEYS = [
  'currentStep',
  'aceptada',
  'aceptadaFecha',
  'aceptadaHora',
  'aceptadaGps',
  'seguridadRespuestas',
  'seguridadJustificaciones',
  'checklistRespuestas',
  'checklistFotosAntes',
  'checklistFotosDespues',
  'repuestosCantidades',
  'repuestosFotosAntes',
  'repuestosFotosDespues',
  'noRepuestosUsed',
  'firmaSaved',
  'firmaDataUrl',
  'firmaNombreCliente',
  'firmaDocumentoCliente',
  'firmaFotoEvidencia',
] as const

function sanitizeProgreso(raw: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}
  for (const key of ALLOWED_KEYS) {
    if (key in raw) {
      sanitized[key] = raw[key]
    }
  }

  // Validaciones básicas de tipo y tamaño
  if (typeof sanitized.currentStep === 'number') {
    sanitized.currentStep = Math.min(Math.max(1, Math.floor(sanitized.currentStep)), 5)
  }

  if (typeof sanitized.firmaNombreCliente === 'string') {
    sanitized.firmaNombreCliente = sanitized.firmaNombreCliente.slice(0, 200)
  }
  if (typeof sanitized.firmaDocumentoCliente === 'string') {
    sanitized.firmaDocumentoCliente = sanitized.firmaDocumentoCliente.slice(0, 50)
  }
  if (typeof sanitized.firmaFotoEvidencia === 'string') {
    sanitized.firmaFotoEvidencia = sanitized.firmaFotoEvidencia.slice(0, 500)
  }
  if (typeof sanitized.firmaDataUrl === 'string' && sanitized.firmaDataUrl.length > 300 * 1024) {
    // Si la firma en base64 excede 300KB, truncar o descartar para evitar abuso
    sanitized.firmaDataUrl = undefined
  }

  return sanitized
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['tecnico', 'admin', 'operador', 'superadmin'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  // Solo se exige que sea el técnico asignado si el rol del usuario autenticado es 'tecnico'
  // Los roles de admin, operador y superadmin pueden supervisar el progreso sin restricción
  const requireAssigned = user!.rol === 'tecnico'
  const { ot, error: accessErr } = await verifyOtAccess(supabase, id, user!, { requireAssignedTech: requireAssigned })
  if (accessErr || !ot) return accessErr || errorResponse('Orden no encontrada', 404)

  let draftData: Record<string, unknown> | null = null

  // 1. Cargar borrador privado desde el bucket seguro 'borradores' (public: false)
  const { data: fileData, error: fileErr } = await supabase.storage
    .from(BUCKET_NAME)
    .download(`${id}/progreso.json`)

  if (!fileErr && fileData) {
    try {
      const text = await fileData.text()
      draftData = JSON.parse(text)
    } catch (e) {
      console.error('Error parsing draft JSON from private storage:', e)
    }
  }

  // 2. Si no hay borrador guardado o faltan respuestas, rehidratar desde la base de datos
  if (!draftData) {
    const [segResp, chkResp, repResp] = await Promise.all([
      supabase.from('ot_seguridad_respuestas').select('seguridad_item_id, cumple, motivo_no_cumplimiento').eq('ot_id', id),
      supabase.from('ot_checklist_respuestas').select('plantilla_item_id, valor_booleano, foto_antes, foto_despues').eq('ot_id', id),
      supabase.from('ot_repuestos_usados').select('material_id, cantidad, foto_antes, foto_despues').eq('ot_id', id),
    ])

    const seguridadRespuestas: Record<number, 'si' | 'no' | 'na'> = {}
    const seguridadJustificaciones: Record<number, string> = {}
    for (const s of segResp.data ?? []) {
      seguridadRespuestas[s.seguridad_item_id] = s.cumple === true ? 'si' : s.cumple === false ? 'no' : 'na'
      if (s.motivo_no_cumplimiento) {
        seguridadJustificaciones[s.seguridad_item_id] = s.motivo_no_cumplimiento
      }
    }

    const checklistRespuestas: Record<number, 'correcto' | 'pendiente'> = {}
    const checklistFotosAntes: Record<number, string> = {}
    const checklistFotosDespues: Record<number, string> = {}
    for (const c of chkResp.data ?? []) {
      checklistRespuestas[c.plantilla_item_id] = c.valor_booleano ? 'correcto' : 'pendiente'
      if (c.foto_antes) checklistFotosAntes[c.plantilla_item_id] = c.foto_antes
      if (c.foto_despues) checklistFotosDespues[c.plantilla_item_id] = c.foto_despues
    }

    // Clave = id de material (como string), igual que en la app del técnico
    const repuestosCantidades: Record<string, number> = {}
    const repuestosFotosAntes: Record<string, string> = {}
    const repuestosFotosDespues: Record<string, string> = {}
    let repCount = 0
    for (const r of (repResp.data ?? []) as Array<{ material_id?: number; cantidad?: number; foto_antes?: string; foto_despues?: string }>) {
      const name = r.material_id ? String(r.material_id) : ''
      if (name) {
        repuestosCantidades[name] = Number(r.cantidad || 0)
        if (r.foto_antes) repuestosFotosAntes[name] = r.foto_antes
        if (r.foto_despues) repuestosFotosDespues[name] = r.foto_despues
        if (Number(r.cantidad || 0) > 0) repCount++
      }
    }

    let calculatedStep = 1
    const isOtAccepted = ot.estado === 'EN_EJECUCION' || Boolean((ot as Record<string, unknown>).fecha_salida)
    if (isOtAccepted) calculatedStep = 2
    if ((ot as Record<string, unknown>).fecha_llegada) calculatedStep = Math.max(calculatedStep, 2)
    if (Object.keys(seguridadRespuestas).length > 0) calculatedStep = Math.max(calculatedStep, 3)
    if (Object.keys(checklistRespuestas).length > 0) calculatedStep = Math.max(calculatedStep, 4)
    if (repCount > 0) calculatedStep = Math.max(calculatedStep, 5)

    draftData = {
      currentStep: calculatedStep,
      aceptada: isOtAccepted,
      seguridadRespuestas,
      seguridadJustificaciones,
      checklistRespuestas,
      checklistFotosAntes,
      checklistFotosDespues,
      repuestosCantidades,
      repuestosFotosAntes,
      repuestosFotosDespues,
      noRepuestosUsed: repCount === 0 && calculatedStep > 4,
      firmaSaved: false,
      firmaNombreCliente: ((ot as Record<string, unknown>).firma_nombre_cliente as string) || '',
      firmaDocumentoCliente: ((ot as Record<string, unknown>).firma_documento_cliente as string) || '',
      firmaFotoEvidencia: ((ot as Record<string, unknown>).firma_foto_evidencia as string) || '',
    }
  }

  return Response.json({ progreso: draftData })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['tecnico', 'admin', 'operador', 'superadmin'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  const requireAssigned = user!.rol === 'tecnico'
  const { ot, error: accessErr } = await verifyOtAccess(supabase, id, user!, { requireAssignedTech: requireAssigned })
  if (accessErr || !ot) return accessErr || errorResponse('Orden no encontrada', 404)
  // Orden pausada por repuestos: no se registra avance hasta que se entreguen
  if (ot.estado === 'ESPERANDO_REPUESTO') {
    return errorResponse('La orden está en espera de repuesto. No se puede registrar avance hasta la entrega.', 409)
  }

  const rawText = await request.text()
  if (rawText.length > MAX_PAYLOAD_SIZE) {
    return errorResponse('El tamaño del progreso excede el máximo permitido (512KB)', 413)
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawText)
  } catch {
    return errorResponse('JSON inválido', 400)
  }

  const rawProgreso = (body.progreso !== undefined ? body.progreso : body) as Record<string, unknown>
  if (typeof rawProgreso !== 'object' || rawProgreso === null || Array.isArray(rawProgreso)) {
    return errorResponse('El payload de progreso debe ser un objeto válido', 400)
  }

  const sanitized = sanitizeProgreso(rawProgreso)
  const buffer = Buffer.from(JSON.stringify(sanitized))

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(`${id}/progreso.json`, buffer, {
      contentType: 'application/json',
      upsert: true,
    })

  if (uploadErr) return errorResponse(uploadErr.message)

  return Response.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['tecnico', 'admin', 'operador', 'superadmin'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  const requireAssigned = user!.rol === 'tecnico'
  const { error: accessErr } = await verifyOtAccess(supabase, id, user!, { requireAssignedTech: requireAssigned })
  if (accessErr) return accessErr

  await supabase.storage.from(BUCKET_NAME).remove([`${id}/progreso.json`])
  return Response.json({ ok: true })
}
