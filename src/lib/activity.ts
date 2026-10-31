// ===== گزارش تغییرات (Activity Log) =====
import { db } from '@/lib/db'

export async function logActivity(params: {
  userId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  entityTitle?: string | null
  details?: string | null
}) {
  try {
    await db.activityLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId ?? null,
        entityTitle: params.entityTitle ?? null,
        details: params.details ?? null,
      },
    })
  } catch (e) {
    console.error('[ActivityLog] failed:', e)
  }
}

/** JSON امن برای BigInt */
export function safeJson(data: unknown): unknown {
  return JSON.parse(
    JSON.stringify(data, (_k, v) => {
      if (typeof v === 'bigint') return v.toString()
      if (v instanceof Date) return v.toISOString()
      return v
    })
  )
}
