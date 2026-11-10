import { createServiceClient, errorResponse } from '../_lib/supabase-server'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('plantillas_trabajo')
    .select('*, plantilla_items(*)')
    .order('titulo')
  if (error) return errorResponse(error.message)
  return Response.json(data)
}

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()
  const { data, error } = await supabase.from('plantillas_trabajo').insert(body).select().single()
  if (error) return errorResponse(error.message)
  return Response.json(data, { status: 201 })
}
