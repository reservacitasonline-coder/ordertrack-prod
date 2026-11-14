import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { CurrentUser, RolUsuario } from '@/types'

export type { CurrentUser }

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()

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

  const { data: { user } } = await anonClient.auth.getUser()
  if (!user) return null

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: {
        transport: class {
          constructor() {}
          on() {}
          connect() {}
          disconnect() {}
        } as unknown as never,
      },
    }
  )

  const { data, error } = await serviceClient
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

export function requireRoles(user: CurrentUser, roles: RolUsuario[]): Response | null {
  if (!roles.includes(user.rol)) {
    return Response.json({ detail: 'Sin permisos para esta acción' }, { status: 403 })
  }
  return null
}
