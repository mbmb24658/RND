'use client'
// ===== مدیریت مالی =====
import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { api, ApiError } from '@/lib/client'
import { useAppStore } from '@/lib/store'
import { GROUP_NAMES, PROJECT_STATUS, PROJECT_STATUS_LABELS } from '@/lib/constants'
import { formatNumberFa, tomanSummary } from '@/lib/format'
import { Amount, PercentBar, StatusBadge, EmptyState } from './shared'
import { Wallet, PiggyBank, Search, Loader2 } from 'lucide-react'

interface FinanceRow {
  id: string; code: string; contractNumber: string | null; title: string; status: string
  groupName: string | null; amount: string; supervisionFee: string; totalPaid: string
  plannedProgress: number | null; actualProgress: number | null
  institute?: { name: string } | null
}
interface FinanceData { items: FinanceRow[]; total: number; page: number; pageSize: number; totals: { amount: string; paid: string; supervisionFee: string; remaining: string; count: number } }

export function FinanceView({ onOpenProjects }: { onOpenProjects?: () => void }) {
  const { toast } = useToast()
  const [data, setData] = useState<FinanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('ALL')
  const [group, setGroup] = useState('ALL')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25', status, group })
      if (q.trim()) params.set('q', q.trim())
      setData(await api<FinanceData>(`/api/finance?${params}`))
    } catch { setData(null) }
    finally { setLoading(false) }
  }, [page, q, status, group])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [q, status, group])

  const t = data?.totals
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div className="space-y-4">
      {/* کارت‌های مالی */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="card-hover border-r-4 border-r-emerald-500"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> کل تعهدات</p>
          <p className="text-lg font-extrabold mt-1">{t ? tomanSummary(t.amount) : '—'}</p>
          <p className="text-[11px] text-muted-foreground">{t ? `${formatNumberFa(t.amount)} ریال` : ''}</p>
        </CardContent></Card>
        <Card className="card-hover border-r-4 border-r-teal-500"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5"><PiggyBank className="h-3.5 w-3.5" /> پرداخت‌شده</p>
          <p className="text-lg font-extrabold mt-1 text-teal-700">{t ? tomanSummary(t.paid) : '—'}</p>
          <p className="text-[11px] text-muted-foreground">{t ? `${formatNumberFa(t.paid)} ریال` : ''}</p>
        </CardContent></Card>
        <Card className="card-hover border-r-4 border-r-amber-500"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">باقی‌مانده</p>
          <p className="text-lg font-extrabold mt-1 text-amber-700">{t ? tomanSummary(t.remaining) : '—'}</p>
          <p className="text-[11px] text-muted-foreground">{t ? `${formatNumberFa(t.remaining)} ریال` : ''}</p>
        </CardContent></Card>
        <Card className="card-hover border-r-4 border-r-stone-400"><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">حق‌نظارت</p>
          <p className="text-lg font-extrabold mt-1">{t ? tomanSummary(t.supervisionFee) : '—'}</p>
          <p className="text-[11px] text-muted-foreground">{t ? `${formatNumberFa(t.count)} پروژه` : ''}</p>
        </CardContent></Card>
      </div>

      {/* فیلترها */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو کد / عنوان / شماره قرارداد..." className="pr-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
            {PROJECT_STATUS.map((s) => <SelectItem key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={group} onValueChange={setGroup}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه گروه‌ها</SelectItem>
            {GROUP_NAMES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* جدول */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : !data || data.items.length === 0 ? (
            <EmptyState title="رکوردی یافت نشد" />
          ) : (
            <div className="overflow-x-auto">
              <div className="max-h-[60vh] overflow-y-auto">
                <Table className="rd-table min-w-[820px]">
                  <TableHeader className="sticky top-0 bg-muted/95 backdrop-blur z-10">
                    <TableRow>
                      <TableHead>کد</TableHead>
                      <TableHead>عنوان</TableHead>
                      <TableHead>مبلغ قرارداد</TableHead>
                      <TableHead>پرداخت‌شده</TableHead>
                      <TableHead>باقی‌مانده</TableHead>
                      <TableHead>نرخ پرداخت</TableHead>
                      <TableHead>وضعیت</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((p) => {
                      const amt = BigInt(p.amount)
                      const paid = BigInt(p.totalPaid)
                      const pctv = amt > 0n ? Number((paid * 100n) / amt) : 0
                      return (
                        <TableRow key={p.id} className="hover:bg-muted/40">
                          <TableCell className="font-mono text-xs ltr-input">{p.code}</TableCell>
                          <TableCell className="max-w-52"><p className="text-xs font-medium truncate" title={p.title}>{p.title || '—'}</p></TableCell>
                          <TableCell><Amount value={p.amount} compact /></TableCell>
                          <TableCell className="text-teal-700"><Amount value={p.totalPaid} compact /></TableCell>
                          <TableCell className={pctv >= 100 ? 'text-emerald-700' : 'text-amber-700'}>
                            <Amount value={(amt - paid).toString()} compact />
                          </TableCell>
                          <TableCell>
                            <div className="min-w-24">
                              <PercentBar actual={Math.min(100, pctv)} />
                              <p className="text-[10px] text-muted-foreground mt-0.5">پیشرفت: {formatNumberFa((p.actualProgress ?? 0).toFixed(0))}٪</p>
                            </div>
                          </TableCell>
                          <TableCell><StatusBadge status={p.status} /></TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          {data && data.total > data.pageSize && (
            <div className="flex items-center justify-between border-t px-4 py-2.5">
              <p className="text-xs text-muted-foreground">صفحه {formatNumberFa(data.page)} از {formatNumberFa(pages)} — کل: {formatNumberFa(data.total)}</p>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>قبلی</Button>
                <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>بعدی</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        <Loader2 className="h-3 w-3" /> برای ثبت پرداخت، پروژه را از بخش «مدیریت پروژه‌ها» باز کنید و در تب مالی، «ثبت پرداخت جدید» را بزنید.
      </p>
    </div>
  )
}
