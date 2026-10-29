import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, errorResponse } from '@/lib/auth'
import { safeJson } from '@/lib/activity'
import { toJalali, jalaliMonthLabel } from '@/lib/jalali'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)

    const [projects, evaluations, paymentsAgg, users] = await Promise.all([
      db.project.findMany({
        select: {
          id: true, code: true, title: true, status: true, kind: true, groupName: true,
          amount: true, supervisionFee: true, plannedProgress: true, actualProgress: true,
          registrationDate: true, institute: { select: { name: true } },
        },
      }),
      db.evaluation.findMany({ select: { totalScore: true, grade: true, performanceTrend: true, evaluatedAt: true } }),
      db.payment.aggregate({ _sum: { amount: true }, _count: true }),
      db.user.count({ where: { active: true } }),
    ])

    // ---------- وضعیت‌ها ----------
    const statusCount: Record<string, number> = {}
    for (const p of projects) statusCount[p.status] = (statusCount[p.status] || 0) + 1
    const byStatus = Object.entries(statusCount).map(([name, value]) => ({ name, value }))

    const proposalCount = projects.filter((p) => p.kind === 'PROPOSAL').length
    const projectCount = projects.length - proposalCount

    // ---------- مالی ----------
    const totalAmount = projects.reduce((s, p) => s + p.amount, 0n)
    const totalSupervisionFee = projects.reduce((s, p) => s + p.supervisionFee, 0n)
    const totalPaid = paymentsAgg._sum.amount ?? 0n
    const remaining = totalAmount - totalPaid

    // ---------- گروه‌ها ----------
    const groupMap = new Map<string, { count: number; amount: bigint }>()
    for (const p of projects) {
      const g = p.groupName || 'ساير'
      const cur = groupMap.get(g) || { count: 0, amount: 0n }
      cur.count++
      cur.amount += p.amount
      groupMap.set(g, cur)
    }
    const byGroup = [...groupMap.entries()]
      .map(([name, v]) => ({ name, count: v.count, amount: v.amount.toString() }))
      .sort((a, b) => b.count - a.count)

    // ---------- روند ماهانه (۱۲ ماه اخیر شمسی) ----------
    const nowJ = toJalali(new Date())!
    const monthKeys: string[] = []
    const monthMap = new Map<string, number>()
    let y = nowJ.jy, m = nowJ.jm
    for (let i = 0; i < 12; i++) {
      const key = `${y}-${m}`
      monthKeys.unshift(key)
      monthMap.set(key, 0)
      m--
      if (m === 0) { m = 12; y-- }
    }
    for (const p of projects) {
      if (!p.registrationDate) continue
      const j = toJalali(p.registrationDate)
      if (!j) continue
      const key = `${j.jy}-${j.jm}`
      if (monthMap.has(key)) monthMap.set(key, (monthMap.get(key) || 0) + 1)
    }
    const monthly = monthKeys.map((k) => {
      const [jy, jm] = k.split('-').map(Number)
      return { label: jalaliMonthLabel(jy, jm), count: monthMap.get(k) || 0 }
    })

    // ---------- پیشرفت ----------
    const withProgress = projects.filter((p) => p.actualProgress !== null)
    const avgActual = withProgress.length
      ? withProgress.reduce((s, p) => s + (p.actualProgress || 0), 0) / withProgress.length
      : 0

    // ---------- تازه‌ترین‌ها ----------
    const recent = await db.project.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true, code: true, title: true, status: true, kind: true, groupName: true,
        amount: true, plannedProgress: true, actualProgress: true, updatedAt: true,
      },
    })

    // ---------- ارزیابی ----------
    const avgScore = evaluations.length
      ? evaluations.reduce((s, e) => s + e.totalScore, 0) / evaluations.length
      : 0
    const gradeDist: Record<string, number> = {}
    for (const e of evaluations) {
      const g = e.grade || 'بدون درجه'
      gradeDist[g] = (gradeDist[g] || 0) + 1
    }
    const pendingEval = await db.project.count({
      where: { status: 'ACTIVE', evaluations: { none: {} } },
    })

    return NextResponse.json(
      safeJson({
        cards: {
          totalProjects: projects.length,
          projectCount,
          proposalCount,
          activeCount: statusCount['ACTIVE'] || 0,
          completedCount: statusCount['COMPLETED'] || 0,
          terminatedCount: statusCount['TERMINATED'] || 0,
          cancelledCount: statusCount['CANCELLED'] || 0,
          inactiveCount: statusCount['INACTIVE'] || 0,
          totalAmount: totalAmount.toString(),
          totalPaid: totalPaid.toString(),
          remaining: remaining.toString(),
          totalSupervisionFee: totalSupervisionFee.toString(),
          paymentCount: paymentsAgg._count,
          usersCount: users,
          evaluationsCount: evaluations.length,
          avgScore,
          avgActual,
          pendingEval,
        },
        byStatus,
        byGroup,
        monthly,
        recent,
        gradeDist,
      })
    )
  } catch (e) {
    return errorResponse(e)
  }
}
