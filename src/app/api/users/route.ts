import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRole, errorResponse, HttpError, hashPassword } from '@/lib/auth'
import { logActivity, safeJson } from '@/lib/activity'
import type { Role } from '@/lib/constants'

const ROLES: Role[] = ['ADMIN', 'PROJECT_CONTROL', 'SUPERVISOR']

export async function GET(req: NextRequest) {
  try {
    await requireRole(req, ['ADMIN'])
    const users = await db.user.findMany({
      select: {
        id: true, username: true, fullName: true, role: true, email: true, phone: true,
        active: true, createdAt: true,
        _count: { select: { evaluations: true, supervisedProjects: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(safeJson({ items: users }))
  } catch (e) {
    return errorResponse(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireRole(req, ['ADMIN'])
    const body = await req.json()
    const username = String(body.username ?? '').trim()
    const password = String(body.password ?? '')
    const fullName = String(body.fullName ?? '').trim()
    const role = String(body.role ?? 'SUPERVISOR') as Role

    if (!username || username.length < 3) throw new HttpError(400, 'نام کاربری باید حداقل ۳ کاراکتر باشد.')
    if (!/^[a-zA-Z0-9_.-]+$/.test(username)) throw new HttpError(400, 'نام کاربری فقط شامل حروف لاتین، رقم و نقطه/خط تیره باشد.')
    if (!password || password.length < 5) throw new HttpError(400, 'رمز عبور باید حداقل ۵ کاراکتر باشد.')
    if (!fullName) throw new HttpError(400, 'نام و نام‌خانوادگی الزامی است.')
    if (!ROLES.includes(role)) throw new HttpError(400, 'نقش نامعتبر است.')

    const dup = await db.user.findUnique({ where: { username } })
    if (dup) throw new HttpError(400, 'این نام کاربری قبلاً ثبت شده است.')

    const user = await db.user.create({
      data: {
        username,
        password: hashPassword(password),
        fullName,
        role,
        email: body.email ? String(body.email).trim() : null,
        phone: body.phone ? String(body.phone).trim() : null,
      },
      select: { id: true, username: true, fullName: true, role: true, email: true, phone: true, active: true },
    })

    await logActivity({
      userId: admin.id,
      action: 'CREATE',
      entityType: 'USER',
      entityId: user.id,
      entityTitle: fullName,
      details: `ایجاد کاربر با نقش ${role}`,
    })

    return NextResponse.json(safeJson(user), { status: 201 })
  } catch (e) {
    return errorResponse(e)
  }
}
