import { Router, type Request, type Response } from 'express'
import { nanoid } from 'nanoid'
import { db, nowIso, audit } from '../db.js'
import { getUserContext, requireAuth, requireRole, rejectUnauthorized } from '../utils/http.js'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  if (!requireAuth(req)) {
    rejectUnauthorized(res)
    return
  }

  const rows = db
    .prepare('SELECT id, name, parent_id, created_at FROM org_units ORDER BY created_at ASC')
    .all() as any[]

  const taskCountRows = db
    .prepare('SELECT org_unit_id, COUNT(1) as c FROM learning_tasks GROUP BY org_unit_id')
    .all() as any[]
  const memberCountRows = db
    .prepare('SELECT org_unit_id, COUNT(1) as c FROM users GROUP BY org_unit_id')
    .all() as any[]
  const memberRows = db
    .prepare('SELECT id, name, role, org_unit_id FROM users ORDER BY created_at ASC')
    .all() as any[]
  const scoreRows = db
    .prepare(
      `SELECT u.org_unit_id as org_unit_id, AVG(ea.total_score) as avg_score
       FROM exam_attempts ea
       JOIN users u ON u.id = ea.user_id
       WHERE u.role = 'member'
       GROUP BY u.org_unit_id`,
    )
    .all() as any[]

  const taskCountByOrg = new Map<string, number>()
  const memberCountByOrg = new Map<string, number>()
  const avgScoreByOrg = new Map<string, number>()
  const membersByOrg = new Map<string, Array<{ id: string; name: string; role: string }>>()

  for (const r of taskCountRows) taskCountByOrg.set(String(r.org_unit_id), Number(r.c ?? 0))
  for (const r of memberCountRows) memberCountByOrg.set(String(r.org_unit_id), Number(r.c ?? 0))
  for (const r of scoreRows) avgScoreByOrg.set(String(r.org_unit_id), Math.round(Number(r.avg_score ?? 0)))
  for (const r of memberRows) {
    const orgUnitId = String(r.org_unit_id)
    const list = membersByOrg.get(orgUnitId) ?? []
    list.push({ id: String(r.id), name: String(r.name), role: String(r.role) })
    membersByOrg.set(orgUnitId, list)
  }

  function latestTaskCompletionRate(orgUnitId: string) {
    const users = db
      .prepare("SELECT id FROM users WHERE org_unit_id = ? AND role = 'member'")
      .all(orgUnitId) as any[]
    if (users.length === 0) return 0

    const task = db
      .prepare('SELECT id FROM learning_tasks WHERE org_unit_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(orgUnitId) as any
    if (!task?.id) return 0

    const contentRows = db.prepare('SELECT content_id FROM task_contents WHERE task_id = ?').all(String(task.id)) as any[]
    const contentIds = contentRows.map((r) => String(r.content_id))
    if (contentIds.length === 0) return 0

    const completed = users.filter((u) => {
      const rows = db
        .prepare('SELECT content_id FROM learning_records WHERE user_id = ? AND is_completed = 1')
        .all(String(u.id)) as any[]
      const completedIds = new Set(rows.map((r) => String(r.content_id)))
      return contentIds.every((cid) => completedIds.has(cid))
    }).length

    return Math.round((completed / users.length) * 100)
  }

  const data = rows.map((r) => ({
    id: r.id,
    name: r.name,
    parentId: r.parent_id,
    createdAt: r.created_at,
    stats: {
      memberCount: memberCountByOrg.get(String(r.id)) ?? 0,
      taskCount: taskCountByOrg.get(String(r.id)) ?? 0,
      avgExamScore: avgScoreByOrg.get(String(r.id)) ?? 0,
      completionRate: latestTaskCompletionRate(String(r.id)),
    },
    members: membersByOrg.get(String(r.id)) ?? [],
  }))

  const { role, orgUnitId } = getUserContext(req)
  let scoped = data
  if (role !== 'admin') {
    // 非管理员仅可见自己支部及上级组织，且仅本支部展示成员名单
    scoped = data
      .filter((x) => x.id === orgUnitId || (!x.parentId && data.some((c) => c.id === orgUnitId && c.parentId === x.id)))
      .map((x) => (x.id === orgUnitId ? x : { ...x, members: [], stats: { ...x.stats, memberCount: x.id === orgUnitId ? x.stats.memberCount : 0 } }))
  }

  res.status(200).json({ success: true, data: scoped })
})

router.post('/', (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = `org_${nanoid(10)}`
  const ts = nowIso()

  db.prepare('INSERT INTO org_units (id, name, parent_id, created_at) VALUES (?, ?, ?, ?)')
    .run(id, String(req.body?.name ?? ''), req.body?.parentId ? String(req.body.parentId) : null, ts)

  audit(userId || 'u_admin_demo', 'org.create', { id })
  res.status(200).json({ success: true, data: { id } })
})

router.put('/:id', (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = String(req.params.id)

  db.prepare('UPDATE org_units SET name = ?, parent_id = ? WHERE id = ?')
    .run(String(req.body?.name ?? ''), req.body?.parentId ? String(req.body.parentId) : null, id)

  audit(userId || 'u_admin_demo', 'org.update', { id })
  res.status(200).json({ success: true })
})

router.delete('/:id', (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = String(req.params.id)

  const children = db.prepare('SELECT COUNT(1) as c FROM org_units WHERE parent_id = ?').get(id) as any
  if (Number(children?.c ?? 0) > 0) {
    res.status(400).json({ success: false, error: '请先删除下级组织' })
    return
  }

  const userCount = db.prepare('SELECT COUNT(1) as c FROM users WHERE org_unit_id = ?').get(id) as any
  if (Number(userCount?.c ?? 0) > 0) {
    res.status(400).json({ success: false, error: '该组织下仍有人员，无法删除' })
    return
  }

  db.prepare('DELETE FROM org_units WHERE id = ?').run(id)

  audit(userId || 'u_admin_demo', 'org.delete', { id })
  res.status(200).json({ success: true })
})

export default router
