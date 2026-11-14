import { createServiceClient, errorResponse } from '../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin'])
  if (rolesErr) return rolesErr

  const { id } = await params
  const supabase = createServiceClient()
  let query = supabase
    .from('usuarios')
    .select('id, nombre, email, rol, empresa_id, activo, created_at')
    .eq('id', id)

  // admin solo puede ver usuarios de su empresa
  if (user!.rol !== 'superadmin') {
    query = query.eq('empresa_id', user!.empresa_id)
  }

  const { data, error } = await query.single()
  if (error) return errorResponse(error.message, 404)
  return Response.json(data)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin'])
  if (rolesErr) return rolesErr

  const { id } = await params
  const supabase = createServiceClient()
  const body = await request.json()

  const { data: target } = await supabase
    .from('usuarios')
    .select('id, empresa_id, supabase_uid, email')
    .eq('id', id)
    .single()

  if (!target) {
    return errorResponse('Usuario no encontrado', 404)
  }

  // admin no puede cambiar empresa_id ni asignar superadmin
  if (user!.rol !== 'superadmin') {
    delete body.empresa_id
    if (body.rol === 'superadmin') {
      return Response.json({ detail: 'No puedes asignar rol superadmin' }, { status: 403 })
    }
    if (target.empresa_id !== user!.empresa_id) {
      return Response.json({ detail: 'Sin permisos para esta acción' }, { status: 403 })
    }
  }

  const { password, ...profileUpdates } = body

  if (target.supabase_uid && (password || (profileUpdates.email && profileUpdates.email !== target.email))) {
    const authUpdate: { password?: string; email?: string } = {}
    if (password && String(password).trim()) authUpdate.password = String(password).trim()
    if (profileUpdates.email && profileUpdates.email !== target.email) authUpdate.email = profileUpdates.email
    if (Object.keys(authUpdate).length > 0) {
      const { error: authErrUpdate } = await supabase.auth.admin.updateUserById(target.supabase_uid, authUpdate)
      if (authErrUpdate) return errorResponse(authErrUpdate.message)
    }
  }

  const { data, error } = await supabase.from('usuarios').update(profileUpdates).eq('id', id).select().single()
  if (error) return errorResponse(error.message)
  return Response.json(data)
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return PUT(request, ctx)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin'])
  if (rolesErr) return rolesErr

  const { id } = await params
  const supabase = createServiceClient()

  // admin solo puede desactivar usuarios de su empresa
  if (user!.rol !== 'superadmin') {
    const { data: target } = await supabase
      .from('usuarios').select('empresa_id').eq('id', id).single()
    if (!target || target.empresa_id !== user!.empresa_id) {
      return Response.json({ detail: 'Sin permisos para esta acción' }, { status: 403 })
    }
  }

  const { error } = await supabase.from('usuarios').update({ activo: false }).eq('id', id)
  if (error) return errorResponse(error.message)
  return new Response(null, { status: 204 })
}
