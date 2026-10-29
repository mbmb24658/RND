// ===== احراز هویت سمت سرور — JWT (HMAC-SHA256) + رمزعبور (scrypt) =====
import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto'
import { db } from '@/lib/db'
import type { Role } from '@/lib/constants'

const SECRET = process.env.JWT_SECRET || 'rd-mgmt-jwt-secret-2024-change-in-production'
const TOKEN_COOKIE = 'rd_token'
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7 // یک هفته

export interface AuthUser {
  id: string
  username: string
  fullName: string
  role: Role
}

// ---------------- Password (scrypt) ----------------
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':')
    const h = scryptSync(password, salt, 64)
    return timingSafeEqual(h, Buffer.from(hash, 'hex'))
  } catch {
    return false
  }
}

// ---------------- JWT (HS256) ----------------
function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url')
}

function sign(data: string): string {
  return createHmac('sha256', SECRET).update(data).digest('base64url')
}

export function signToken(user: AuthUser): string {
  const payload = {
    sub: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  }
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify(payload))
  return `${head}.${body}.${sign(`${head}.${body}`)}`
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const [head, body, sig] = token.split('.')
    if (!head || !body || !sig) return null
    if (sign(`${head}.${body}`) !== sig) return null
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null
    return {
      id: payload.sub,
      username: payload.username,
      fullName: payload.fullName,
      role: payload.role,
    }
  } catch {
    return null
  }
}

// ---------------- Request helpers ----------------
export function getAuth(req: NextRequest): AuthUser | null {
  const token = req.cookies.get(TOKEN_COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** احراز هویت اجباری — در صورت خطا HttpError پرتاب می‌شود */
export async function requireAuth(req: NextRequest): Promise<AuthUser> {
  const user = getAuth(req)
  if (!user) throw new HttpError(401, 'برای دسترسی باید وارد شوید.')
  // بررسی فعال بودن کاربر
  const dbUser = await db.user.findUnique({ where: { id: user.id }, select: { active: true } })
  if (!dbUser || !dbUser.active) throw new HttpError(403, 'حساب کاربری شما غیرفعال است.')
  return user
}

/** احراز هویت + کنترل نقش */
export async function requireRole(req: NextRequest, roles: Role[]): Promise<AuthUser> {
  const user = await requireAuth(req)
  if (!roles.includes(user.role)) throw new HttpError(403, 'شما مجوز انجام این عملیات را ندارید.')
  return user
}

/** پاسخ خطای استاندارد */
export function errorResponse(e: unknown): NextResponse {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  console.error('[API Error]', e)
  const msg = e instanceof Error ? e.message : 'خطای غیرمنتظره سرور'
  return NextResponse.json({ error: msg }, { status: 500 })
}

/** تنظیم کوکی توکن در پاسخ */
export function setAuthCookie(res: NextResponse, token: string) {
  res.cookies.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TOKEN_TTL_SECONDS,
    path: '/',
  })
}

export function clearAuthCookie(res: NextResponse) {
  res.cookies.set(TOKEN_COOKIE, '', { httpOnly: true, maxAge: 0, path: '/' })
}
