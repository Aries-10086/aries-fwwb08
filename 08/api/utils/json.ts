export function json(value: unknown) {
  return JSON.stringify(value ?? null)
}

export function parseJson<T>(text: string | null): T | null {
  if (!text) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

