'use client'
// ===== داشبورد وضعیت پروژه‌ها و پروپوزال‌ها =====
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { apiGet } from '@/lib/client'
import { useAppStore } from '@/lib/store'
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS, type ProjectStatus } from '@/lib/constants'
import { formatNumberFa, tomanSummary, formatDecimalFa } from '@/lib/format'
import { formatJalali } from '@/lib/jalali'
import { Amount, JDate, KindBadge, PercentBar, StatusBadge, EmptyState, FaNum } from './shared'
import {
  FolderKanban, Lightbulb, CheckCircle2, Activity, Wallet, PiggyBank,
  ClipboardCheck, Loader2, TrendingUp, UsersRound,
} from 'lucide-react'

interface DashData {
  cards: {
    totalProjects: number; projectCount: number; proposalCount: number
    activeCount: number; completedCount: number; terminatedCount: number; cancelledCount: number; inactiveCount: number
    totalAmount: string; totalPaid: string; remaining: string; totalSupervisionFee: string
    paymentCount: number; usersCount: number; evaluationsCount: number
    avgScore: number; avgActual: number; pendingEval: number
  }
  byStatus: { name: string; value: number }[]
  byGroup: { name: string; count: number; amount: string }[]
  monthly: { label: string; count: number }[]
  recent: Array<{ id: string; code: string; title: string; status: string; kind: string; groupName: string | null; amount: string; plannedProgress: number | null; actualProgress: number | null; updatedAt: string }>
  gradeDist: Record<string, number>
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#059669', COMPLETED: '#0d9488', TERMINATED: '#e11d48', CANCELLED: '#78716c', INACTIVE: '#d97706',
}

function StatCard({ title, value, sub, icon: Icon, tone = 'default' }: {
  title: string
  value: React.ReactNode
  sub?: React.ReactNode
  icon: typeof FolderKanban
  tone?: 'default' | 'green' | 'amber' | 'rose' | 'teal'
}) {
  const tones: Record<string, string> = {
    default: 'bg-stone-100 text-stone-600',
    green: 'bg-emerald-100 text-emerald-700',
    teal: 'bg-teal-100 text-teal-700',
    amber: 'bg-amber-100 text-amber-700',
    rose: 'bg-rose-100 text-rose-700',
  }
  return (
    <Card className="card-hover">
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-lg font-extrabold leading-tight mt-0.5">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export function DashboardView({ onOpenProjects }: { onOpenProjects?: () => void }) {
  const user = useAppStore((s) => s.user)
  const dataVersion = useAppStore((s) => s.dataVersion)
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    apiGet<DashData>('/api/dashboard')
      .then((d) => { if (alive) setData(d) })
      .catch(() => null)
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [dataVersion])

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        <div className="grid gap-4 lg:grid-cols-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-72" />)}</div>
      </div>
    )
  }

  const c = data.cards
  const statusChart = data.byStatus.map((s) => ({ ...s, label: PROJECT_STATUS_LABELS[s.name as ProjectStatus] || s.name }))

  return (
    <div className="space-y-6">
      {/* خوشامد */}
      <div className="rounded-2xl bg-gradient-to-l from-emerald-600 to-teal-600 text-white p-5 lg:p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm opacity-90">خوش آمدید</p>
            <h1 className="text-xl lg:text-2xl font-extrabold mt-1">{user?.fullName} عزیز 👋</h1>
            <p className="text-sm opacity-90 mt-1">وضعیت لحظه‌ای پروژه‌ها و پروپوزال‌های واحد تحقیق و توسعه در نگاه اول</p>
          </div>
          <div className="text-sm bg-white/15 rounded-xl px-4 py-2 backdrop-blur">
            <p className="opacity-90">میانگین پیشرفت واقعی</p>
            <p className="text-2xl font-extrabold">{formatDecimalFa(c.avgActual, 1)}٪</p>
          </div>
        </div>
      </div>

      {/* کارت‌های آماری */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="کل پروژه‌ها" value={<FaNum value={c.totalProjects} />} sub={`${formatNumberFa(c.projectCount)} پروژه + ${formatNumberFa(c.proposalCount)} پروپوزال`} icon={FolderKanban} />
        <StatCard title="در حال اجرا" value={<FaNum value={c.activeCount} />} sub="نیازمند پایش مستمر" icon={Activity} tone="green" />
        <StatCard title="خاتمه‌یافته" value={<FaNum value={c.completedCount} />} sub="تکمیل‌شده" icon={CheckCircle2} tone="teal" />
        <StatCard title="فسخ / باطل" value={<FaNum value={c.terminatedCount + c.cancelledCount} />} sub={`${formatNumberFa(c.terminatedCount)} فسخ + ${formatNumberFa(c.cancelledCount)} باطل`} icon={TrendingUp} tone="rose" />
        <StatCard title="کل تعهدات مالی" value={tomanSummary(c.totalAmount)} sub={`${formatNumberFa(c.totalAmount)} ریال`} icon={Wallet} />
        <StatCard title="پرداخت‌شده" value={tomanSummary(c.totalPaid)} sub={`${formatNumberFa(c.paymentCount)} سند پرداخت`} icon={PiggyBank} tone="green" />
        <StatCard title="باقی‌مانده" value={tomanSummary(c.remaining)} sub="مانده تعهدات" icon={Wallet} tone="amber" />
        <StatCard title="ارزیابی‌ها" value={<FaNum value={c.evaluationsCount} />} sub={`میانگین امتیاز: ${formatDecimalFa(c.avgScore, 1)} — در انتظار: ${formatNumberFa(c.pendingEval)}`} icon={ClipboardCheck} tone="teal" />
      </div>

      {/* نمودارها */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">توزیع وضعیت پروژه‌ها</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusChart} dataKey="value" nameKey="label" innerRadius={55} outerRadius={90} paddingAngle={3} strokeWidth={0}>
                    {statusChart.map((s) => (
                      <Cell key={s.name} fill={STATUS_COLORS[s.name] || '#a8a29e'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${formatNumberFa(v)} مورد`, 'تعداد']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {statusChart.map((s) => (
                <span key={s.name} className={`text-[11px] px-2 py-1 rounded-full border ${PROJECT_STATUS_COLORS[s.name as ProjectStatus] || ''}`}>
                  {s.label}: {formatNumberFa(s.value)}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">روند ثبت پروژه در ۱۲ ماه اخیر (شمسی)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthly} margin={{ top: 8, left: 0, right: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-35} textAnchor="end" height={56} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={30} />
                  <Tooltip formatter={(v: number) => [`${formatNumberFa(v)} پروژه`, 'ثبت‌شده']} />
                  <Bar dataKey="count" fill="#0d9488" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2"><CardTitle className="text-base">مبلغ پروژه‌ها به تفکیک گروه</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byGroup.slice(0, 6)} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(Number(v) / 1e9).toFixed(0)}B`} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [tomanSummary(v.toString()), 'مبلغ']} />
                  <Bar dataKey="amount" fill="#059669" radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">توزیع درجات ارزیابی</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {['عالی', 'خوب', 'متوسط', 'ضعیف'].map((g) => {
              const n = data.gradeDist[g] || 0
              const pctv = c.evaluationsCount ? Math.round((n / c.evaluationsCount) * 100) : 0
              return (
                <div key={g}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{g}</span>
                    <span className="text-muted-foreground">{formatNumberFa(n)} مورد</span>
                  </div>
                  <div className="h-2 bg-stone-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${g === 'عالی' ? 'bg-emerald-500' : g === 'خوب' ? 'bg-teal-500' : g === 'متوسط' ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${pctv}%` }} />
                  </div>
                </div>
              )
            })}
            {c.evaluationsCount === 0 && (
              <p className="text-xs text-muted-foreground pt-2">هنوز ارزیابی‌ای ثبت نشده است. ناظران می‌توانند از بخش «داشبورد ارزیابی» شروع کنند.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* آخرین رکوردها */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">آخرین رکوردهای ثبت/تغییر</CardTitle>
          {onOpenProjects && (
            <button onClick={onOpenProjects} className="text-xs text-primary hover:underline">مشاهده همه ←</button>
          )}
        </CardHeader>
        <CardContent>
          {data.recent.length === 0 ? (
            <EmptyState title="هنوز رکوردی ثبت نشده است" />
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-lg border">
              <Table className="rd-table">
                <TableHeader className="sticky top-0 bg-muted/95 backdrop-blur">
                  <TableRow>
                    <TableHead>کد</TableHead>
                    <TableHead>عنوان</TableHead>
                    <TableHead className="hidden md:table-cell">نوع</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead className="hidden sm:table-cell">مبلغ</TableHead>
                    <TableHead>پیشرفت</TableHead>
                    <TableHead className="hidden lg:table-cell">آخرین تغییر</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recent.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-xs ltr-input">{p.code}</TableCell>
                      <TableCell className="max-w-[240px] truncate text-xs" title={p.title}>{p.title || '—'}</TableCell>
                      <TableCell className="hidden md:table-cell"><KindBadge kind={p.kind} /></TableCell>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Amount value={p.amount} compact /></TableCell>
                      <TableCell><PercentBar actual={p.actualProgress} planned={p.plannedProgress} /></TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground"><JDate value={p.updatedAt} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
