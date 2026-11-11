import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // Captura el 100% de errores; para traces de rendimiento baja a 0.1 en producción con muchos usuarios
  tracesSampleRate: 0.1,
  // Replay de sesión solo cuando hay un error (no graba todo el tiempo)
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  // No mostrar errores de Sentry en la consola del browser
  debug: false,
})
