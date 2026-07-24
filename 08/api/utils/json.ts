export function json(value: unknown) {
  return JSON.stringify(value ?? null)
}

export function parseJson<T>(value: unknown): T | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') return value as T
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export function toIso(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return value.toISOString()
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString()
}

