import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireRole, errorResponse, HttpError } from '@/lib/auth'
import { logActivity, safeJson } from '@/lib/activity'
import { normalizeProjectPayload } from '@/lib/project-validation'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requireAuth(req)
    const { id } = await ctx.params
    const project = await db.project.findUnique({
      where: { id },
      include: {
        institute: true,
        supervisor: { select: { id: true, fullName: true, username: true } },
        author: { select: { id: true, fullName: true } },
        payments: { orderBy: [{ isLegacy: 'desc' }, { createdAt: 'asc' }] },
        extensions: { orderBy: { createdAt: 'asc' } },
        items: { orderBy: { createdAt: 'asc' } },
        evaluations: {
          include: { evaluator: { select: { id: true, fullName: true } } },
          orderBy: { evaluatedAt: 'desc' },
        },
      },
    })
    if (!project) throw new HttpError(404, 'پروژه یافت نشد.')
    const documents = await db.document.findMany({
      where: { entityType: 'PROJECT', entityId: id },
      include: { uploadedBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(safeJson({ ...project, documents }))
  } catch (e) {
    return errorResponse(e)
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireRole(req, ['ADMIN', 'PROJECT_CONTROL'])
    const { id } = await ctx.params
    const existing = await db.project.findUnique({ where: { id } })
    if (!existing) throw new HttpError(404, 'پروژه یافت نشد.')

    const body = await req.json()
    const data = normalizeProjectPayload(body, { partial: true })

    if (data.contractNumber && data.contractNumber !== existing.contractNumber) {
      const dup = await db.project.findFirst({
        where: { contractNumber: data.contractNumber, NOT: { id } },
      })
      if (dup) throw new HttpError(400, `شماره قرارداد «${data.contractNumber}» برای پروژه دیگری ثبت شده است.`)
    }

    let instituteId = data.instituteId
    if (instituteId === undefined && body.instituteName) {
      const name = String(body.instituteName).trim()
      if (name) {
        const inst = await db.institute.upsert({ where: { name }, update: {}, create: { name } })
        instituteId = inst.id
      }
    }

    if (data.supervisorId) {
      const sup = await db.user.findUnique({ where: { id: data.supervisorId } })
      if (!sup || sup.role !== 'SUPERVISOR') throw new HttpError(400, 'ناظر انتخاب‌شده معتبر نیست.')
    }

    const changed: string[] = []
    for (const [k, v] of Object.entries(data)) {
      const before = (existing as Record<string, unknown>)[k]
      if (typeof v === 'bigint') {
        if (before !== v.toString()) changed.push(k)
      } else if (JSON.stringify(v ?? null) !== JSON.stringify(before ?? null)) {
        changed.push(k)
      }
    }

    const project = await db.project.update({
      where: { id },
      data: { ...(data as object), instituteId } as never,
      include: {
        institute: true,
        supervisor: { select: { id: true, fullName: true } },
        _count: { select: { evaluations: true, payments: true, extensions: true, items: true } },
      },
    })

    await logActivity({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'PROJECT',
      entityId: id,
      entityTitle: project.title,
      details: changed.length ? `ویرایش فیلدها: ${changed.join('، ')}` : 'به‌روزرسانی رکورد',
    })

    return NextResponse.json(safeJson(project))
  } catch (e) {
    return errorResponse(e)
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireRole(req, ['ADMIN'])
    const { id } = await ctx.params
    const existing = await db.project.findUnique({ where: { id } })
    if (!existing) throw new HttpError(404, 'پروژه یافت نشد.')
    await db.project.delete({ where: { id } })
    await logActivity({
      userId: user.id,
      action: 'DELETE',
      entityType: 'PROJECT',
      entityId: id,
      entityTitle: existing.title,
      details: `حذف پروژه با کد ${existing.code}`,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
