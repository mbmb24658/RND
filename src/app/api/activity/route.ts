import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole, errorResponse } from '@/lib/auth'
import { safeJson } from '@/lib/activity'

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ['ADMIN'])
    const sp = req.nextUrl.searchParams
    const entityType = sp.get('entityType')?.trim()
    const action = sp.get('action')?.trim()
    const page = Math.max(1, Number(sp.get('page') || 1))
    const pageSize = Math.min(100, Math.max(10, Number(sp.get('pageSize') || 40)))

    const where: Record<string, unknown> = {}
    if (entityType && entityType !== 'ALL') where.entityType = entityType
    if (action && action !== 'ALL') where.action = action

    const [items, total] = await Promise.all([
      db.activityLog.findMany({
        where,
        include: { user: { select: { id: true, fullName: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.activityLog.count({ where }),
    ])
    return NextResponse.json(safeJson({ items, total, page, pageSize }))
  } catch (e) {
    return errorResponse(e)
  }
}
