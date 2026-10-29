// ===== کلاینت API سمت مرورگر =====
export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options?.headers,
    },
  })
  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    const msg = (data as { error?: string })?.error || `خطای سرور (${res.status})`
    throw new ApiError(res.status, msg)
  }
  return data as T
}

export const apiGet = <T = unknown>(p: string) => api<T>(p)
export const apiPost = <T = unknown>(p: string, body: unknown) =>
  api<T>(p, { method: 'POST', body: JSON.stringify(body) })
export const apiPatch = <T = unknown>(p: string, body: unknown) =>
  api<T>(p, { method: 'PATCH', body: JSON.stringify(body) })
export const apiDelete = <T = unknown>(p: string) => api<T>(p, { method: 'DELETE' })
export const apiUpload = <T = unknown>(p: string, form: FormData) =>
  api<T>(p, { method: 'POST', body: form })
