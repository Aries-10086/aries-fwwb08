export function isFkViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('code' in err)) return false
  return String((err as { code: unknown }).code) === '23503'
}

export function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('code' in err)) return false
  return String((err as { code: unknown }).code) === '23505'
}
