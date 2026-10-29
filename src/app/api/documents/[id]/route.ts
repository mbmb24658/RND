import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireRole, errorResponse, HttpError } from '@/lib/auth'
import { logActivity } from '@/lib/activity'
import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { createReadStream, existsSync } from 'node:fs'
import { Readable } from 'node:stream'

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads')

type Ctx = { params: Promise<{ id: string }> }

/** دانلود فایل */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    await requireAuth(req)
    const { id } = await ctx.params
    const doc = await db.document.findUnique({ where: { id } })
    if (!doc) throw new HttpError(404, 'سند یافت نشد.')
    const filePath = path.join(UPLOAD_DIR, doc.filePath)
    if (!existsSync(filePath)) throw new HttpError(404, 'فایل روی سرور یافت نشد.')

    const stream = Readable.toWeb(createReadStream(filePath)) as unknown as ReadableStream
    return new NextResponse(stream, {
      headers: {
        'Content-Type': doc.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
        'Content-Length': String(doc.size),
      },
    })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireRole(req, ['ADMIN', 'PROJECT_CONTROL'])
    const { id } = await ctx.params
    const doc = await db.document.findUnique({ where: { id } })
    if (!doc) throw new HttpError(404, 'سند یافت نشد.')
    const filePath = path.join(UPLOAD_DIR, doc.filePath)
    if (existsSync(filePath)) {
      await unlink(filePath).catch(() => null)
    }
    await db.document.delete({ where: { id } })
    await logActivity({
      userId: user.id,
      action: 'DELETE',
      entityType: 'DOCUMENT',
      entityId: id,
      entityTitle: doc.title,
      details: `حذف سند «${doc.fileName}»`,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
