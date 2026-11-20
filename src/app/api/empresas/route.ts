import { createServiceClient, errorResponse } from '../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function GET() {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin'])
  if (rolesErr) return rolesErr

  const supabase = createServiceClient()
  const { data, error } = await supabase.from('empresas').select('*').order('nombre')
  if (error) return errorResponse(error.message)
  return Response.json(data)
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin'])
  if (rolesErr) return rolesErr

  const supabase = createServiceClient()
  const body = await request.json().catch(() => null)
  const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : ''
  const ruc = typeof body?.ruc === 'string' ? body.ruc.trim() : ''
  if (!nombre || !ruc) return errorResponse('Nombre y RUC son obligatorios', 400)
  const apiKey = typeof body.api_key === 'string' && body.api_key.trim() ? body.api_key.trim() : crypto.randomUUID()

  const { data, error } = await supabase
    .from('empresas')
    .insert({ nombre, ruc, api_key: apiKey, activo: body.activo !== false })
    .select()
    .single()
  if (error) return errorResponse(error.message)

  // Una empresa nueva debe poder operar el primer día: checklist de seguridad y plantilla base
  const fallo = await sembrarConfiguracionBase(supabase, data.id)
  if (fallo) {
    await supabase.from('empresas').delete().eq('id', data.id)
    return errorResponse(`No se pudo configurar la empresa: ${fallo}`)
  }
  return Response.json(data, { status: 201 })
}

const SEGURIDAD_BASE: { pregunta: string; es_critico: boolean }[] = [
  { pregunta: '¿Cuenta con el equipo de protección personal (casco, guantes, botas)?', es_critico: true },
  { pregunta: '¿El área de trabajo está señalizada y despejada?', es_critico: false },
  { pregunta: '¿El equipo está desenergizado / bloqueado antes de intervenir?', es_critico: true },
  { pregunta: '¿Se identificaron riesgos del entorno (altura, electricidad, espacio confinado)?', es_critico: false },
]

const CHECKLIST_BASE: { pregunta: string; tipo_respuesta: string }[] = [
  { pregunta: 'Estado general del equipo al llegar', tipo_respuesta: 'TEXTO' },
  { pregunta: '¿Se realizó la inspección visual del equipo?', tipo_respuesta: 'SI_NO' },
  { pregunta: '¿El equipo funciona correctamente al finalizar?', tipo_respuesta: 'SI_NO' },
  { pregunta: 'Observaciones finales', tipo_respuesta: 'TEXTO' },
]

async function sembrarConfiguracionBase(
  supabase: ReturnType<typeof createServiceClient>,
  empresaId: number
): Promise<string | null> {
  // 1. Plantillas de Seguridad especializadas
  try {
    const { data: pSeg1 } = await supabase
      .from('plantillas_seguridad')
      .insert({
        empresa_id: empresaId,
        titulo: 'Seguridad Eléctrica: Las 5 Reglas de Oro (RETIE / NFPA 70E)',
        descripcion: 'Protocolo mandatorio para desenergización y aseguramiento de circuitos e instalaciones de baja y media tensión.',
        categoria: 'ELECTRICO',
        es_default: true,
      })
      .select('id')
      .single()

    const pSeg1Id = pSeg1?.id ?? null

    const { error: segErr } = await supabase.from('seguridad_items').insert(
      SEGURIDAD_BASE.map((it, i) => ({
        empresa_id: empresaId,
        plantilla_id: pSeg1Id,
        ...it,
        requerido: true,
        orden: i + 1,
      }))
    )
    if (segErr) return segErr.message
  } catch {
    const { error: segErr } = await supabase.from('seguridad_items').insert(
      SEGURIDAD_BASE.map((it, i) => ({ empresa_id: empresaId, ...it, requerido: true, orden: i + 1 }))
    )
    if (segErr) return segErr.message
  }

  const { data: plantilla, error: plErr } = await supabase
    .from('plantillas_trabajo')
    .insert({ empresa_id: empresaId, titulo: 'Mantenimiento general', tiempo_estimado_minutos: 60 })
    .select('id')
    .single()
  if (plErr || !plantilla) return plErr?.message ?? 'plantilla no creada'

  const { error: itErr } = await supabase.from('plantilla_items').insert(
    CHECKLIST_BASE.map((it, i) => ({ plantilla_id: plantilla.id, orden: i + 1, requerido: true, ...it }))
  )
  return itErr ? itErr.message : null
}
