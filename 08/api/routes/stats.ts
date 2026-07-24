import { Router, type Request, type Response } from 'express'
import { query } from '../db.js'
import { toIso } from '../utils/json.js'
import { getUserContext, requireRole } from '../utils/http.js'
import { wrapAsyncRouter } from '../utils/async-router.js'
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

async function getOrgUnitIdForUser(userId: string) {
  const row = (await query('SELECT org_unit_id FROM users WHERE id = $1', [userId])).rows[0]
  return row?.org_unit_id ? String(row.org_unit_id) : ''
}

router.get('/overview', async (req: Request, res: Response) => {
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
      : await getOrgUnitIdForUser(userId)

  const userWhere = orgUnitId ? 'WHERE org_unit_id = $1 AND role = $2' : 'WHERE role = $1'
  const { rows: users } = await query(
    `SELECT id, name FROM users ${userWhere}`,
    orgUnitId ? [orgUnitId, 'member'] : ['member'],
  )

  const memberCount = users.length
  const memberIds = users.map((u) => String(u.id))

  const durationRow = (
    await query(
      `SELECT SUM(duration_ms) as s
       FROM learning_records lr
       JOIN users u ON u.id = lr.user_id
       ${orgUnitId ? 'WHERE u.org_unit_id = $1' : ''}`,
      orgUnitId ? [orgUnitId] : [],
    )
  ).rows[0]

  const durationMs = Number(durationRow?.s ?? 0)
  const durationHours = Math.round((durationMs / 3600000) * 10) / 10

  const examSummary = await loadOrgExamSummary(orgUnitId)

  const latestTask = (
    await query(
      `SELECT id FROM learning_tasks ${orgUnitId ? 'WHERE org_unit_id = $1' : ''} ORDER BY created_at DESC LIMIT 1`,
      orgUnitId ? [orgUnitId] : [],
    )
  ).rows[0]

  let completionRate = 0
  if (latestTask?.id && memberCount > 0) {
    const cids = (await loadTaskContentsMap([String(latestTask.id)])).get(String(latestTask.id)) ?? []
    const completedByUser = await loadCompletedByUserIds(memberIds)
    completionRate = completionRatePercent(memberIds, cids, completedByUser)
  }

  const { rows: orgs } = await query('SELECT id, name, parent_id FROM org_units')
  const orgNameById = new Map<string, string>()
  for (const o of orgs) orgNameById.set(String(o.id), String(o.name))

  const { rows: byOrgRows } = await query(
      `SELECT u.org_unit_id as org_unit_id, AVG(ea.total_score) as avg_score
       FROM exam_attempts ea
       JOIN users u ON u.id = ea.user_id
       WHERE u.role = 'member'
       ${orgUnitId ? 'AND u.org_unit_id = $1' : ''}
       GROUP BY u.org_unit_id`,
    orgUnitId ? [orgUnitId] : [],
  )

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
router.get('/member-scores', async (req: Request, res: Response) => {
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
      : await getOrgUnitIdForUser(userId)

  if (role === 'secretary' && !orgUnitId) {
    res.status(400).json({ success: false, error: '未绑定所属支部' })
    return
  }

  const orgName = orgUnitId
    ? String((await query('SELECT name FROM org_units WHERE id = $1', [orgUnitId])).rows[0]?.name ?? '')
    : '全部组织'

  const { rows: members } = await query(
    `SELECT id, name, username, org_unit_id, created_at
     FROM users
     WHERE ${orgUnitId ? 'org_unit_id = $1 AND ' : ''}role = 'member'
     ORDER BY name ASC`,
    orgUnitId ? [orgUnitId] : [],
  )

  const memberIds = members.map((m) => String(m.id))
  const examAgg = await loadExamAggByUserIds(memberIds)

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
router.get('/branch-dashboard', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin', 'secretary'])) {
    res.status(403).json({ success: false, error: '无权限访问' })
    return
  }

  const { role, userId } = getUserContext(req)
  const orgUnitId =
    role === 'admin'
      ? req.query.orgUnitId
        ? String(req.query.orgUnitId)
        : (await getOrgUnitIdForUser(userId)) || null
      : await getOrgUnitIdForUser(userId)

  if (!orgUnitId) {
    res.status(400).json({ success: false, error: '未指定支部（书记须绑定所属支部）' })
    return
  }

  const orgName = String(
    (await query('SELECT name FROM org_units WHERE id = $1', [orgUnitId])).rows[0]?.name ?? '',
  )

  const { rows: members } = await query(
    `SELECT id, name, username FROM users
     WHERE org_unit_id = $1 AND role = 'member'
     ORDER BY name ASC`,
    [orgUnitId],
  )

  const memberCount = members.length
  const memberIds = members.map((m) => String(m.id))

  const durationRow = (
    await query(
      `SELECT SUM(lr.duration_ms) as s
       FROM learning_records lr
       JOIN users u ON u.id = lr.user_id
       WHERE u.org_unit_id = $1 AND u.role = 'member'`,
      [orgUnitId],
    )
  ).rows[0]
  const durationMs = Number(durationRow?.s ?? 0)
  const durationHours = Math.round((durationMs / 3600000) * 10) / 10

  const examSummary = await loadOrgExamSummary(orgUnitId)

  const { rows: tasks } = await query(
    `SELECT id, title, due_at, created_at FROM learning_tasks
     WHERE org_unit_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [orgUnitId],
  )

  const completedByUser = await loadCompletedByUserIds(memberIds)
  const durationByUser = await loadDurationByUserIds(memberIds)
  const examAgg = await loadExamAggByUserIds(memberIds)
  const contentsByTask = await loadTaskContentsMap(tasks.map((t) => String(t.id)))

  const taskStats = tasks.map((t) => {
    const cids = contentsByTask.get(String(t.id)) ?? []
    const completedMemberCount = countMembersFullyDone(memberIds, cids, completedByUser)
    return {
      id: String(t.id),
      title: String(t.title),
      dueAt: toIso(t.due_at),
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
      tasks: taskStats.map((task) => ({
        id: task.id,
        title: task.title,
        dueAt: task.dueAt,
        contentCount: task.contentCount,
        completedMemberCount: task.completedMemberCount,
        completionRate: task.completionRate,
      })),
      members: memberRows,
    },
  })
})

/** 个人中心：资料、学习时长、我的成绩 */
router.get('/my-center', async (req: Request, res: Response) => {
  if (!requireRole(req, ['member', 'secretary', 'admin'])) {
    res.status(403).json({ success: false, error: '未登录' })
    return
  }

  const { userId } = getUserContext(req)
  const user = (
    await query('SELECT id, name, username, role, org_unit_id, created_at FROM users WHERE id = $1', [
      userId,
    ])
  ).rows[0]
  if (!user) {
    res.status(401).json({ success: false, error: '登录已失效' })
    return
  }

  const org = user.org_unit_id
    ? (await query('SELECT id, name FROM org_units WHERE id = $1', [String(user.org_unit_id)])).rows[0]
    : null

  const learnRow = (
    await query(
      `SELECT COALESCE(SUM(duration_ms), 0) as duration_ms,
              COALESCE(SUM(CASE WHEN is_completed = true THEN 1 ELSE 0 END), 0) as completed_count,
              COUNT(1) as record_count
       FROM learning_records WHERE user_id = $1`,
      [userId],
    )
  ).rows[0]

  const durationMs = Number(learnRow?.duration_ms ?? 0)
  const durationHours = Math.round((durationMs / 3600000) * 10) / 10
  const durationMinutes = Math.round(durationMs / 60000)
  const completedContentCount = Number(learnRow?.completed_count ?? 0)
  const recordCount = Number(learnRow?.record_count ?? 0)

  const { rows: attempts } = await query(
      `SELECT ea.id, ea.exam_id, ea.total_score, ea.is_pass, ea.created_at,
              e.title as exam_title, e.pass_score as pass_score, e.duration_min as duration_min
       FROM exam_attempts ea
       LEFT JOIN exams e ON e.id = ea.exam_id
       WHERE ea.user_id = $1
       ORDER BY ea.created_at DESC
       LIMIT 50`,
    [userId],
  )

  const attemptCount = attempts.length
  const avgScore =
    attemptCount > 0
      ? Math.round(attempts.reduce((a, b) => a + Number(b.total_score ?? 0), 0) / attemptCount)
      : null
  const passCount = attempts.filter((a) => Boolean(a.is_pass)).length
  const bestScore =
    attemptCount > 0 ? Math.max(...attempts.map((a) => Number(a.total_score ?? 0))) : null

  // 支部内按学习时长排名（党员）
  let branchRank: number | null = null
  let branchMemberCount: number | null = null
  if (user.org_unit_id && user.role === 'member') {
    const { rows: ranks } = await query(
        `SELECT u.id as user_id, COALESCE(SUM(lr.duration_ms), 0) as duration_ms
         FROM users u
         LEFT JOIN learning_records lr ON lr.user_id = u.id
         WHERE u.org_unit_id = $1 AND u.role = 'member'
         GROUP BY u.id
         ORDER BY duration_ms DESC, u.name ASC`,
      [String(user.org_unit_id)],
    )
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
        createdAt: toIso(user.created_at),
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
          isPass: Boolean(a.is_pass),
          createdAt: toIso(a.created_at),
        })),
      },
    },
  })
})

export default wrapAsyncRouter(router)
