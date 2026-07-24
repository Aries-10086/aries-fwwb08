import { Router, type Request, type Response } from 'express'
import { nanoid } from 'nanoid'
import { query, withTransaction, nowIso, audit, type TransactionClient } from '../db.js'
import { getUserContext, requireAuth, requireRole, rejectUnauthorized, rejectForbidden } from '../utils/http.js'
import { isFkViolation } from '../utils/fk-schema.js'
import { hashPassword, normalizeUsername } from '../utils/password.js'
import { wrapAsyncRouter } from '../utils/async-router.js'

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

async function assertUsernameAvailable(
  username: string,
  excludeId?: string,
  client?: TransactionClient,
) {
  const { rowCount } = await (client ?? { query }).query(
    `SELECT id FROM users WHERE lower(username) = $1${excludeId ? ' AND id != $2' : ''}`,
    excludeId ? [username, excludeId] : [username],
  )
  return rowCount === 0
}

router.get('/', async (req: Request, res: Response) => {
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
  const params: unknown[] = []

  if (name) {
    where.push(`(name ILIKE $${params.length + 1} OR username ILIKE $${params.length + 2})`)
    params.push(`%${name}%`, `%${name}%`)
  }
  if (role) {
    where.push(`role = $${params.length + 1}`)
    params.push(role)
  }
  if (orgUnitId) {
    where.push(`org_unit_id = $${params.length + 1}`)
    params.push(orgUnitId)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  const { rows } = await query(
    `SELECT id, name, username, role, org_unit_id, created_at
     FROM users
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT 500`,
    params,
  )

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

router.post('/', async (req: Request, res: Response) => {
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
  if (!(await assertUsernameAvailable(username))) {
    res.status(400).json({ success: false, error: '账号已存在' })
    return
  }

  await query(
    `INSERT INTO users (id, name, username, password_hash, role, org_unit_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, name, username, hashPassword(password), role, orgUnitId, ts],
  )

  await audit(userId || 'u_admin_demo', 'users.create', { id, username })
  res.status(200).json({ success: true, data: { id } })
})

router.put('/:id', async (req: Request, res: Response) => {
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
  if (!(await assertUsernameAvailable(username, id))) {
    res.status(400).json({ success: false, error: '账号已存在' })
    return
  }

  if (password) {
    if (password.length < 6) {
      res.status(400).json({ success: false, error: '密码至少 6 位' })
      return
    }
    await query(
      `UPDATE users SET name = $1, username = $2, password_hash = $3, role = $4, org_unit_id = $5
       WHERE id = $6`,
      [name, username, hashPassword(password), role, orgUnitId, id],
    )
  } else {
    await query(
      'UPDATE users SET name = $1, username = $2, role = $3, org_unit_id = $4 WHERE id = $5',
      [name, username, role, orgUnitId, id],
    )
  }

  await audit(userId || 'u_admin_demo', 'users.update', { id, username })
  res.status(200).json({ success: true })
})

router.delete('/:id', async (req: Request, res: Response) => {
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

  try {
    await query('DELETE FROM users WHERE id = $1', [id])
  } catch (e) {
    if (isFkViolation(e)) {
      res.status(400).json({ success: false, error: '存在关联数据，无法删除该用户' })
      return
    }
    throw e
  }

  await audit(userId || 'u_admin_demo', 'users.delete', { id })
  res.status(200).json({ success: true })
})

router.post('/import', async (req: Request, res: Response) => {
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
  const { rows: orgRows } = await query('SELECT id, name FROM org_units')
  for (const o of orgRows) orgByName.set(String(o.name), String(o.id))

  const ts = nowIso()
  const result: { ok: number; failed: number; errors: Array<{ line: number; reason: string }> } = {
    ok: 0,
    failed: 0,
    errors: [],
  }

  await withTransaction(async (client) => {
    for (const [idx, r] of rows.entries()) {
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
        continue
      }
      if (!role) {
        result.failed += 1
        result.errors.push({ line: idx + 2, reason: '角色无效（仅支持 member/secretary/admin）' })
        continue
      }
      if (password.length < 6) {
        result.failed += 1
        result.errors.push({ line: idx + 2, reason: '缺少 password/密码或不足 6 位（禁止默认弱密码）' })
        continue
      }
      if (!orgUnitId) {
        result.failed += 1
        result.errors.push({ line: idx + 2, reason: '缺少 orgUnitId/支部ID 或 orgUnitName/支部' })
        continue
      }
      if (!(await assertUsernameAvailable(username, undefined, client))) {
        result.failed += 1
        result.errors.push({ line: idx + 2, reason: `账号已存在：${username}` })
        continue
      }

      const id = `u_${nanoid(10)}`
      await client.query(
        `INSERT INTO users (id, name, username, password_hash, role, org_unit_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, name, username, hashPassword(password), role, orgUnitId, ts],
      )
      result.ok += 1
    }
  })

  await audit(userId || 'u_admin_demo', 'users.import', { ok: result.ok, failed: result.failed })
  res.status(200).json({ success: true, data: result })
})

export default wrapAsyncRouter(router)
