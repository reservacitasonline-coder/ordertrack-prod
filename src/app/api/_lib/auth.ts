import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createServiceClient } from './supabase-server'

export interface CurrentUser {
  id: number
  supabase_uid: string
  email: string
  nombre: string
  rol: 'superadmin' | 'admin' | 'operador' | 'tecnico'
  empresa_id: number | null
  activo: boolean
}

export async function getCurrentUser(_request: Request): Promise<CurrentUser | null> {
  const cookieStore = await cookies()

  const allCookies = cookieStore.getAll()
  const supabaseCookies = allCookies.filter(c => c.name.includes('sb-'))
  console.log('[getCurrentUser] cookies sb-*:', supabaseCookies.map(c => `${c.name}=${c.value.slice(0,30)}...`))

  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return allCookies },
        setAll() {},
      },
    }
  )

  const { data: { user }, error: authError } = await anonClient.auth.getUser()
  console.log('[getCurrentUser] getUser result:', user?.id ?? null, 'error:', authError?.message ?? null)
  if (!user) return null

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('supabase_uid', user.id)
    .eq('activo', true)
    .single()

  if (error || !data) return null
  return data as CurrentUser
}

export function requireAuth(user: CurrentUser | null): Response | null {
  if (!user) return Response.json({ detail: 'No autenticado' }, { status: 401 })
  return null
}

export function requireRoles(user: CurrentUser, roles: string[]): Response | null {
  if (!roles.includes(user.rol)) {
    return Response.json({ detail: 'Sin permisos para esta acción' }, { status: 403 })
  }
  return null
}
