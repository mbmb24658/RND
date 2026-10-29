'use client'
// ===== کامپوننت‌های مشترک نمایش =====
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { formatNumberFa, formatRial, tomanSummary, parseAmountInput, formatPercent, groupEn } from '@/lib/format'
import { formatJalali, parseJalaliInput, toJalaliInputString, todayJalali } from '@/lib/jalali'
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, PROJECT_KIND_LABELS, gradeOf, type ProjectStatus } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { CalendarDays, AlertCircle } from 'lucide-react'

/** نمایش مبلغ: ریال کامل + معادل تومان زیر برچسب */
export function Amount({ value, compact = false }: { value: string | bigint | number | null | undefined; compact?: boolean }) {
  if (value === null || value === undefined || value === '') return <span className="text-muted-foreground">—</span>
  const n = typeof value === 'bigint' ? value.toString() : String(value)
  if (n === '0') return <span className="text-muted-foreground">۰ ریال</span>
  if (compact) {
    return (
      <span className="whitespace-nowrap" title={formatRial(n)}>
        {tomanSummary(n)}
      </span>
    )
  }
  return (
    <span className="inline-flex flex-col leading-tight">
      <span className="font-medium whitespace-nowrap">{formatRial(n)}</span>
      <span className="text-[11px] text-muted-foreground whitespace-nowrap">≈ {tomanSummary(n)}</span>
    </span>
  )
}

/** تاریخ شمسی */
export function JDate({ value, long = false }: { value: string | null | undefined; long?: boolean }) {
  if (!value) return <span className="text-muted-foreground">—</span>
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <CalendarDays className="h-3 w-3 text-muted-foreground" />
      {long ? formatJalaliLong(value) : formatJalali(value)}
    </span>
  )
}

/** نشان وضعیت پروژه */
export function StatusBadge({ status }: { status: string }) {
  const label = PROJECT_STATUS_LABELS[status as ProjectStatus] || status
  const color = PROJECT_STATUS_COLORS[status as ProjectStatus] || 'bg-stone-100 text-stone-700 border-stone-200'
  return (
    <Badge variant="outline" className={cn('text-xs', color)}>
      {label}
    </Badge>
  )
}

export function KindBadge({ kind }: { kind: string }) {
  const isProposal = kind === 'PROPOSAL'
  return (
    <Badge variant="outline" className={cn('text-xs', isProposal ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-sky-50 text-sky-800 border-sky-200')}>
      {PROJECT_KIND_LABELS[kind] || kind}
    </Badge>
  )
}

/** درصد پیشرفت با رنگ‌بندی */
export function PercentBar({ actual, planned }: { actual: number | null | undefined; planned?: number | null }) {
  const a = actual ?? 0
  const color = a >= 90 ? 'bg-emerald-500' : a >= 60 ? 'bg-teal-500' : a >= 30 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="min-w-[110px]">
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className={cn('font-semibold', a >= 60 ? 'text-emerald-700' : 'text-amber-700')}>{formatPercent(a, 1)}</span>
        {planned !== undefined && planned !== null && (
          <span className="text-muted-foreground">برنامه: {formatPercent(planned, 0)}</span>
        )}
      </div>
      <div className="relative">
        <Progress value={a} className="h-2 bg-stone-200" />
        <div className="pointer-events-none absolute inset-y-0 right-0 rounded-full opacity-90" style={{ width: `${Math.min(100, a)}%`, backgroundColor: 'currentColor' }} />
      </div>
    </div>
  )
}

/** نشان درجه ارزیابی */
export function GradeBadge({ score, grade }: { score: number; grade?: string | null }) {
  const g = gradeOf(score)
  return (
    <Badge variant="outline" className={cn('text-xs', g.color)}>
      {grade || g.grade} — {formatPercent(score, 0)}
    </Badge>
  )
}

/** ورودی تاریخ شمسی با اعتبارسنجی زنده */
export function JalaliInput({
  value,
  onChange,
  placeholder = '۱۴۰۳/۰۵/۲۱',
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const [touched, setTouched] = useState(false)
  const valid = value === '' || parseJalaliInput(value) !== null
  return (
    <div className="relative">
      <Input
        dir="ltr"
        className={cn('ltr-input pr-9', className, touched && !valid && 'border-destructive focus-visible:ring-destructive')}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          setTouched(true)
          // نرمال‌سازی ارقام فارسی/عربی به انگلیسی + فقط رقم و اسلش
          const normalized = e.target.value
            .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
            .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
          onChange(normalized.replace(/[^\d/]/g, '').slice(0, 10))
        }}
      />
      <button
        type="button"
        title="امروز"
        className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary"
        onClick={() => onChange(toJalaliInputString(new Date()))}
        tabIndex={-1}
      >
        <CalendarDays className="h-4 w-4" />
      </button>
      {touched && !valid && (
        <p className="text-[11px] text-destructive mt-1 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> فرمت صحیح: {todayJalali()}
        </p>
      )}
    </div>
  )
}

/** ورودی مبلغ ریالی با گروه‌بندی خودکار */
export function MoneyInput({
  value,
  onChange,
  placeholder = '۰',
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div>
      <Input
        dir="ltr"
        inputMode="numeric"
        className={cn('ltr-input', className)}
        value={value ? groupEn(value) : ''}
        placeholder={placeholder}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '')
          onChange(digits)
        }}
      />
      {value && parseAmountInput(value) !== null && (
        <p className="text-[11px] text-muted-foreground mt-1">{tomanSummary(value)}</p>
      )}
    </div>
  )
}

/** نمایش عدد فارسی */
export function FaNum({ value, fallback = '—' }: { value: string | number | null | undefined; fallback?: string }) {
  if (value === null || value === undefined || value === '') return <span className="text-muted-foreground">{fallback}</span>
  return <span className="tabular-nums">{formatNumberFa(value)}</span>
}

/** حالت خالی */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <AlertCircle className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="font-medium text-sm">{title}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  )
}
