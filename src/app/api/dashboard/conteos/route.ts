import { createServiceClient, errorResponse } from '../../_lib/supabase-server'

export async function GET() {
  const supabase = createServiceClient()

  const estados = ['RECIBIDA', 'EN_REVISION', 'APROBADA', 'PROGRAMADA', 'EN_EJECUCION',
                   'PAUSADA', 'ESPERANDO_REPUESTO', 'COMPLETADA', 'CERRADA', 'ANULADA', 'RECHAZADA']

  const counts = await Promise.all(
    estados.map(async (estado) => {
      const { count } = await supabase
        .from('ordenes_trabajo')
        .select('*', { count: 'exact', head: true })
        .eq('estado', estado)
      return { estado, count: count ?? 0 }
    })
  )

  if (!counts) return errorResponse('Error consultando conteos')

  const result = Object.fromEntries(counts.map(({ estado, count }) => [estado, count]))
  return Response.json(result)
}
