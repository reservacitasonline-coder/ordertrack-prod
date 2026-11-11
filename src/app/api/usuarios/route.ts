import { createServiceClient, errorResponse } from '../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

export async function GET() {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin'])
  if (rolesErr) return rolesErr

  const supabase = createServiceClient()
  let query = supabase
    .from('usuarios')
    .select('id, nombre, email, rol, empresa_id, activo')
    .order('nombre')

  // admin solo ve usuarios de su empresa
  if (user!.rol !== 'superadmin') {
    query = query.eq('empresa_id', user!.empresa_id)
  }

  const { data, error } = await query
  if (error) return errorResponse(error.message)
  return Response.json(data)
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin'])
  if (rolesErr) return rolesErr

  const supabase = createServiceClient()
  const body = await request.json()

  // admin solo puede crear usuarios en su empresa
  if (user!.rol !== 'superadmin') {
    body.empresa_id = user!.empresa_id
  }

  const { password, ...profileData } = body

  // 1. Crear el usuario en Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: profileData.email,
    password,
    email_confirm: true,
  })
  if (authError) return errorResponse(authError.message)

  // 2. Insertar perfil en tabla usuarios usando supabase_uid
  const { data, error } = await supabase
    .from('usuarios')
    .insert({ ...profileData, supabase_uid: authData.user.id })
    .select()
    .single()
  if (error) {
    // Revertir auth user si falla el perfil
    await supabase.auth.admin.deleteUser(authData.user.id)
    return errorResponse(error.message)
  }
  return Response.json(data, { status: 201 })
}
