import { createServiceClient, errorResponse } from '../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

interface OtResumen {
  id: number
  estado: string | null
  prioridad: string | null
  fecha_salida: string | null
  fecha_llegada: string | null
  fecha_inicio_real: string | null
  fecha_cierre: string | null
  plantilla_id: number | null
  tecnico_asignado: { id: number; nombre: string } | { id: number; nombre: string }[] | null
}

export async function GET() {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const rolesErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (rolesErr) return rolesErr

  const supabase = createServiceClient()
  if (user!.rol !== 'superadmin' && !user!.empresa_id) {
    return errorResponse('Usuario sin empresa asignada', 403)
  }

  // Supabase devuelve como máximo 1000 filas por consulta: paginar para que
  // los conteos no se queden cortos cuando la empresa supera ese volumen.
  const PAGE = 1000
  const ots: OtResumen[] = []
  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from('ordenes_trabajo')
      .select('id, estado, prioridad, fecha_salida, fecha_llegada, fecha_inicio_real, fecha_cierre, plantilla_id, tecnico_asignado:usuarios!tecnico_asignado_id(id, nombre)')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)

    if (user!.rol !== 'superadmin') {
      query = query.eq('empresa_id', user!.empresa_id)
    }

    const { data: page, error } = await query
    if (error) return errorResponse(error.message)
    ots.push(...((page ?? []) as unknown as OtResumen[]))
    if (!page || page.length < PAGE) break
  }

  const estados = [
    'RECIBIDA', 'EN_REVISION', 'APROBADA', 'PROGRAMADA', 'EN_EJECUCION',
    'PAUSADA', 'ESPERANDO_REPUESTO', 'PRECIERRE', 'COMPLETADA', 'CERRADA', 'ANULADA', 'RECHAZADA',
  ]
  const prioridades = ['baja', 'media', 'alta', 'critica']

  const por_estado: Record<string, number> = Object.fromEntries(estados.map((e) => [e, 0]))
  const por_prioridad: Record<string, number> = Object.fromEntries(prioridades.map((p) => [p, 0]))

  let totalTrasladoMin = 0
  let countTraslado = 0
  let totalEjecucionMin = 0
  let countEjecucion = 0
  let countConChecklist = 0
  const rankingMap = new Map<string, number>()

  for (const ot of ots ?? []) {
    if (ot.estado && por_estado[ot.estado] !== undefined) {
      por_estado[ot.estado] += 1
    }
    if (ot.prioridad && por_prioridad[ot.prioridad] !== undefined) {
      por_prioridad[ot.prioridad] += 1
    }
    if (ot.plantilla_id) {
      countConChecklist += 1
    }
    if (ot.fecha_salida && ot.fecha_llegada) {
      const diff = (new Date(ot.fecha_llegada).getTime() - new Date(ot.fecha_salida).getTime()) / 60000
      if (diff >= 0 && diff < 1440) {
        totalTrasladoMin += diff
        countTraslado += 1
      }
    }
    const inicio = ot.fecha_llegada || ot.fecha_inicio_real
    if (inicio && ot.fecha_cierre) {
      const diff = (new Date(ot.fecha_cierre).getTime() - new Date(inicio).getTime()) / 60000
      if (diff >= 0 && diff < 10080) {
        totalEjecucionMin += diff
        countEjecucion += 1
      }
    }
    if (ot.estado === 'COMPLETADA' || ot.estado === 'CERRADA') {
      const techObj = Array.isArray(ot.tecnico_asignado) ? ot.tecnico_asignado[0] : ot.tecnico_asignado
      const nombre = (techObj as { nombre?: string } | null)?.nombre
      if (nombre) {
        rankingMap.set(nombre, (rankingMap.get(nombre) ?? 0) + 1)
      }
    }
  }

  const totalOts = (ots ?? []).length
  const ranking_tecnicos = Array.from(rankingMap.entries())
    .map(([nombre, completadas]) => ({ nombre, completadas }))
    .sort((a, b) => b.completadas - a.completadas)

  return Response.json({
    ...por_estado,
    por_estado,
    por_prioridad,
    metricas: {
      tiempo_medio_traslado_minutos: countTraslado > 0 ? Math.round(totalTrasladoMin / countTraslado) : 0,
      tiempo_medio_ejecucion_minutos: countEjecucion > 0 ? Math.round(totalEjecucionMin / countEjecucion) : 0,
      porcentaje_ots_con_checklist: totalOts > 0 ? Math.round((countConChecklist / totalOts) * 100) : 0,
      ranking_tecnicos,
    },
  })
}
