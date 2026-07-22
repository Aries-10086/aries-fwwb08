import { Router, type Request, type Response } from 'express'
import { nanoid } from 'nanoid'
import { db, nowIso, audit } from '../db.js'
import { getUserContext, requireRole } from '../utils/http.js'

const router = Router()

function getOrgUnitIdForUser(userId: string) {
  const row = db.prepare('SELECT org_unit_id FROM users WHERE id = ?').get(userId) as any
  return row?.org_unit_id ? String(row.org_unit_id) : ''
}

function getContentIdsForTask(taskId: string) {
  const rows = db.prepare('SELECT content_id FROM task_contents WHERE task_id = ?').all(taskId) as any[]
  return rows.map((r) => String(r.content_id))
}

router.get('/', (req: Request, res: Response) => {
  const { role, userId } = getUserContext(req)
  const orgUnitIdParam = req.query.orgUnitId ? String(req.query.orgUnitId) : null

  const orgUnitId =
    role === 'admin'
      ? orgUnitIdParam
      : role === 'secretary' || role === 'member'
        ? getOrgUnitIdForUser(userId)
        : null

  const where: string[] = []
  const params: any[] = []

  if (orgUnitId) {
    where.push('org_unit_id = ?')
    params.push(orgUnitId)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  const rows = db
    .prepare(
      `SELECT id, org_unit_id, title, due_at, created_at
       FROM learning_tasks
       ${whereSql}
       ORDER BY created_at DESC
       LIMIT 200`,
    )
    .all(...params) as any[]

  const data = rows.map((r) => ({
    id: r.id,
    orgUnitId: r.org_unit_id,
    title: r.title,
    dueAt: r.due_at,
    createdAt: r.created_at,
    contentIds: getContentIdsForTask(String(r.id)),
  }))

  res.status(200).json({ success: true, data })
})

router.post('/', (req: Request, res: Response) => {
  if (!requireRole(req, ['admin', 'secretary'])) {
    res.status(403).json({ success: false, error: '无权限操作' })
    return
  }

  const { userId, role } = getUserContext(req)
  const orgUnitId = role === 'secretary' ? getOrgUnitIdForUser(userId) : String(req.body?.orgUnitId ?? '')
  if (!orgUnitId) {
    res.status(400).json({ success: false, error: '缺少 orgUnitId' })
    return
  }

  const id = `task_${nanoid(10)}`
  const ts = nowIso()
  const contentIds = Array.isArray(req.body?.contentIds) ? (req.body.contentIds as string[]) : []

  db.prepare('INSERT INTO learning_tasks (id, org_unit_id, title, due_at, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, orgUnitId, String(req.body?.title ?? ''), req.body?.dueAt ? String(req.body.dueAt) : null, ts)

  const insertTC = db.prepare('INSERT INTO task_contents (task_id, content_id) VALUES (?, ?)')
  for (const cid of contentIds) insertTC.run(id, cid)

  audit(userId || 'u_admin_demo', 'tasks.create', { id, orgUnitId, contentCount: contentIds.length })
  res.status(200).json({ success: true, data: { id } })
})

router.get('/:id', (req: Request, res: Response) => {
  const { role, userId } = getUserContext(req)
  const id = String(req.params.id)

  const row = db
    .prepare('SELECT id, org_unit_id, title, due_at, created_at FROM learning_tasks WHERE id = ?')
    .get(id) as any

  if (!row) {
    res.status(404).json({ success: false, error: '任务不存在' })
    return
  }

  if (role === 'member' || role === 'secretary') {
    const ownOrg = getOrgUnitIdForUser(userId)
    if (String(row.org_unit_id) !== ownOrg) {
      res.status(403).json({ success: false, error: '无权限访问该任务' })
      return
    }
  }

  res.status(200).json({
    success: true,
    data: {
      id: row.id,
      orgUnitId: row.org_unit_id,
      title: row.title,
      dueAt: row.due_at,
      createdAt: row.created_at,
      contentIds: getContentIdsForTask(id),
    },
  })
})

export default router

