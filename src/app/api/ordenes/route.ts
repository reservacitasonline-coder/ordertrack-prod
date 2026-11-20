import { createServiceClient, errorResponse } from '../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'
import {
  ESTADOS_INICIALES,
  OT_CAMPOS_CREAR,
  esConflictoDeCodigo,
  pickCampos,
  siguienteCodigo,
  validarRefsOT,
} from '../_lib/ordenes'

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
  const body = (await request.json()) as Record<string, unknown>

  // Lista blanca: nunca volcar el body completo en la tabla (service role sin RLS).
  const otFields = pickCampos(body, OT_CAMPOS_CREAR)
  const plantilla_ids = Array.isArray(body.plantilla_ids) ? (body.plantilla_ids as unknown[]) : []
  const plantilla_seguridad_ids = Array.isArray(body.plantilla_seguridad_ids)
    ? (body.plantilla_seguridad_ids as unknown[])
    : []

  if (!otFields.cliente_id) return errorResponse('cliente_id es requerido', 400)

  let empresa_id = Number(
    user!.rol !== 'superadmin' ? user!.empresa_id : (body.empresa_id ?? user!.empresa_id)
  )
  if (!empresa_id && user!.rol === 'superadmin') {
    // Superadmin sin empresa propia: la orden hereda la empresa del cliente
    const { data: cli } = await supabase
      .from('clientes')
      .select('empresa_id')
      .eq('id', Number(otFields.cliente_id))
      .maybeSingle()
    empresa_id = Number(cli?.empresa_id)
  }
  if (!empresa_id) return errorResponse('empresa_id es requerido', 400)
  if (!otFields.titulo || !String(otFields.titulo).trim()) return errorResponse('titulo es requerido', 400)

  const resolvedTecnicoId = body.tecnico_asignado_id ?? body.tecnico_id ?? null

  const resolvedPlantillaId =
    body.plantilla_id !== undefined && body.plantilla_id !== null
      ? body.plantilla_id
      : plantilla_ids.length > 0
      ? Number(plantilla_ids[0])
      : null

  const estadoInicial = String(body.estado || 'RECIBIDA')
  if (!(ESTADOS_INICIALES as readonly string[]).includes(estadoInicial)) {
    return errorResponse(`No se puede crear una orden en estado ${estadoInicial}`, 400)
  }

  // Toda referencia debe pertenecer a la empresa de la orden
  const refErr = await validarRefsOT(supabase, empresa_id, {
    cliente_id: otFields.cliente_id,
    tecnico_asignado_id: resolvedTecnicoId,
    plantilla_id: resolvedPlantillaId,
    plantilla_ids,
    equipo_principal_id: otFields.equipo_principal_id,
  })
  if (refErr) return errorResponse(refErr, 400)

  // Generar codigo_interno con reintento optimista ante colisiones de concurrencia.
  // Se parte de la última OT regular: las reaperturas (OT-00012-R1) no cuentan.
  let data: Record<string, unknown> | null = null
  let insertError: { message: string; code?: string } | null = null

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: lastOt } = await supabase
      .from('ordenes_trabajo')
      .select('id, codigo_interno')
      .eq('empresa_id', empresa_id)
      .eq('es_reapertura', false)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()

    const codigo_interno = siguienteCodigo(lastOt?.codigo_interno, attempt)

    const res = await supabase
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

    if (!res.error && res.data) {
      data = res.data as unknown as Record<string, unknown>
      insertError = null
      break
    }

    insertError = res.error
    if (!esConflictoDeCodigo(res.error)) break
  }

  if (insertError || !data) return errorResponse(insertError?.message || 'Error al crear la orden')

  if (plantilla_ids.length > 0) {
    await supabase.from('ot_plantillas_association').insert(
      Array.from(new Set(plantilla_ids.map(Number))).map((pid) => ({
        ot_id: data.id,
        plantilla_id: pid,
      }))
    )
  }

  if (plantilla_seguridad_ids.length > 0) {
    try {
      await supabase.from('ot_seguridad_plantillas').insert(
        Array.from(new Set(plantilla_seguridad_ids.map(Number))).map((psid) => ({
          ot_id: data.id,
          plantilla_id: psid,
        }))
      )
    } catch (err) {
      console.warn('No se pudo vincular ot_seguridad_plantillas:', err)
    }
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
