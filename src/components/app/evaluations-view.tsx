'use client'
// ===== داشبورد ارزیابی و امتیازدهی ناظران =====
import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { api, apiPost, apiPatch, ApiError } from '@/lib/client'
import { useAppStore } from '@/lib/store'
import { EVALUATION_CRITERIA, gradeOf, canEvaluate, PERFORMANCE_TRENDS } from '@/lib/constants'
import { formatNumberFa, formatPercent, formatDecimalFa } from '@/lib/format'
import { JDate, GradeBadge, KindBadge, EmptyState, StatusBadge } from './shared'
import { ClipboardCheck, Star, Loader2, Pencil, Target, TrendingUp } from 'lucide-react'

interface EvalRow {
  id: string; totalScore: number; grade: string | null; performanceTrend: string | null
  comment: string | null; evaluatedAt: string; targetType: string
  evaluator?: { id: string; fullName: string } | null
  project?: { id: string; code: string; title: string; kind: string; status: string; groupName: string | null } | null
}
interface EvalDash {
  stats: { total: number; avgScore: number; gradeDist: Record<string, number>; trendDist: Record<string, number>; pendingProjects: number; pendingProposals: number }
  monthly: { label: string; count: number }[]
  pendingProjects: Array<{ id: string; code: string; title: string; groupName: string | null; supervisorNames: string | null; supervisorId: string | null }>
  pendingProposals: Array<{ id: string; code: string; title: string; groupName: string | null; supervisorNames: string | null }>
  recent: EvalRow[]
  supervisors: Array<{ id: string; fullName: string; _count?: { evaluations: number } }>
}

interface ScoreTarget { id: string; title: string; code: string; kind: string }

const EMPTY_SCORES = { technical: 10, management: 10, financial: 10, innovation: 10, documentation: 10 }

export function EvaluationsView() {
  const user = useAppStore((s) => s.user)
  const bump = useAppStore((s) => s.bumpDataVersion)
  const { toast } = useToast()
  const [data, setData] = useState<EvalDash | null>(null)
  const [loading, setLoading] = useState(true)
  const [onlyMine, setOnlyMine] = useState(false)
  const [evaluatorFilter, setEvaluatorFilter] = useState('ALL')
  const [list, setList] = useState<EvalRow[]>([])
  const [listLoading, setListLoading] = useState(true)

  // فرم امتیازدهی
  const [dialogOpen, setDialogOpen] = useState(false)
  const [target, setTarget] = useState<ScoreTarget | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [scores, setScores] = useState({ ...EMPTY_SCORES })
  const [trend, setTrend] = useState<string>('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  const canEval = user && canEvaluate(user.role)

  const loadDash = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api<EvalDash>('/api/eval-dashboard')
      setData(d)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  const loadList = useCallback(async () => {
    setListLoading(true)
    try {
      const params = new URLSearchParams({ pageSize: '25' })
      if (onlyMine && user) params.set('mine', '1')
      else if (evaluatorFilter !== 'ALL') params.set('evaluatorId', evaluatorFilter)
      const r = await api<{ items: EvalRow[] }>(`/api/evaluations?${params}`)
      setList(r.items)
    } catch { setList([]) }
    finally { setListLoading(false) }
  }, [onlyMine, evaluatorFilter, user])

  useEffect(() => { loadDash() }, [loadDash])
  useEffect(() => { loadList() }, [loadList])

  function openScore(t: ScoreTarget, existing?: EvalRow) {
    setTarget(t)
    if (existing) {
      setEditId(existing.id)
      setScores({
        technical: (existing as unknown as Record<string, number>).technical ?? 10,
        management: (existing as unknown as Record<string, number>).management ?? 10,
        financial: (existing as unknown as Record<string, number>).financial ?? 10,
        innovation: (existing as unknown as Record<string, number>).innovation ?? 10,
        documentation: (existing as unknown as Record<string, number>).documentation ?? 10,
      })
      setTrend(existing.performanceTrend || '')
      setComment(existing.comment || '')
    } else {
      setEditId(null)
      setScores({ ...EMPTY_SCORES })
      setTrend('')
      setComment('')
    }
    setDialogOpen(true)
  }

  const total = Object.values(scores).reduce((a, b) => a + b, 0)
  const g = gradeOf(total)

  async function submitScore() {
    if (!target) return
    setSaving(true)
    try {
      if (editId) {
        await apiPatch(`/api/evaluations/${editId}`, { ...scores, performanceTrend: trend || null, comment })
        toast({ title: 'ارزیابی ویرایش شد', description: `امتیاز جدید: ${formatNumberFa(total)}` })
      } else {
        await apiPost('/api/evaluations', { targetType: 'PROJECT', targetId: target.id, ...scores, performanceTrend: trend || null, comment })
        toast({ title: 'ارزیابی ثبت شد', description: `امتیاز کل: ${formatNumberFa(total)} — درجه: ${g.grade}` })
      }
      setDialogOpen(false)
      loadDash()
      loadList()
      bump()
    } catch (err) {
      toast({ title: 'خطا', description: err instanceof ApiError ? err.message : 'خطا در ثبت ارزیابی', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading || !data) {
    return <div className="grid gap-4 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
  }

  return (
    <div className="space-y-5">
      {/* آمار کلی */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="card-hover"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">کل ارزیابی‌ها</p>
          <p className="text-2xl font-extrabold">{formatNumberFa(data.stats.total)}</p>
        </CardContent></Card>
        <Card className="card-hover"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">میانگین امتیاز</p>
          <p className="text-2xl font-extrabold text-emerald-700">{formatDecimalFa(data.stats.avgScore, 1)}</p>
        </CardContent></Card>
        <Card className="card-hover"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">پروژه‌های در انتظار ارزیابی</p>
          <p className="text-2xl font-extrabold text-amber-600">{formatNumberFa(data.stats.pendingProjects)}</p>
        </CardContent></Card>
        <Card className="card-hover"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">پروپوزال‌های در انتظار</p>
          <p className="text-2xl font-extrabold text-violet-600">{formatNumberFa(data.stats.pendingProposals)}</p>
        </CardContent></Card>
      </div>

      {/* توزیع درجات + روند */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><Star className="h-4 w-4 text-amber-500" /> توزیع درجات</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {['عالی', 'خوب', 'متوسط', 'ضعیف'].map((gr) => {
              const n = data.stats.gradeDist[gr] || 0
              const p = data.stats.total ? (n / data.stats.total) * 100 : 0
              return (
                <div key={gr}>
                  <div className="flex justify-between text-[11px] mb-1"><span>{gr}</span><span className="text-muted-foreground">{formatNumberFa(n)}</span></div>
                  <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                    <div className={`h-full ${gr === 'عالی' ? 'bg-emerald-500' : gr === 'خوب' ? 'bg-teal-500' : gr === 'متوسط' ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${p}%` }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-teal-600" /> روند عملکرد</CardTitle></CardHeader>
          <CardContent className="flex gap-2 flex-wrap">
            {PERFORMANCE_TRENDS.map((t) => (
              <div key={t} className="flex-1 rounded-xl border p-3 text-center min-w-20">
                <p className="text-xl font-extrabold">{formatNumberFa(data.stats.trendDist[t] || 0)}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{t}</p>
              </div>
            ))}
            {data.stats.total === 0 && <p className="text-xs text-muted-foreground">داده‌ای موجود نیست</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm">ناظران فعال</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-40 overflow-y-auto">
            {data.supervisors.length === 0 && <p className="text-xs text-muted-foreground">ناظری ثبت نشده — از بخش «مدیریت ناظران» اضافه کنید.</p>}
            {data.supervisors.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs border-b border-dashed pb-1.5 last:border-0">
                <span>{s.fullName}</span>
                <Badge variant="secondary">{formatNumberFa(s._count?.evaluations || 0)} ارزیابی</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* در انتظار ارزیابی */}
      {canEval && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><Target className="h-4 w-4 text-primary" /> صف ارزیابی — پروژه‌های فعال بدون ارزیابی</CardTitle></CardHeader>
          <CardContent>
            {data.pendingProjects.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">همه پروژه‌های فعال ارزیابی شده‌اند ✔</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-64 overflow-y-auto pr-1">
                {data.pendingProjects.map((p) => (
                  <div key={p.id} className="rounded-xl border p-3 flex flex-col gap-2 card-hover">
                    <p className="text-xs font-medium leading-snug line-clamp-2" title={p.title}>{p.title || p.code}</p>
                    <p className="text-[10px] text-muted-foreground font-mono ltr-input">{p.code} {p.groupName ? `| ${p.groupName}` : ''}</p>
                    {p.supervisorNames && <p className="text-[10px] text-muted-foreground truncate">ناظر: {p.supervisorNames}</p>}
                    <Button size="sm" className="mt-auto gap-1" onClick={() => openScore({ id: p.id, title: p.title, code: p.code, kind: 'PROJECT' })}>
                      <ClipboardCheck className="h-3.5 w-3.5" /> ارزیابی
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* تاریخچه ارزیابی‌ها */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">تاریخچه ارزیابی‌ها</CardTitle>
          <div className="flex items-center gap-2">
            {canEval && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">فقط ارزیابی‌های من</span>
                <Switch checked={onlyMine} onCheckedChange={setOnlyMine} />
              </div>
            )}
            {!onlyMine && (
              <Select value={evaluatorFilter} onValueChange={setEvaluatorFilter}>
                <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">همه ارزیاب‌ها</SelectItem>
                  {data.supervisors.map((s) => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {listLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : list.length === 0 ? (
            <EmptyState title="ارزیابی‌ای یافت نشد" hint="از صف ارزیابی بالا شروع کنید" />
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-lg border">
              <Table className="rd-table min-w-[720px]">
                <TableHeader className="sticky top-0 bg-muted/95">
                  <TableRow>
                    <TableHead>پروژه</TableHead>
                    <TableHead>ارزیاب</TableHead>
                    <TableHead>امتیاز / درجه</TableHead>
                    <TableHead className="hidden md:table-cell">روند</TableHead>
                    <TableHead>تاریخ</TableHead>
                    {canEval && <TableHead className="text-left"> </TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="max-w-52">
                        <p className="text-xs font-medium truncate" title={e.project?.title}>{e.project?.title || '—'}</p>
                        <div className="flex gap-1 mt-0.5"><KindBadge kind={e.project?.kind || 'PROJECT'} /></div>
                      </TableCell>
                      <TableCell className="text-xs">{e.evaluator?.fullName || '—'}</TableCell>
                      <TableCell><GradeBadge score={e.totalScore} grade={e.grade} /></TableCell>
                      <TableCell className="hidden md:table-cell text-xs">{e.performanceTrend || '—'}</TableCell>
                      <TableCell className="text-xs"><JDate value={e.evaluatedAt} /></TableCell>
                      {canEval && (
                        <TableCell className="text-left">
                          {(user?.role === 'ADMIN' || e.evaluator?.id === user?.id) && e.project && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="ویرایش" onClick={() => openScore({ id: e.project!.id, title: e.project!.title, code: e.project!.code, kind: 'PROJECT' }, e)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* فرم امتیازدهی */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">{editId ? 'ویرایش ارزیابی' : 'ثبت ارزیابی جدید'}</DialogTitle>
            <DialogDescription className="leading-snug">
              {target && <><span className="font-medium text-foreground">{target.title}</span><br /><span className="font-mono text-[11px]" dir="ltr">{target.code}</span></>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {EVALUATION_CRITERIA.map((c) => (
              <div key={c.key}>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">{c.label}</Label>
                  <Badge variant="secondary" className="tabular-nums">{formatNumberFa(scores[c.key as keyof typeof scores])} / ۲۰</Badge>
                </div>
                <input
                  type="range" min={0} max={20} step={1} value={scores[c.key as keyof typeof scores]}
                  onChange={(e) => setScores((s) => ({ ...s, [c.key]: Number(e.target.value) }))}
                  className="w-full"
                />
                <p className="text-[10px] text-muted-foreground">{c.hint}</p>
              </div>
            ))}

            <div className="rounded-xl border-2 p-3 flex items-center justify-between" style={{ borderColor: 'currentColor' }}>
              <div>
                <p className="text-[11px] text-muted-foreground">امتیاز کل</p>
                <p className="text-3xl font-extrabold tabular-nums">{formatNumberFa(total)}<span className="text-sm text-muted-foreground"> / ۱۰۰</span></p>
              </div>
              <Badge className={`text-sm px-3 py-1.5 ${g.color}`} variant="outline">{g.grade}</Badge>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">روند عملکرد</Label>
              <Select value={trend || undefined} onValueChange={setTrend}>
                <SelectTrigger><SelectValue placeholder="انتخاب روند" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— بدون روند —</SelectItem>
                  {PERFORMANCE_TRENDS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">توضیحات ارزیاب</Label>
              <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="نظرات تخصصی درباره پیشرفت و کیفیت پروژه..." />
            </div>

            <Button className="w-full" onClick={submitScore} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
              {editId ? 'ذخیره ویرایش' : 'ثبت ارزیابی'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
