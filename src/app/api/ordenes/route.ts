import { createServiceClient, errorResponse } from '../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

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
  const page_size = Math.min(parseInt(searchParams.get('page_size') || '20'), 100)

  let query = supabase
    .from('ordenes_trabajo')
    .select('*, cliente:clientes(id,nombre,ruc), canal:canal_ingreso(id,nombre), tecnico_asignado:usuarios!tecnico_asignado_id(id,nombre,email)')
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
  return Response.json(data)
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  const body = await request.json()

  // Extraer campos que no van directamente en la tabla
  const { plantilla_ids, ...otFields } = body

  // Auto-generate codigo_interno
  const { count } = await supabase
    .from('ordenes_trabajo')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', user!.empresa_id ?? otFields.empresa_id)

  const prefix = 'OT'
  const num = String((count ?? 0) + 1).padStart(5, '0')
  const codigo_interno = `${prefix}-${num}`

  const { data, error } = await supabase
    .from('ordenes_trabajo')
    .insert({
      ...otFields,
      empresa_id: user!.empresa_id ?? otFields.empresa_id,
      codigo_interno,
      estado: 'RECIBIDA',
    })
    .select('*, cliente:clientes(id,nombre), canal:canal_ingreso(id,nombre), tecnico_asignado:usuarios!tecnico_asignado_id(id,nombre)')
    .single()

  if (error) return errorResponse(error.message)

  // Create initial audit event
  await supabase.from('ot_eventos').insert({
    ot_id: data.id,
    estado_anterior: null,
    estado_nuevo: 'RECIBIDA',
    usuario_id: user!.id,
    comentario: 'Orden de trabajo creada manualmente',
    origen: 'manual',
  })

  return Response.json(data, { status: 201 })
}
