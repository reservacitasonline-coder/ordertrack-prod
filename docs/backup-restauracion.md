# Respaldo y restauración — OrderTrack v1.0

Qué se respalda: base de datos Postgres (Supabase) y el bucket de Storage `adjuntos` (fotos, firmas).
El código vive en GitHub; las variables de entorno en Vercel (guardar una copia cifrada aparte).

## 1. Base de datos
- Plan Pro de Supabase o superior: respaldos diarios automáticos (Dashboard → Database → Backups). Plan Free: **no hay respaldos restaurables**; hacer el dump manual.
- Dump manual semanal (mínimo), desde una máquina con `pg_dump`:
  ```
  pg_dump "$DATABASE_URL" --format=custom --no-owner -f ordertrack_$(date +%F).dump
  ```
  `DATABASE_URL` está en Supabase → Project Settings → Database (conexión directa). Guardar el archivo fuera de Supabase (otro proveedor/disco cifrado).
- Antes de aplicar cualquier migración en producción: hacer un dump.

## 2. Storage (`adjuntos`)
- Los respaldos de Supabase **no incluyen** los archivos del bucket.
- Copia periódica con la CLI de Supabase o con cualquier cliente S3 (Storage → S3 connection) hacia un bucket/disco propio.

## 3. Restauración (probar en un proyecto Supabase vacío, nunca sobre producción primero)
1. Crear un proyecto nuevo de pruebas.
2. `pg_restore --no-owner --clean --if-exists -d "$DATABASE_URL_PRUEBAS" ordertrack_AAAA-MM-DD.dump`
3. Copiar los archivos del bucket al proyecto de pruebas.
4. Apuntar un deploy de preview de Vercel a ese proyecto y verificar: login, listado de OTs, abrir una OT con fotos y generar un informe PDF.
5. Anotar fecha y tiempo que tomó. **Un respaldo que nunca se restauró no cuenta como respaldo.**

## 4. Objetivos y responsables
| Dato | Frecuencia | Retención | Responsable |
|---|---|---|---|
| Base de datos | diaria (Pro) / semanal manual | 30 días | Alberto |
| Storage `adjuntos` | semanal | 4 copias | Alberto |
| Prueba de restauración | trimestral | — | Alberto |

## 5. Registro de ejecuciones y plan actual
- **Proyecto Supabase:** `lmjonpsagqcxyicmjcec` (`ordertrack`, región `sa-east-1`, PostgreSQL 17.11) — Organización `OrderTrack` (`czvdkjcqiubjxddzpgvx`).
- **Plan contratado:** **Free** (`plan: "free"`, `pitr_enabled: false`, `backups: []`). No existen respaldos automáticos restaurables en Supabase; los respaldos dependen del dump manual periódico.
- **Último respaldo previo a migraciones:** `2026-11-15` (`backups/ordertrack_2026-11-15_pre_migration.backup.sql` — 52,451 bytes y `.json` — 71,380 bytes; 26 tablas del esquema `public`).
- **Primera prueba de restauración verificada:** `2026-11-15` — Restauración completa de las 26 tablas y sus registros en esquema aislado de verificación (`restore_verify_20261115`), completada en **2.94 s** con 100% de paridad en conteo de filas (`empresas: 2`, `usuarios: 14`, `ordenes_trabajo: 2`, `ot_eventos: 8`, `equipo_categorias: 10`, `equipo_tipos: 36`, `clientes: 2`, `canal_ingreso: 4`, `prioridad_cliente: 3`, `plantillas_trabajo: 1`, `seguridad_items: 1`, `equipos: 1`).
