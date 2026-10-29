'use client'
// ===== مدیریت ناظران =====
import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { api, apiPost, ApiError } from '@/lib/client'
import { useAppStore } from '@/lib/store'
import { isAdmin } from '@/lib/constants'
import { formatNumberFa } from '@/lib/format'
import { JDate, EmptyState } from './shared'
import { UsersRound, Plus, Loader2, ClipboardCheck, FolderKanban } from 'lucide-react'

interface SupervisorRow {
  id: string; username: string; fullName: string; email: string | null; phone: string | null; createdAt: string
  _count?: { evaluations: number; supervisedProjects: number }
}

export function SupervisorsView() {
  const user = useAppStore((s) => s.user)
  const bump = useAppStore((s) => s.bumpDataVersion)
  const { toast } = useToast()
  const [rows, setRows] = useState<SupervisorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ fullName: '', username: '', password: '', email: '', phone: '' })

  const admin = user && isAdmin(user.role)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api<{ items: SupervisorRow[] }>('/api/supervisors?stats=1')
      setRows(r.items)
    } catch { setRows([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function create() {
    setSaving(true)
    setError(null)
    try {
      await apiPost('/api/users', { ...form, role: 'SUPERVISOR' })
      toast({ title: 'ناظر جدید ساخته شد', description: `${form.fullName} — نام کاربری: ${form.username}` })
      setForm({ fullName: '', username: '', password: '', email: '', phone: '' })
      setOpen(false)
      load()
      bump()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در ایجاد کاربر')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          ناظران کاربرانی هستند که می‌توانند روی پروژه‌ها و پروپوزال‌ها ارزیابی و امتیاز ثبت کنند.
        </p>
        {admin && (
          <Button onClick={() => { setError(null); setOpen(true) }} className="gap-1.5">
            <Plus className="h-4 w-4" /> ساخت کاربر ناظر
          </Button>
        )}
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <Card className="card-hover"><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center"><UsersRound className="h-5 w-5" /></div>
          <div><p className="text-xs text-muted-foreground">ناظران فعال</p><p className="text-xl font-extrabold">{formatNumberFa(rows.length)}</p></div>
        </CardContent></Card>
        <Card className="card-hover"><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center"><ClipboardCheck className="h-5 w-5" /></div>
          <div><p className="text-xs text-muted-foreground">کل ارزیابی‌ها</p><p className="text-xl font-extrabold">{formatNumberFa(rows.reduce((s, r) => s + (r._count?.evaluations || 0), 0))}</p></div>
        </CardContent></Card>
        <Card className="card-hover"><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center"><FolderKanban className="h-5 w-5" /></div>
          <div><p className="text-xs text-muted-foreground">پروژه‌های تحت نظارت فعال</p><p className="text-xl font-extrabold">{formatNumberFa(rows.reduce((s, r) => s + (r._count?.supervisedProjects || 0), 0))}</p></div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">فهرست ناظران</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : rows.length === 0 ? (
            <EmptyState title="ناظری ثبت نشده است" hint={admin ? 'با دکمه «ساخت کاربر ناظر» اولین ناظر را اضافه کنید' : 'با مدیریت تماس بگیرید'} />
          ) : (
            <div className="overflow-x-auto">
              <div className="max-h-96 overflow-y-auto">
                <Table className="rd-table min-w-[640px]">
                  <TableHeader className="sticky top-0 bg-muted/95">
                    <TableRow>
                      <TableHead>نام و نام‌خانوادگی</TableHead>
                      <TableHead>نام کاربری</TableHead>
                      <TableHead className="hidden md:table-cell">ایمیل / تلفن</TableHead>
                      <TableHead>ارزیابی‌ها</TableHead>
                      <TableHead className="hidden lg:table-cell">پروژه فعال</TableHead>
                      <TableHead className="hidden lg:table-cell">تاریخ عضویت</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium text-sm">{s.fullName}</TableCell>
                        <TableCell><Badge variant="secondary" className="font-mono" dir="ltr">{s.username}</Badge></TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{s.email || s.phone || '—'}</TableCell>
                        <TableCell><Badge variant="outline" className="bg-emerald-50">{formatNumberFa(s._count?.evaluations || 0)}</Badge></TableCell>
                        <TableCell className="hidden lg:table-cell text-xs">{formatNumberFa(s._count?.supervisedProjects || 0)}</TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground"><JDate value={s.createdAt} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* دیالوگ ساخت ناظر */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ساخت کاربر ناظر</DialogTitle>
            <DialogDescription>ناظر پس از ساخت می‌تواند وارد سامانه شود و ارزیابی ثبت کند.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">نام و نام‌خانوادگی *</Label>
              <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="مثلاً: علی گشاس" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">نام کاربری *</Label>
                <Input dir="ltr" className="ltr-input" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} placeholder="nazer2" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">رمز عبور *</Label>
                <Input dir="ltr" type="password" className="ltr-input" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="حداقل ۵ کاراکتر" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">ایمیل</Label>
                <Input dir="ltr" className="ltr-input" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">تلفن</Label>
                <Input dir="ltr" className="ltr-input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            {error && <p className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>}
            <Button className="w-full" onClick={create} disabled={saving || !form.fullName || !form.username || form.password.length < 5}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} ایجاد ناظر
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
