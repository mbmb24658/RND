import { NextRequest, NextResponse } from 'next/server'
import { getAuth, errorResponse } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = getAuth(req)
    if (!user) return NextResponse.json({ user: null }, { status: 200 })
    return NextResponse.json({ user })
  } catch (e) {
    return errorResponse(e)
  }
}
