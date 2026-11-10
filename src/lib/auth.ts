// Auth delegado completamente a Supabase
// El frontend no maneja tokens JWT manualmente — Supabase los gestiona via cookies

import { createClient } from '@/lib/supabase/client'
import type { UsuarioResumen } from '@/types'

export async function signIn(email: string, password: string) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  return data
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
}

export async function getSession() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// Obtiene el perfil del usuario actual desde la API (server-side lookup en tabla usuarios)
export async function getCurrentUserProfile(): Promise<UsuarioResumen | null> {
  const session = await getSession()
  if (!session) return null
  try {
    const res = await fetch('/api/auth/me')
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
