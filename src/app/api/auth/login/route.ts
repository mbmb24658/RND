import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyPassword, signToken, setAuthCookie, errorResponse, HttpError } from '@/lib/auth'
import { logActivity } from '@/lib/activity'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const username = String(body.username ?? '').trim()
    const password = String(body.password ?? '')
    if (!username || !password) throw new HttpError(400, 'نام کاربری و رمز عبور الزامی است.')

    const user = await db.user.findUnique({ where: { username } })
    if (!user || !verifyPassword(password, user.password)) {
      throw new HttpError(401, 'نام کاربری یا رمز عبور اشتباه است.')
    }
    if (!user.active) throw new HttpError(403, 'حساب کاربری شما غیرفعال شده است. با مدیریت تماس بگیرید.')

    const authUser = { id: user.id, username: user.username, fullName: user.fullName, role: user.role as never }
    const token = signToken(authUser)
    const res = NextResponse.json({
      user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role },
    })
    setAuthCookie(res, token)
    await logActivity({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'USER',
      entityId: user.id,
      entityTitle: user.fullName,
    })
    return res
  } catch (e) {
    return errorResponse(e)
  }
}
