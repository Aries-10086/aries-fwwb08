/**
 * User authentication: register + username/password login.
 * Accounts are stored in PostgreSQL `users` (username + password_hash).
 * Access tokens are HMAC-signed; roles are always loaded from DB.
 */
import { Router, type Request, type Response } from 'express'
import { nanoid } from 'nanoid'
import type { QueryResultRow } from 'pg'
import { query, nowIso, audit } from '../db.js'
import { hashPassword, normalizeUsername, verifyPassword } from '../utils/password.js'
import { signAccessToken } from '../utils/token.js'
import { clientKey, hitRateLimit } from '../utils/rateLimit.js'
import { getUserContext, requireAuth, rejectUnauthorized } from '../utils/http.js'
import { wrapAsyncRouter } from '../utils/async-router.js'

const router = Router()

type AuthUserRow = QueryResultRow & {
  id: string
  name: string
  username: string
  role: string
  org_unit_id: string
}

function toAuthUser(user: AuthUserRow) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    orgUnitId: user.org_unit_id,
  }
}

async function issueLogin(user: AuthUserRow, res: Response) {
  const token = signAccessToken(String(user.id))
  await audit(user.id, 'auth.login', { username: user.username })
  res.status(200).json({
    success: true,
    data: {
      token,
      user: toAuthUser(user),
    },
  })
}

/** Public: branches available for self-registration */
router.get('/org-options', async (_req: Request, res: Response) => {
  const { rows } = await query<{ id: string; name: string }>(
    `SELECT id, name FROM org_units
     WHERE parent_id IS NOT NULL
     ORDER BY created_at ASC`,
  )

  res.status(200).json({ success: true, data: rows })
})

router.get('/me', async (req: Request, res: Response) => {
  if (!requireAuth(req)) {
    rejectUnauthorized(res)
    return
  }
  const { userId } = getUserContext(req)
  const { rows } = await query<AuthUserRow>(
    'SELECT id, name, username, role, org_unit_id FROM users WHERE id = $1',
    [userId],
  )
  const user = rows[0]
  if (!user) {
    rejectUnauthorized(res, '登录已失效')
    return
  }
  res.status(200).json({ success: true, data: { user: toAuthUser(user) } })
})

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const rl = hitRateLimit(clientKey(req, 'register'), 8, 15 * 60 * 1000)
  if (!rl.ok) {
    res.status(429).json({ success: false, error: `注册过于频繁，请 ${rl.retryAfterSec} 秒后重试` })
    return
  }

  if (process.env.ALLOW_OPEN_REGISTER === '0') {
    res.status(403).json({ success: false, error: '当前已关闭开放注册，请联系管理员创建账号' })
    return
  }

  const name = String(req.body?.name ?? '').trim()
  const username = normalizeUsername(String(req.body?.username ?? ''))
  const password = String(req.body?.password ?? '')
  const confirmPassword = String(req.body?.confirmPassword ?? '')
  const orgUnitId = String(req.body?.orgUnitId ?? '').trim()

  if (!name) {
    res.status(400).json({ success: false, error: '请填写姓名' })
    return
  }
  if (!username) {
    res.status(400).json({ success: false, error: '请填写账号' })
    return
  }
  if (!/^[a-z0-9_]{3,32}$/.test(username)) {
    res.status(400).json({ success: false, error: '账号需为 3–32 位小写字母、数字或下划线' })
    return
  }
  if (password.length < 6) {
    res.status(400).json({ success: false, error: '密码至少 6 位' })
    return
  }
  if (confirmPassword && password !== confirmPassword) {
    res.status(400).json({ success: false, error: '两次输入的密码不一致' })
    return
  }
  if (!orgUnitId) {
    res.status(400).json({ success: false, error: '请选择所属支部' })
    return
  }

  const exists = (await query('SELECT id FROM users WHERE lower(username) = $1', [username])).rows[0]
  if (exists) {
    res.status(400).json({ success: false, error: '该账号已被注册' })
    return
  }

  const org = (
    await query('SELECT id FROM org_units WHERE id = $1 AND parent_id IS NOT NULL', [orgUnitId])
  ).rows[0]
  if (!org) {
    res.status(400).json({ success: false, error: '所属支部无效' })
    return
  }

  const id = `u_${nanoid(10)}`
  const ts = nowIso()

  await query(
    `INSERT INTO users (id, name, username, password_hash, role, org_unit_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, name, username, hashPassword(password), 'member', orgUnitId, ts],
  )

  await audit(id, 'auth.register', { username })

  const user = (
    await query<AuthUserRow>('SELECT id, name, username, role, org_unit_id FROM users WHERE id = $1', [id])
  ).rows[0]

  await issueLogin(user, res)
})

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const rl = hitRateLimit(clientKey(req, 'login'), 20, 15 * 60 * 1000)
  if (!rl.ok) {
    res.status(429).json({ success: false, error: `登录尝试过多，请 ${rl.retryAfterSec} 秒后重试` })
    return
  }

  const username = normalizeUsername(String(req.body?.username ?? ''))
  const password = String(req.body?.password ?? '')

  if (!username || !password) {
    res.status(400).json({ success: false, error: '请输入账号和密码' })
    return
  }

  const user = (
    await query<AuthUserRow>(
      'SELECT id, name, username, password_hash, role, org_unit_id FROM users WHERE lower(username) = $1',
      [username],
    )
  ).rows[0]

  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ success: false, error: '账号或密码错误' })
    return
  }

  await issueLogin(user, res)
})

router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth?.userId || String(req.body?.userId ?? '')
  if (userId) await audit(userId, 'auth.logout', {})
  res.status(200).json({ success: true })
})

router.post('/change-password', async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req)) {
    rejectUnauthorized(res)
    return
  }

  const { userId } = getUserContext(req)
  const oldPassword = String(req.body?.oldPassword ?? '')
  const newPassword = String(req.body?.newPassword ?? '')

  if (!oldPassword || !newPassword) {
    res.status(400).json({ success: false, error: '请填写原密码和新密码' })
    return
  }
  if (newPassword.length < 6) {
    res.status(400).json({ success: false, error: '新密码至少 6 位' })
    return
  }

  const user = (await query('SELECT id, password_hash FROM users WHERE id = $1', [userId])).rows[0]
  if (!user || !verifyPassword(oldPassword, user.password_hash)) {
    res.status(400).json({ success: false, error: '原密码不正确' })
    return
  }

  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashPassword(newPassword), userId])
  await audit(userId, 'auth.change_password', {})
  res.status(200).json({ success: true })
})

/** 更新个人资料（姓名） */
router.put('/profile', async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req)) {
    rejectUnauthorized(res)
    return
  }

  const { userId } = getUserContext(req)
  const name = String(req.body?.name ?? '').trim()
  if (!name || name.length < 2) {
    res.status(400).json({ success: false, error: '姓名至少 2 个字符' })
    return
  }
  if (name.length > 40) {
    res.status(400).json({ success: false, error: '姓名过长' })
    return
  }

  await query('UPDATE users SET name = $1 WHERE id = $2', [name, userId])
  const user = (
    await query<AuthUserRow>(
      'SELECT id, name, username, role, org_unit_id FROM users WHERE id = $1',
      [userId],
    )
  ).rows[0]
  await audit(userId, 'auth.update_profile', { name })
  res.status(200).json({ success: true, data: { user: toAuthUser(user) } })
})

export default wrapAsyncRouter(router)
