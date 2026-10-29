'use client'
// ===== جزئیات پروژه: اطلاعات، مالی، تمدیدها، ارزیابی‌ها، مستندات =====
import { useCallback, useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useToast } from '@/hooks/use-toast'
import { api, apiDelete, apiPost, apiUpload, ApiError } from '@/lib/client'
import { useAppStore } from '@/lib/store'
import { PAYMENT_TYPE_LABELS, PAYMENT_TYPES, canManageProjects, isAdmin } from '@/lib/constants'
import { formatPercent, formatFileSize } from '@/lib/format'
import { Amount, JDate, PercentBar, StatusBadge, KindBadge, JalaliInput, MoneyInput, FaNum, EmptyState, GradeBadge } from './shared'
import { Wallet, Plus, Trash2, Download, Loader2, ChevronDown, FolderOpen } from 'lucide-react'

interface PaymentRow {
  id: string; amount: string; netAmount: string | null; type: string; subject: string | null
  letterNumber: string | null; date: string | null; documentNumber: string | null
  documentDate: string | null; note: string | null; isLegacy: boolean
  createdBy?: { fullName: string } | null
}
interface ExtensionRow {
  id: string; months: number | null; days: number | null; date: string | null; rawValue: string | null; isLegacy: boolean
}
interface EvaluationRow {
  id: string; totalScore: number; grade: string | null; performanceTrend: string | null; comment: string | null
  evaluatedAt: string; evaluator?: { fullName: string } | null; isLegacy?: boolean
}
interface DocumentRow {
  id: string; title: string; fileName: string; mimeType: string | null; size: number; createdAt: string
  uploadedBy?: { fullName: string } | null
}
interface ItemRow {
  id: string; name: string; quantity: number | null; unit: string | null; unitPriceRial: string | null
  totalPriceRial: string | null; isConsumable: boolean | null
}
export interface ProjectDetail {
  id: string; kind: string; code: string; archiveNumber: string | null; contractNumber: string | null
  contractDate: string | null; title: string; notes: string | null; amount: string; durationMonths: number | null
  groupName: string | null; registrationDate: string | null; executorName: string | null; managerName: string | null
  caseManager: string | null; companyName: string | null; researchType: string | null; status: string
  statusNote: string | null; finalStatusNote: string | null; startDate: string | null; endDate: string | null
  startLetterNumber: string | null; financeReferralDate: string | null; financeReferralNumber: string | null
  seminarDate: string | null; settlementDate: string | null; supervisionType: string | null
  supervisionFee: string; supervisionPaidAt: string | null; supervisionLetterNumber: string | null
  plannedProgress: number | null; actualProgress: number | null; totalPaid: string
  bankAccountNote: string | null; supervisorNames: string | null
  institute?: { name: string } | null
  supervisor?: { id: string; fullName: string } | null
  author?: { fullName: string } | null
  payments: PaymentRow[]
  extensions: ExtensionRow[]
  evaluations: EvaluationRow[]
  items: ItemRow[]
  documents: DocumentRow[]
}

export function ProjectDetailDialog({
  projectId, open, onClose, onChanged,
}: {
  projectId: string | null
  open: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const user = useAppStore((s) => s.user)
  const bump = useAppStore((s) => s.bumpDataVersion)
  const { toast } = useToast()
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(false)

  // فرم پرداخت
  const [payOpen, setPayOpen] = useState(false)
  const [payForm, setPayForm] = useState({ amount: '', type: 'PROGRESS', subject: '', letterNumber: '', date: '', documentNumber: '', documentDate: '', note: '' })
  const [paySaving, setPaySaving] = useState(false)
  // فرم تمدید
  const [extForm, setExtForm] = useState({ months: '', date: '', note: '' })
  // بارگذاری سند
  const [docTitle, setDocTitle] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docSaving, setDocSaving] = useState(false)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const d = await api<ProjectDetail>(`/api/projects/${projectId}`)
      setDetail(d)
    } catch {
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (open) { load(); setPayOpen(false) }
    else setDetail(null)
  }, [open, load])

  if (!open) return null

  async function addPayment() {
    if (!projectId) return
    setPaySaving(true)
    try {
      await apiPost(`/api/projects/${projectId}/payments`, payForm)
      toast({ title: 'پرداخت ثبت شد', description: `${payForm.amount} ریال` })
      setPayForm({ amount: '', type: 'PROGRESS', subject: '', letterNumber: '', date: '', documentNumber: '', documentDate: '', note: '' })
      setPayOpen(false)
      await load()
      onChanged()
      bump()
    } catch (err) {
      toast({ title: 'خطا', description: err instanceof ApiError ? err.message : 'خطای نامشخص', variant: 'destructive' })
    } finally {
      setPaySaving(false)
    }
  }

  async function deletePayment(id: string) {
    try {
      await apiDelete(`/api/payments/${id}`)
      toast({ title: 'پرداخت حذف شد' })
      await load()
      onChanged()
      bump()
    } catch (err) {
      toast({ title: 'خطا', description: err instanceof ApiError ? err.message : 'خطا در حذف', variant: 'destructive' })
    }
  }

  async function addExtension() {
    if (!projectId) return
    try {
      await apiPost(`/api/projects/${projectId}/extensions`, extForm)
      toast({ title: 'تمدید ثبت شد' })
      setExtForm({ months: '', date: '', note: '' })
      await load()
      onChanged()
      bump()
    } catch (err) {
      toast({ title: 'خطا', description: err instanceof ApiError ? err.message : 'خطای نامشخص', variant: 'destructive' })
    }
  }

  async function uploadDoc() {
    if (!projectId || !docFile || !docTitle) {
      toast({ title: 'عنوان و فایل الزامی است', variant: 'destructive' })
      return
    }
    setDocSaving(true)
    try {
      const fd = new FormData()
      fd.append('file', docFile)
      fd.append('title', docTitle)
      fd.append('entityType', 'PROJECT')
      fd.append('entityId', projectId)
      await apiUpload('/api/documents', fd)
      toast({ title: 'سند بارگذاری شد' })
      setDocTitle('')
      setDocFile(null)
      await load()
    } catch (err) {
      toast({ title: 'خطا', description: err instanceof ApiError ? err.message : 'خطا در بارگذاری', variant: 'destructive' })
    } finally {
      setDocSaving(false)
    }
  }

  const manage = user && canManageProjects(user.role)
  const admin = user && isAdmin(user.role)
  const remaining = detail ? BigInt(detail.amount) - BigInt(detail.totalPaid) : 0n

  const InfoRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex flex-col gap-0.5 py-1.5 border-b border-dashed last:border-0 sm:flex-row sm:items-center sm:gap-2">
      <span className="text-[11px] text-muted-foreground min-w-40">{label}</span>
      <span className="text-sm font-medium break-all">{children}</span>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-base leading-snug flex-1 min-w-0">{detail?.title || 'در حال بارگذاری...'}</DialogTitle>
            {detail && <StatusBadge status={detail.status} />}
            {detail && <KindBadge kind={detail.kind} />}
          </div>
          {detail && (
            <DialogDescription className="font-mono text-xs" dir="ltr">
              {detail.code} {detail.contractNumber ? `| ${detail.contractNumber}` : ''}
            </DialogDescription>
          )}
        </DialogHeader>

        {loading || !detail ? (
          <div className="py-16 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <Tabs defaultValue="info" className="flex-1 flex flex-col min-h-0">
            <TabsList className="w-full justify-start overflow-x-auto h-auto flex-wrap">
              <TabsTrigger value="info">اطلاعات</TabsTrigger>
              <TabsTrigger value="finance">مالی و پرداخت‌ها</TabsTrigger>
              <TabsTrigger value="extensions">تمدیدها</TabsTrigger>
              <TabsTrigger value="evals">ارزیابی‌ها ({detail.evaluations.length})</TabsTrigger>
              <TabsTrigger value="docs">مستندات ({detail.documents.length})</TabsTrigger>
              {detail.items.length > 0 && <TabsTrigger value="items">کالا و مواد ({detail.items.length})</TabsTrigger>}
            </TabsList>

            <div className="flex-1 overflow-y-auto max-h-[55vh] mt-3 pr-1">
              {/* ---------------- اطلاعات ---------------- */}
              <TabsContent value="info" className="mt-0 space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Card className="p-3">
                    <p className="text-[11px] text-muted-foreground">مبلغ پروژه</p>
                    <Amount value={detail.amount} />
                  </Card>
                  <Card className="p-3">
                    <p className="text-[11px] text-muted-foreground">پرداخت‌شده</p>
                    <Amount value={detail.totalPaid} />
                  </Card>
                  <Card className="p-3">
                    <p className="text-[11px] text-muted-foreground">باقی‌مانده</p>
                    <Amount value={remaining.toString()} />
                  </Card>
                </div>
                <Card className="p-4">
                  <PercentBar actual={detail.actualProgress} planned={detail.plannedProgress} />
                </Card>
                <div className="grid gap-x-6 sm:grid-cols-2">
                  <div>
                    <InfoRow label="کد پروژه"><span className="font-mono" dir="ltr">{detail.code}</span></InfoRow>
                    <InfoRow label="شماره بایگانی">{detail.archiveNumber || '—'}</InfoRow>
                    <InfoRow label="شماره قرارداد">{detail.contractNumber || '—'}</InfoRow>
                    <InfoRow label="تاریخ قرارداد"><JDate value={detail.contractDate} /></InfoRow>
                    <InfoRow label="تاریخ ثبت"><JDate value={detail.registrationDate} /></InfoRow>
                    <InfoRow label="مدت زمان"><FaNum value={detail.durationMonths} /> ماه</InfoRow>
                    <InfoRow label="گروه">{detail.groupName || '—'}</InfoRow>
                    <InfoRow label="نوع طرح">{detail.researchType || '—'}</InfoRow>
                    <InfoRow label="مؤسسه / دانشگاه">{detail.institute?.name || '—'}</InfoRow>
                  </div>
                  <div>
                    <InfoRow label="مجری">{detail.executorName || '—'}</InfoRow>
                    <InfoRow label="مدیر پروژه">{detail.managerName || '—'}</InfoRow>
                    <InfoRow label="مسئول پرونده">{detail.caseManager || '—'}</InfoRow>
                    <InfoRow label="شرکت">{detail.companyName || '—'}</InfoRow>
                    <InfoRow label="شروع به کار مجری"><JDate value={detail.startDate} /></InfoRow>
                    <InfoRow label="پایان کار مجری"><JDate value={detail.endDate} /></InfoRow>
                    <InfoRow label="ناظرین">{detail.supervisor?.fullName || detail.supervisorNames || '—'}</InfoRow>
                    <InfoRow label="نوع نظارت">{detail.supervisionType || '—'}</InfoRow>
                    <InfoRow label="مبلغ نظارت"><Amount value={detail.supervisionFee} compact /></InfoRow>
                  </div>
                </div>
                {(detail.statusNote || detail.finalStatusNote || detail.notes || detail.bankAccountNote) && (
                  <Card className="p-4 bg-muted/40">
                    <p className="text-xs font-semibold mb-2">یادداشت‌ها</p>
                    <div className="text-xs space-y-1.5 text-muted-foreground">
                      {detail.statusNote && <p>وضعیت (متن اکسل): {detail.statusNote}</p>}
                      {detail.finalStatusNote && <p>وضعیت نهایی: {detail.finalStatusNote}</p>}
                      {detail.notes && <p>توضیحات: {detail.notes}</p>}
                      {detail.bankAccountNote && <p className="break-all">حساب بانکی: {detail.bankAccountNote}</p>}
                    </div>
                  </Card>
                )}
              </TabsContent>

              {/* ---------------- مالی ---------------- */}
              <TabsContent value="finance" className="mt-0 space-y-3">
                {manage && (
                  <Collapsible open={payOpen} onOpenChange={setPayOpen}>
                    <CollapsibleTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-1.5">
                        <Plus className="h-4 w-4" /> ثبت پرداخت جدید
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${payOpen ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <Card className="p-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs">مبلغ (ریال) *</Label>
                            <MoneyInput value={payForm.amount} onChange={(v) => setPayForm((f) => ({ ...f, amount: v }))} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">نوع پرداخت</Label>
                            <Select value={payForm.type} onValueChange={(v) => setPayForm((f) => ({ ...f, type: v }))}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>{PAYMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{PAYMENT_TYPE_LABELS[t]}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">عنوان نامه</Label>
                            <Input value={payForm.subject} onChange={(e) => setPayForm((f) => ({ ...f, subject: e.target.value }))} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">شماره نامه</Label>
                            <Input dir="ltr" className="ltr-input" value={payForm.letterNumber} onChange={(e) => setPayForm((f) => ({ ...f, letterNumber: e.target.value }))} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">تاریخ نامه</Label>
                            <JalaliInput value={payForm.date} onChange={(v) => setPayForm((f) => ({ ...f, date: v }))} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">شماره سند</Label>
                            <Input dir="ltr" className="ltr-input" value={payForm.documentNumber} onChange={(e) => setPayForm((f) => ({ ...f, documentNumber: e.target.value }))} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">تاریخ سند</Label>
                            <JalaliInput value={payForm.documentDate} onChange={(v) => setPayForm((f) => ({ ...f, documentDate: v }))} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs">یادداشت</Label>
                            <Input value={payForm.note} onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))} />
                          </div>
                        </div>
                        <Button size="sm" className="mt-3" onClick={addPayment} disabled={paySaving || !payForm.amount}>
                          {paySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />} ذخیره پرداخت
                        </Button>
                      </Card>
                    </CollapsibleContent>
                  </Collapsible>
                )}
                {detail.payments.length === 0 ? (
                  <EmptyState title="هنوز پرداختی ثبت نشده است" hint="با دکمه «ثبت پرداخت جدید» اولین سند مالی را اضافه کنید" />
                ) : (
                  <div className="max-h-80 overflow-y-auto rounded-lg border">
                    <Table className="rd-table">
                      <TableHeader className="sticky top-0 bg-muted/95">
                        <TableRow>
                          <TableHead>مبلغ</TableHead>
                          <TableHead className="hidden md:table-cell">نوع</TableHead>
                          <TableHead>عنوان/نامه</TableHead>
                          <TableHead>تاریخ</TableHead>
                          <TableHead className="hidden lg:table-cell">سند</TableHead>
                          {(manage || admin) && <TableHead> </TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.payments.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell><Amount value={p.amount} compact /></TableCell>
                            <TableCell className="hidden md:table-cell text-xs">
                              {PAYMENT_TYPE_LABELS[p.type as keyof typeof PAYMENT_TYPE_LABELS] || p.type}
                              {p.isLegacy && <span className="text-[10px] text-muted-foreground block">مهاجرت اکسل</span>}
                            </TableCell>
                            <TableCell className="max-w-44 truncate text-xs" title={p.subject || ''}>{p.subject || '—'}</TableCell>
                            <TableCell className="text-xs"><JDate value={p.date} /></TableCell>
                            <TableCell className="hidden lg:table-cell text-xs">{p.documentNumber || '—'}</TableCell>
                            {(manage || admin) && (
                              <TableCell>
                                <Button
                                  size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                                  onClick={() => deletePayment(p.id)}
                                  disabled={p.isLegacy && !admin}
                                  title={p.isLegacy && !admin ? 'رکوردهای مهاجرت فقط توسط مدیریت حذف می‌شوند' : 'حذف'}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              {/* ---------------- تمدیدها ---------------- */}
              <TabsContent value="extensions" className="mt-0 space-y-3">
                {manage && (
                  <Card className="p-4">
                    <p className="text-xs font-semibold mb-3">ثبت تمدید جدید</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">مدت (ماه)</Label>
                        <Input dir="ltr" inputMode="decimal" className="ltr-input" value={extForm.months} onChange={(e) => setExtForm((f) => ({ ...f, months: e.target.value.replace(/[^\d.]/g, '') }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">تاریخ تمدید</Label>
                        <JalaliInput value={extForm.date} onChange={(v) => setExtForm((f) => ({ ...f, date: v }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">یادداشت</Label>
                        <Input value={extForm.note} onChange={(e) => setExtForm((f) => ({ ...f, note: e.target.value }))} />
                      </div>
                    </div>
                    <Button size="sm" className="mt-3" onClick={addExtension} disabled={!extForm.months}>
                      <Plus className="h-4 w-4" /> ثبت تمدید
                    </Button>
                  </Card>
                )}
                {detail.extensions.length === 0 ? (
                  <EmptyState title="تمدیدی ثبت نشده است" />
                ) : (
                  <div className="max-h-72 overflow-y-auto rounded-lg border">
                    <Table className="rd-table">
                      <TableHeader className="sticky top-0 bg-muted/95">
                        <TableRow>
                          <TableHead>مدت</TableHead>
                          <TableHead>تاریخ</TableHead>
                          <TableHead className="hidden sm:table-cell">یادداشت / مقدار اکسل</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.extensions.map((x) => (
                          <TableRow key={x.id}>
                            <TableCell className="text-sm font-medium">
                              {x.months ? `${formatPercent(x.months, 0).replace('٪', '')} ماه` : x.days ? `${x.days} روز` : '—'}
                            </TableCell>
                            <TableCell className="text-xs"><JDate value={x.date} /></TableCell>
                            <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">{x.note || x.rawValue || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              {/* ---------------- ارزیابی‌ها ---------------- */}
              <TabsContent value="evals" className="mt-0">
                {detail.evaluations.length === 0 ? (
                  <EmptyState title="هنوز ارزیابی ثبت نشده است" hint="ناظران از بخش «داشبورد ارزیابی و امتیازدهی» می‌توانند ارزیابی ثبت کنند" />
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {detail.evaluations.map((e) => (
                      <Card key={e.id} className="p-3">
                        <div className="flex flex-wrap items-center gap-2 justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
                            <GradeBadge score={e.totalScore} grade={e.grade} />
                            <span className="text-xs font-medium">{e.evaluator?.fullName || 'مهاجرت اکسل'}</span>
                            <span className="text-[11px] text-muted-foreground"><JDate value={e.evaluatedAt} /></span>
                            {e.performanceTrend && <span className="text-[11px] bg-muted rounded-full px-2 py-0.5">روند: {e.performanceTrend}</span>}
                          </div>
                        </div>
                        {e.comment && <p className="text-xs text-muted-foreground mt-2">{e.comment}</p>}
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ---------------- مستندات ---------------- */}
              <TabsContent value="docs" className="mt-0 space-y-3">
                {manage && (
                  <Card className="p-4">
                    <p className="text-xs font-semibold mb-3 flex items-center gap-1.5"><FolderOpen className="h-4 w-4" /> بارگذاری سند اسکن‌شده (حداکثر ۱۰ مگابایت)</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">عنوان سند *</Label>
                        <Input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="مثلاً: قرارداد اسکن‌شده" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">فایل *</Label>
                        <Input type="file" onChange={(e) => setDocFile(e.target.files?.[0] || null)} accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.zip" />
                      </div>
                    </div>
                    <Button size="sm" className="mt-3" onClick={uploadDoc} disabled={docSaving || !docFile || !docTitle}>
                      {docSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} بارگذاری
                    </Button>
                  </Card>
                )}
                {detail.documents.length === 0 ? (
                  <EmptyState title="سندی بارگذاری نشده است" />
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {detail.documents.map((d) => (
                      <div key={d.id} className="flex items-center gap-3 rounded-lg border p-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{d.title}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{d.fileName} — {formatFileSize(d.size)} — {d.uploadedBy?.fullName || '—'}</p>
                        </div>
                        <span className="text-[11px] text-muted-foreground hidden sm:block"><JDate value={d.createdAt} /></span>
                        <a href={`/api/documents/${d.id}`} className="shrink-0">
                          <Button size="icon" variant="outline" className="h-8 w-8"><Download className="h-4 w-4" /></Button>
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ---------------- کالا و مواد ---------------- */}
              {detail.items.length > 0 && (
                <TabsContent value="items" className="mt-0">
                  <div className="max-h-80 overflow-y-auto rounded-lg border">
                    <Table className="rd-table">
                      <TableHeader className="sticky top-0 bg-muted/95">
                        <TableRow>
                          <TableHead>کالا / ماده</TableHead>
                          <TableHead>مقدار</TableHead>
                          <TableHead className="hidden sm:table-cell">قیمت واحد</TableHead>
                          <TableHead>قیمت کل</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.items.map((it) => (
                          <TableRow key={it.id}>
                            <TableCell className="text-xs max-w-52 truncate" title={it.name}>{it.name}{it.isConsumable === true ? ' (مصرفی)' : it.isConsumable === false ? ' (غیرمصرفی)' : ''}</TableCell>
                            <TableCell className="text-xs">{it.quantity !== null ? `${formatPercent(it.quantity, 0).replace('٪','')}` : '—'} {it.unit || ''}</TableCell>
                            <TableCell className="hidden sm:table-cell"><Amount value={it.unitPriceRial} compact /></TableCell>
                            <TableCell><Amount value={it.totalPriceRial} compact /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              )}
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}

export type { Textarea }
