import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, errorResponse } from '@/lib/auth'
import { safeJson } from '@/lib/activity'
import { toJalali, jalaliMonthLabel } from '@/lib/jalali'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)

    const [evaluations, pendingProjects, pendingProposals, supervisors] = await Promise.all([
      db.evaluation.findMany({
        include: {
          evaluator: { select: { id: true, fullName: true } },
          project: { select: { id: true, code: true, title: true, kind: true, groupName: true } },
        },
        orderBy: { evaluatedAt: 'desc' },
      }),
      db.project.findMany({
        where: { kind: 'PROJECT', status: 'ACTIVE', evaluations: { none: {} } },
        select: { id: true, code: true, title: true, groupName: true, supervisorNames: true, supervisorId: true },
        take: 30,
        orderBy: { createdAt: 'asc' },
      }),
      db.project.findMany({
        where: { kind: 'PROPOSAL', status: 'ACTIVE', evaluations: { none: {} } },
        select: { id: true, code: true, title: true, groupName: true, supervisorNames: true },
        take: 20,
        orderBy: { createdAt: 'asc' },
      }),
      db.user.findMany({
        where: { role: 'SUPERVISOR', active: true },
        select: { id: true, fullName: true, _count: { select: { evaluations: true } } },
      }),
    ])

    const total = evaluations.length
    const avgScore = total ? evaluations.reduce((s, e) => s + e.totalScore, 0) / total : 0

    const gradeDist: Record<string, number> = {}
    const trendDist: Record<string, number> = {}
    for (const e of evaluations) {
      gradeDist[e.grade || 'بدون درجه'] = (gradeDist[e.grade || 'بدون درجه'] || 0) + 1
      if (e.performanceTrend) trendDist[e.performanceTrend] = (trendDist[e.performanceTrend] || 0) + 1
    }

    // روند ماهانه ارزیابی‌ها
    const monthMap = new Map<string, number>()
    for (const e of evaluations) {
      const j = toJalali(e.evaluatedAt)
      if (!j) continue
      const key = `${j.jy}-${j.jm}`
      monthMap.set(key, (monthMap.get(key) || 0) + 1)
    }
    const nowJ = toJalali(new Date())!
    let y = nowJ.jy, m = nowJ.jm
    const monthly: { label: string; count: number }[] = []
    for (let i = 0; i < 6; i++) {
      const key = `${y}-${m}`
      monthly.unshift({ label: jalaliMonthLabel(y, m), count: monthMap.get(key) || 0 })
      m--
      if (m === 0) { m = 12; y-- }
    }

    return NextResponse.json(
      safeJson({
        stats: {
          total,
          avgScore,
          gradeDist,
          trendDist,
          pendingProjects: pendingProjects.length,
          pendingProposals: pendingProposals.length,
        },
        monthly,
        pendingProjects,
        pendingProposals,
        recent: evaluations.slice(0, 10),
        supervisors,
      })
    )
  } catch (e) {
    return errorResponse(e)
  }
}
