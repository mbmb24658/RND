// ===== قالب‌بندی مبالغ — همه‌چیز ریال؛ معادل تومان زیر برچسب =====
import { toFaDigits } from './jalali'

/** گروه‌بندی سه‌رقمی با جداکننده */
function group(n: string): string {
  return n.replace(/\B(?=(\d{3})+(?!\d))/g, '٬')
}

/** عدد → رشته گروه‌بندی‌شده لاتین: 60,000,000 */
export function groupEn(n: number | string): string {
  const s = String(n).replace(/[٬,]/g, '')
  if (!/^-?\d+(\.\d+)?$/.test(s)) return String(n)
  const [int, frac] = s.split('.')
  const g = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return frac ? `${g}.${frac}` : g
}

/** 60000000n → «۶۰٬۰۰۰٬۰۰۰» */
export function formatNumberFa(v: number | bigint | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—'
  const num = typeof v === 'bigint' ? v.toString() : String(v)
  if (num === '0') return '۰'
  return toFaDigits(group(num))
}

/** ریال با واحدها: ۶۰٬۰۰۰٬۰۰۰ ریال */
export function formatRial(v: number | bigint | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return `${formatNumberFa(v)} ریال`
}

/** ریال → تومان (÷10) با رشته انسانی: ۶ میلیون تومان برای مبالغ بزرگ */
export function toToman(v: number | bigint | null | undefined): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === 'bigint' ? Number(v) : Number(v)
  if (isNaN(n)) return null
  return n / 10
}

/** خلاصه تومان: ۶٬۰۰۰٬۰۰۰ تومان / ۱٫۵ میلیارد تومان */
export function tomanSummary(v: number | bigint | null | undefined): string {
  const t = toToman(v)
  if (t === null) return ''
  const abs = Math.abs(t)
  if (abs >= 1_000_000_000) {
    const b = t / 1_000_000_000
    return `${toFaDigits(b.toFixed(b % 1 === 0 ? 0 : 1).replace(/\.0$/, '').replace('.', '٫'))} میلیارد تومان`
  }
  if (abs >= 1_000_000) {
    const m = t / 1_000_000
    return `${toFaDigits(m.toFixed(m % 1 === 0 ? 0 : 1).replace(/\.0$/, '').replace('.', '٫'))} میلیون تومان`
  }
  if (abs === 0) return '۰ تومان'
  return `${formatNumberFa(t)} تومان`
}

/** پارس ورودی مبلغ کاربر → bigint ریال (پذیرش ارقام فارسی، کاما، فاصله) */
export function parseAmountInput(input: string): bigint | null {
  if (!input) return null
  const s = input
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٬,،\s]/g, '')
  if (!/^-?\d+$/.test(s)) return null
  try {
    return BigInt(s)
  } catch {
    return null
  }
}

/** درصد با رقم فارسی */
export function formatPercent(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined) return '—'
  const s = Number(v.toFixed(digits)).toString().replace('.', '٫')
  return `${toFaDigits(s)}٪`
}

/** عدد اعشاری فارسی بدون صفرهای زائد: 80 → ۸۰ ، 72.83 → ۷۲٫۸۳ */
export function formatDecimalFa(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || isNaN(v)) return '—'
  const s = Number(v.toFixed(digits)).toString().replace('.', '٫')
  return toFaDigits(s)
}

/** حجم فایل خوانا */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${toFaDigits(bytes)} بایت`
  if (bytes < 1024 * 1024) return `${toFaDigits((bytes / 1024).toFixed(0))} کیلوبایت`
  return `${toFaDigits((bytes / 1024 / 1024).toFixed(1))} مگابایت`
}
