import { createServiceClient, errorResponse } from '../_lib/supabase-server'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('repuestos').select('*').order('nombre')
  if (error) return errorResponse(error.message)
  return Response.json(data)
}

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()
  const { data, error } = await supabase.from('repuestos').insert(body).select().single()
  if (error) return errorResponse(error.message)
  return Response.json(data, { status: 201 })
}
