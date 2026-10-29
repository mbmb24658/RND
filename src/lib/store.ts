'use client'
// ===== استور وضعیت برنامه (Zustand) =====
import { create } from 'zustand'
import type { Role } from '@/lib/constants'

export interface AuthUser {
  id: string
  username: string
  fullName: string
  role: Role
}

export type ViewKey =
  | 'dashboard'
  | 'projects'
  | 'evaluations'
  | 'finance'
  | 'supervisors'
  | 'users'
  | 'documents'
  | 'activity'

interface AppState {
  user: AuthUser | null
  setUser: (u: AuthUser | null) => void
  view: ViewKey
  setView: (v: ViewKey) => void
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
  /** شمارنده برای رفرش سراسری داده‌ها پس از تغییر */
  dataVersion: number
  bumpDataVersion: () => void
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (u) => set({ user: u }),
  view: 'dashboard',
  setView: (v) => set({ view: v, sidebarOpen: false }),
  sidebarOpen: false,
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
  dataVersion: 0,
  bumpDataVersion: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
}))
