import type { Request, Response, NextFunction } from 'express'
import type { UserRole } from '../../shared/types.js'
import { query } from '../db.js'
import { extractBearerToken, verifyAccessToken } from './token.js'

export type AuthContext = {
  userId: string
  role: UserRole
  orgUnitId: string
  username: string
  name: string
}

declare global {
  // Express 4 的 Request 类型只能通过声明合并扩展。
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext | null
    }
  }
}

const VALID_ROLES: UserRole[] = ['member', 'secretary', 'admin']

async function loadUser(userId: string): Promise<AuthContext | null> {
  const { rows } = await query(
    'SELECT id, name, username, role, org_unit_id FROM users WHERE id = $1',
    [userId],
  )
  const row = rows[0]
  if (!row?.id) return null
  const role = String(row.role) as UserRole
  if (!VALID_ROLES.includes(role)) return null
  return {
    userId: String(row.id),
    name: String(row.name ?? ''),
    username: String(row.username ?? ''),
    role,
    orgUnitId: String(row.org_unit_id ?? ''),
  }
}

/** 从 Authorization Bearer 解析用户；角色一律以数据库为准，忽略客户端 x-role */
export async function attachAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    req.auth = null
    const token = extractBearerToken(req)
    if (!token) {
      next()
      return
    }
    const payload = verifyAccessToken(token)
    if (!payload?.sub) {
      next()
      return
    }
    req.auth = await loadUser(payload.sub)
    next()
  } catch (error) {
    next(error)
  }
}

export function getUserContext(req: Request) {
  return {
    userId: req.auth?.userId ?? '',
    role: (req.auth?.role ?? '') as UserRole,
    orgUnitId: req.auth?.orgUnitId ?? '',
  }
}

export function isAuthenticated(req: Request) {
  return Boolean(req.auth?.userId)
}

export function requireAuth(req: Request) {
  return isAuthenticated(req)
}

export function requireRole(req: Request, roles: UserRole[]) {
  if (!req.auth?.userId) return false
  return roles.includes(req.auth.role)
}

export function rejectUnauthorized(res: Response, message = '请先登录') {
  res.status(401).json({ success: false, error: message })
}

export function rejectForbidden(res: Response, message = '无权限访问') {
  res.status(403).json({ success: false, error: message })
}

/** 路由级：必须登录 */
export function ensureAuth(req: Request, res: Response, next: NextFunction) {
  if (!requireAuth(req)) {
    rejectUnauthorized(res)
    return
  }
  next()
}

/** 路由级：必须具备角色之一 */
export function ensureRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!requireAuth(req)) {
      rejectUnauthorized(res)
      return
    }
    if (!requireRole(req, roles)) {
      rejectForbidden(res)
      return
    }
    next()
  }
}
