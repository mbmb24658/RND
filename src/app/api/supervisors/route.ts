import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, errorResponse } from '@/lib/auth'
import { safeJson } from '@/lib/activity'

/** لیست ناظران فعال (برای ویزارد و مدیریت ناظران) */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
    const sp = req.nextUrl.searchParams
    const withStats = sp.get('stats') === '1'

    const users = await db.user.findMany({
      where: { role: 'SUPERVISOR', active: true },
      select: {
        id: true, username: true, fullName: true, email: true, phone: true, createdAt: true,
        ...(withStats
          ? {
              _count: {
                select: {
                  evaluations: true,
                  supervisedProjects: { where: { kind: 'PROJECT', status: 'ACTIVE' } },
                },
              },
            }
          : {}),
      },
      orderBy: { fullName: 'asc' },
    })
    return NextResponse.json(safeJson({ items: users }))
  } catch (e) {
    return errorResponse(e)
  }
}
