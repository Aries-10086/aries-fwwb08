import { Router, type Request, type Response } from 'express'
import { db } from '../db.js'
import { getUserContext, requireRole } from '../utils/http.js'
import {
  completionRatePercent,
  countMembersFullyDone,
  loadCompletedByUserIds,
  loadDurationByUserIds,
  loadExamAggByUserIds,
  loadOrgExamSummary,
  loadTaskContentsMap,
} from '../utils/aggregates.js'

const router = Router()

function getOrgUnitIdForUser(userId: string) {
  const row = db.prepare('SELECT org_unit_id FROM users WHERE id = ?').get(userId) as any
  return row?.org_unit_id ? String(row.org_unit_id) : ''
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
  const memberIds = users.map((u) => String(u.id))

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

  const examSummary = loadOrgExamSummary(orgUnitId)

  const latestTask = db
    .prepare(
      `SELECT id FROM learning_tasks ${orgUnitId ? 'WHERE org_unit_id = ?' : ''} ORDER BY created_at DESC LIMIT 1`,
    )
    .get(orgUnitId ? [orgUnitId] : []) as any

  let completionRate = 0
  if (latestTask?.id && memberCount > 0) {
    const cids = loadTaskContentsMap([String(latestTask.id)]).get(String(latestTask.id)) ?? []
    const completedByUser = loadCompletedByUserIds(memberIds)
    completionRate = completionRatePercent(memberIds, cids, completedByUser)
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
      avgExamScore: examSummary.avgExamScore,
      passRate: examSummary.passRate,
      latestTaskCompletionRate: completionRate,
      rank,
    },
  })
})

/** 支部书记/管理员：查看下级（本支部党员）测验成绩 */
router.get('/member-scores', (req: Request, res: Response) => {
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

  if (role === 'secretary' && !orgUnitId) {
    res.status(400).json({ success: false, error: '未绑定所属支部' })
    return
  }

  const orgName = orgUnitId
    ? String((db.prepare('SELECT name FROM org_units WHERE id = ?').get(orgUnitId) as any)?.name ?? '')
    : '全部组织'

  const members = (
    orgUnitId
      ? (db
          .prepare(
            `SELECT id, name, username, org_unit_id, created_at
             FROM users
             WHERE org_unit_id = ? AND role = 'member'
             ORDER BY name ASC`,
          )
          .all(orgUnitId) as any[])
      : (db
          .prepare(
            `SELECT id, name, username, org_unit_id, created_at
             FROM users
             WHERE role = 'member'
             ORDER BY name ASC`,
          )
          .all() as any[])
  )

  const memberIds = members.map((m) => String(m.id))
  const examAgg = loadExamAggByUserIds(memberIds)

  const list = members.map((m) => {
    const uid = String(m.id)
    const agg = examAgg.get(uid)!
    return {
      userId: uid,
      name: String(m.name),
      username: String(m.username ?? ''),
      orgUnitId: String(m.org_unit_id),
      attemptCount: agg.attemptCount,
      avgScore: agg.avgScore,
      passCount: agg.passCount,
      passRate: agg.passRate,
      latestScore: agg.latestScore,
      latestIsPass: agg.latestIsPass,
      latestExamTitle: agg.latestExamTitle,
      latestAt: agg.latestAt,
    }
  })

  const scored = list.filter((x) => x.attemptCount > 0)
  const allAttempts = scored.reduce((a, b) => a + b.attemptCount, 0)
  const avgScore =
    scored.length > 0
      ? Math.round(scored.reduce((a, b) => a + Number(b.avgScore ?? 0), 0) / scored.length)
      : 0
  const passRate =
    allAttempts > 0
      ? Math.round((scored.reduce((a, b) => a + b.passCount, 0) / allAttempts) * 100)
      : 0

  res.status(200).json({
    success: true,
    data: {
      orgUnitId,
      orgName,
      summary: {
        memberCount: list.length,
        attemptedMemberCount: scored.length,
        attemptCount: allAttempts,
        avgScore,
        passRate,
      },
      members: list,
    },
  })
})

/** 支部书记完整数据看板：时长、任务完成率、测验、成员明细 */
router.get('/branch-dashboard', (req: Request, res: Response) => {
  if (!requireRole(req, ['admin', 'secretary'])) {
    res.status(403).json({ success: false, error: '无权限访问' })
    return
  }

  const { role, userId } = getUserContext(req)
  const orgUnitId =
    role === 'admin'
      ? req.query.orgUnitId
        ? String(req.query.orgUnitId)
        : getOrgUnitIdForUser(userId) || null
      : getOrgUnitIdForUser(userId)

  if (!orgUnitId) {
    res.status(400).json({ success: false, error: '未指定支部（书记须绑定所属支部）' })
    return
  }

  const orgName = String((db.prepare('SELECT name FROM org_units WHERE id = ?').get(orgUnitId) as any)?.name ?? '')

  const members = db
    .prepare(
      `SELECT id, name, username FROM users
       WHERE org_unit_id = ? AND role = 'member'
       ORDER BY name ASC`,
    )
    .all(orgUnitId) as any[]

  const memberCount = members.length
  const memberIds = members.map((m) => String(m.id))

  const durationRow = db
    .prepare(
      `SELECT SUM(lr.duration_ms) as s
       FROM learning_records lr
       JOIN users u ON u.id = lr.user_id
       WHERE u.org_unit_id = ? AND u.role = 'member'`,
    )
    .get(orgUnitId) as any
  const durationMs = Number(durationRow?.s ?? 0)
  const durationHours = Math.round((durationMs / 3600000) * 10) / 10

  const examSummary = loadOrgExamSummary(orgUnitId)

  const tasks = db
    .prepare(
      `SELECT id, title, due_at, created_at FROM learning_tasks
       WHERE org_unit_id = ? ORDER BY created_at DESC LIMIT 50`,
    )
    .all(orgUnitId) as any[]

  const completedByUser = loadCompletedByUserIds(memberIds)
  const durationByUser = loadDurationByUserIds(memberIds)
  const examAgg = loadExamAggByUserIds(memberIds)
  const contentsByTask = loadTaskContentsMap(tasks.map((t) => String(t.id)))

  const taskStats = tasks.map((t) => {
    const cids = contentsByTask.get(String(t.id)) ?? []
    const completedMemberCount = countMembersFullyDone(memberIds, cids, completedByUser)
    return {
      id: String(t.id),
      title: String(t.title),
      dueAt: t.due_at ? String(t.due_at) : null,
      contentIds: cids,
      contentCount: cids.length,
      completedMemberCount,
      completionRate: memberCount > 0 ? Math.round((completedMemberCount / memberCount) * 100) : 0,
    }
  })

  const latestTaskCompletionRate = taskStats[0]?.completionRate ?? 0
  const overallTaskCompletionRate =
    taskStats.length > 0
      ? Math.round(taskStats.reduce((a, b) => a + b.completionRate, 0) / taskStats.length)
      : 0

  const allContentIds = [...new Set(taskStats.flatMap((t) => t.contentIds))]
  const membersFullyDone = countMembersFullyDone(memberIds, allContentIds, completedByUser)
  const contentCompletionRate =
    allContentIds.length === 0 || memberCount === 0
      ? 0
      : Math.round((membersFullyDone / memberCount) * 100)

  const memberRows = members.map((m) => {
    const uid = String(m.id)
    const done = completedByUser.get(uid) ?? new Set<string>()
    const dur = durationByUser.get(uid) ?? 0
    const att = examAgg.get(uid)!
    const completedContentCount = done.size
    const taskDoneCount =
      taskStats.length === 0
        ? 0
        : taskStats.filter((t) => t.contentIds.length > 0 && t.contentIds.every((cid) => done.has(cid)))
            .length

    return {
      userId: uid,
      name: String(m.name),
      username: String(m.username ?? ''),
      durationMs: dur,
      durationHours: Math.round((dur / 3600000) * 10) / 10,
      completedContentCount,
      taskCompletedCount: taskDoneCount,
      taskCount: taskStats.length,
      taskCompletionRate:
        taskStats.length > 0 ? Math.round((taskDoneCount / taskStats.length) * 100) : 0,
      attemptCount: att.attemptCount,
      avgScore: att.avgScore,
      passCount: att.passCount,
    }
  })

  res.status(200).json({
    success: true,
    data: {
      orgUnitId,
      orgName,
      summary: {
        memberCount,
        durationHours,
        avgExamScore: examSummary.avgExamScore,
        passRate: examSummary.passRate,
        attemptCount: examSummary.attemptCount,
        taskCount: taskStats.length,
        latestTaskCompletionRate,
        overallTaskCompletionRate,
        contentCompletionRate,
        requiredContentCount: allContentIds.length,
      },
      tasks: taskStats.map(({ contentIds: _cids, ...rest }) => rest),
      members: memberRows,
    },
  })
})

/** 个人中心：资料、学习时长、我的成绩 */
router.get('/my-center', (req: Request, res: Response) => {
  if (!requireRole(req, ['member', 'secretary', 'admin'])) {
    res.status(403).json({ success: false, error: '未登录' })
    return
  }

  const { userId } = getUserContext(req)
  const user = db
    .prepare('SELECT id, name, username, role, org_unit_id, created_at FROM users WHERE id = ?')
    .get(userId) as any
  if (!user) {
    res.status(401).json({ success: false, error: '登录已失效' })
    return
  }

  const org = user.org_unit_id
    ? (db.prepare('SELECT id, name FROM org_units WHERE id = ?').get(String(user.org_unit_id)) as any)
    : null

  const learnRow = db
    .prepare(
      `SELECT COALESCE(SUM(duration_ms), 0) as duration_ms,
              COALESCE(SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END), 0) as completed_count,
              COUNT(1) as record_count
       FROM learning_records WHERE user_id = ?`,
    )
    .get(userId) as any

  const durationMs = Number(learnRow?.duration_ms ?? 0)
  const durationHours = Math.round((durationMs / 3600000) * 10) / 10
  const durationMinutes = Math.round(durationMs / 60000)
  const completedContentCount = Number(learnRow?.completed_count ?? 0)
  const recordCount = Number(learnRow?.record_count ?? 0)

  const attempts = db
    .prepare(
      `SELECT ea.id, ea.exam_id, ea.total_score, ea.is_pass, ea.created_at,
              e.title as exam_title, e.pass_score as pass_score, e.duration_min as duration_min
       FROM exam_attempts ea
       LEFT JOIN exams e ON e.id = ea.exam_id
       WHERE ea.user_id = ?
       ORDER BY ea.created_at DESC
       LIMIT 50`,
    )
    .all(userId) as any[]

  const attemptCount = attempts.length
  const avgScore =
    attemptCount > 0
      ? Math.round(attempts.reduce((a, b) => a + Number(b.total_score ?? 0), 0) / attemptCount)
      : null
  const passCount = attempts.filter((a) => Number(a.is_pass ?? 0) === 1).length
  const bestScore =
    attemptCount > 0 ? Math.max(...attempts.map((a) => Number(a.total_score ?? 0))) : null

  // 支部内按学习时长排名（党员）
  let branchRank: number | null = null
  let branchMemberCount: number | null = null
  if (user.org_unit_id && user.role === 'member') {
    const ranks = db
      .prepare(
        `SELECT u.id as user_id, COALESCE(SUM(lr.duration_ms), 0) as duration_ms
         FROM users u
         LEFT JOIN learning_records lr ON lr.user_id = u.id
         WHERE u.org_unit_id = ? AND u.role = 'member'
         GROUP BY u.id
         ORDER BY duration_ms DESC, u.name ASC`,
      )
      .all(String(user.org_unit_id)) as any[]
    branchMemberCount = ranks.length
    const idx = ranks.findIndex((r) => String(r.user_id) === userId)
    branchRank = idx >= 0 ? idx + 1 : null
  }

  res.status(200).json({
    success: true,
    data: {
      profile: {
        id: String(user.id),
        name: String(user.name),
        username: String(user.username ?? ''),
        role: String(user.role),
        orgUnitId: user.org_unit_id ? String(user.org_unit_id) : '',
        orgName: org?.name ? String(org.name) : '未分配支部',
        createdAt: user.created_at ? String(user.created_at) : null,
      },
      learning: {
        durationMs,
        durationHours,
        durationMinutes,
        completedContentCount,
        recordCount,
        branchRank,
        branchMemberCount,
      },
      exams: {
        attemptCount,
        avgScore,
        bestScore,
        passCount,
        passRate: attemptCount > 0 ? Math.round((passCount / attemptCount) * 100) : null,
        attempts: attempts.map((a) => ({
          id: String(a.id),
          examId: String(a.exam_id),
          examTitle: a.exam_title ? String(a.exam_title) : '测验',
          totalScore: Number(a.total_score ?? 0),
          passScore: a.pass_score != null ? Number(a.pass_score) : null,
          isPass: Number(a.is_pass ?? 0) === 1,
          createdAt: String(a.created_at),
        })),
      },
    },
  })
})

export default router
