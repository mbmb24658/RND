'use client'
// ===== پوسته برنامه: سایدبار + هدر + فوتر چسبان =====
import { useRouter } from 'next/navigation'
import { useAppStore, type ViewKey } from '@/lib/store'
import { ROLE_LABELS, canManageProjects, isAdmin } from '@/lib/constants'
import { apiPost } from '@/lib/client'
import { formatJalaliFull, todayJalali } from '@/lib/jalali'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  LayoutDashboard, FolderKanban, ClipboardCheck, Wallet, UsersRound,
  UserCog, FileText, History, FlaskConical, LogOut, Menu, ChevronDown,
} from 'lucide-react'
import type { ReactNode } from 'react'

const NAV: Array<{ key: ViewKey; label: string; icon: typeof LayoutDashboard; roles?: string[] }> = [
  { key: 'dashboard', label: 'داشبورد وضعیت', icon: LayoutDashboard },
  { key: 'projects', label: 'مدیریت پروژه‌ها و پروپوزال‌ها', icon: FolderKanban },
  { key: 'evaluations', label: 'داشبورد ارزیابی و امتیازدهی', icon: ClipboardCheck, roles: ['ADMIN', 'SUPERVISOR', 'PROJECT_CONTROL'] },
  { key: 'finance', label: 'مدیریت مالی', icon: Wallet },
  { key: 'supervisors', label: 'مدیریت ناظران', icon: UsersRound },
  { key: 'documents', label: 'مستندات و بارگذاری', icon: FileText },
  { key: 'users', label: 'مدیریت کاربران و نقش‌ها', icon: UserCog, roles: ['ADMIN'] },
  { key: 'activity', label: 'گزارش تغییرات', icon: History, roles: ['ADMIN'] },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { user, view, setView, sidebarOpen, setSidebarOpen } = useAppStore()
  const router = useRouter()

  if (!user) return null

  async function logout() {
    await apiPost('/api/auth/logout').catch(() => null)
    useAppStore.getState().setUser(null)
    router.refresh()
  }

  const nav = NAV.filter((n) => !n.roles || n.roles.includes(user.role))

  const sidebar = (
    <aside className="flex flex-col h-full w-64 bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="h-10 w-10 rounded-xl bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center shrink-0">
          <FlaskConical className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm leading-tight">سامانه R&D</p>
          <p className="text-[11px] text-sidebar-foreground/70">مدیریت پروژه و پروپوزال</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {nav.map((item) => {
          const Icon = item.icon
          const active = view === item.key
          return (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={cn(
                'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors text-right',
                active
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" />
              <span className="leading-snug">{item.label}</span>
            </button>
          )
        })}
      </nav>
      <div className="px-5 py-4 border-t border-sidebar-border text-[11px] text-sidebar-foreground/60 space-y-1">
        <p>{todayJalali()}</p>
        <p>نسخه ۱٫۰ — واحد تحقیق و توسعه</p>
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1">
        {/* سایدبار دسکتاپ */}
        <div className="hidden lg:block sticky top-0 h-screen shrink-0">{sidebar}</div>

        {/* سایدبار موبایل */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
            <div className="absolute inset-y-0 right-0 shadow-2xl">{sidebar}</div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          {/* هدر */}
          <header className="sticky top-0 z-40 bg-background/90 backdrop-blur border-b">
            <div className="flex items-center gap-3 px-4 lg:px-6 h-14">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <h2 className="font-bold text-sm lg:text-base truncate">
                {NAV.find((n) => n.key === view)?.label || 'سامانه R&D'}
              </h2>
              <div className="ms-auto flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                        {user.fullName.trim().charAt(0)}
                      </div>
                      <span className="hidden sm:inline text-xs font-medium">{user.fullName}</span>
                      <Badge variant="secondary" className="hidden md:inline text-[10px]">{ROLE_LABELS[user.role]}</Badge>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <p className="font-bold">{user.fullName}</p>
                      <p className="text-xs text-muted-foreground font-normal">{user.username}</p>
                      <p className="text-xs text-muted-foreground font-normal mt-1">نقش: {ROLE_LABELS[user.role]}</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
                      <LogOut className="h-4 w-4" /> خروج از حساب
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </header>

          {/* محتوا */}
          <main className="flex-1 px-4 lg:px-6 py-6">{children}</main>

          {/* فوتر چسبان */}
          <footer className="mt-auto border-t bg-card">
            <div className="px-4 lg:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-1 text-xs text-muted-foreground">
              <p>سامانه مدیریت پروژه‌ها و پروپوزال‌های تحقیق و توسعه — نسخه ۱٫۰</p>
              <p>امروز: {formatJalaliFull(new Date())}</p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
