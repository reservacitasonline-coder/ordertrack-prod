import { getCurrentUser, requireAuth } from '../../_lib/auth'

export async function GET(request: Request) {
  const user = await getCurrentUser(request)
  const authErr = requireAuth(user)
  if (authErr) return authErr
  return Response.json(user)
}
