import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireRole, errorResponse, HttpError } from '@/lib/auth'
import { logActivity, safeJson } from '@/lib/activity'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireAuth(req)
    const { id } = await ctx.params
    const existing = await db.evaluation.findUnique({ where: { id } })
    if (!existing) throw new HttpError(404, 'ارزیابی یافت نشد.')
    if (user.role !== 'ADMIN' && existing.evaluatorId !== user.id) {
      throw new HttpError(403, 'فقط ارزیاب یا مدیریت می‌تواند این ارزیابی را ویرایش کند.')
    }

    const body = await req.json()
    const scores: Record<string, number> = {}
    for (const key of ['technical', 'management', 'financial', 'innovation', 'documentation']) {
      const n = Number(body[key] ?? (existing as unknown as Record<string, number>)[key])
      if (isNaN(n) || n < 0 || n > 20) throw new HttpError(400, 'امتیاز هر معیار باید بین ۰ تا ۲۰ باشد.')
      scores[key] = Math.round(n)
    }
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0)
    const grade = totalScore >= 85 ? 'عالی' : totalScore >= 70 ? 'خوب' : totalScore >= 50 ? 'متوسط' : 'ضعیف'

    const evaluation = await db.evaluation.update({
      where: { id },
      data: {
        ...scores,
        totalScore,
        grade,
        performanceTrend: body.performanceTrend ?? existing.performanceTrend,
        comment: body.comment ?? existing.comment,
      },
      include: {
        evaluator: { select: { id: true, fullName: true } },
        project: { select: { id: true, code: true, title: true } },
      },
    })

    await logActivity({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'EVALUATION',
      entityId: id,
      entityTitle: evaluation.project?.title,
      details: `ویرایش ارزیابی — امتیاز جدید ${totalScore}`,
    })

    return NextResponse.json(safeJson(evaluation))
  } catch (e) {
    return errorResponse(e)
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireAuth(req)
    const { id } = await ctx.params
    const existing = await db.evaluation.findUnique({ where: { id } })
    if (!existing) throw new HttpError(404, 'ارزیابی یافت نشد.')
    if (user.role !== 'ADMIN' && existing.evaluatorId !== user.id) {
      throw new HttpError(403, 'فقط ارزیاب یا مدیریت می‌تواند این ارزیابی را حذف کند.')
    }
    await db.evaluation.delete({ where: { id } })
    await logActivity({
      userId: user.id,
      action: 'DELETE',
      entityType: 'EVALUATION',
      entityId: id,
      entityTitle: existing.id,
      details: 'حذف ارزیابی',
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
