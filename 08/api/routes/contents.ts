import { Router, type Request, type Response } from 'express'
import { nanoid } from 'nanoid'
import { db, nowIso, audit } from '../db.js'
import { getUserContext, requireRole } from '../utils/http.js'
import { json, parseJson } from '../utils/json.js'

const router = Router()

function accessibleContentIdsForUser(userId: string) {
  const user = db.prepare('SELECT org_unit_id FROM users WHERE id = ?').get(userId) as any
  if (!user?.org_unit_id) return new Set<string>()

  const taskIds = db
    .prepare('SELECT id FROM learning_tasks WHERE org_unit_id = ?')
    .all(String(user.org_unit_id)) as any[]

  const ids = new Set<string>()
  const publicRows = db.prepare('SELECT id FROM contents WHERE is_public = 1').all() as any[]
  for (const r of publicRows) ids.add(String(r.id))

  for (const t of taskIds) {
    const rows = db.prepare('SELECT content_id FROM task_contents WHERE task_id = ?').all(String(t.id)) as any[]
    for (const r of rows) ids.add(String(r.content_id))
  }

  return ids
}

router.get('/', (req: Request, res: Response) => {
  const { role, userId } = getUserContext(req)
  const q = req.query.q ? String(req.query.q) : null
  const type = req.query.type ? String(req.query.type) : null
  const category = req.query.category ? String(req.query.category) : null
  const isPublic = req.query.isPublic ? Number(req.query.isPublic) : null

  const where: string[] = []
  const params: any[] = []

  if (q) {
    where.push('(title LIKE ? OR body LIKE ?)')
    params.push(`%${q}%`, `%${q}%`)
  }
  if (type) {
    where.push('type = ?')
    params.push(type)
  }
  if (category) {
    where.push('category = ?')
    params.push(category)
  }
  if (isPublic === 0 || isPublic === 1) {
    where.push('is_public = ?')
    params.push(isPublic)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  const rows = db
    .prepare(
      `SELECT id, type, title, body, category, tags_json, is_public, created_at, updated_at
       FROM contents
       ${whereSql}
       ORDER BY updated_at DESC
       LIMIT 300`,
    )
    .all(...params) as any[]

  let data = rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    category: r.category,
    tags: parseJson<string[]>(r.tags_json) ?? [],
    isPublic: !!r.is_public,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))

  if (role === 'member' || role === 'secretary') {
    const allow = accessibleContentIdsForUser(userId)
    data = data.filter((x) => allow.has(String(x.id)))
  }

  res.status(200).json({ success: true, data })
})

router.get('/:id', (req: Request, res: Response) => {
  const { role, userId } = getUserContext(req)
  const id = String(req.params.id)

  const row = db
    .prepare(
      `SELECT id, type, title, body, category, tags_json, is_public, created_at, updated_at
       FROM contents
       WHERE id = ?`,
    )
    .get(id) as any

  if (!row) {
    res.status(404).json({ success: false, error: '内容不存在' })
    return
  }

  if (role === 'member' || role === 'secretary') {
    const allow = accessibleContentIdsForUser(userId)
    if (!allow.has(id)) {
      res.status(403).json({ success: false, error: '无权限访问该内容' })
      return
    }
  }

  res.status(200).json({
    success: true,
    data: {
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      category: row.category,
      tags: parseJson<string[]>(row.tags_json) ?? [],
      isPublic: !!row.is_public,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  })
})

router.post('/', (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = `c_${nanoid(10)}`
  const ts = nowIso()

  db.prepare(
    `INSERT INTO contents (id, type, title, body, category, tags_json, is_public, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    String(req.body?.type ?? 'article'),
    String(req.body?.title ?? ''),
    String(req.body?.body ?? ''),
    String(req.body?.category ?? ''),
    json(req.body?.tags ?? []),
    req.body?.isPublic ? 1 : 0,
    ts,
    ts,
  )

  audit(userId || 'u_admin_demo', 'contents.create', { id })
  res.status(200).json({ success: true, data: { id } })
})

router.put('/:id', (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = String(req.params.id)
  const ts = nowIso()

  db.prepare(
    `UPDATE contents SET type = ?, title = ?, body = ?, category = ?, tags_json = ?, is_public = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    String(req.body?.type ?? 'article'),
    String(req.body?.title ?? ''),
    String(req.body?.body ?? ''),
    String(req.body?.category ?? ''),
    json(req.body?.tags ?? []),
    req.body?.isPublic ? 1 : 0,
    ts,
    id,
  )

  audit(userId || 'u_admin_demo', 'contents.update', { id })
  res.status(200).json({ success: true })
})

router.delete('/:id', (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = String(req.params.id)

  db.prepare('DELETE FROM task_contents WHERE content_id = ?').run(id)
  db.prepare('DELETE FROM learning_records WHERE content_id = ?').run(id)
  db.prepare('DELETE FROM contents WHERE id = ?').run(id)

  audit(userId || 'u_admin_demo', 'contents.delete', { id })
  res.status(200).json({ success: true })
})

export default router
