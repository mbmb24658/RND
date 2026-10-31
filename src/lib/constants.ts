// ===== ثابت‌ها و برچسب‌های فارسی — منبع واحد حقیقت برای Data Validation =====

export type Role = 'ADMIN' | 'PROJECT_CONTROL' | 'SUPERVISOR'

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'مدیریت',
  PROJECT_CONTROL: 'کارشناس کنترل پروژه',
  SUPERVISOR: 'ناظر',
}

export const PROJECT_STATUS = ['ACTIVE', 'COMPLETED', 'TERMINATED', 'CANCELLED', 'INACTIVE'] as const
export type ProjectStatus = (typeof PROJECT_STATUS)[number]

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  ACTIVE: 'فعال',
  COMPLETED: 'خاتمه‌یافته',
  TERMINATED: 'فسخ‌شده',
  CANCELLED: 'باطل‌شده',
  INACTIVE: 'غیرفعال',
}

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  COMPLETED: 'bg-teal-100 text-teal-800 border-teal-200',
  TERMINATED: 'bg-rose-100 text-rose-800 border-rose-200',
  CANCELLED: 'bg-stone-200 text-stone-700 border-stone-300',
  INACTIVE: 'bg-amber-100 text-amber-800 border-amber-200',
}

export const PROJECT_KIND_LABELS: Record<string, string> = {
  PROJECT: 'پروژه',
  PROPOSAL: 'پروپوزال',
}

export const SUPERVISION_TYPES = ['كارمند شركت', 'اشخاص حقيقي', 'اشخاص حقوقي'] as const
export const RESEARCH_TYPES = ['كاربردي', 'تحقيقاتي', 'توسعه اي', 'بنيادي', 'اجرايي'] as const

export const PAYMENT_TYPES = ['PROGRESS', 'PREPAYMENT', 'SETTLEMENT', 'SUPERVISION', 'OTHER'] as const
export type PaymentType = (typeof PAYMENT_TYPES)[number]
export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  PROGRESS: 'پرداخت پیشرفت',
  PREPAYMENT: 'پیش‌پرداخت',
  SETTLEMENT: 'تسویه‌حساب',
  SUPERVISION: 'حق‌نظارت',
  OTHER: 'سایر',
}

export const GROUP_NAMES = [
  'گروه كاتاليست وفرايند',
  'گروه پليمر',
  'گروه زيست محيطي',
  'گروه تحقيقات فني',
  'گروه عمومي',
  'گروه آزمايشگاه',
  'گروه پايلوت',
  'ساير',
  'غير پليمري',
] as const

export const PERFORMANCE_TRENDS = ['بهبود', 'ثابت', 'نزولی'] as const

// معیارهای ارزیابی — هر کدام ۰ تا ۲۰، جمع ۱۰۰
export const EVALUATION_CRITERIA = [
  { key: 'technical', label: 'کیفیت فنی و علمی', hint: 'روش‌شناسی، صحت محاسبات و اعتبار علمی' },
  { key: 'management', label: 'مدیریت و زمان‌بندی', hint: 'تعهد به جدول زمانی و مدیریت منابع' },
  { key: 'financial', label: 'بودجه و بهینه‌سازی هزینه', hint: 'انطباق هزینه‌ها با بودجه مصوب' },
  { key: 'innovation', label: 'نوآوری و خلاقیت', hint: 'نوآوری در راهکار و خروجی' },
  { key: 'documentation', label: 'مستندسازی و گزارش‌دهی', hint: 'کیفیت گزارش‌های دوره‌ای و نهایی' },
] as const

export type EvaluationCriterionKey = (typeof EVALUATION_CRITERIA)[number]['key']

export function gradeOf(total: number): { grade: string; color: string } {
  if (total >= 85) return { grade: 'عالی', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
  if (total >= 70) return { grade: 'خوب', color: 'bg-teal-100 text-teal-800 border-teal-200' }
  if (total >= 50) return { grade: 'متوسط', color: 'bg-amber-100 text-amber-800 border-amber-200' }
  return { grade: 'ضعیف', color: 'bg-rose-100 text-rose-800 border-rose-200' }
}

export function canManageProjects(role: Role) {
  return role === 'ADMIN' || role === 'PROJECT_CONTROL'
}
export function isAdmin(role: Role) {
  return role === 'ADMIN'
}
export function canEvaluate(role: Role) {
  return role === 'ADMIN' || role === 'SUPERVISOR'
}
