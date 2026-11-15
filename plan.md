# Plan de corrección — OrderTrack producción

Revisión del 15 de noviembre de 2026 sobre `main` (commit `9005d79`).
Rama de trabajo: `fix/seguridad-multitenant`. `main` despliega a producción, así que nada de esto está en vivo hasta que se haga merge.

Estado: ✅ hecho en esta rama · 🔧 requiere una acción tuya · ⏳ pendiente (necesita decisión o más trabajo)

## Contexto

La base es sana: las 57 rutas de API con handlers autentican con `getCurrentUser`, RLS está activo en todas las tablas y no hay secretos en el repo. El riesgo está en que las rutas usan `service_role` (sin RLS), así que el aislamiento entre empresas depende de que cada ruta valide bien. Varias no lo hacían.

## Fase 1 — Bloqueantes (✅ hechos)

| # | Problema | Arreglo | Archivos |
|---|----------|---------|----------|
| 1 | **Fuga entre empresas.** `POST` y `PATCH /api/ordenes` volcaban el body completo en la tabla. Un admin u operador podía poner `cliente_id`, técnico o plantillas de otra empresa y recibir sus datos en la respuesta. | Lista blanca de campos y validación de que cliente, técnico, plantillas y equipo pertenecen a la empresa de la orden. | `api/_lib/ordenes.ts`, `api/ordenes/route.ts`, `api/ordenes/[id]/route.ts` |
| 2 | **Salto de la máquina de estados.** `PATCH` aceptaba `estado` directo; `POST` aceptaba cualquier estado inicial (incluso `CERRADA`). | `estado` fuera de la lista blanca de edición. Crear solo en `RECIBIDA`, `EN_REVISION`, `APROBADA` o `PROGRAMADA`. | los mismos |
| 3 | **La creación de OTs se podía bloquear.** El correlativo leía los últimos dígitos del último código; tras una reapertura (`OT-00012-R345`) saltaba a `OT-00346` y, si ya existía, fallaban todos los reintentos. | El correlativo parte de la última OT regular e ignora el sufijo `-R`. Reaperturas con sufijo correlativo (`-R1`, `-R2`) y reintento, en vez de número aleatorio. | `api/_lib/ordenes.ts`, `api/ordenes/route.ts`, `api/ordenes/[id]/reabrir/route.ts` |
| 4 | **Archivos públicos.** Firmas, fotos y PDFs se servían por URL pública del bucket `adjuntos`, sin sesión ni caducidad. | Nueva ruta `/api/archivos` que valida sesión, empresa y técnico asignado, y redirige a una URL firmada de 5 minutos. El frontend ya no construye URLs públicas; las URLs antiguas guardadas en la base se convierten solas. | `api/archivos/route.ts`, `lib/files.ts`, páginas de orden (admin y técnico), `adjuntos`, `upload-foto` |

### 🔧 Acción tuya para cerrar el punto 4

El código ya no depende de que el bucket sea público, pero **el bucket sigue público hasta que lo cambies**:

1. Haz merge de esta rama y confirma en producción que las fotos, firmas y adjuntos se ven.
2. En Supabase → Storage → bucket `adjuntos` → edita y desmarca **Public bucket**.
3. Vuelve a abrir una orden con fotos y confirma que siguen cargando.

Hazlo en ese orden. Si pasas el bucket a privado antes del merge, producción deja de mostrar archivos.

## Fase 2 — Bugs funcionales (✅ hechos)

| # | Problema | Arreglo |
|---|----------|---------|
| 5 | `entregar-repuestos` pasaba cualquier OT a `EN_EJECUCION`, incluso `CERRADA` o `ANULADA`. | Solo actúa con la orden en `ESPERANDO_REPUESTO` o `EN_EJECUCION` y exige que haya repuestos pendientes. |
| 6 | Registrar repuestos con cantidad negativa sumaba stock; un material inválido a mitad de lista dejaba el inventario a medias. | Se valida toda la lista (cantidad > 0, material de la empresa) antes de tocar inventario. |
| 7 | Transferencias y solicitudes de repuesto aceptaban cantidades no numéricas. | Validación numérica estricta. |
| 8 | Cualquier usuario leía la `api_key` de su empresa. | Solo `superadmin` y `admin` la reciben. |
| 9 | Dashboard sin paginar: conteos incorrectos al superar 1000 órdenes. | Lectura por páginas de 1000. |
| 10 | Las ediciones de OT no quedaban en el historial (evento con `estado_nuevo` nulo en columna NOT NULL). | El evento registra el estado actual. |
| 11 | El checklist aceptaba ítems de plantillas ajenas a la orden. | Solo ítems de las plantillas vinculadas. |
| 12 | Usuario no superadmin sin empresa veía datos sin filtro en dashboard y ruteo. | Responde 403. |
| 13 | La extensión del archivo subido salía del nombre enviado por el cliente. | Sale del tipo MIME validado. |

## Fase 3 — Calidad (parcial)

- ✅ Primeros 15 tests (correlativo, lista blanca, URLs de archivos) con el runner nativo de Node, sin dependencias nuevas. `npm test`, agregado al CI.
- ⏳ **El CI ya falla en `main`**: `npm run lint` da 13 errores previos a esta rama (8 `preserve-manual-memoization`, 4 `set-state-in-effect`, 1 `no-explicit-any`). No los toqué porque son refactors de componentes React sin relación con seguridad. Hay que corregirlos o el CI no sirve como control.
- ⏳ Tests de aislamiento entre empresas contra una base de prueba (Supabase local). Es la única forma de garantizar que el punto 1 no regrese.

## Fase 4 — Pendiente, requiere decisión o más trabajo

| # | Tema | Por qué no está hecho | Recomendación |
|---|------|-----------------------|---------------|
| 14 | **Repuestos del técnico están cableados.** La pantalla de campo usa tres nombres fijos ("Filtro de aire", "Correa", "Aceite compresor") mapeados a los IDs 1, 2 y 3, con un catálogo de respaldo ficticio. Para una empresa cuyos materiales no sean esos IDs, el registro falla y el error se oculta. | Arreglarlo es rediseñar ese paso de una pantalla de 1946 líneas; necesita definición de UI. | **Prioridad alta antes de cualquier piloto.** Cargar el catálogo real de `/repuestos` y enviar el `id` real. |
| 15 | El técnico puede autotransferirse stock sin límite ni aprobación. | Hoy es una función de la app ("Kit Vehicular Stock"); restringirla la rompe. | Decidir: solo admin/operador transfieren, o el técnico solicita y alguien aprueba. |
| 16 | Operaciones no atómicas (actualizar orden, descontar stock, registrar evento). Si un paso falla, queda a medias. | Requiere funciones SQL (RPC) en Supabase, que no puedo crear desde el repo. | Mover cierre de OT, repuestos y transferencias a funciones Postgres. |
| 17 | Esquema en un único `migration.sql` para pegar a mano; hay indicios de que ya no coincide con la base real (el tipo `EmpresaNotifConfig` del código no calza con la tabla del SQL). | Necesito ver el esquema real. | Adoptar migraciones versionadas de Supabase CLI y regenerar el esquema desde producción. |
| 18 | Sin notificaciones ni modo offline. | Funcionalidad nueva, no corrección. | Planificar aparte. |
| 19 | `tecnico/ordenes/[id]/page.tsx` tiene 1946 líneas. | Refactor grande. | Dividir por paso del flujo al atender el punto 14. |

## Verificación de esta rama

- `npx tsc --noEmit`: sin errores.
- `npm test`: 15 de 15.
- `npm run build`: compila.
- `npm run lint`: 13 errores, los mismos que `main`; ninguno nuevo.
- **No probado contra Supabase real.** No tengo acceso a la base ni a un entorno de staging. Antes del merge, prueba en el preview de Vercel: crear y editar una orden, reabrir una orden cerrada, subir y ver una foto como técnico, ver firma y adjuntos como admin.

## Orden sugerido

1. Revisar y probar esta rama en preview. Merge.
2. Pasar el bucket `adjuntos` a privado.
3. Punto 14 (repuestos del técnico).
4. Dejar el CI en verde y agregar tests de aislamiento.
5. Puntos 15 a 17.
