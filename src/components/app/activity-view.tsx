'use client'
// ===== گزارش تغییرات (Activity Log) — فقط مدیریت =====
import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/client'
import { useAppStore } from '@/lib/store'
import { formatJalali } from '@/lib/jalali'
import { EmptyState } from './shared'
import { History } from 'lucide-react'

const ENTITY_LABELS: Record<string, string> = {
  PROJECT: 'پروژه', PAYMENT: 'پرداخت', EXTENSION: 'تمدید', EVALUATION: 'ارزیابی',
  DOCUMENT: 'سند', USER: 'کاربر',
}
const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  CREATE: { label: 'ایجاد', color: 'bg-emerald-100 text-emerald-800' },
  UPDATE: { label: 'ویرایش', color: 'bg-amber-100 text-amber-800' },
  DELETE: { label: 'حذف', color: 'bg-rose-100 text-rose-800' },
  LOGIN: { label: 'ورود', color: 'bg-stone-100 text-stone-700' },
  MIGRATE: { label: 'مهاجرت', color: 'bg-teal-100 text-teal-800' },
}

interface LogRow {
  id: string; action: string; entityType: string; entityId: string | null
  entityTitle: string | null; details: string | null; createdAt: string
  user?: { fullName: string; role: string } | null
}

export function ActivityView() {
  const [rows, setRows] = useState<LogRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [entityType, setEntityType] = useState('ALL')
  const [action, setAction] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const pageSize = 40

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), entityType, action })
      const r = await api<{ items: LogRow[]; total: number }>(`/api/activity?${params}`)
      setRows(r.items)
      setTotal(r.total)
    } catch { setRows([]) }
    finally { setLoading(false) }
  }, [page, entityType, action])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [entityType, action])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={entityType} onValueChange={setEntityType}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه موجودیت‌ها</SelectItem>
            {Object.entries(ENTITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه عملیات</SelectItem>
            {Object.entries(ACTION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground flex items-center gap-1"><History className="h-3.5 w-3.5" /> {new Intl.NumberFormat('fa-IR').format(total)} رخداد</span>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : rows.length === 0 ? (
            <EmptyState title="رخدادی ثبت نشده است" />
          ) : (
            <div className="overflow-x-auto">
              <div className="max-h-[65vh] overflow-y-auto">
                <Table className="rd-table min-w-[680px]">
                  <TableHeader className="sticky top-0 bg-muted/95">
                    <TableRow>
                      <TableHead>زمان</TableHead>
                      <TableHead>کاربر</TableHead>
                      <TableHead>عملیات</TableHead>
                      <TableHead>موجودیت</TableHead>
                      <TableHead>توضیح</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((l) => {
                      const a = ACTION_LABELS[l.action] || { label: l.action, color: 'bg-stone-100' }
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{formatJalali(l.createdAt)}</TableCell>
                          <TableCell className="text-xs">{l.user?.fullName || '—'}</TableCell>
                          <TableCell><Badge variant="outline" className={`text-[10px] ${a.color}`}>{a.label}</Badge></TableCell>
                          <TableCell className="text-xs">{ENTITY_LABELS[l.entityType] || l.entityType}{l.entityTitle ? <span className="text-muted-foreground"> — {l.entityTitle.slice(0, 30)}</span> : null}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-64 truncate" title={l.details || ''}>{l.details || '—'}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          {total > pageSize && (
            <div className="flex items-center justify-between border-t px-4 py-2.5">
              <span className="text-xs text-muted-foreground">صفحه {new Intl.NumberFormat('fa-IR').format(page)}</span>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>قبلی</Button>
                <Button size="sm" variant="outline" disabled={page >= Math.ceil(total / pageSize)} onClick={() => setPage((p) => p + 1)}>بعدی</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
