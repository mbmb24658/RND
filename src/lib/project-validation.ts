// ===== اعتبارسنجی و نرمال‌سازی داده پروژه (سمت سرور) =====
// فیلدهای دارای Data Validation فقط مقادیر مجاز می‌پذیرند.
import { parseJalaliInput } from './jalali'
import { parseAmountInput } from './format'
import {
  PROJECT_STATUS,
  SUPERVISION_TYPES,
  RESEARCH_TYPES,
  PAYMENT_TYPES,
  PERFORMANCE_TRENDS,
} from './constants'
import { HttpError } from './auth'

export interface NormalizedProject {
  kind: 'PROJECT' | 'PROPOSAL'
  code?: string
  archiveNumber?: string | null
  contractNumber?: string | null
  contractDate?: Date | null
  title: string
  notes?: string | null
  amount?: bigint
  durationMonths?: number | null
  groupName?: string | null
  registrationDate?: Date | null
  executorName?: string | null
  managerName?: string | null
  caseManager?: string | null
  companyName?: string | null
  researchType?: string | null
  status: string
  statusNote?: string | null
  finalStatusNote?: string | null
  startDate?: Date | null
  endDate?: Date | null
  startLetterNumber?: string | null
  financeReferralDate?: Date | null
  financeReferralNumber?: string | null
  seminarDate?: Date | null
  settlementDate?: Date | null
  supervisionType?: string | null
  supervisionFee?: bigint
  supervisionPaidAt?: Date | null
  supervisionLetterNumber?: string | null
  plannedProgress?: number | null
  actualProgress?: number | null
  bankAccountNote?: string | null
  supervisorNames?: string | null
  instituteId?: string | null
  supervisorId?: string | null
  hasRegulation?: boolean
  hasPrepaymentGuarantee?: boolean
  hasGoodPerformance?: boolean
  hasGuaranteeRefund?: boolean
  yesNo?: boolean
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))))
  return isNaN(n) ? null : n
}

function pct(v: unknown, field: string): number | null {
  const n = num(v)
  if (n === null) return null
  if (n < 0 || n > 100) throw new HttpError(400, `${field} باید بین ۰ تا ۱۰۰ باشد.`)
  return n
}

function dateField(v: unknown, field: string): Date | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    // ISO از سمت کلاینت (تاریخ شمسی پیش‌تبدیل‌شده)
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : d
  }
  const d = parseJalaliInput(String(v))
  if (!d) throw new HttpError(400, `فرمت تاریخ «${field}» نامعتبر است. نمونه صحیح: ۱۴۰۳/۰۵/۲۱`)
  return d
}

function money(v: unknown, field: string): bigint {
  const b = typeof v === 'bigint' ? v : parseAmountInput(String(v ?? ''))
  if (b === null) throw new HttpError(400, `مبلغ «${field}» نامعتبر است. فقط رقم وارد کنید.`)
  if (b < 0n) throw new HttpError(400, `${field} نمی‌تواند منفی باشد.`)
  return b
}

function oneOf(v: unknown, allowed: readonly string[], field: string): string | null {
  const s = str(v)
  if (!s) return null
  if (!allowed.includes(s)) throw new HttpError(400, `مقدار «${field}» باید یکی از مقادیر مجاز باشد: ${allowed.join(' / ')}`)
  return s
}

export function normalizeProjectPayload(body: Record<string, unknown>, { partial = false } = {}): NormalizedProject {
  const out: Record<string, unknown> = {}

  // kind
  const kind = str(body.kind) ?? 'PROJECT'
  if (kind !== 'PROJECT' && kind !== 'PROPOSAL') throw new HttpError(400, 'نوع رکورد باید پروژه یا پروپوزال باشد.')
  out.kind = kind

  // title (الزامی در ایجاد)
  const title = str(body.title)
  if (!partial && !title) throw new HttpError(400, 'عنوان پروژه الزامی است.')
  if (title) out.title = title

  // status — فقط مقادیر مجاز
  const status = str(body.status) ?? 'ACTIVE'
  if (!PROJECT_STATUS.includes(status as (typeof PROJECT_STATUS)[number])) {
    throw new HttpError(400, 'وضعیت پروژه نامعتبر است.')
  }
  out.status = status

  const simpleText: Array<[string, string]> = [
    ['archiveNumber', 'شماره بایگانی'],
    ['contractNumber', 'شماره قرارداد'],
    ['notes', 'توضیحات'],
    ['groupName', 'نام گروه'],
    ['executorName', 'نام مجری'],
    ['managerName', 'نام مدیر پروژه'],
    ['caseManager', 'مسئول پرونده'],
    ['companyName', 'نام شرکت'],
    ['statusNote', 'توضیح وضعیت'],
    ['finalStatusNote', 'وضعیت نهایی'],
    ['startLetterNumber', 'شماره نامه شروع به کار'],
    ['financeReferralNumber', 'شماره نامه معرفی به امور مالی'],
    ['supervisionLetterNumber', 'شماره نامه پرداخت نظارت'],
    ['bankAccountNote', 'شماره حساب و بانک'],
    ['supervisorNames', 'نام ناظرین'],
  ]
  for (const [key, label] of simpleText) {
    if (key in body) out[key] = str(body[key])
  }

  // کد پروژه — اگر خالی بود سرور تولید می‌کند
  if ('code' in body) out.code = str(body.code)

  // dates
  const dateMap: Array<[string, string]> = [
    ['contractDate', 'تاریخ قرارداد'],
    ['registrationDate', 'تاریخ ثبت'],
    ['startDate', 'تاریخ شروع به کار مجری'],
    ['endDate', 'تاریخ پایان کار مجری'],
    ['financeReferralDate', 'تاریخ معرفی به امور مالی'],
    ['seminarDate', 'تاریخ سمینار'],
    ['settlementDate', 'تاریخ تسویه حساب'],
    ['supervisionPaidAt', 'تاریخ پرداخت حق‌الزحمه نظارت'],
  ]
  for (const [key, label] of dateMap) {
    if (key in body) out[key] = dateField(body[key], label)
  }

  // money
  if ('amount' in body && body.amount !== '' && body.amount !== null && body.amount !== undefined) {
    out.amount = money(body.amount, 'مبلغ پروژه')
  } else if ('amount' in body) {
    out.amount = 0n
  }
  if ('supervisionFee' in body && body.supervisionFee !== '' && body.supervisionFee !== null && body.supervisionFee !== undefined) {
    out.supervisionFee = money(body.supervisionFee, 'مبلغ نظارت')
  } else if ('supervisionFee' in body) {
    out.supervisionFee = 0n
  }

  // numbers
  if ('durationMonths' in body) {
    const n = num(body.durationMonths)
    if (n !== null && (n <= 0 || n > 600)) throw new HttpError(400, 'مدت زمان پروژه باید بین ۱ تا ۶۰۰ ماه باشد.')
    out.durationMonths = n
  }
  if ('plannedProgress' in body) out.plannedProgress = pct(body.plannedProgress, 'درصد پیشرفت برنامه')
  if ('actualProgress' in body) out.actualProgress = pct(body.actualProgress, 'درصد پیشرفت واقعی')

  // enum-like fields — فقط مقادیر مجاز
  if ('researchType' in body) out.researchType = oneOf(body.researchType, RESEARCH_TYPES, 'نوع طرح')
  if ('supervisionType' in body) out.supervisionType = oneOf(body.supervisionType, SUPERVISION_TYPES, 'نوع نظارت')

  // booleans
  for (const key of ['hasRegulation', 'hasPrepaymentGuarantee', 'hasGoodPerformance', 'hasGuaranteeRefund', 'yesNo']) {
    if (key in body) out[key] = Boolean(body[key])
  }

  // relations
  if ('instituteId' in body) out.instituteId = str(body.instituteId)
  if ('supervisorId' in body) out.supervisorId = str(body.supervisorId)

  return out as unknown as NormalizedProject
}

export function normalizePaymentPayload(body: Record<string, unknown>) {
  const amount = money(body.amount, 'مبلغ پرداخت')
  const netAmount =
    body.netAmount !== undefined && body.netAmount !== null && body.netAmount !== ''
      ? money(body.netAmount, 'مبلغ خالص')
      : null
  const type = str(body.type) ?? 'PROGRESS'
  if (!PAYMENT_TYPES.includes(type as (typeof PAYMENT_TYPES)[number])) {
    throw new HttpError(400, 'نوع پرداخت نامعتبر است.')
  }
  return {
    amount,
    netAmount,
    type,
    subject: str(body.subject),
    letterNumber: str(body.letterNumber),
    date: dateField(body.date, 'تاریخ نامه'),
    documentNumber: str(body.documentNumber),
    documentDate: dateField(body.documentDate, 'تاریخ سند'),
    note: str(body.note),
  }
}

export function normalizeExtensionPayload(body: Record<string, unknown>) {
  const months = 'months' in body ? num(body.months) : null
  const days = 'days' in body ? num(body.days) : null
  if (months === null && days === null) throw new HttpError(400, 'مدت تمدید (ماه یا روز) الزامی است.')
  if (months !== null && (months <= 0 || months > 600)) throw new HttpError(400, 'مدت تمدید باید بین ۱ تا ۶۰۰ ماه باشد.')
  if (days !== null && (days <= 0 || days > 18000)) throw new HttpError(400, 'مدت تمدید روزانه نامعتبر است.')
  return {
    months,
    days,
    date: dateField(body.date, 'تاریخ تمدید'),
    note: str(body.note),
  }
}

export function normalizeEvaluationPayload(body: Record<string, unknown>) {
  const targetType = str(body.targetType) ?? 'PROJECT'
  if (targetType !== 'PROJECT' && targetType !== 'PROPOSAL') {
    throw new HttpError(400, 'هدف ارزیابی نامعتبر است.')
  }
  const targetId = str(body.targetId)
  if (!targetId) throw new HttpError(400, 'انتخاب پروژه/پروپوزال الزامی است.')

  const scores: Record<string, number> = {}
  for (const key of ['technical', 'management', 'financial', 'innovation', 'documentation']) {
    const n = num(body[key])
    if (n === null || n < 0 || n > 20) {
      throw new HttpError(400, 'هر معیار ارزیابی باید عددی بین ۰ تا ۲۰ باشد.')
    }
    scores[key] = Math.round(n)
  }
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0)

  let performanceTrend: string | null = str(body.performanceTrend)
  if (performanceTrend && !PERFORMANCE_TRENDS.includes(performanceTrend as (typeof PERFORMANCE_TRENDS)[number])) {
    performanceTrend = null
  }

  return {
    targetType,
    targetId,
    ...scores,
    totalScore,
    performanceTrend,
    comment: str(body.comment),
  }
}
