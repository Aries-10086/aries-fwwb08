import { Router, type Request, type Response } from 'express'
import { nanoid } from 'nanoid'
import { db, nowIso, audit } from '../db.js'
import { getUserContext, requireAuth, requireRole, rejectUnauthorized, rejectForbidden } from '../utils/http.js'
import { hashPassword, normalizeUsername } from '../utils/password.js'

const router = Router()

function parseTabular(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return []

  const delimiter = lines[0].includes('\t') ? '\t' : ','
  const header = lines[0].split(delimiter).map((s) => s.trim())
  const rows: Record<string, string>[] = []
  for (const line of lines.slice(1)) {
    const cols = line.split(delimiter).map((s) => s.trim())
    const row: Record<string, string> = {}
    for (let i = 0; i < header.length; i++) row[header[i]] = cols[i] ?? ''
    rows.push(row)
  }
  return rows
}

function assertUsernameAvailable(username: string, excludeId?: string) {
  const row = excludeId
    ? (db.prepare('SELECT id FROM users WHERE lower(username) = ? AND id != ?').get(username, excludeId) as any)
    : (db.prepare('SELECT id FROM users WHERE lower(username) = ?').get(username) as any)
  return !row
}

router.get('/', (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    if (!requireAuth(req)) {
      rejectUnauthorized(res)
      return
    }
    rejectForbidden(res, '仅管理员可查看人员列表')
    return
  }

  const name = req.query.name ? String(req.query.name) : null
  const role = req.query.role ? String(req.query.role) : null
  const orgUnitId = req.query.orgUnitId ? String(req.query.orgUnitId) : null

  const where: string[] = []
  const params: any[] = []

  if (name) {
    where.push('(name LIKE ? OR username LIKE ?)')
    params.push(`%${name}%`, `%${name}%`)
  }
  if (role) {
    where.push('role = ?')
    params.push(role)
  }
  if (orgUnitId) {
    where.push('org_unit_id = ?')
    params.push(orgUnitId)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  const rows = db
    .prepare(
      `SELECT id, name, username, role, org_unit_id, created_at
       FROM users
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT 500`,
    )
    .all(...params) as any[]

  const data = rows.map((r) => ({
    id: r.id,
    name: r.name,
    username: r.username ?? '',
    role: r.role,
    orgUnitId: r.org_unit_id,
    createdAt: r.created_at,
  }))

  res.status(200).json({ success: true, data })
})

router.post('/', (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = `u_${nanoid(10)}`
  const ts = nowIso()
  const name = String(req.body?.name ?? '').trim()
  const username = normalizeUsername(String(req.body?.username ?? ''))
  const password = String(req.body?.password ?? '')
  const roleRaw = String(req.body?.role ?? 'member')
  const role = ['member', 'secretary', 'admin'].includes(roleRaw) ? roleRaw : ''
  const orgUnitId = String(req.body?.orgUnitId ?? '')

  if (!name) {
    res.status(400).json({ success: false, error: '请填写姓名' })
    return
  }
  if (!username) {
    res.status(400).json({ success: false, error: '请填写登录账号' })
    return
  }
  if (!role) {
    res.status(400).json({ success: false, error: '角色无效' })
    return
  }
  if (password.length < 6) {
    res.status(400).json({ success: false, error: '密码至少 6 位' })
    return
  }
  if (!assertUsernameAvailable(username)) {
    res.status(400).json({ success: false, error: '账号已存在' })
    return
  }

  db.prepare(
    'INSERT INTO users (id, name, username, password_hash, role, org_unit_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(id, name, username, hashPassword(password), role, orgUnitId, ts)

  audit(userId || 'u_admin_demo', 'users.create', { id, username })
  res.status(200).json({ success: true, data: { id } })
})

router.put('/:id', (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = String(req.params.id)
  const name = String(req.body?.name ?? '').trim()
  const username = normalizeUsername(String(req.body?.username ?? ''))
  const password = String(req.body?.password ?? '')
  const roleRaw = String(req.body?.role ?? 'member')
  const role = ['member', 'secretary', 'admin'].includes(roleRaw) ? roleRaw : ''
  const orgUnitId = String(req.body?.orgUnitId ?? '')

  if (!name) {
    res.status(400).json({ success: false, error: '请填写姓名' })
    return
  }
  if (!username) {
    res.status(400).json({ success: false, error: '请填写登录账号' })
    return
  }
  if (!role) {
    res.status(400).json({ success: false, error: '角色无效' })
    return
  }
  if (!assertUsernameAvailable(username, id)) {
    res.status(400).json({ success: false, error: '账号已存在' })
    return
  }

  if (password) {
    if (password.length < 6) {
      res.status(400).json({ success: false, error: '密码至少 6 位' })
      return
    }
    db.prepare(
      'UPDATE users SET name = ?, username = ?, password_hash = ?, role = ?, org_unit_id = ? WHERE id = ?',
    ).run(name, username, hashPassword(password), role, orgUnitId, id)
  } else {
    db.prepare('UPDATE users SET name = ?, username = ?, role = ?, org_unit_id = ? WHERE id = ?').run(
      name,
      username,
      role,
      orgUnitId,
      id,
    )
  }

  audit(userId || 'u_admin_demo', 'users.update', { id, username })
  res.status(200).json({ success: true })
})

router.delete('/:id', (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = String(req.params.id)

  if (id === 'u_admin_demo') {
    res.status(400).json({ success: false, error: '演示管理员不可删除' })
    return
  }

  db.prepare('DELETE FROM learning_records WHERE user_id = ?').run(id)
  db.prepare('DELETE FROM exam_answers WHERE attempt_id IN (SELECT id FROM exam_attempts WHERE user_id = ?)').run(id)
  db.prepare('DELETE FROM exam_attempts WHERE user_id = ?').run(id)
  db.prepare('DELETE FROM ai_reports WHERE user_id = ?').run(id)
  db.prepare('DELETE FROM ai_logs WHERE user_id = ?').run(id)
  db.prepare('DELETE FROM users WHERE id = ?').run(id)

  audit(userId || 'u_admin_demo', 'users.delete', { id })
  res.status(200).json({ success: true })
})

router.post('/import', (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const csvText = String(req.body?.csvText ?? '')
  const rows = parseTabular(csvText)

  if (rows.length === 0) {
    res.status(400).json({ success: false, error: '导入内容为空或格式不正确' })
    return
  }

  const orgByName = new Map<string, string>()
  const orgRows = db.prepare('SELECT id, name FROM org_units').all() as any[]
  for (const o of orgRows) orgByName.set(String(o.name), String(o.id))

  const insert = db.prepare(
    'INSERT INTO users (id, name, username, password_hash, role, org_unit_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )

  const ts = nowIso()
  const result: { ok: number; failed: number; errors: Array<{ line: number; reason: string }> } = {
    ok: 0,
    failed: 0,
    errors: [],
  }

  rows.forEach((r, idx) => {
    const name = String(r.name ?? r.姓名 ?? '').trim()
    const roleRaw = String(r.role ?? r.角色 ?? 'member').trim()
    const role = ['member', 'secretary', 'admin'].includes(roleRaw) ? roleRaw : ''
    const usernameRaw = String(r.username ?? r.账号 ?? r.用户名 ?? '').trim()
    const password = String(r.password ?? r.密码 ?? '').trim()
    const orgUnitIdRaw = String(r.orgUnitId ?? r.支部ID ?? '').trim()
    const orgNameRaw = String(r.orgUnitName ?? r.支部 ?? '').trim()
    const orgUnitId = orgUnitIdRaw || (orgNameRaw ? orgByName.get(orgNameRaw) ?? '' : '')
    const username = normalizeUsername(usernameRaw || `user_${nanoid(6)}`)

    if (!name) {
      result.failed += 1
      result.errors.push({ line: idx + 2, reason: '缺少 name/姓名' })
      return
    }
    if (!role) {
      result.failed += 1
      result.errors.push({ line: idx + 2, reason: '角色无效（仅支持 member/secretary/admin）' })
      return
    }
    if (password.length < 6) {
      result.failed += 1
      result.errors.push({ line: idx + 2, reason: '缺少 password/密码或不足 6 位（禁止默认弱密码）' })
      return
    }
    if (!orgUnitId) {
      result.failed += 1
      result.errors.push({ line: idx + 2, reason: '缺少 orgUnitId/支部ID 或 orgUnitName/支部' })
      return
    }
    if (!assertUsernameAvailable(username)) {
      result.failed += 1
      result.errors.push({ line: idx + 2, reason: `账号已存在：${username}` })
      return
    }

    const id = `u_${nanoid(10)}`
    insert.run(id, name, username, hashPassword(password), role, orgUnitId, ts)
    result.ok += 1
  })

  audit(userId || 'u_admin_demo', 'users.import', { ok: result.ok, failed: result.failed })
  res.status(200).json({ success: true, data: result })
})

export default router
