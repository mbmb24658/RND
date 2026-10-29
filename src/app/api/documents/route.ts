import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireRole, errorResponse, HttpError } from '@/lib/auth'
import { logActivity, safeJson } from '@/lib/activity'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ENTITY_TYPES = ['PROJECT', 'PROPOSAL', 'PAYMENT', 'EVALUATION']

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
    const sp = req.nextUrl.searchParams
    const entityType = sp.get('entityType')?.trim()
    const entityId = sp.get('entityId')?.trim()
    const where: Record<string, unknown> = {}
    if (entityType && entityType !== 'ALL') where.entityType = entityType
    if (entityId) where.entityId = entityId

    const items = await db.document.findMany({
      where,
      include: { uploadedBy: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    // عنوان موجودیت‌ها برای نمایش
    const projectIds = [...new Set(items.filter((d) => d.entityType === 'PROJECT' || d.entityType === 'PROPOSAL').map((d) => d.entityId))]
    const projects = projectIds.length
      ? await db.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, title: true, code: true } })
      : []
    const titleMap = new Map(projects.map((p) => [p.id, `${p.title} (${p.code})`]))

    return NextResponse.json(
      safeJson({
        items: items.map((d) => ({ ...d, entityTitle: titleMap.get(d.entityId) || null })),
      })
    )
  } catch (e) {
    return errorResponse(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(req, ['ADMIN', 'PROJECT_CONTROL'])
    const form = await req.formData()
    const file = form.get('file') as File | null
    const title = String(form.get('title') ?? '').trim()
    const entityType = String(form.get('entityType') ?? 'PROJECT').trim()
    const entityId = String(form.get('entityId') ?? '').trim()

    if (!file) throw new HttpError(400, 'انتخاب فایل الزامی است.')
    if (!title) throw new HttpError(400, 'عنوان سند الزامی است.')
    if (!ENTITY_TYPES.includes(entityType)) throw new HttpError(400, 'نوع موجودیت نامعتبر است.')
    if (!entityId) throw new HttpError(400, 'انتخاب رکورد مرتبط الزامی است.')
    if (file.size > MAX_SIZE) throw new HttpError(400, 'حجم فایل باید کمتر از ۱۰ مگابایت باشد.')

    const project = await db.project.findUnique({ where: { id: entityId } })
    if (!project) throw new HttpError(404, 'رکورد مرتبط یافت نشد.')

    await mkdir(UPLOAD_DIR, { recursive: true })
    const ext = path.extname(file.name) || ''
    const storedName = `${Date.now()}-${randomBytes(6).toString('hex')}${ext}`
    const filePath = path.join(UPLOAD_DIR, storedName)
    const bytes = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, bytes)

    const doc = await db.document.create({
      data: {
        title,
        entityType,
        entityId,
        fileName: file.name,
        filePath: storedName,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        uploadedById: user.id,
      },
      include: { uploadedBy: { select: { fullName: true } } },
    })

    await logActivity({
      userId: user.id,
      action: 'CREATE',
      entityType: 'DOCUMENT',
      entityId: doc.id,
      entityTitle: title,
      details: `بارگذاری سند «${file.name}» برای ${project.title}`,
    })

    return NextResponse.json(safeJson(doc), { status: 201 })
  } catch (e) {
    return errorResponse(e)
  }
}
