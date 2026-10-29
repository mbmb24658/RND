'use client'
// ===== صفحه ورود =====
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { api, ApiError } from '@/lib/client'
import { useAppStore, type AuthUser } from '@/lib/store'
import { formatJalaliFull } from '@/lib/jalali'
import { FlaskConical, Lock, User, LogIn, Loader2 } from 'lucide-react'

export function LoginView() {
  const setUser = useAppStore((s) => s.setUser)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await api<{ user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      setUser(res.user)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در برقراری ارتباط با سرور')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-emerald-50 via-background to-teal-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary text-primary-foreground shadow-lg mb-4">
            <FlaskConical className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">سامانه مدیریت پروژه‌های تحقیق و توسعه</h1>
          <p className="text-sm text-muted-foreground mt-2">ثبت، پایش و ارزیابی پروژه‌ها و پروپوزال‌های R&D</p>
        </div>

        <Card className="card-hover shadow-xl border-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <LogIn className="h-5 w-5 text-primary" /> ورود به سامانه
            </CardTitle>
            <CardDescription>{formatJalaliFull(new Date())}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">نام کاربری</Label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    dir="ltr"
                    className="ltr-input pr-9"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">رمز عبور</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    dir="ltr"
                    type="password"
                    className="ltr-input pr-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                ورود
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-4 text-center text-xs text-muted-foreground space-y-1">
          <p>کاربران نمونه (اولین راه‌اندازی):</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant="outline">admin / admin123 — مدیریت</Badge>
            <Badge variant="outline">control / control123 — کنترل پروژه</Badge>
            <Badge variant="outline">nazer / nazer123 — ناظر</Badge>
          </div>
        </div>
      </div>
    </div>
  )
}
