import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Destino del enlace del correo de recuperación: canjea el código por una sesión
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const destino = searchParams.get('next') === '/restablecer' ? '/restablecer' : '/login'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${destino}`)
  }
  return NextResponse.redirect(`${origin}/recuperar?error=enlace`)
}
