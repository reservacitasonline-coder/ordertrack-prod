import { createServiceClient, errorResponse } from '../_lib/supabase-server'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, email, rol, empresa_id, activo')
    .order('nombre')
  if (error) return errorResponse(error.message)
  return Response.json(data)
}

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()
  const { data, error } = await supabase
    .from('usuarios')
    .insert(body)
    .select()
    .single()
  if (error) return errorResponse(error.message)
  return Response.json(data, { status: 201 })
}
