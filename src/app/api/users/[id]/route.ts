import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole, errorResponse, HttpError, hashPassword } from '@/lib/auth'
import { logActivity } from '@/lib/activity'
import type { Role } from '@/lib/constants'

const ROLES: Role[] = ['ADMIN', 'PROJECT_CONTROL', 'SUPERVISOR']
type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const admin = await requireRole(req, ['ADMIN'])
    const { id } = await ctx.params
    const target = await db.user.findUnique({ where: { id } })
    if (!target) throw new HttpError(404, 'کاربر یافت نشد.')

    const body = await req.json()
    const data: Record<string, unknown> = {}

    if (body.fullName !== undefined) {
      const fullName = String(body.fullName).trim()
      if (!fullName) throw new HttpError(400, 'نام نمی‌تواند خالی باشد.')
      data.fullName = fullName
    }
    if (body.email !== undefined) data.email = body.email ? String(body.email).trim() : null
    if (body.phone !== undefined) data.phone = body.phone ? String(body.phone).trim() : null
    if (body.role !== undefined) {
      if (id === admin.id) throw new HttpError(400, 'نمی‌توانید نقش خودتان را تغییر دهید.')
      const role = String(body.role) as Role
      if (!ROLES.includes(role)) throw new HttpError(400, 'نقش نامعتبر است.')
      data.role = role
    }
    if (body.active !== undefined) {
      if (id === admin.id && body.active === false) throw new HttpError(400, 'نمی‌توانید حساب خودتان را غیرفعال کنید.')
      data.active = Boolean(body.active)
    }
    if (body.password) {
      const password = String(body.password)
      if (password.length < 5) throw new HttpError(400, 'رمز عبور باید حداقل ۵ کاراکتر باشد.')
      data.password = hashPassword(password)
    }

    const user = await db.user.update({
      where: { id },
      data,
      select: { id: true, username: true, fullName: true, role: true, email: true, phone: true, active: true },
    })

    await logActivity({
      userId: admin.id,
      action: 'UPDATE',
      entityType: 'USER',
      entityId: id,
      entityTitle: user.fullName,
      details: `ویرایش کاربر${body.password ? ' + بازنشانی رمز' : ''}${body.role ? ` — نقش جدید: ${body.role}` : ''}`,
    })

    return NextResponse.json(user)
  } catch (e) {
    return errorResponse(e)
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const admin = await requireRole(req, ['ADMIN'])
    const { id } = await ctx.params
    if (id === admin.id) throw new HttpError(400, 'نمی‌توانید حساب خودتان را حذف کنید.')
    const target = await db.user.findUnique({ where: { id } })
    if (!target) throw new HttpError(404, 'کاربر یافت نشد.')

    // جایگزینی ارجاع‌ها برای حفظ داده‌ها
    await db.project.updateMany({ where: { supervisorId: id }, data: { supervisorId: null } })
    await db.user.delete({ where: { id } })

    await logActivity({
      userId: admin.id,
      action: 'DELETE',
      entityType: 'USER',
      entityId: id,
      entityTitle: target.fullName,
      details: `حذف کاربر «${target.username}»`,
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
