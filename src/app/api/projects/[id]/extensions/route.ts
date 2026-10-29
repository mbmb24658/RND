import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireRole, errorResponse, HttpError } from '@/lib/auth'
import { logActivity, safeJson } from '@/lib/activity'
import { normalizeExtensionPayload } from '@/lib/project-validation'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requireAuth(req)
    const { id } = await ctx.params
    const extensions = await db.extension.findMany({
      where: { projectId: id },
      include: { createdBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(safeJson({ items: extensions }))
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

    const data = normalizeExtensionPayload(await req.json())
    const extension = await db.extension.create({
      data: { ...data, projectId: id, isLegacy: false, createdById: user.id },
      include: { createdBy: { select: { fullName: true } } },
    })
    await logActivity({
      userId: user.id,
      action: 'CREATE',
      entityType: 'EXTENSION',
      entityId: extension.id,
      entityTitle: project.title,
      details: `ثبت تمدید ${data.months ? `${data.months} ماه` : `${data.days} روز`}`,
    })
    return NextResponse.json(safeJson(extension), { status: 201 })
  } catch (e) {
    return errorResponse(e)
  }
}
