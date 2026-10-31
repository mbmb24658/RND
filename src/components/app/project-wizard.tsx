'use client'
// ===== ویزارد ۵ مرحله‌ای ثبت/ویرایش پروژه و پروپوزال =====
// طراحی برای جلوگیری از خستگی کاربر: هر مرحله فقط چند فیلد کوتاه
import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { api, ApiError } from '@/lib/client'
import { useAppStore } from '@/lib/store'
import {
  GROUP_NAMES, RESEARCH_TYPES, SUPERVISION_TYPES, PROJECT_STATUS_LABELS, PROJECT_STATUS, PROJECT_KIND_LABELS,
} from '@/lib/constants'
import { toJalaliInputString, parseJalaliInput } from '@/lib/jalali'
import { tomanSummary } from '@/lib/format'
import { cn } from '@/lib/utils'
import { JalaliInput, MoneyInput, Amount } from './shared'
import {
  FileText, FileSignature, Eye, CalendarClock, ClipboardCheck, ChevronRight, ChevronLeft, Loader2, Check,
} from 'lucide-react'

export interface WizardInitial {
  id?: string
  kind?: string
  code?: string
  archiveNumber?: string | null
  contractNumber?: string | null
  contractDate?: string | null
  title?: string
  notes?: string | null
  amount?: string | null
  durationMonths?: number | null
  groupName?: string | null
  registrationDate?: string | null
  executorName?: string | null
  managerName?: string | null
  caseManager?: string | null
  companyName?: string | null
  researchType?: string | null
  status?: string
  startDate?: string | null
  endDate?: string | null
  startLetterNumber?: string | null
  financeReferralDate?: string | null
  financeReferralNumber?: string | null
  seminarDate?: string | null
  settlementDate?: string | null
  supervisionType?: string | null
  supervisionFee?: string | null
  supervisionPaidAt?: string | null
  supervisionLetterNumber?: string | null
  plannedProgress?: number | null
  actualProgress?: number | null
  bankAccountNote?: string | null
  supervisorNames?: string | null
  supervisorId?: string | null
  instituteId?: string | null
  instituteName?: string | null
}

interface SupervisorUser { id: string; fullName: string }
interface InstituteItem { id: string; name: string }

const STEPS = [
  { key: 'base', title: 'اطلاعات پایه', icon: FileText, hint: 'نوع رکورد، عنوان و گروه' },
  { key: 'contract', title: 'اطلاعات قرارداد', icon: FileSignature, hint: 'شماره، مبلغ و مجری' },
  { key: 'supervision', title: 'نظارت و ناظر', icon: ClipboardCheck, hint: 'انتخاب ناظر و حق‌الزحمه' },
  { key: 'schedule', title: 'زمان‌بندی و پیشرفت', icon: CalendarClock, hint: 'تاریخ‌ها و درصد پیشرفت' },
  { key: 'review', title: 'بازبینی و ثبت', icon: Eye, hint: 'کنترل نهایی اطلاعات' },
]

interface FormState {
  kind: 'PROJECT' | 'PROPOSAL'
  code: string
  archiveNumber: string
  contractNumber: string
  contractDate: string
  title: string
  notes: string
  amount: string
  durationMonths: string
  groupName: string
  registrationDate: string
  executorName: string
  managerName: string
  caseManager: string
  companyName: string
  researchType: string
  status: string
  startDate: string
  endDate: string
  startLetterNumber: string
  financeReferralDate: string
  financeReferralNumber: string
  seminarDate: string
  settlementDate: string
  supervisionType: string
  supervisionFee: string
  supervisionPaidAt: string
  supervisionLetterNumber: string
  plannedProgress: string
  actualProgress: string
  bankAccountNote: string
  supervisorNames: string
  supervisorId: string
  instituteId: string
  instituteName: string
}

const emptyForm: FormState = {
  kind: 'PROJECT', code: '', archiveNumber: '', contractNumber: '', contractDate: '', title: '', notes: '',
  amount: '', durationMonths: '', groupName: '', registrationDate: '', executorName: '', managerName: '',
  caseManager: '', companyName: '', researchType: '', status: 'ACTIVE', startDate: '', endDate: '',
  startLetterNumber: '', financeReferralDate: '', financeReferralNumber: '', seminarDate: '', settlementDate: '',
  supervisionType: '', supervisionFee: '', supervisionPaidAt: '', supervisionLetterNumber: '',
  plannedProgress: '', actualProgress: '', bankAccountNote: '', supervisorNames: '', supervisorId: '',
  instituteId: '', instituteName: '',
}

function labelOf(key: keyof FormState): string {
  const map: Partial<Record<keyof FormState, string>> = {
    code: 'کد پروژه', archiveNumber: 'شماره بایگانی', contractNumber: 'شماره قرارداد', contractDate: 'تاریخ قرارداد',
    title: 'عنوان', notes: 'توضیحات', amount: 'مبلغ پروژه', durationMonths: 'مدت (ماه)', groupName: 'گروه',
    registrationDate: 'تاریخ ثبت', executorName: 'مجری', managerName: 'مدیر پروژه', caseManager: 'مسئول پرونده',
    companyName: 'شرکت', researchType: 'نوع طرح', status: 'وضعیت', startDate: 'شروع به کار مجری', endDate: 'پایان کار مجری',
    startLetterNumber: 'نامه شروع', financeReferralDate: 'معرفی به امور مالی', financeReferralNumber: 'شماره نامه مالی',
    seminarDate: 'سمینار', settlementDate: 'تسویه‌حساب', supervisionType: 'نوع نظارت', supervisionFee: 'مبلغ نظارت',
    supervisionPaidAt: 'پرداخت حق‌نظارت', supervisionLetterNumber: 'نامه پرداخت نظارت',
    plannedProgress: 'پیشرفت برنامه', actualProgress: 'پیشرفت واقعی', bankAccountNote: 'حساب بانکی',
    supervisorNames: 'ناظرین (متن)', supervisorId: 'ناظر سامانه', instituteId: 'مؤسسه', instituteName: 'مؤسسه جدید',
  }
  return map[key] || key
}

export function ProjectWizard({
  open, onClose, initial, onSaved,
}: {
  open: boolean
  onClose: () => void
  initial?: WizardInitial | null
  onSaved: () => void
}) {
  const user = useAppStore((s) => s.user)
  const isEdit = Boolean(initial?.id)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [supervisors, setSupervisors] = useState<SupervisorUser[]>([])
  const [institutes, setInstitutes] = useState<InstituteItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setStep(0)
    setError(null)
    if (initial?.id) {
      const d = initial as Record<string, unknown>
      const f: Record<string, string> = { ...emptyForm }
      for (const k of Object.keys(emptyForm) as (keyof FormState)[]) {
        const v = d[k]
        if (v === null || v === undefined) continue
        if (k.endsWith('Date') || k === 'contractDate') {
          f[k] = toJalaliInputString(String(v))
        } else {
          f[k] = String(v)
        }
      }
      setForm(f as unknown as FormState)
    } else {
      setForm({ ...emptyForm })
    }
    // بارگذاری ناظران و مؤسسات
    api<{ items: SupervisorUser[] }>('/api/supervisors').then((r) => setSupervisors(r.items)).catch(() => null)
    api<{ items: InstituteItem[] }>('/api/institutes').then((r) => setInstitutes(r.items)).catch(() => null)
  }, [open, initial])

  const set = (k: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  const canManage = user?.role === 'ADMIN' || user?.role === 'PROJECT_CONTROL'

  const summaryRows = useMemo(() => {
    return (Object.keys(emptyForm) as (keyof FormState)[])
      .filter((k) => form[k] !== '' && form[k] !== null && form[k] !== undefined)
      .map((k) => ({ key: k, label: labelOf(k), value: String(form[k]) }))
  }, [form])

  function validateStep(i: number): string | null {
    if (i === 0) {
      if (!form.title.trim()) return 'عنوان پروژه الزامی است.'
    }
    if (i === 1) {
      if (form.kind === 'PROJECT' && !form.contractNumber.trim()) return 'برای پروژه، شماره قرارداد الزامی است.'
      if (form.amount && !/^\d+$/.test(form.amount)) return 'مبلغ باید فقط رقم باشد.'
    }
    if (i === 3) {
      for (const k of ['contractDate', 'startDate', 'endDate', 'registrationDate', 'seminarDate', 'settlementDate', 'financeReferralDate'] as const) {
        if (form[k] && !parseJalaliInput(form[k])) return `فرمت تاریخ نامعتبر است: ${labelOf(k)}`
      }
    }
    return null
  }

  function next() {
    const err = validateStep(step)
    if (err) { setError(err); return }
    setError(null)
    setStep((s) => Math.min(STEPS.length - 1, s + 1))
  }

  async function submit() {
    setError(null)
    setSaving(true)
    try {
      const payload: Record<string, unknown> = { ...form }
      // فیلدهای عددی خالی → حذف
      for (const k of Object.keys(payload)) {
        if (payload[k] === '') payload[k] = null
      }
      payload.kind = form.kind
      if (form.plannedProgress !== '') payload.plannedProgress = Number(form.plannedProgress)
      else payload.plannedProgress = null
      if (form.actualProgress !== '') payload.actualProgress = Number(form.actualProgress)
      else payload.actualProgress = null
      if (form.durationMonths !== '') payload.durationMonths = Number(form.durationMonths)
      else payload.durationMonths = null
      if (isEdit) {
        await api(`/api/projects/${initial!.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      } else {
        await api('/api/projects', { method: 'POST', body: JSON.stringify(payload) })
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در ذخیره‌سازی')
    } finally {
      setSaving(false)
    }
  }

  if (!canManage) return null

  const Field = ({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  )

  const summaryRowsLocal = summaryRows

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle>{isEdit ? `ویرایش ${PROJECT_KIND_LABELS[form.kind]} ${form.code || ''}` : 'ثبت جدید پروژه / پروپوزال'}</DialogTitle>
          <DialogDescription>
            مرحله {step + 1} از {STEPS.length}: {STEPS[step].hint} — نیازی به پر کردن همه فیلدها در یک نوبت نیست.
          </DialogDescription>
        </DialogHeader>

        {/* نوار مراحل */}
        <div className="px-1">
          <div className="flex items-center gap-1 mb-2 overflow-x-auto pb-1">
            {STEPS.map((s, i) => {
              const Icon = s.icon
              const done = i < step
              const active = i === step
              return (
                <button
                  key={s.key}
                  onClick={() => i <= step && setStep(i)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] whitespace-nowrap transition-colors',
                    active ? 'bg-primary text-primary-foreground font-bold' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground',
                    i > step && 'cursor-default'
                  )}
                >
                  {done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                  {s.title}
                </button>
              )
            })}
          </div>
          <Progress value={((step + 1) / STEPS.length) * 100} className="h-1.5" />
        </div>

        <ScrollArea className="flex-1 max-h-[52vh] pr-2 mt-3">
          <div className="space-y-4 pb-2">
            {/* ---------- مرحله ۱: پایه ---------- */}
            {step === 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="نوع رکورد" required>
                  <Select value={form.kind} onValueChange={(v) => set('kind')(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PROJECT">پروژه (دارای قرارداد)</SelectItem>
                      <SelectItem value="PROPOSAL">پروپوزال (پیش از قرارداد)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="کد پروژه (خالی = تولید خودکار)">
                  <Input dir="ltr" className="ltr-input" value={form.code} onChange={(e) => set('code')(e.target.value.replace(/\D/g, ''))} placeholder="خودکار" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="عنوان پروژه / پژوهش" required>
                    <Textarea rows={2} value={form.title} onChange={(e) => set('title')(e.target.value)} placeholder="عنوان کامل پژوهش..." />
                  </Field>
                </div>
                <Field label="نام گروه">
                  <Select value={form.groupName || undefined} onValueChange={(v) => set('groupName')(v === '__none__' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="انتخاب گروه" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— بدون گروه —</SelectItem>
                      {GROUP_NAMES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="نوع طرح">
                  <Select value={form.researchType || undefined} onValueChange={(v) => set('researchType')(v === '__none__' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="انتخاب نوع طرح" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— انتخاب نشده —</SelectItem>
                      {RESEARCH_TYPES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="مؤسسه / دانشگاه">
                  <Input list="institute-list" value={form.instituteName} onChange={(e) => { set('instituteName')(e.target.value); set('instituteId')('') }} placeholder="جستجو یا تایپ نام جدید..." />
                  <datalist id="institute-list">
                    {institutes.map((i) => <option key={i.id} value={i.name} />)}
                  </datalist>
                </Field>
                <Field label="شماره بایگانی">
                  <Input dir="ltr" className="ltr-input" value={form.archiveNumber} onChange={(e) => set('archiveNumber')(e.target.value)} />
                </Field>
              </div>
            )}

            {/* ---------- مرحله ۲: قرارداد ---------- */}
            {step === 1 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="شماره قرارداد" required={form.kind === 'PROJECT'}>
                  <Input dir="ltr" className="ltr-input" value={form.contractNumber} onChange={(e) => set('contractNumber')(e.target.value)} placeholder="08-133/00000ص پ" />
                </Field>
                <Field label="تاریخ قرارداد (شمسی)">
                  <JalaliInput value={form.contractDate} onChange={set('contractDate')} />
                </Field>
                <Field label="مبلغ پروژه (ریال)">
                  <MoneyInput value={form.amount} onChange={set('amount')} />
                </Field>
                <Field label="مدت زمان پروژه (ماه)">
                  <Input dir="ltr" inputMode="numeric" className="ltr-input" value={form.durationMonths} onChange={(e) => set('durationMonths')(e.target.value.replace(/[^\d.]/g, ''))} placeholder="۱۲" />
                </Field>
                <Field label="نام مجری">
                  <Input value={form.executorName} onChange={(e) => set('executorName')(e.target.value)} />
                </Field>
                <Field label="نام مدیر پروژه">
                  <Input value={form.managerName} onChange={(e) => set('managerName')(e.target.value)} />
                </Field>
                <Field label="نام شرکت (در صورت وجود)">
                  <Input value={form.companyName} onChange={(e) => set('companyName')(e.target.value)} />
                </Field>
                <Field label="مسئول پرونده">
                  <Input value={form.caseManager} onChange={(e) => set('caseManager')(e.target.value)} />
                </Field>
              </div>
            )}

            {/* ---------- مرحله ۳: نظارت ---------- */}
            {step === 2 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="ناظر سامانه (کاربر ثبت‌کننده ارزیابی)">
                  <Select value={form.supervisorId || undefined} onValueChange={(v) => set('supervisorId')(v === '__none__' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="انتخاب ناظر" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— بدون ناظر سامانه —</SelectItem>
                      {supervisors.map((s) => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="ناظرین (متن آزاد — مطابق اکسل)">
                  <Input value={form.supervisorNames} onChange={(e) => set('supervisorNames')(e.target.value)} placeholder="نام۱- نام۲" />
                </Field>
                <Field label="نوع نظارت">
                  <Select value={form.supervisionType || undefined} onValueChange={(v) => set('supervisionType')(v === '__none__' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="انتخاب نوع نظارت" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— انتخاب نشده —</SelectItem>
                      {SUPERVISION_TYPES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="مبلغ نظارت (ریال)">
                  <MoneyInput value={form.supervisionFee} onChange={set('supervisionFee')} />
                </Field>
                <Field label="تاریخ پرداخت حق‌الزحمه نظارت">
                  <JalaliInput value={form.supervisionPaidAt} onChange={set('supervisionPaidAt')} />
                </Field>
                <Field label="شماره نامه پرداخت نظارت">
                  <Input dir="ltr" className="ltr-input" value={form.supervisionLetterNumber} onChange={(e) => set('supervisionLetterNumber')(e.target.value)} />
                </Field>
              </div>
            )}

            {/* ---------- مرحله ۴: زمان‌بندی ---------- */}
            {step === 3 && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="وضعیت پروژه">
                  <Select value={form.status} onValueChange={(v) => set('status')(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROJECT_STATUS.map((s) => <SelectItem key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="تاریخ شروع به کار مجری">
                  <JalaliInput value={form.startDate} onChange={set('startDate')} />
                </Field>
                <Field label="تاریخ پایان کار مجری">
                  <JalaliInput value={form.endDate} onChange={set('endDate')} />
                </Field>
                <Field label="شماره نامه شروع به کار">
                  <Input dir="ltr" className="ltr-input" value={form.startLetterNumber} onChange={(e) => set('startLetterNumber')(e.target.value)} />
                </Field>
                <Field label="تاریخ معرفی به امور مالی">
                  <JalaliInput value={form.financeReferralDate} onChange={set('financeReferralDate')} />
                </Field>
                <Field label="شماره نامه معرفی به امور مالی">
                  <Input dir="ltr" className="ltr-input" value={form.financeReferralNumber} onChange={(e) => set('financeReferralNumber')(e.target.value)} />
                </Field>
                <Field label="درصد پیشرفت برنامه">
                  <Input dir="ltr" inputMode="decimal" className="ltr-input" value={form.plannedProgress} onChange={(e) => { const v = e.target.value.replace(/[^\d.]/g, ''); set('plannedProgress')(v === '' || Number(v) <= 100 ? v : '100') }} placeholder="۰ تا ۱۰۰" />
                </Field>
                <Field label="درصد پیشرفت واقعی">
                  <Input dir="ltr" inputMode="decimal" className="ltr-input" value={form.actualProgress} onChange={(e) => { const v = e.target.value.replace(/[^\d.]/g, ''); set('actualProgress')(v === '' || Number(v) <= 100 ? v : '100') }} placeholder="۰ تا ۱۰۰" />
                </Field>
                <Field label="تاریخ سمینار">
                  <JalaliInput value={form.seminarDate} onChange={set('seminarDate')} />
                </Field>
                <Field label="تاریخ تسویه‌حساب">
                  <JalaliInput value={form.settlementDate} onChange={set('settlementDate')} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="توضیحات">
                    <Textarea rows={2} value={form.notes} onChange={(e) => set('notes')(e.target.value)} />
                  </Field>
                </div>
              </div>
            )}

            {/* ---------- مرحله ۵: بازبینی ---------- */}
            {step === 4 && (
              <div>
                <p className="text-sm text-muted-foreground mb-3">خلاصه اطلاعات واردشده را کنترل کنید و سپس ثبت نمایید.</p>
                {summaryRows.length === 0 ? (
                  <p className="text-sm text-destructive">هیچ داده‌ای وارد نشده است!</p>
                ) : (
                  <div className="rounded-xl border divide-y">
                    {summaryRows.map(({ key, label, value }) => (
                      <div key={key} className="flex items-start gap-3 px-3 py-2 text-sm">
                        <span className="text-muted-foreground text-xs min-w-36">{label}:</span>
                        <span className="font-medium break-all flex-1">
                          {['amount', 'supervisionFee'].includes(key) ? `${tomanSummary(value)} (${value} ریال)` : value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">{error}</p>
            )}
          </div>
        </ScrollArea>

        <Separator className="my-2" />
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" onClick={onClose} size="sm">انصراف</Button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
                <ChevronRight className="h-4 w-4" /> مرحله قبل
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button size="sm" onClick={next}>مرحله بعد <ChevronLeft className="h-4 w-4" /></Button>
            ) : (
              <Button size="sm" onClick={submit} disabled={saving || summaryRows.length === 0}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {isEdit ? 'ذخیره تغییرات' : 'ثبت نهایی'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** نمایش خلاصه مبلغ در بازبینی */
export function ReviewAmount({ value }: { value: string }) {
  return <Amount value={value} />
}
