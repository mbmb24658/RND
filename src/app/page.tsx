'use client'
// ===== صفحه اصلی سامانه مدیریت پروژه‌ها و پروپوزال‌های R&D =====
import { useEffect, useState } from 'react'
import { useAppStore, type AuthUser, type ViewKey } from '@/lib/store'
import { api } from '@/lib/client'
import { LoginView } from '@/components/app/login-view'
import { AppShell } from '@/components/app/app-shell'
import { DashboardView } from '@/components/app/dashboard-view'
import { ProjectsView } from '@/components/app/projects-view'
import { EvaluationsView } from '@/components/app/evaluations-view'
import { FinanceView } from '@/components/app/finance-view'
import { SupervisorsView } from '@/components/app/supervisors-view'
import { UsersView } from '@/components/app/users-view'
import { DocumentsView } from '@/components/app/documents-view'
import { ActivityView } from '@/components/app/activity-view'
import { FlaskConical } from 'lucide-react'

export default function Page() {
  const { user, setUser, view, setView } = useAppStore()
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    api<{ user: AuthUser | null }>('/api/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setBooting(false))
  }, [setUser])

  if (booting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-emerald-50 to-teal-50">
        <div className="h-16 w-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg animate-pulse">
          <FlaskConical className="h-8 w-8" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">در حال بارگذاری سامانه R&D...</p>
      </div>
    )
  }

  if (!user) return <LoginView />

  const goProjects = () => setView('projects' as ViewKey)

  return (
    <AppShell>
      {view === 'dashboard' && <DashboardView onOpenProjects={goProjects} />}
      {view === 'projects' && <ProjectsView />}
      {view === 'evaluations' && <EvaluationsView />}
      {view === 'finance' && <FinanceView onOpenProjects={goProjects} />}
      {view === 'supervisors' && <SupervisorsView />}
      {view === 'users' && <UsersView />}
      {view === 'documents' && <DocumentsView />}
      {view === 'activity' && <ActivityView />}
    </AppShell>
  )
}
