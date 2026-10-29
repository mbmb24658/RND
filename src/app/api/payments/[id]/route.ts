import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole, errorResponse, HttpError } from '@/lib/auth'
import { logActivity, safeJson } from '@/lib/activity'

type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireRole(req, ['ADMIN', 'PROJECT_CONTROL'])
    const { id } = await ctx.params
    const payment = await db.payment.findUnique({
      where: { id },
      include: { project: { select: { id: true, title: true } } },
    })
    if (!payment) throw new HttpError(404, 'پرداخت یافت نشد.')
    if (payment.isLegacy && user.role !== 'ADMIN') {
      throw new HttpError(403, 'پرداخت‌های مهاجرت‌شده از اکسل فقط توسط مدیریت قابل حذف هستند.')
    }
    await db.payment.delete({ where: { id } })
    const agg = await db.payment.aggregate({ where: { projectId: payment.projectId }, _sum: { amount: true } })
    await db.project.update({ where: { id: payment.projectId }, data: { totalPaid: agg._sum.amount ?? 0n } })
    await logActivity({
      userId: user.id,
      action: 'DELETE',
      entityType: 'PAYMENT',
      entityId: id,
      entityTitle: payment.project.title,
      details: `حذف پرداخت ${payment.amount.toString()} ریال`,
    })
    return NextResponse.json(safeJson({ ok: true }))
  } catch (e) {
    return errorResponse(e)
  }
}
