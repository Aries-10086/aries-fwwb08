import type { Request } from 'express'
import type { UserRole } from '../../shared/types.js'

export function getUserContext(req: Request) {
  const userId = String(req.headers['x-user-id'] ?? '')
  const role = String(req.headers['x-role'] ?? '') as UserRole
  const orgUnitId = String(req.headers['x-org-unit-id'] ?? '')
  return { userId, role, orgUnitId }
}

export function requireRole(req: Request, roles: UserRole[]) {
  const { role } = getUserContext(req)
  return roles.includes(role)
}

