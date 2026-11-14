import { createServiceClient, errorResponse } from '../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

const OT_LIST_SELECT =
  '*, cliente:clientes(id,nombre,ruc,telefono), canal:canal_ingreso(id,nombre), tecnico_asignado:usuarios!tecnico_asignado_id(id,nombre,email), plantilla:plantillas_trabajo!plantilla_id(id,titulo,tiempo_estimado_minutos), ot_plantillas:ot_plantillas_association(plantilla:plantillas_trabajo(id,titulo,tiempo_estimado_minutos))'

function normalizeOT(row: Record<string, unknown>) {
  const assoc = Array.isArray(row.ot_plantillas) ? row.ot_plantillas : []
  const fromAssoc = assoc
    .map((a: { plantilla?: unknown }) => a?.plantilla)
    .filter(Boolean) as { id: number; titulo: string; tiempo_estimado_minutos: number }[]
  const singlePlan = row.plantilla as { id: number; titulo: string; tiempo_estimado_minutos: number } | null
  const plantillas =
    fromAssoc.length > 0
      ? fromAssoc
      : singlePlan
      ? [singlePlan]
      : []
  const copy = { ...row, plantillas }
  delete (copy as Record<string, unknown>).ot_plantillas
  return copy
}

export async function GET(request: Request) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr

  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)
  const estado = searchParams.get('estado')
  const prioridad = searchParams.get('prioridad')
  const cliente_id = searchParams.get('cliente_id')
  const tecnico_asignado_id = searchParams.get('tecnico_asignado_id')
  const canal_id = searchParams.get('canal_id')
  const q = searchParams.get('q')
  const page = parseInt(searchParams.get('page') || '1')
  const page_size = Math.min(parseInt(searchParams.get('page_size') || '100'), 200)

  let query = supabase
    .from('ordenes_trabajo')
    .select(OT_LIST_SELECT)
    .order('id', { ascending: false })
    .range((page - 1) * page_size, page * page_size - 1)

  // Enterprise isolation
  if (user!.rol !== 'superadmin') {
    query = query.eq('empresa_id', user!.empresa_id)
    if (user!.rol === 'tecnico') {
      query = query.eq('tecnico_asignado_id', user!.id)
    } else if (tecnico_asignado_id) {
      query = query.eq('tecnico_asignado_id', tecnico_asignado_id)
    }
  } else if (tecnico_asignado_id) {
    query = query.eq('tecnico_asignado_id', tecnico_asignado_id)
  }

  if (estado) query = query.eq('estado', estado)
  if (prioridad) query = query.eq('prioridad', prioridad)
  if (cliente_id) query = query.eq('cliente_id', cliente_id)
  if (canal_id) query = query.eq('canal_id', canal_id)
  if (q) query = query.or(`titulo.ilike.%${q}%,codigo_interno.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return errorResponse(error.message)
  return Response.json((data ?? []).map((r) => normalizeOT(r as Record<string, unknown>)))
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  const body = await request.json()

  // Extraer campos que no van directamente en la tabla o tienen alias
  const { plantilla_ids, tecnico_id, ...otFields } = body
  const empresa_id = user!.rol !== 'superadmin' ? user!.empresa_id : (otFields.empresa_id ?? user!.empresa_id)
  if (!empresa_id) return errorResponse('empresa_id es requerido', 400)

  // Generar codigo_interno sin colisiones usando el mayor ID existente + conteo
  const { data: lastOt } = await supabase
    .from('ordenes_trabajo')
    .select('id, codigo_interno')
    .eq('empresa_id', empresa_id)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  let nextNum = 1
  if (lastOt?.codigo_interno) {
    const match = String(lastOt.codigo_interno).match(/(\d+)$/)
    if (match) nextNum = parseInt(match[1], 10) + 1
    else nextNum = (lastOt.id ?? 0) + 1
  }
  const codigo_interno = `OT-${String(nextNum).padStart(5, '0')}`

  const resolvedTecnicoId =
    otFields.tecnico_asignado_id !== undefined
      ? otFields.tecnico_asignado_id
      : tecnico_id !== undefined
      ? tecnico_id
      : null

  const resolvedPlantillaId =
    otFields.plantilla_id !== undefined
      ? otFields.plantilla_id
      : Array.isArray(plantilla_ids) && plantilla_ids.length > 0
      ? Number(plantilla_ids[0])
      : null

  const estadoInicial = otFields.estado || 'RECIBIDA'

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .insert({
      ...otFields,
      empresa_id,
      codigo_interno,
      estado: estadoInicial,
      tecnico_asignado_id: resolvedTecnicoId,
      plantilla_id: resolvedPlantillaId,
      canal_id: otFields.canal_id ?? 1, // 1 = Manual por defecto
    })
    .select(OT_LIST_SELECT)
    .single()

  if (error) return errorResponse(error.message)

  if (Array.isArray(plantilla_ids) && plantilla_ids.length > 0) {
    await supabase.from('ot_plantillas_association').insert(
      plantilla_ids.map((pid: number) => ({
        ot_id: data.id,
        plantilla_id: Number(pid),
      }))
    )
  }

  // Create initial audit event
  await supabase.from('ot_eventos').insert({
    ot_id: data.id,
    estado_anterior: null,
    estado_nuevo: estadoInicial,
    usuario_id: user!.id,
    comentario: 'Orden de trabajo creada manualmente',
    origen: 'manual',
  })

  return Response.json(normalizeOT(data as Record<string, unknown>), { status: 201 })
}
