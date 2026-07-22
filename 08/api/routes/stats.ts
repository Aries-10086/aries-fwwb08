import { Router, type Request, type Response } from 'express'
import { db } from '../db.js'
import { getUserContext, requireRole } from '../utils/http.js'
import { parseJson } from '../utils/json.js'

const router = Router()

function getOrgUnitIdForUser(userId: string) {
  const row = db.prepare('SELECT org_unit_id FROM users WHERE id = ?').get(userId) as any
  return row?.org_unit_id ? String(row.org_unit_id) : ''
}

function taskContentIds(taskId: string) {
  const rows = db.prepare('SELECT content_id FROM task_contents WHERE task_id = ?').all(taskId) as any[]
  return rows.map((r) => String(r.content_id))
}

function userCompletedContents(userId: string) {
  const rows = db
    .prepare('SELECT content_id FROM learning_records WHERE user_id = ? AND is_completed = 1')
    .all(userId) as any[]
  return new Set(rows.map((r) => String(r.content_id)))
}

router.get('/overview', (req: Request, res: Response) => {
  if (!requireRole(req, ['admin', 'secretary'])) {
    res.status(403).json({ success: false, error: '无权限访问' })
    return
  }

  const { role, userId } = getUserContext(req)
  const orgUnitId =
    role === 'admin'
      ? req.query.orgUnitId
        ? String(req.query.orgUnitId)
        : null
      : getOrgUnitIdForUser(userId)

  const userWhere = orgUnitId ? 'WHERE org_unit_id = ? AND role = ?' : 'WHERE role = ?'
  const users = db
    .prepare(`SELECT id, name FROM users ${userWhere}`)
    .all(orgUnitId ? [orgUnitId, 'member'] : ['member']) as any[]

  const memberCount = users.length

  const durationRow = db
    .prepare(
      `SELECT SUM(duration_ms) as s
       FROM learning_records lr
       JOIN users u ON u.id = lr.user_id
       ${orgUnitId ? 'WHERE u.org_unit_id = ?' : ''}`,
    )
    .get(orgUnitId ? [orgUnitId] : []) as any

  const durationMs = Number(durationRow?.s ?? 0)
  const durationHours = Math.round((durationMs / 3600000) * 10) / 10

  const examRows = db
    .prepare(
      `SELECT ea.total_score as total_score, ea.is_pass as is_pass
       FROM exam_attempts ea
       JOIN users u ON u.id = ea.user_id
       ${orgUnitId ? 'WHERE u.org_unit_id = ?' : ''}`,
    )
    .all(orgUnitId ? [orgUnitId] : []) as any[]

  const avgExamScore =
    examRows.length > 0
      ? Math.round(examRows.reduce((a, b) => a + Number(b.total_score ?? 0), 0) / examRows.length)
      : 0
  const passRate =
    examRows.length > 0
      ? Math.round((examRows.filter((r) => Number(r.is_pass ?? 0) === 1).length / examRows.length) * 100)
      : 0

  const taskRows = db
    .prepare(
      `SELECT id, title FROM learning_tasks ${orgUnitId ? 'WHERE org_unit_id = ?' : ''} ORDER BY created_at DESC LIMIT 20`,
    )
    .all(orgUnitId ? [orgUnitId] : []) as any[]

  let completionRate = 0
  if (taskRows.length > 0 && memberCount > 0) {
    const task = taskRows[0]
    const cids = taskContentIds(String(task.id))
    const completedCount = users.filter((u) => {
      const s = userCompletedContents(String(u.id))
      return cids.every((cid) => s.has(cid))
    }).length
    completionRate = Math.round((completedCount / memberCount) * 100)
  }

  const orgs = db.prepare('SELECT id, name, parent_id FROM org_units').all() as any[]
  const orgNameById = new Map<string, string>()
  for (const o of orgs) orgNameById.set(String(o.id), String(o.name))

  const byOrgRows = db
    .prepare(
      `SELECT u.org_unit_id as org_unit_id, AVG(ea.total_score) as avg_score
       FROM exam_attempts ea
       JOIN users u ON u.id = ea.user_id
       WHERE u.role = 'member'
       ${orgUnitId ? 'AND u.org_unit_id = ?' : ''}
       GROUP BY u.org_unit_id`,
    )
    .all(...(orgUnitId ? [orgUnitId] : [])) as any[]

  const rank = byOrgRows
    .map((r) => ({
      orgUnitId: r.org_unit_id,
      orgName: orgNameById.get(String(r.org_unit_id)) ?? String(r.org_unit_id),
      avgScore: Math.round(Number(r.avg_score ?? 0)),
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 10)

  res.status(200).json({
    success: true,
    data: {
      orgUnitId,
      memberCount,
      durationHours,
      avgExamScore,
      passRate,
      latestTaskCompletionRate: completionRate,
      rank,
    },
  })
})

export default router
