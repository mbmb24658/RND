import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireRole, errorResponse, HttpError } from '@/lib/auth'
import { logActivity, safeJson } from '@/lib/activity'
import { normalizePaymentPayload } from '@/lib/project-validation'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requireAuth(req)
    const { id } = await ctx.params
    const payments = await db.payment.findMany({
      where: { projectId: id },
      include: { createdBy: { select: { fullName: true } } },
      orderBy: [{ isLegacy: 'desc' }, { createdAt: 'asc' }],
    })
    return NextResponse.json(safeJson({ items: payments }))
  } catch (e) {
    return errorResponse(e)
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireRole(req, ['ADMIN', 'PROJECT_CONTROL'])
    const { id } = await ctx.params
    const project = await db.project.findUnique({ where: { id } })
    if (!project) throw new HttpError(404, 'پروژه یافت نشد.')

    const body = await req.json()
    const data = normalizePaymentPayload(body)

    const payment = await db.payment.create({
      data: { ...data, projectId: id, createdById: user.id },
      include: { createdBy: { select: { fullName: true } } },
    })

    // به‌روزرسانی مجموع پرداخت‌شده
    const agg = await db.payment.aggregate({ where: { projectId: id }, _sum: { amount: true } })
    await db.project.update({ where: { id }, data: { totalPaid: agg._sum.amount ?? 0n } })

    await logActivity({
      userId: user.id,
      action: 'CREATE',
      entityType: 'PAYMENT',
      entityId: payment.id,
      entityTitle: project.title,
      details: `ثبت پرداخت ${payment.amount.toString()} ریال`,
    })

    return NextResponse.json(safeJson(payment), { status: 201 })
  } catch (e) {
    return errorResponse(e)
  }
}
