import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireRole, errorResponse, HttpError } from '@/lib/auth'
import { logActivity, safeJson } from '@/lib/activity'
import { normalizeProjectPayload } from '@/lib/project-validation'
import type { Role } from '@/lib/constants'

const listInclude = {
  institute: { select: { name: true } },
  supervisor: { select: { id: true, fullName: true } },
  _count: { select: { evaluations: true, payments: true, extensions: true, items: true } },
} as const

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
    const sp = req.nextUrl.searchParams
    const q = sp.get('q')?.trim()
    const status = sp.get('status')?.trim()
    const group = sp.get('group')?.trim()
    const kind = sp.get('kind')?.trim()
    const supervisorId = sp.get('supervisorId')?.trim()
    const withoutEval = sp.get('withoutEval') === '1'
    const page = Math.max(1, Number(sp.get('page') || 1))
    const pageSize = Math.min(100, Math.max(5, Number(sp.get('pageSize') || 25)))

    const where: Record<string, unknown> = {}
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { code: { contains: q } },
        { contractNumber: { contains: q } },
        { managerName: { contains: q } },
        { executorName: { contains: q } },
        { archiveNumber: { contains: q } },
      ]
    }
    if (status && status !== 'ALL') where.status = status
    if (group && group !== 'ALL') where.groupName = group
    if (kind && kind !== 'ALL') where.kind = kind
    if (supervisorId && supervisorId !== 'ALL') where.supervisorId = supervisorId
    if (withoutEval) where.evaluations = { none: {} }

    const [items, total] = await Promise.all([
      db.project.findMany({
        where,
        include: listInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.project.count({ where }),
    ])

    return NextResponse.json(safeJson({ items, total, page, pageSize }))
  } catch (e) {
    return errorResponse(e)
  }
}

/** تولید کد پروژه جدید: بزرگ‌ترین کد عددی ۹ رقمی + ۱ */
async function nextCode(): Promise<string> {
  const rows = await db.project.findMany({ select: { code: true } })
  let max = 0
  for (const r of rows) {
    const n = Number(r.code)
    if (!isNaN(n) && n > max) max = n
  }
  if (max >= 100000000) return String(max + 1)
  return `9${Date.now().toString().slice(-8)}`
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(req, ['ADMIN', 'PROJECT_CONTROL'])
    const body = await req.json()
    const data = normalizeProjectPayload(body)

    if (!data.code) data.code = await nextCode()
    // یکتایی کد
    const exists = await db.project.findUnique({ where: { code: data.code } })
    if (exists) throw new HttpError(400, `کد پروژه «${data.code}» قبلاً ثبت شده است.`)
    // یکتایی شماره قرارداد
    if (data.contractNumber) {
      const dup = await db.project.findFirst({ where: { contractNumber: data.contractNumber } })
      if (dup) throw new HttpError(400, `شماره قرارداد «${data.contractNumber}» قبلاً ثبت شده است.`)
    }
    // مؤسسه جدید در صورت نیاز
    let instituteId = data.instituteId ?? null
    if (!instituteId && body.instituteName) {
      const name = String(body.instituteName).trim()
      if (name) {
        const inst = await db.institute.upsert({ where: { name }, update: {}, create: { name } })
        instituteId = inst.id
      }
    }
    // اعتبارسنجی ناظر
    if (data.supervisorId) {
      const sup = await db.user.findUnique({ where: { id: data.supervisorId } })
      if (!sup || sup.role !== 'SUPERVISOR') throw new HttpError(400, 'ناظر انتخاب‌شده معتبر نیست.')
    }

    const project = await db.project.create({
      data: { ...(data as object), instituteId, authorId: user.id } as never,
      include: listInclude,
    })

    await logActivity({
      userId: user.id,
      action: 'CREATE',
      entityType: 'PROJECT',
      entityId: project.id,
      entityTitle: project.title,
      details: `ثبت ${data.kind === 'PROPOSAL' ? 'پروپوزال' : 'پروژه'} با کد ${project.code}`,
    })

    return NextResponse.json(safeJson(project), { status: 201 })
  } catch (e) {
    return errorResponse(e)
  }
}

export type { Role }
