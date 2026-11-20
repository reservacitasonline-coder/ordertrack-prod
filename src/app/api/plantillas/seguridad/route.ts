import { createServiceClient, errorResponse } from '../../_lib/supabase-server'
import { getCurrentUser, requireAuth, requireRoles } from '@/lib/server-auth'

// Fallback in-memory electrical safety templates in case migration has not yet run in Supabase
const FALLBACK_PLANTILLAS_ELECTRICO = [
  {
    id: 101,
    empresa_id: 0,
    titulo: 'Seguridad Eléctrica: Las 5 Reglas de Oro (RETIE / NFPA 70E)',
    descripcion: 'Protocolo mandatorio para desenergización y aseguramiento de circuitos e instalaciones de baja y media tensión.',
    categoria: 'ELECTRICO',
    es_default: true,
    items: [
      { id: 1001, pregunta: '¿Se realizó el corte visible o apertura efectiva de todas las fuentes de alimentación?', requerido: true, es_critico: true, orden: 1 },
      { id: 1002, pregunta: '¿Se aplicó bloqueo físico (candado LOTO) y tarjeta de señalización de peligro en los seccionadores?', requerido: true, es_critico: true, orden: 2 },
      { id: 1003, pregunta: '¿Se comprobó la ausencia total de tensión en todas las fases y neutro mediante detector/multímetro (Live-Dead-Live)?', requerido: true, es_critico: true, orden: 3 },
      { id: 1004, pregunta: '¿Se colocó la puesta a tierra temporal y en cortocircuito en todas las fases activas?', requerido: true, es_critico: true, orden: 4 },
      { id: 1005, pregunta: '¿Se encuentra delimitada y señalizada la zona de trabajo con conos, cinta reflectiva y aviso de peligro?', requerido: true, es_critico: false, orden: 5 },
    ]
  },
  {
    id: 102,
    empresa_id: 0,
    titulo: 'EPP Dieléctrico y Protección contra Arco Eléctrico (Arc Flash)',
    descripcion: 'Inspección pre-operacional de elementos de protección personal dieléctricos y ropa ignífuga.',
    categoria: 'EPP',
    es_default: false,
    items: [
      { id: 1006, pregunta: '¿Los guantes dieléctricos fueron inspeccionados visualmente e inflados para prueba de fugas de aire?', requerido: true, es_critico: true, orden: 1 },
      { id: 1007, pregunta: '¿Se colocaron sobreguantes de vaqueta/cuero sobre los guantes dieléctricos para protección mecánica?', requerido: true, es_critico: true, orden: 2 },
      { id: 1008, pregunta: '¿El técnico utiliza ropa de trabajo 100% ignífuga / anti-arco con nivel ATPV adecuado?', requerido: true, es_critico: true, orden: 3 },
      { id: 1009, pregunta: '¿El casco de seguridad es dieléctrico (Clase E - 20,000V) con barboquejo ajustado y careta contra arco?', requerido: true, es_critico: true, orden: 4 },
      { id: 1010, pregunta: '¿El calzado de seguridad es 100% dieléctrico, sin puntera ni ojalillos metálicos, limpio y seco?', requerido: true, es_critico: false, orden: 5 },
    ]
  },
  {
    id: 103,
    empresa_id: 0,
    titulo: 'Trabajos en Altura con Riesgo Eléctrico (Postes y Redes Aéreas)',
    descripcion: 'Inspección de estructuras de apoyo, sistemas anticaídas dieléctricos y distancias mínimas de seguridad.',
    categoria: 'ALTURAS',
    es_default: false,
    items: [
      { id: 1011, pregunta: '¿El arnés de cuerpo entero, eslingas y mosquetones cuentan con herrajes dieléctricos o aislados?', requerido: true, es_critico: true, orden: 1 },
      { id: 1012, pregunta: '¿Se inspeccionó la solidez mecánica del poste o estructura (ausencia de pudrición/fracturas) antes del ascenso?', requerido: true, es_critico: true, orden: 2 },
      { id: 1013, pregunta: '¿Se respetan estrictamente las Distancias Mínimas de Seguridad (DMS) respecto a líneas energizadas vecinas?', requerido: true, es_critico: true, orden: 3 },
      { id: 1014, pregunta: '¿La escalera de fibra de vidrio cuenta con zapatas antideslizantes y amarre seguro en su extremo superior?', requerido: true, es_critico: true, orden: 4 },
      { id: 1015, pregunta: '¿Se dispone de pértiga de rescate dieléctrica en el sitio y el vigía conoce el protocolo de emergencia?', requerido: true, es_critico: false, orden: 5 },
    ]
  },
  {
    id: 104,
    empresa_id: 0,
    titulo: 'Intervención en Cuadros de Distribución y Medición en Baja Tensión',
    descripcion: 'Protocolo de seguridad para mantenimiento, cambio de protecciones y conexionado de tableros eléctricos.',
    categoria: 'LOTO',
    es_default: false,
    items: [
      { id: 1016, pregunta: '¿Las herramientas manuales cuentan con aislamiento certificado 1000V (VDE / IEC 60900)?', requerido: true, es_critico: true, orden: 1 },
      { id: 1017, pregunta: '¿Los instrumentos de medición cuentan con categoría mínima CAT III 600V / CAT IV y puntas íntegras?', requerido: true, es_critico: true, orden: 2 },
      { id: 1018, pregunta: '¿Se verificó que bancos de condensadores o fuentes ininterrumpidas (UPS) se encuentren completamente descargados?', requerido: true, es_critico: true, orden: 3 },
      { id: 1019, pregunta: '¿Se instalaron mantas o protectores aislantes temporales para cubrir partes energizadas adyacentes?', requerido: true, es_critico: false, orden: 4 },
      { id: 1020, pregunta: '¿El área de piso cuenta con alfombra o tapete dieléctrico certificado frente al tablero intervenido?', requerido: true, es_critico: false, orden: 5 },
    ]
  }
];

export async function GET() {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr

  const supabase = createServiceClient()
  const empresaId = user!.rol !== 'superadmin' ? user!.empresa_id : null

  try {
    let query = supabase
      .from('plantillas_seguridad')
      .select('*, items:seguridad_items(*)')
      .order('id', { ascending: true })

    if (empresaId) {
      query = query.eq('empresa_id', empresaId)
    }

    const { data, error } = await query

    if (error) {
      // Si la tabla aún no existe en Supabase, responder fallback con empresa_id del usuario
      return Response.json(
        FALLBACK_PLANTILLAS_ELECTRICO.map((p) => ({
          ...p,
          empresa_id: empresaId || 1,
        }))
      )
    }

    if (!data || data.length === 0) {
      // Si la tabla existe pero no tiene plantillas para esta empresa, retornar templates base
      return Response.json(
        FALLBACK_PLANTILLAS_ELECTRICO.map((p) => ({
          ...p,
          empresa_id: empresaId || 1,
        }))
      )
    }

    return Response.json(data)
  } catch {
    return Response.json(FALLBACK_PLANTILLAS_ELECTRICO)
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  const roleErr = requireRoles(user!, ['superadmin', 'admin', 'operador'])
  if (roleErr) return roleErr

  const supabase = createServiceClient()
  const body = await request.json()
  const empresa_id = user!.rol !== 'superadmin' ? user!.empresa_id : (body.empresa_id ?? user!.empresa_id)
  if (!empresa_id) return errorResponse('empresa_id es requerido', 400)

  const { titulo, descripcion, categoria = 'ELECTRICO', es_default = false, items = [] } = body

  if (!titulo || !titulo.trim()) {
    return errorResponse('titulo es requerido', 400)
  }

  // 1. Insertar plantilla_seguridad
  const { data: plantilla, error: plErr } = await supabase
    .from('plantillas_seguridad')
    .insert({
      empresa_id,
      titulo: titulo.trim(),
      descripcion: descripcion?.trim() || null,
      categoria,
      es_default: Boolean(es_default),
    })
    .select()
    .single()

  if (plErr) {
    return errorResponse(`Error al crear plantilla de seguridad: ${plErr.message}`)
  }

  // 2. Insertar items vinculados
  if (Array.isArray(items) && items.length > 0) {
    const itemsToInsert = items.map((it: { pregunta: string; requerido?: boolean; es_critico?: boolean; orden?: number }, idx: number) => ({
      empresa_id,
      plantilla_id: plantilla.id,
      pregunta: it.pregunta.trim(),
      requerido: it.requerido ?? true,
      es_critico: it.es_critico ?? false,
      orden: it.orden ?? idx + 1,
    }))

    const { error: itErr } = await supabase.from('seguridad_items').insert(itemsToInsert)
    if (itErr) {
      console.error('Error insertando items de seguridad:', itErr)
    }
  }

  // 3. Devolver plantilla completa
  const { data: result } = await supabase
    .from('plantillas_seguridad')
    .select('*, items:seguridad_items(*)')
    .eq('id', plantilla.id)
    .single()

  return Response.json(result || plantilla, { status: 201 })
}
