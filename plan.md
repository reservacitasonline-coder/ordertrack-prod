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
- ✅ **El CI fallaba en `main`**: `npm run lint` daba 13 errores (8 `preserve-manual-memoization`, 4 `set-state-in-effect`, 1 `no-explicit-any`). Corregidos: el lint queda en 0 errores y el CI vuelve a servir como control.
- ✅ Las funciones SQL nuevas se probaron contra un Postgres embebido cargando `migration.sql` completo y las migraciones dos veces (idempotencia): 12 comprobaciones, incluido el caso de fallo a mitad de operación.
- ⏳ Tests de aislamiento entre empresas contra una base de prueba (Supabase local). Es la única forma de garantizar que el punto 1 no regrese.

## Fase 4 — Segunda tanda (✅ hecha, con migraciones por aplicar)

| # | Problema | Arreglo |
|---|----------|---------|
| 14 | **Repuestos del técnico cableados** a tres nombres fijos y a los IDs 1, 2 y 3, con catálogo ficticio de respaldo. | La pantalla de campo lista el kit real del técnico (con stock y tope por stock) o, si el kit está vacío, el catálogo real de la empresa. Se envía el `id` real del material. Se eliminaron los catálogos y checklists ficticios. |
| 14b | La pantalla ocultaba los errores al guardar checklist y repuestos y avanzaba igual. | Si el guardado falla, muestra el error y no avanza. |
| 14c | Una orden sin plantilla mostraba un checklist inventado de 4 ítems. | Sin plantilla no hay checklist técnico y el paso no bloquea. |
| 15 | El técnico podía autotransferirse stock sin control. | Configurable por empresa: el admin lo activa o desactiva con un interruptor en "Kit Vehicular por Técnico". La API lo exige (403 si está bloqueado). Por defecto queda permitido, como hoy. |
| 16 | Inventario no atómico. | Funciones SQL `transferir_a_tecnico` y `registrar_repuestos_ot` (todo o nada, sin carreras). La API las usa si existen y cae al camino anterior si no. |

### 🔧 Acción tuya: aplicar dos migraciones

En Supabase → SQL Editor, pega y ejecuta, en este orden (ambas son idempotentes):

1. `supabase/migrations/20261115_config_autotransferencia.sql` — agrega la columna de configuración. Sin ella, el interruptor del admin responde con un aviso y todo sigue permitido.
2. `supabase/migrations/20261115_inventario_atomico.sql` — crea las dos funciones. Sin ellas, la app funciona igual que antes, pero sin atomicidad.

Puedes aplicarlas antes o después del merge: el código tolera ambos casos.

## Fase 5 — Tercera tanda: lista v1.0 de Trello (✅ hecha en código)

| Tarjeta | Qué cambió |
|---|---|
| Flujo técnico real | Errores visibles en cada paso (aceptar, llegada, seguridad, checklist, repuestos, cierre). GPS real o "Sin GPS" (antes coordenadas inventadas). Firma obligatoria y validada como PNG real en el servidor (antes un PNG de 1 píxel). Fotos con reintento. Sin preguntas de seguridad ficticias. El PDF muestra las fotos Antes/Después. |
| 3 — Repuestos (operador) | Panel en el detalle de la OT: lista lo solicitado, "Marcar en camino" (fecha estimada, validada) y "Marcar entregado y reanudar OT". |
| 7 — Alta de empresa | Al crear la empresa se crean 4 ítems de seguridad y la plantilla "Mantenimiento general" con su checklist. Si falla, se revierte la empresa. El POST ya no inserta el cuerpo crudo. |
| 9 — Funciones simuladas | Ocultas (no borradas): SLA 92.4% fijo y tabla "Excedido", vista Mapa del técnico, pestaña Ruteo, clave API y "Canal de Ingesta". |
| 10 — Recuperar contraseña | Enlace en el login, `/recuperar`, `/auth/callback` y `/restablecer`. |
| 11 — Respaldos | `docs/backup-restauracion.md`. |

### 🔧 Acción tuya para la tarjeta 10
En Supabase → Authentication → URL Configuration: agrega `https://<tu-dominio>/auth/callback` en *Redirect URLs* (y la URL de preview para probar). Sin eso el enlace del correo no funciona. Revisa también la plantilla "Reset Password" y el remitente SMTP (el SMTP por defecto de Supabase tiene límite bajo de correos por hora).

### 🔧 Acción tuya para la tarjeta 11
Ejecutar una restauración de prueba siguiendo el documento y anotar fecha y plan de Supabase.

## Fase 6 — Pendiente

| # | Tema | Por qué no está hecho | Recomendación |
|---|------|-----------------------|---------------|
| 17 | Cierre de OT y transiciones siguen sin ser atómicos (actualizar orden + evento). | Menor riesgo que inventario; requiere más funciones SQL. | Siguiente tanda. |
| 18 | Esquema en un único `migration.sql`; hay indicios de que no coincide con la base real (`EmpresaNotifConfig` y `clientes.contrato` del código no calzan con el SQL). | Necesito ver el esquema real de producción. | Exportar el esquema real y adoptar migraciones versionadas (ya hay carpeta `supabase/migrations`). |
| 19 | Tests de aislamiento entre empresas a nivel de API. | Requieren un Supabase de prueba. | Supabase local en CI. |
| 20 | Notificaciones y modo offline. | Funcionalidad nueva, no corrección. | Definir con la lista de la v1.0. |
| 21 | `tecnico/ordenes/[id]/page.tsx` sigue con ~1950 líneas. | Refactor grande sin cambio funcional. | Dividir por paso del flujo. |

## Verificación de esta rama

- `npx tsc --noEmit`: sin errores.
- `npm test`: 15 de 15.
- `npm run build`: compila.
- `npm run lint`: 0 errores (antes 13).
- SQL: esquema y migraciones probados en Postgres embebido, 12 comprobaciones.
- **No probado contra Supabase real.** No tengo acceso a la base ni a un entorno de staging. Antes del merge, prueba en el preview de Vercel: crear y editar una orden, reabrir una orden cerrada, subir y ver una foto como técnico, registrar repuestos del kit como técnico, cambiar el interruptor de autotransferencia como admin, ver firma y adjuntos como admin.

## Orden sugerido

1. Aplicar las dos migraciones en Supabase.
2. Probar esta rama en el preview de Vercel. Merge.
3. Pasar el bucket `adjuntos` a privado.
4. Configurar Redirect URLs de Supabase (tarjeta 10) y hacer la prueba de restauración (tarjeta 11).
5. Puntos 17 a 21.
