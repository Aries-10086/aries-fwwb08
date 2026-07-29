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
import { loadLearningAggByUserIds } from '../utils/learning-records.js'
import { assignRanks, computeEvaluation } from '../utils/evaluation.js'
import { parseStatsRange, type TimeRange } from '../utils/time-range.js'

const router = Router()

async function getOrgUnitIdForUser(userId: string) {
  const row = (await query('SELECT org_unit_id FROM users WHERE id = $1', [userId])).rows[0]
  return row?.org_unit_id ? String(row.org_unit_id) : ''
}

/** 构建党员综合评价排行（时长 + 完成数 + 测验均分） */
async function buildMemberEvaluationRanking(
  orgUnitId: string | null,
  limit = 50,
  range?: TimeRange,
) {
  const { rows: members } = await query(
    `SELECT u.id, u.name, u.username, u.org_unit_id, o.name AS org_name
     FROM users u
     LEFT JOIN org_units o ON o.id = u.org_unit_id
     WHERE u.role = 'member' ${orgUnitId ? 'AND u.org_unit_id = $1' : ''}
     ORDER BY u.name ASC`,
    orgUnitId ? [orgUnitId] : [],
  )

  const memberIds = members.map((m) => String(m.id))
  const time = range?.from && range?.to ? { from: range.from, to: range.to } : undefined
  const [learnAgg, examAgg] = await Promise.all([
    loadLearningAggByUserIds(memberIds, time),
    loadExamAggByUserIds(memberIds, time),
  ])

  const scored = members.map((m) => {
    const uid = String(m.id)
    const learn = learnAgg.get(uid) ?? { durationMs: 0, completedContentCount: 0, recordCount: 0 }
    const exam = examAgg.get(uid)!
    const evaluation = computeEvaluation({
      durationMs: learn.durationMs,
      completedContentCount: learn.completedContentCount,
      avgExamScore: exam.avgScore,
    })
    return {
      userId: uid,
      name: String(m.name),
      username: String(m.username ?? ''),
      orgUnitId: String(m.org_unit_id),
      orgName: m.org_name ? String(m.org_name) : '',
      score: evaluation.score,
      level: evaluation.level,
      parts: evaluation.parts,
      durationHours: evaluation.metrics.durationHours,
      completedContentCount: evaluation.metrics.completedCount,
      avgExamScore: exam.avgScore,
      attemptCount: exam.attemptCount,
      passRate: exam.passRate,
    }
  })

  const ranked = assignRanks(scored).sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    if (b.durationHours !== a.durationHours) return b.durationHours - a.durationHours
    return a.name.localeCompare(b.name, 'zh')
  })

  return {
    orgUnitId,
    memberCount: ranked.length,
    members: limit > 0 ? ranked.slice(0, limit) : ranked,
    all: ranked,
  }
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

  const range = parseStatsRange(req.query.range)
  const time = range.from && range.to ? { from: range.from, to: range.to } : undefined

  const userWhere = orgUnitId ? 'WHERE org_unit_id = $1 AND role = $2' : 'WHERE role = $1'
  const { rows: users } = await query(
    `SELECT id, name FROM users ${userWhere}`,
    orgUnitId ? [orgUnitId, 'member'] : ['member'],
  )

  const memberCount = users.length
  const memberIds = users.map((u) => String(u.id))

  const durationParams: unknown[] = []
  let durationWhere = ''
  if (orgUnitId) {
    durationParams.push(orgUnitId)
    durationWhere = 'WHERE u.org_unit_id = $1'
  }
  if (time) {
    durationParams.push(time.from!.toISOString(), time.to!.toISOString())
    const fromIdx = durationParams.length - 1
    const toIdx = durationParams.length
    durationWhere += durationWhere ? ' AND' : 'WHERE'
    durationWhere += ` lr.updated_at >= $${fromIdx}::timestamptz AND lr.updated_at < $${toIdx}::timestamptz`
  }

  const durationRow = (
    await query(
      `SELECT SUM(duration_ms) as s
       FROM learning_records lr
       JOIN users u ON u.id = lr.user_id
       ${durationWhere}`,
      durationParams,
    )
  ).rows[0]

  const durationMs = Number(durationRow?.s ?? 0)
  const durationHours = Math.round((durationMs / 3600000) * 10) / 10

  const examSummary = await loadOrgExamSummary(orgUnitId, time)

  const latestTask = (
    await query(
      `SELECT id FROM learning_tasks ${orgUnitId ? 'WHERE org_unit_id = $1' : ''} ORDER BY created_at DESC LIMIT 1`,
      orgUnitId ? [orgUnitId] : [],
    )
  ).rows[0]

  let completionRate = 0
  if (latestTask?.id && memberCount > 0) {
    const cids = (await loadTaskContentsMap([String(latestTask.id)])).get(String(latestTask.id)) ?? []
    const completedByUser = await loadCompletedByUserIds(memberIds, time)
    completionRate = completionRatePercent(memberIds, cids, completedByUser)
  }

  const { rows: orgs } = await query('SELECT id, name, parent_id FROM org_units')
  const orgNameById = new Map<string, string>()
  for (const o of orgs) orgNameById.set(String(o.id), String(o.name))

  const byOrgParams: unknown[] = []
  let byOrgWhere = `WHERE u.role = 'member'`
  if (orgUnitId) {
    byOrgParams.push(orgUnitId)
    byOrgWhere += ` AND u.org_unit_id = $${byOrgParams.length}`
  }
  if (time) {
    byOrgParams.push(time.from!.toISOString(), time.to!.toISOString())
    byOrgWhere += ` AND ea.created_at >= $${byOrgParams.length - 1}::timestamptz AND ea.created_at < $${byOrgParams.length}::timestamptz`
  }

  const { rows: byOrgRows } = await query(
    `SELECT u.org_unit_id as org_unit_id, AVG(ea.total_score) as avg_score, COUNT(1) as attempt_count
     FROM exam_attempts ea
     JOIN users u ON u.id = ea.user_id
     ${byOrgWhere}
     GROUP BY u.org_unit_id`,
    byOrgParams,
  )

  const rank = byOrgRows
    .map((r) => ({
      orgUnitId: String(r.org_unit_id),
      orgName: orgNameById.get(String(r.org_unit_id)) ?? String(r.org_unit_id),
      avgScore: Math.round(Number(r.avg_score ?? 0)),
      attemptCount: Number(r.attempt_count ?? 0),
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 10)

  const memberRanking = await buildMemberEvaluationRanking(orgUnitId, 50, range)

  res.status(200).json({
    success: true,
    data: {
      orgUnitId,
      range: range.key,
      rangeLabel: range.label,
      rangeFrom: range.from ? range.from.toISOString() : null,
      rangeTo: range.to ? range.to.toISOString() : null,
      memberCount,
      durationHours,
      avgExamScore: examSummary.avgExamScore,
      passRate: examSummary.passRate,
      latestTaskCompletionRate: completionRate,
      rank,
      memberRank: memberRanking.members.map((m) => ({
        userId: m.userId,
        name: m.name,
        username: m.username,
        orgUnitId: m.orgUnitId,
        orgName: m.orgName,
        rank: m.rank,
        score: m.score,
        level: m.level,
        durationHours: m.durationHours,
        completedContentCount: m.completedContentCount,
        avgExamScore: m.avgExamScore,
        attemptCount: m.attemptCount,
        passRate: m.passRate,
      })),
    },
  })
})

/** 党员综合评价排行榜（个人维度） */
router.get('/member-ranking', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin', 'secretary', 'member'])) {
    res.status(403).json({ success: false, error: '未登录' })
    return
  }

  const { role, userId } = getUserContext(req)
  let orgUnitId: string | null = null
  if (role === 'admin') {
    orgUnitId = req.query.orgUnitId ? String(req.query.orgUnitId) : null
  } else {
    orgUnitId = (await getOrgUnitIdForUser(userId)) || null
    if (!orgUnitId) {
      res.status(400).json({ success: false, error: '未绑定所属支部' })
      return
    }
  }

  const limitRaw = req.query.limit ? Number(req.query.limit) : 50
  const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.floor(limitRaw))) : 50
  const ranking = await buildMemberEvaluationRanking(orgUnitId, limit)

  const orgName = orgUnitId
    ? String((await query('SELECT name FROM org_units WHERE id = $1', [orgUnitId])).rows[0]?.name ?? '')
    : '全部组织'

  const me = ranking.all.find((m) => m.userId === userId) ?? null

  res.status(200).json({
    success: true,
    data: {
      orgUnitId,
      orgName,
      memberCount: ranking.memberCount,
      formula: '时长≤20 + 完成内容≤20 + 测验均分×0.6≤60',
      me: me
        ? {
            userId: me.userId,
            rank: me.rank,
            score: me.score,
            level: me.level,
            durationHours: me.durationHours,
            completedContentCount: me.completedContentCount,
            avgExamScore: me.avgExamScore,
          }
        : null,
      members: ranking.members,
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
  const [examAgg, ranking] = await Promise.all([
    loadExamAggByUserIds(memberIds),
    buildMemberEvaluationRanking(orgUnitId, 0),
  ])
  const evalByUser = new Map(ranking.all.map((m) => [m.userId, m]))

  const list = members.map((m) => {
    const uid = String(m.id)
    const agg = examAgg.get(uid)!
    const ev = evalByUser.get(uid)
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
      evalScore: ev?.score ?? 0,
      evalLevel: ev?.level ?? '需加强',
      evalRank: ev?.rank ?? null,
      durationHours: ev?.durationHours ?? 0,
      completedContentCount: ev?.completedContentCount ?? 0,
    }
  })

  list.sort((a, b) => {
    if ((a.evalRank ?? 9999) !== (b.evalRank ?? 9999)) return (a.evalRank ?? 9999) - (b.evalRank ?? 9999)
    return b.evalScore - a.evalScore
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
  const avgDurationHours =
    memberCount > 0 ? Math.round((durationHours / memberCount) * 10) / 10 : 0

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

  const memberNameById = new Map(members.map((m) => [String(m.id), String(m.name)]))
  const taskStats = tasks.map((t) => {
    const cids = contentsByTask.get(String(t.id)) ?? []
    const completedIds =
      cids.length === 0
        ? []
        : memberIds.filter((uid) => {
            const done = completedByUser.get(uid) ?? new Set<string>()
            return cids.every((cid) => done.has(cid))
          })
    const pendingIds = memberIds.filter((uid) => !completedIds.includes(uid))
    const completedMemberCount = completedIds.length
    return {
      id: String(t.id),
      title: String(t.title),
      dueAt: toIso(t.due_at),
      contentIds: cids,
      contentCount: cids.length,
      completedMemberCount,
      completionRate: memberCount > 0 ? Math.round((completedMemberCount / memberCount) * 100) : 0,
      completedMembers: completedIds.map((uid) => ({
        userId: uid,
        name: memberNameById.get(uid) ?? uid,
      })),
      pendingMembers: pendingIds.map((uid) => ({
        userId: uid,
        name: memberNameById.get(uid) ?? uid,
      })),
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

  // 支部薄弱知识点 / 高频错题（便于书记讲评）
  const wrongWhere = `
    u.org_unit_id = $1 AND u.role = 'member'
    AND (COALESCE(pq.score, 0) = 0 OR ea.score < COALESCE(pq.score, 0))
  `
  const { rows: weakRows } = await query(
    `SELECT q.category,
            COUNT(*)::int AS wrong_count,
            COUNT(DISTINCT att.user_id)::int AS member_count
     FROM exam_attempts att
     JOIN users u ON u.id = att.user_id
     JOIN exam_answers ea ON ea.attempt_id = att.id
     JOIN exams e ON e.id = att.exam_id
     JOIN questions q ON q.id = ea.question_id
     LEFT JOIN paper_questions pq ON pq.paper_id = e.paper_id AND pq.question_id = ea.question_id
     WHERE ${wrongWhere}
     GROUP BY q.category
     ORDER BY wrong_count DESC, q.category ASC
     LIMIT 8`,
    [orgUnitId],
  )
  const totalWrong = weakRows.reduce((s, r) => s + Number(r.wrong_count ?? 0), 0)
  const weakCategories = weakRows.map((r) => {
    const wrongCount = Number(r.wrong_count ?? 0)
    return {
      category: String(r.category ?? '未分类') || '未分类',
      wrongCount,
      memberCount: Number(r.member_count ?? 0),
      sharePercent: totalWrong > 0 ? Math.round((wrongCount / totalWrong) * 100) : 0,
    }
  })

  const { rows: wrongTopRows } = await query(
    `SELECT q.id AS question_id, q.stem, q.category, q.type,
            COUNT(*)::int AS wrong_count,
            COUNT(DISTINCT att.user_id)::int AS member_count
     FROM exam_attempts att
     JOIN users u ON u.id = att.user_id
     JOIN exam_answers ea ON ea.attempt_id = att.id
     JOIN exams e ON e.id = att.exam_id
     JOIN questions q ON q.id = ea.question_id
     LEFT JOIN paper_questions pq ON pq.paper_id = e.paper_id AND pq.question_id = ea.question_id
     WHERE ${wrongWhere}
     GROUP BY q.id, q.stem, q.category, q.type
     ORDER BY wrong_count DESC, member_count DESC
     LIMIT 8`,
    [orgUnitId],
  )
  const wrongTop = wrongTopRows.map((r) => ({
    questionId: String(r.question_id),
    stem: String(r.stem ?? ''),
    category: String(r.category ?? '未分类') || '未分类',
    type: String(r.type ?? ''),
    wrongCount: Number(r.wrong_count ?? 0),
    memberCount: Number(r.member_count ?? 0),
  }))

  res.status(200).json({
    success: true,
    data: {
      orgUnitId,
      orgName,
      summary: {
        memberCount,
        durationHours,
        avgDurationHours,
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
        completedMembers: task.completedMembers,
        pendingMembers: task.pendingMembers,
      })),
      members: memberRows,
      weakCategories,
      wrongTop,
    },
  })
})

/** 支部各次测验成绩矩阵 + 未参与人员 */
router.get('/branch-exams', async (req: Request, res: Response) => {
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

  const { rows: exams } = await query(
    `SELECT id, title, pass_score, status, created_at
     FROM exams
     WHERE org_unit_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [orgUnitId],
  )

  const examIds = exams.map((e) => String(e.id))
  const latestByExamUser = new Map<string, Map<string, { score: number; isPass: boolean; at: string | null; attemptId: string }>>()

  if (examIds.length > 0 && members.length > 0) {
    const placeholders = examIds.map((_, i) => `$${i + 1}`).join(',')
    const { rows: attempts } = await query(
      `SELECT DISTINCT ON (att.exam_id, att.user_id)
              att.id, att.exam_id, att.user_id, att.total_score, att.submitted_at, e.pass_score
       FROM exam_attempts att
       JOIN exams e ON e.id = att.exam_id
       WHERE att.exam_id IN (${placeholders})
         AND att.submitted_at IS NOT NULL
       ORDER BY att.exam_id, att.user_id, att.submitted_at DESC`,
      examIds,
    )
    for (const a of attempts) {
      const examId = String(a.exam_id)
      const uid = String(a.user_id)
      let byUser = latestByExamUser.get(examId)
      if (!byUser) {
        byUser = new Map()
        latestByExamUser.set(examId, byUser)
      }
      const score = Math.round(Number(a.total_score ?? 0))
      const passScore = Number(a.pass_score ?? 60)
      byUser.set(uid, {
        score,
        isPass: score >= passScore,
        at: toIso(a.submitted_at),
        attemptId: String(a.id),
      })
    }
  }

  const list = exams.map((e) => {
    const examId = String(e.id)
    const byUser = latestByExamUser.get(examId) ?? new Map()
    const attempted: Array<{
      userId: string
      name: string
      username: string
      score: number
      isPass: boolean
      submittedAt: string | null
      attemptId: string
    }> = []
    const notAttempted: Array<{ userId: string; name: string; username: string }> = []

    for (const m of members) {
      const uid = String(m.id)
      const hit = byUser.get(uid)
      if (hit) {
        attempted.push({
          userId: uid,
          name: String(m.name),
          username: String(m.username ?? ''),
          score: hit.score,
          isPass: hit.isPass,
          submittedAt: hit.at,
          attemptId: hit.attemptId,
        })
      } else {
        notAttempted.push({
          userId: uid,
          name: String(m.name),
          username: String(m.username ?? ''),
        })
      }
    }

    attempted.sort((a, b) => b.score - a.score)
    const avgScore =
      attempted.length > 0
        ? Math.round(attempted.reduce((s, x) => s + x.score, 0) / attempted.length)
        : 0
    const passCount = attempted.filter((x) => x.isPass).length

    return {
      examId,
      title: String(e.title),
      passScore: Number(e.pass_score ?? 60),
      status: String(e.status),
      createdAt: toIso(e.created_at),
      memberCount: members.length,
      attemptedCount: attempted.length,
      notAttemptedCount: notAttempted.length,
      avgScore,
      passRate: attempted.length > 0 ? Math.round((passCount / attempted.length) * 100) : 0,
      attempted,
      notAttempted,
    }
  })

  res.status(200).json({
    success: true,
    data: {
      orgUnitId,
      orgName,
      exams: list,
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

  const learnAgg = (await loadLearningAggByUserIds([userId])).get(userId) ?? {
    durationMs: 0,
    completedContentCount: 0,
    recordCount: 0,
  }

  const durationMs = learnAgg.durationMs
  const durationHours = Math.round((durationMs / 3600000) * 10) / 10
  const durationMinutes = Math.round(durationMs / 60000)
  const completedContentCount = learnAgg.completedContentCount
  const recordCount = learnAgg.recordCount

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
  // 支部内综合评价排名
  let evalRank: number | null = null
  let evalScore: number | null = null
  let evalLevel: string | null = null
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

    const ranking = await buildMemberEvaluationRanking(String(user.org_unit_id), 0)
    branchMemberCount = ranking.memberCount
    const me = ranking.all.find((m) => m.userId === userId)
    if (me) {
      evalRank = me.rank
      evalScore = me.score
      evalLevel = me.level
    }
  } else {
    const selfEval = computeEvaluation({
      durationMs,
      completedContentCount,
      avgExamScore: avgScore,
    })
    evalScore = selfEval.score
    evalLevel = selfEval.level
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
      evaluation: {
        score: evalScore,
        level: evalLevel,
        rank: evalRank,
        memberCount: branchMemberCount,
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
