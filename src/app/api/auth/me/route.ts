import { getCurrentUser, requireAuth } from '@/lib/server-auth'

export async function GET() {
  const user = await getCurrentUser()
  const authErr = requireAuth(user)
  if (authErr) return authErr
  return Response.json(user)
}
