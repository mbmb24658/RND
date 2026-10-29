import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, errorResponse } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
    const sp = req.nextUrl.searchParams
    const q = sp.get('q')?.trim()
    const where = q ? { name: { contains: q } } : {}
    const items = await db.institute.findMany({
      where,
      orderBy: { name: 'asc' },
      take: 200,
      select: { id: true, name: true, _count: { select: { projects: true } } },
    })
    return NextResponse.json({ items })
  } catch (e) {
    return errorResponse(e)
  }
}
