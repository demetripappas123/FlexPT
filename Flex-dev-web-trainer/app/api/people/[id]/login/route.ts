import { NextRequest, NextResponse } from 'next/server'
import { requireTrainerFromToken, upsertPersonAuth } from '@/supabase/auth/link-person-auth'

function errorStatus(err: unknown): number {
  if (typeof err === 'object' && err && 'status' in err) {
    const status = (err as { status: unknown }).status
    if (typeof status === 'number') return status
  }
  return 500
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const trainer = await requireTrainerFromToken(token)
    const body = await req.json()
    const person = await upsertPersonAuth({
      personId: id,
      trainerId: trainer.id,
      email: body.email ?? '',
      password: body.password || undefined,
      username: body.username ?? null,
    })

    return NextResponse.json({
      person,
      hasLogin: Boolean(person?.auth_user_id),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save login'
    return NextResponse.json({ error: message }, { status: errorStatus(err) })
  }
}
