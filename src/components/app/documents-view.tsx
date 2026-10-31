'use client'
// ===== مستندات (بارگذاری و دانلود اسناد اسکن‌شده) =====
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { api, apiUpload, apiDelete, ApiError } from '@/lib/client'
import { useAppStore } from '@/lib/store'
import { canManageProjects } from '@/lib/constants'
import { formatFileSize } from '@/lib/format'
import { JDate, EmptyState } from './shared'
import { Upload, Download, Trash2, Loader2, FileText } from 'lucide-react'

interface DocRow {
  id: string; title: string; entityType: string; entityId: string; fileName: string
  mimeType: string | null; size: number; createdAt: string
  uploadedBy?: { fullName: string } | null
  entityTitle?: string | null
}
interface ProjectOption { id: string; code: string; title: string }

export function DocumentsView() {
  const user = useAppStore((s) => s.user)
  const bump = useAppStore((s) => s.bumpDataVersion)
  const { toast } = useToast()
  const [docs, setDocs] = useState<DocRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [projectQuery, setProjectQuery] = useState('')
  const [form, setForm] = useState({ title: '', entityId: '', file: null as File | null })
  const [uploading, setUploading] = useState(false)

  const manage = user && canManageProjects(user.role)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api<{ items: DocRow[] }>(`/api/documents${filter !== 'ALL' ? `?entityType=${filter}` : ''}`)
      setDocs(r.items)
    } catch { setDocs([]) }
    finally { setLoading(false) }
  }, [filter])

  useEffect(() => { load() }, [load])

  // جستجوی پروژه برای بارگذاری
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams({ pageSize: '20' })
      if (projectQuery.trim()) params.set('q', projectQuery.trim())
      api<{ items: ProjectOption[] }>(`/api/projects?${params}`).then((r) => setProjects(r.items)).catch(() => null)
    }, 300)
    return () => clearTimeout(t)
  }, [projectQuery])

  const filtered = useMemo(() => docs, [docs])

  async function upload() {
    if (!form.file || !form.title || !form.entityId) {
      toast({ title: 'عنوان، پروژه و فایل الزامی است', variant: 'destructive' })
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', form.file)
      fd.append('title', form.title)
      fd.append('entityType', 'PROJECT')
      fd.append('entityId', form.entityId)
      await apiUpload('/api/documents', fd)
      toast({ title: 'سند بارگذاری شد' })
      setForm({ title: '', entityId: '', file: null })
      load()
      bump()
    } catch (err) {
      toast({ title: 'خطا', description: err instanceof ApiError ? err.message : 'خطا', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  async function removeDoc(id: string) {
    if (!confirm('این سند حذف شود؟')) return
    try {
      await apiDelete(`/api/documents/${id}`)
      toast({ title: 'سند حذف شد' })
      load()
      bump()
    } catch (err) {
      toast({ title: 'خطا', description: err instanceof ApiError ? err.message : 'خطا', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      {manage && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><Upload className="h-4 w-4 text-primary" /> بارگذاری سند جدید</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">عنوان سند *</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="مثلاً: قرارداد اسکن‌شده پروژه" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">پروژه مرتبط *</Label>
                <Select value={form.entityId || undefined} onValueChange={(v) => setForm((f) => ({ ...f, entityId: v }))}>
                  <SelectTrigger><SelectValue placeholder="انتخاب پروژه" /></SelectTrigger>
                  <SelectContent>
                    <div className="p-2">
                      <Input value={projectQuery} onChange={(e) => setProjectQuery(e.target.value)} placeholder="جستجو..." className="h-8" />
                    </div>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="text-xs">{p.title.slice(0, 40)} — {p.code}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">فایل (PDF / تصویر / آفیس / ZIP — حداکثر ۱۰ مگابایت) *</Label>
                <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.zip" onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))} />
              </div>
            </div>
            <Button className="mt-3 gap-1.5" onClick={upload} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} بارگذاری سند
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm flex items-center gap-1.5"><FileText className="h-4 w-4" /> اسناد بارگذاری‌شده</CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">همه</SelectItem>
              <SelectItem value="PROJECT">پروژه‌ها</SelectItem>
              <SelectItem value="PROPOSAL">پروپوزال‌ها</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : filtered.length === 0 ? (
            <EmptyState title="سندی یافت نشد" hint="اسناد اسکن‌شده قراردادها را از فرم بالا بارگذاری کنید" />
          ) : (
            <div className="overflow-x-auto">
              <div className="max-h-96 overflow-y-auto">
                <Table className="rd-table min-w-[680px]">
                  <TableHeader className="sticky top-0 bg-muted/95">
                    <TableRow>
                      <TableHead>عنوان</TableHead>
                      <TableHead>پروژه</TableHead>
                      <TableHead className="hidden md:table-cell">فایل</TableHead>
                      <TableHead>حجم</TableHead>
                      <TableHead className="hidden lg:table-cell">بارگذار</TableHead>
                      <TableHead className="hidden lg:table-cell">تاریخ</TableHead>
                      <TableHead className="text-left"> </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="text-xs font-medium max-w-40 truncate" title={d.title}>{d.title}</TableCell>
                        <TableCell className="text-[11px] text-muted-foreground max-w-36 truncate">{d.entityTitle || '—'}</TableCell>
                        <TableCell className="hidden md:table-cell text-[11px] text-muted-foreground max-w-36 truncate" dir="ltr">{d.fileName}</TableCell>
                        <TableCell className="text-xs">{formatFileSize(d.size)}</TableCell>
                        <TableCell className="hidden lg:table-cell text-xs">{d.uploadedBy?.fullName || '—'}</TableCell>
                        <TableCell className="hidden lg:table-cell text-xs"><JDate value={d.createdAt} /></TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-0.5">
                            <a href={`/api/documents/${d.id}`}>
                              <Button size="icon" variant="ghost" className="h-7 w-7" title="دانلود"><Download className="h-3.5 w-3.5" /></Button>
                            </a>
                            {manage && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="حذف" onClick={() => removeDoc(d.id)}>
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
      <Badge variant="outline" className="text-[10px]">ساختار ذخیره‌سازی: فایل روی دیسک + متادیتا در دیتابیس — آماده اتصال به Vercel Blob در استقرار ابری</Badge>
    </div>
  )
}
