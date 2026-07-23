/**
 * User authentication: register + username/password login.
 * Accounts are stored in SQLite `users` (username + password_hash).
 * Access tokens are HMAC-signed; roles are always loaded from DB.
 */
import { Router, type Request, type Response } from 'express'
import { nanoid } from 'nanoid'
import { db, nowIso, audit } from '../db.js'
import { hashPassword, normalizeUsername, verifyPassword } from '../utils/password.js'
import { signAccessToken } from '../utils/token.js'
import { clientKey, hitRateLimit } from '../utils/rateLimit.js'
import { getUserContext, requireAuth, rejectUnauthorized } from '../utils/http.js'

const router = Router()

function toAuthUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    orgUnitId: user.org_unit_id,
  }
}

function issueLogin(user: any, res: Response) {
  const token = signAccessToken(String(user.id))
  audit(user.id, 'auth.login', { username: user.username })
  res.status(200).json({
    success: true,
    data: {
      token,
      user: toAuthUser(user),
    },
  })
}

/** Public: branches available for self-registration */
router.get('/org-options', (_req: Request, res: Response) => {
  const rows = db
    .prepare(
      `SELECT id, name FROM org_units
       WHERE parent_id IS NOT NULL
       ORDER BY created_at ASC`,
    )
    .all() as Array<{ id: string; name: string }>

  res.status(200).json({ success: true, data: rows })
})

router.get('/me', (req: Request, res: Response) => {
  if (!requireAuth(req)) {
    rejectUnauthorized(res)
    return
  }
  const { userId } = getUserContext(req)
  const user = db
    .prepare('SELECT id, name, username, role, org_unit_id FROM users WHERE id = ?')
    .get(userId) as any
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

  const exists = db.prepare('SELECT id FROM users WHERE lower(username) = ?').get(username) as any
  if (exists) {
    res.status(400).json({ success: false, error: '该账号已被注册' })
    return
  }

  const org = db.prepare('SELECT id FROM org_units WHERE id = ? AND parent_id IS NOT NULL').get(orgUnitId) as any
  if (!org) {
    res.status(400).json({ success: false, error: '所属支部无效' })
    return
  }

  const id = `u_${nanoid(10)}`
  const ts = nowIso()

  db.prepare(
    'INSERT INTO users (id, name, username, password_hash, role, org_unit_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, name, username, hashPassword(password), 'member', orgUnitId, ts)

  audit(id, 'auth.register', { username })

  const user = db
    .prepare('SELECT id, name, username, role, org_unit_id FROM users WHERE id = ?')
    .get(id) as any

  issueLogin(user, res)
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

  const user = db
    .prepare('SELECT id, name, username, password_hash, role, org_unit_id FROM users WHERE lower(username) = ?')
    .get(username) as any

  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ success: false, error: '账号或密码错误' })
    return
  }

  issueLogin(user, res)
})

router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth?.userId || String(req.body?.userId ?? '')
  if (userId) audit(userId, 'auth.logout', {})
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

  const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(userId) as any
  if (!user || !verifyPassword(oldPassword, user.password_hash)) {
    res.status(400).json({ success: false, error: '原密码不正确' })
    return
  }

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), userId)
  audit(userId, 'auth.change_password', {})
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

  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, userId)
  const user = db
    .prepare('SELECT id, name, username, role, org_unit_id FROM users WHERE id = ?')
    .get(userId) as any
  audit(userId, 'auth.update_profile', { name })
  res.status(200).json({ success: true, data: { user: toAuthUser(user) } })
})

export default router
