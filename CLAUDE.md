# OrderTrack — contexto para Claude Code

## Stack
- **Framework**: Next.js 16 (App Router) + React 19
- **Auth / DB**: Supabase (SSR cookies, no localStorage)
- **Estilos**: Tailwind CSS
- **Deploy**: Vercel (rama `main` → producción automática)

## Variables de entorno
Ver `.env.example`. Las tres variables son obligatorias; copiar a `.env.local` para desarrollo.

## Estructura clave
```
src/
  app/
    (protected)/      # rutas autenticadas (layout verifica sesión)
      tecnico/        # vista del técnico en campo
      ordenes/        # kanban de órdenes (admin/operador)
      dashboard/      # métricas
    api/              # API Routes de Next.js
      _lib/auth.ts    # getCurrentUser — autenticación para todas las rutas API
  lib/
    auth.ts           # helpers de sesión lado cliente/layout
    supabase/         # clientes SSR (server.ts, client.ts, middleware.ts)
  types/index.ts      # tipos compartidos (sin `any`)
middleware.ts         # protege rutas /api y /(protected) redirigiendo a /login
```

## Roles de usuario
`superadmin` > `admin` > `operador` > `tecnico`

Los técnicos sólo ven `/tecnico` y sus sub-rutas. Las rutas admin usan `requireRoles()` en cada API route.

## Convenciones
- Commits semánticos: `feat:`, `fix:`, `chore:`, `ci:`
- No subir archivos personales (PDFs, imágenes, DOCXs) — están en `.gitignore`
- No dejar `console.log` de debug en producción; `console.error` en catch está permitido
- Las API Routes validan siempre con `getCurrentUser` + `requireAuth` antes de operar
