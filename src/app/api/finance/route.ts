import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, errorResponse } from '@/lib/auth'
import { safeJson } from '@/lib/activity'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
    const sp = req.nextUrl.searchParams
    const q = sp.get('q')?.trim()
    const status = sp.get('status')?.trim()
    const group = sp.get('group')?.trim()
    const page = Math.max(1, Number(sp.get('page') || 1))
    const pageSize = Math.min(100, Math.max(5, Number(sp.get('pageSize') || 25)))

    const where: Record<string, unknown> = { kind: 'PROJECT' }
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { code: { contains: q } },
        { contractNumber: { contains: q } },
      ]
    }
    if (status && status !== 'ALL') where.status = status
    if (group && group !== 'ALL') where.groupName = group

    const [projects, total] = await Promise.all([
      db.project.findMany({
        where,
        select: {
          id: true, code: true, contractNumber: true, title: true, status: true,
          groupName: true, amount: true, supervisionFee: true, totalPaid: true,
          plannedProgress: true, actualProgress: true, institute: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.project.count({ where }),
    ])

    // جمع کل روی همه رکوردهای منطبق
    const all = await db.project.findMany({
      where,
      select: { amount: true, supervisionFee: true, totalPaid: true },
    })
    const totals = {
      amount: all.reduce((s, p) => s + p.amount, 0n).toString(),
      paid: all.reduce((s, p) => s + p.totalPaid, 0n).toString(),
      supervisionFee: all.reduce((s, p) => s + p.supervisionFee, 0n).toString(),
      remaining: all.reduce((s, p) => s + p.amount - p.totalPaid, 0n).toString(),
      count: all.length,
    }

    return NextResponse.json(safeJson({ items: projects, total, page, pageSize, totals }))
  } catch (e) {
    return errorResponse(e)
  }
}
