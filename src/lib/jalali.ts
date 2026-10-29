// ===== ابزارهای تاریخ هجری شمسی (جلالی) =====
// همه تاریخ‌ها در دیتابیس به‌صورت Gregorian (UTC نیمه‌شب) ذخیره و در نمایش به شمسی تبدیل می‌شوند.
import {
  toJalaali as j2j,
  toGregorian as j2g,
  isValidJalaaliDate,
} from 'jalaali-js'

export interface JDate {
  jy: number
  jm: number
  jd: number
}

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'

export function toFaDigits(s: string | number): string {
  return String(s).replace(/\d/g, (d) => FA_DIGITS[Number(d)])
}

export function toEnDigits(s: string): string {
  return String(s)
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}

/** Date (Gregorian) → jalali parts */
export function toJalali(date: Date | string | null | undefined): JDate | null {
  if (!date) return null
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return null
  const j = j2j(d.getFullYear(), d.getMonth() + 1, d.getDate())
  return j
}

/** فرمت کوتاه: ۱۴۰۳/۰۵/۲۱ */
export function formatJalali(date: Date | string | null | undefined): string {
  const j = toJalali(date)
  if (!j) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return toFaDigits(`${j.jy}/${pad(j.jm)}/${pad(j.jd)}`)
}

const MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
]
const WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه']

export function jalaliMonthName(jm: number): string {
  return MONTHS[jm - 1] || ''
}

/** فرمت بلند: ۲۱ مرداد ۱۴۰۳ */
export function formatJalaliLong(date: Date | string | null | undefined): string {
  const j = toJalali(date)
  if (!j) return '—'
  return toFaDigits(`${j.jd} ${MONTHS[j.jm - 1]} ${j.jy}`)
}

/** فرمت کامل با روز هفته */
export function formatJalaliFull(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  const j = toJalali(d)
  if (!j) return '—'
  return toFaDigits(`${WEEKDAYS[d.getDay()]} ${j.jd} ${MONTHS[j.jm - 1]} ${j.jy}`)
}

/** تاریخ امروز به شمسی (فرمت کوتاه) */
export function todayJalali(): string {
  return formatJalali(new Date())
}

/** ورودی کاربر «۱۴۰۳/۰۵/۲۱» → Date Gregorian (UTC midnight) یا null */
export function parseJalaliInput(input: string): Date | null {
  if (!input) return null
  const s = toEnDigits(input).trim().replace(/[-.]/g, '/')
  const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (!m) return null
  const jy = Number(m[1])
  const jm = Number(m[2])
  const jd = Number(m[3])
  if (jy < 1300 || jy > 1500 || jm < 1 || jm > 12 || jd < 1 || jd > 31) return null
  if (!isValidJalaaliDate(jy, jm, jd)) return null
  const g = j2g(jy, jm, jd)
  return new Date(Date.UTC(g.gy, g.gm - 1, g.gd))
}

/** Date Gregorian → رشته شمسی قابل ویرایش «۱۴۰۳/۰۵/۲۱» (اعداد لاتین برای input) */
export function toJalaliInputString(date: Date | string | null | undefined): string {
  const j = toJalali(date)
  if (!j) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${j.jy}/${pad(j.jm)}/${pad(j.jd)}`
}

/** برچسب ماه شمسی برای نمودارها: «مرداد ۱۴۰۳» */
export function jalaliMonthLabel(jy: number, jm: number): string {
  return `${MONTHS[jm - 1]} ${toFaDigits(String(jy).slice(2))}`
}
