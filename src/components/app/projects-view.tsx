'use client'
// ===== مدیریت پروژه‌ها و پروپوزال‌ها (لیست + فیلتر + ویزارد) =====
import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { api, apiDelete, ApiError } from '@/lib/client'
import { useAppStore } from '@/lib/store'
import { GROUP_NAMES, PROJECT_STATUS, PROJECT_STATUS_LABELS, canManageProjects, isAdmin } from '@/lib/constants'
import { formatNumberFa } from '@/lib/format'
import { ProjectWizard, type WizardInitial } from './project-wizard'
import { ProjectDetailDialog, type ProjectDetail } from './project-detail'
import { Amount, JDate, KindBadge, PercentBar, StatusBadge, EmptyState } from './shared'
import { Plus, Search, Loader2, Pencil, Trash2, Eye } from 'lucide-react'

interface ListRow {
  id: string; kind: string; code: string; title: string; contractNumber: string | null
  status: string; groupName: string | null; amount: string; plannedProgress: number | null
  actualProgress: number | null; registrationDate: string | null; updatedAt: string
  institute?: { name: string } | null
  _count?: { evaluations: number; payments: number; extensions: number; items: number }
}

export function ProjectsView() {
  const user = useAppStore((s) => s.user)
  const bump = useAppStore((s) => s.bumpDataVersion)
  const { toast } = useToast()
  const [rows, setRows] = useState<ListRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('ALL')
  const [group, setGroup] = useState('ALL')
  const [kind, setKind] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardInitial, setWizardInitial] = useState<WizardInitial | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const pageSize = 25

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), status, group, kind })
      if (q.trim()) params.set('q', q.trim())
      const r = await api<{ items: ListRow[]; total: number }>(`/api/projects?${params}`)
      setRows(r.items)
      setTotal(r.total)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [page, q, status, group, kind])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [q, status, group, kind])

  const canManage = user && canManageProjects(user.role)
  const admin = user && isAdmin(user.role)
  const pages = Math.max(1, Math.ceil(total / pageSize))

  async function openEdit(id: string) {
    try {
      const d = await api<ProjectDetail>(`/api/projects/${id}`)
      setWizardInitial({ ...d, instituteName: d.institute?.name || '' })
      setWizardOpen(true)
    } catch (err) {
      toast({ title: 'خطا', description: err instanceof ApiError ? err.message : 'خطا', variant: 'destructive' })
    }
  }

  async function remove(id: string, code: string) {
    if (!confirm(`حذف پروژه «${code}» و تمام پرداخت‌ها/تمدیدها/ارزیابی‌های آن؟ این عمل بازگشت‌پذیر نیست.`)) return
    try {
      await apiDelete(`/api/projects/${id}`)
      toast({ title: 'پروژه حذف شد' })
      load()
      bump()
    } catch (err) {
      toast({ title: 'خطا', description: err instanceof ApiError ? err.message : 'خطا در حذف', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      {/* نوار ابزار */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو در عنوان، کد، شماره قرارداد، مجری..." className="pr-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="وضعیت" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه وضعیت‌ها</SelectItem>
            {PROJECT_STATUS.map((s) => <SelectItem key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={group} onValueChange={setGroup}>
          <SelectTrigger className="w-44"><SelectValue placeholder="گروه" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">همه گروه‌ها</SelectItem>
            {GROUP_NAMES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-32"><SelectValue placeholder="نوع" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">پروژه + پروپوزال</SelectItem>
            <SelectItem value="PROJECT">فقط پروژه</SelectItem>
            <SelectItem value="PROPOSAL">فقط پروپوزال</SelectItem>
          </SelectContent>
        </Select>
        {canManage && (
          <Button onClick={() => { setWizardInitial(null); setWizardOpen(true) }} className="gap-1.5">
            <Plus className="h-4 w-4" /> ثبت جدید
          </Button>
        )}
      </div>

      {/* جدول */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : rows.length === 0 ? (
            <EmptyState title="رکوردی یافت نشد" hint="فیلترها را تغییر دهید یا پروژه جدید ثبت کنید" />
          ) : (
            <div className="overflow-x-auto">
              <div className="max-h-[65vh] overflow-y-auto">
                <Table className="rd-table min-w-[860px]">
                  <TableHeader className="sticky top-0 bg-muted/95 backdrop-blur z-10">
                    <TableRow>
                      <TableHead>کد / قرارداد</TableHead>
                      <TableHead>عنوان</TableHead>
                      <TableHead className="hidden xl:table-cell">گروه / مؤسسه</TableHead>
                      <TableHead>نوع</TableHead>
                      <TableHead>وضعیت</TableHead>
                      <TableHead className="hidden md:table-cell">مبلغ</TableHead>
                      <TableHead>پیشرفت</TableHead>
                      <TableHead className="hidden lg:table-cell">ثبت</TableHead>
                      <TableHead className="text-left">عملیات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((p) => (
                      <TableRow key={p.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setDetailId(p.id)}>
                        <TableCell>
                          <div className="font-mono text-xs ltr-input font-semibold">{p.code}</div>
                          {p.contractNumber && <div className="font-mono text-[10px] text-muted-foreground ltr-input">{p.contractNumber}</div>}
                        </TableCell>
                        <TableCell className="max-w-56">
                          <p className="text-xs font-medium truncate" title={p.title}>{p.title || '—'}</p>
                          {p.institute?.name && <p className="text-[10px] text-muted-foreground truncate">{p.institute.name}</p>}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-xs">{p.groupName || '—'}</TableCell>
                        <TableCell><KindBadge kind={p.kind} /></TableCell>
                        <TableCell><StatusBadge status={p.status} /></TableCell>
                        <TableCell className="hidden md:table-cell"><Amount value={p.amount} compact /></TableCell>
                        <TableCell><PercentBar actual={p.actualProgress} planned={p.plannedProgress} /></TableCell>
                        <TableCell className="hidden lg:table-cell text-[11px] text-muted-foreground"><JDate value={p.registrationDate} /></TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-0.5">
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="جزئیات" onClick={() => setDetailId(p.id)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {canManage && (
                              <Button size="icon" variant="ghost" className="h-7 w-7" title="ویرایش" onClick={() => openEdit(p.id)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {admin && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="حذف" onClick={() => remove(p.id, p.code)}>
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
          {/* صفحه‌بندی */}
          {total > pageSize && (
            <div className="flex items-center justify-between border-t px-4 py-2.5">
              <p className="text-xs text-muted-foreground">
                نمایش {formatNumberFa((page - 1) * pageSize + 1)} تا {formatNumberFa(Math.min(page * pageSize, total))} از {formatNumberFa(total)} رکورد
              </p>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>قبلی</Button>
                <Badge variant="secondary">{formatNumberFa(page)} / {formatNumberFa(pages)}</Badge>
                <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>بعدی</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ProjectWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        initial={wizardInitial}
        onSaved={() => { load(); bump(); toast({ title: wizardInitial?.id ? 'تغییرات ذخیره شد' : 'رکورد جدید با موفقیت ثبت شد' }) }}
      />
      <ProjectDetailDialog
        projectId={detailId}
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        onChanged={load}
      />
      {loading && <Loader2 className="hidden" />}
    </div>
  )
}
