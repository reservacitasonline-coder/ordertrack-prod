import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs/config'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
}

export default withSentryConfig(nextConfig, {
  org: 'conectaya-digital',
  project: 'ordertrack',
  // Sube source maps a Sentry en cada deploy para ver stack traces legibles
  silent: !process.env.CI,
  widenClientFileUpload: true,
})
