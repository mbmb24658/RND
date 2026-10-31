import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole, errorResponse, HttpError } from '@/lib/auth'
import { logActivity } from '@/lib/activity'

type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireRole(req, ['ADMIN', 'PROJECT_CONTROL'])
    const { id } = await ctx.params
    const ext = await db.extension.findUnique({
      where: { id },
      include: { project: { select: { id: true, title: true } } },
    })
    if (!ext) throw new HttpError(404, 'تمدید یافت نشد.')
    if (ext.isLegacy && user.role !== 'ADMIN') {
      throw new HttpError(403, 'تمدیدهای مهاجرت‌شده از اکسل فقط توسط مدیریت قابل حذف هستند.')
    }
    await db.extension.delete({ where: { id } })
    await logActivity({
      userId: user.id,
      action: 'DELETE',
      entityType: 'EXTENSION',
      entityId: id,
      entityTitle: ext.project.title,
      details: 'حذف رکورد تمدید',
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
