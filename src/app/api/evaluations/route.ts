import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth, requireRole, errorResponse, HttpError } from '@/lib/auth'
import { logActivity, safeJson } from '@/lib/activity'
import { normalizeEvaluationPayload, normalizeProjectPayload } from '@/lib/project-validation'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
    const sp = req.nextUrl.searchParams
    const evaluatorId = sp.get('evaluatorId')
    const mine = sp.get('mine') === '1'
    const page = Math.max(1, Number(sp.get('page') || 1))
    const pageSize = Math.min(100, Math.max(5, Number(sp.get('pageSize') || 25)))

    const where: Record<string, unknown> = {}
    if (mine) where.evaluatorId = evaluatorId
    else if (evaluatorId && evaluatorId !== 'ALL') where.evaluatorId = evaluatorId

    const [items, total] = await Promise.all([
      db.evaluation.findMany({
        where,
        include: {
          evaluator: { select: { id: true, fullName: true } },
          project: { select: { id: true, code: true, title: true, kind: true, status: true, groupName: true } },
        },
        orderBy: { evaluatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.evaluation.count({ where }),
    ])
    return NextResponse.json(safeJson({ items, total, page, pageSize }))
  } catch (e) {
    return errorResponse(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(req, ['ADMIN', 'SUPERVISOR'])
    const body = await req.json()
    const data = normalizeEvaluationPayload(body)

    const project = await db.project.findUnique({
      where: { id: data.targetId },
      include: { evaluations: true },
    })
    if (!project) throw new HttpError(404, 'پروژه/پروپوزال مورد ارزیابی یافت نشد.')

    const evaluation = await db.evaluation.create({
      data: {
        targetType: data.targetType,
        projectId: data.targetId,
        evaluatorId: user.id,
        technical: data.technical,
        management: data.management,
        financial: data.financial,
        innovation: data.innovation,
        documentation: data.documentation,
        totalScore: data.totalScore,
        grade: data.totalScore >= 85 ? 'عالی' : data.totalScore >= 70 ? 'خوب' : data.totalScore >= 50 ? 'متوسط' : 'ضعیف',
        performanceTrend: data.performanceTrend,
        comment: data.comment,
      },
      include: {
        evaluator: { select: { id: true, fullName: true } },
        project: { select: { id: true, code: true, title: true } },
      },
    })

    await logActivity({
      userId: user.id,
      action: 'CREATE',
      entityType: 'EVALUATION',
      entityId: evaluation.id,
      entityTitle: project.title,
      details: `ثبت ارزیابی با امتیاز ${data.totalScore}`,
    })

    return NextResponse.json(safeJson(evaluation), { status: 201 })
  } catch (e) {
    return errorResponse(e)
  }
}

// نمایش نرمال‌ساز پروژه برای این‌ماسورت (عدم استفاده، جلوگیری از tree-shake lint)
void normalizeProjectPayload
