'use client'
// ===== مدیریت کاربران و نقش‌ها (فقط مدیریت) =====
import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { api, apiPatch, apiDelete, ApiError } from '@/lib/client'
import { useAppStore } from '@/lib/store'
import { ROLE_LABELS, type Role } from '@/lib/constants'
import { JDate, EmptyState } from './shared'
import { KeyRound, Trash2, Loader2 } from 'lucide-react'

interface UserRow {
  id: string; username: string; fullName: string; role: Role; email: string | null; phone: string | null
  active: boolean; createdAt: string
  _count?: { evaluations: number; supervisedProjects: number }
}

export function UsersView() {
  const me = useAppStore((s) => s.user)
  const bump = useAppStore((s) => s.bumpDataVersion)
  const { toast } = useToast()
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [resetUser, setResetUser] = useState<UserRow | null>(null)
  const [newPass, setNewPass] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api<{ items: UserRow[] }>('/api/users')
      setRows(r.items)
    } catch { setRows([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function changeRole(u: UserRow, role: Role) {
    try {
      await apiPatch(`/api/users/${u.id}`, { role })
      toast({ title: 'نقش تغییر کرد', description: `${u.fullName} → ${ROLE_LABELS[role]}` })
      load()
      bump()
    } catch (err) {
      toast({ title: 'خطا', description: err instanceof ApiError ? err.message : 'خطا', variant: 'destructive' })
    }
  }

  async function toggleActive(u: UserRow) {
    try {
      await apiPatch(`/api/users/${u.id}`, { active: !u.active })
      load()
      bump()
    } catch (err) {
      toast({ title: 'خطا', description: err instanceof ApiError ? err.message : 'خطا', variant: 'destructive' })
    }
  }

  async function resetPassword() {
    if (!resetUser) return
    setBusy(true)
    try {
      await apiPatch(`/api/users/${resetUser.id}`, { password: newPass })
      toast({ title: 'رمز عبور بازنشانی شد', description: resetUser.fullName })
      setResetUser(null)
      setNewPass('')
    } catch (err) {
      toast({ title: 'خطا', description: err instanceof ApiError ? err.message : 'خطا', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  async function remove(u: UserRow) {
    if (!confirm(`حذف کاربر «${u.fullName}»؟`)) return
    try {
      await apiDelete(`/api/users/${u.id}`)
      toast({ title: 'کاربر حذف شد' })
      load()
      bump()
    } catch (err) {
      toast({ title: 'خطا', description: err instanceof ApiError ? err.message : 'خطا', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        هر مدیر می‌تواند نقش هر کاربر را تغییر دهد و دسترسی‌های مجاز را تعیین کند. چند مدیر همزمان پشتیبانی می‌شود.
      </p>
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : rows.length === 0 ? (
            <EmptyState title="کاربری یافت نشد" />
          ) : (
            <div className="overflow-x-auto">
              <div className="max-h-[60vh] overflow-y-auto">
                <Table className="rd-table min-w-[720px]">
                  <TableHeader className="sticky top-0 bg-muted/95">
                    <TableRow>
                      <TableHead>کاربر</TableHead>
                      <TableHead>نقش</TableHead>
                      <TableHead className="hidden md:table-cell">فعالیت</TableHead>
                      <TableHead>وضعیت</TableHead>
                      <TableHead className="hidden lg:table-cell">عضویت</TableHead>
                      <TableHead className="text-left">عملیات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <p className="text-sm font-medium">{u.fullName}{u.id === me?.id && <span className="text-[10px] text-muted-foreground"> (شما)</span>}</p>
                          <p className="text-[11px] text-muted-foreground font-mono" dir="ltr">{u.username}</p>
                        </TableCell>
                        <TableCell>
                          {u.id === me?.id ? (
                            <Badge>{ROLE_LABELS[u.role]}</Badge>
                          ) : (
                            <Select value={u.role} onValueChange={(v) => changeRole(u, v as Role)}>
                              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                          {formatEvalCount(u)} ارزیابی {u.role !== 'ADMIN' && `• ${u._count?.supervisedProjects || 0} نظارت`}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Switch checked={u.active} onCheckedChange={() => toggleActive(u)} disabled={u.id === me?.id} />
                            <span className={`text-[11px] ${u.active ? 'text-emerald-700' : 'text-rose-600'}`}>{u.active ? 'فعال' : 'غیرفعال'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground"><JDate value={u.createdAt} /></TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-0.5">
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="بازنشانی رمز" onClick={() => { setResetUser(u); setNewPass('') }}>
                              <KeyRound className="h-3.5 w-3.5" />
                            </Button>
                            {u.id !== me?.id && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="حذف" onClick={() => remove(u)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={resetUser !== null} onOpenChange={(v) => !v && setResetUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>بازنشانی رمز عبور</DialogTitle>
            <DialogDescription>رمز جدید برای «{resetUser?.fullName}» تعیین کنید (حداقل ۵ کاراکتر).</DialogDescription>
          </DialogHeader>
          <Input dir="ltr" type="password" className="ltr-input" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="رمز جدید" />
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">نام کاربری: {resetUser?.username}</Label>
          </div>
          <Button className="w-full" onClick={resetPassword} disabled={busy || newPass.length < 5}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} ثبت رمز جدید
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function formatEvalCount(u: UserRow): string {
  const n = u._count?.evaluations || 0
  return new Intl.NumberFormat('fa-IR').format(n)
}
