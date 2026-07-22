import { Router, type Request, type Response } from 'express'
import { nanoid } from 'nanoid'
import { db, nowIso, audit } from '../db.js'
import { getUserContext, requireRole } from '../utils/http.js'
import { parseJson, json } from '../utils/json.js'
import { llmText } from '../services/llm.js'

const router = Router()

function getOrgNameById() {
  const rows = db.prepare('SELECT id, name FROM org_units').all() as any[]
  const m = new Map<string, string>()
  for (const r of rows) m.set(String(r.id), String(r.name))
  return m
}

function getOrgIdByName() {
  const rows = db.prepare('SELECT id, name FROM org_units').all() as any[]
  const m = new Map<string, string>()
  for (const r of rows) m.set(String(r.name), String(r.id))
  return m
}

function userOrgId(userId: string) {
  const row = db.prepare('SELECT org_unit_id FROM users WHERE id = ?').get(userId) as any
  return row?.org_unit_id ? String(row.org_unit_id) : ''
}

function topWeakCategories(userId: string) {
  const attempts = db
    .prepare('SELECT id FROM exam_attempts WHERE user_id = ? ORDER BY created_at DESC LIMIT 3')
    .all(userId) as any[]

  const map = new Map<string, number>()

  for (const a of attempts) {
    const rows = db
      .prepare(
        `SELECT ea.score as score, q.category as category
         FROM exam_answers ea
         JOIN questions q ON q.id = ea.question_id
         WHERE ea.attempt_id = ?`,
      )
      .all(String(a.id)) as any[]

    for (const r of rows) {
      const score = Number(r.score ?? 0)
      if (score > 0) continue
      const c = String(r.category ?? '')
      map.set(c, (map.get(c) ?? 0) + 1)
    }
  }

  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
    .slice(0, 2)
}

function completedContentIds(userId: string) {
  const rows = db
    .prepare('SELECT content_id FROM learning_records WHERE user_id = ? AND is_completed = 1')
    .all(userId) as any[]
  return new Set(rows.map((r) => String(r.content_id)))
}

router.post('/recommend', async (req: Request, res: Response) => {
  if (!requireRole(req, ['member', 'secretary', 'admin'])) {
    res.status(403).json({ success: false, error: '未登录' })
    return
  }

  const { userId } = getUserContext(req)
  const targetUserId = String(req.body?.userId ?? userId)
  const weak = topWeakCategories(targetUserId)
  const done = completedContentIds(targetUserId)

  const rows = db
    .prepare(
      `SELECT id, type, title, category, tags_json, is_public
       FROM contents
       WHERE is_public = 1
       ORDER BY updated_at DESC`,
    )
    .all() as any[]

  const picks = rows
    .map((r) => ({
      id: String(r.id),
      type: String(r.type),
      title: String(r.title),
      category: String(r.category),
      tags: parseJson<string[]>(r.tags_json) ?? [],
      isPublic: Number(r.is_public ?? 0) === 1,
    }))
    .filter((c) => !done.has(c.id))
    .sort((a, b) => {
      const aw = weak.includes(a.category) ? 1 : 0
      const bw = weak.includes(b.category) ? 1 : 0
      return bw - aw
    })
    .slice(0, 6)

  const explanation = await llmText({
    purpose: 'recommend',
    prompt: `你是党校学习助手，请基于薄弱知识点（${weak.join('、') || '暂无'}）解释推荐理由，并给出 3 条学习建议。`,
    data: { weak, picks: picks.map((p) => ({ title: p.title, category: p.category, tags: p.tags })) },
  })

  audit(targetUserId, 'ai.recommend', { weak, count: picks.length })
  res.status(200).json({ success: true, data: { weakCategories: weak, items: picks, text: explanation.text } })
})

function metricFromQuestion(q: string) {
  if (q.includes('学习时长')) return 'duration'
  if (q.includes('平均分')) return 'avg_score'
  if (q.includes('通过率')) return 'pass_rate'
  if (q.includes('完成率')) return 'completion_rate'
  return 'completion_rate'
}

function orgFromQuestion(q: string) {
  const nameMap = getOrgIdByName()
  const hits = [...nameMap.keys()].filter((n) => q.includes(n))
  if (hits.length > 0) return nameMap.get(hits[0]) ?? null

  const m = q.match(/(一|二|三)支部/)
  if (!m) return null
  const map: Record<string, string> = { 一: '第一党支部', 二: '第二党支部', 三: '第三党支部' }
  return nameMap.get(map[m[1]] ?? '') ?? null
}

router.post('/query', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin', 'secretary'])) {
    res.status(403).json({ success: false, error: '无权限访问' })
    return
  }

  const { userId, role } = getUserContext(req)
  const question = String(req.body?.question ?? '')
  if (!question.trim()) {
    res.status(400).json({ success: false, error: '缺少 question' })
    return
  }

  const metric = metricFromQuestion(question)
  const orgUnitIdFromQ = orgFromQuestion(question)
  const orgUnitId = role === 'secretary' ? userOrgId(userId) : orgUnitIdFromQ

  const orgNameById = getOrgNameById()
  const orgRows = db.prepare('SELECT id, name FROM org_units WHERE parent_id IS NOT NULL').all() as any[]

  const series: Array<{ name: string; value: number }> = []

  for (const o of orgRows) {
    const orgId = String(o.id)
    if (orgUnitId && orgId !== orgUnitId) continue

    const members = db
      .prepare('SELECT id FROM users WHERE role = ? AND org_unit_id = ?')
      .all('member', orgId) as any[]

    const memberCount = members.length

    const durationRow = db
      .prepare(
        `SELECT SUM(lr.duration_ms) as s
         FROM learning_records lr
         JOIN users u ON u.id = lr.user_id
         WHERE u.org_unit_id = ?`,
      )
      .get(orgId) as any
    const durationHours = Number(durationRow?.s ?? 0) / 3600000

    const examRows = db
      .prepare(
        `SELECT ea.total_score as total_score, ea.is_pass as is_pass
         FROM exam_attempts ea
         JOIN users u ON u.id = ea.user_id
         WHERE u.org_unit_id = ?`,
      )
      .all(orgId) as any[]

    const avgScore =
      examRows.length > 0
        ? examRows.reduce((a, b) => a + Number(b.total_score ?? 0), 0) / examRows.length
        : 0
    const passRate =
      examRows.length > 0
        ? (examRows.filter((r) => Number(r.is_pass ?? 0) === 1).length / examRows.length) * 100
        : 0

    let completionRate = 0
    const tasks = db.prepare('SELECT id FROM learning_tasks WHERE org_unit_id = ?').all(orgId) as any[]
    if (tasks.length > 0 && memberCount > 0) {
      const task = tasks[0]
      const cids = db.prepare('SELECT content_id FROM task_contents WHERE task_id = ?').all(String(task.id)) as any[]
      const needed = cids.map((x) => String(x.content_id))
      const completedCount = members.filter((m) => {
        const s = completedContentIds(String(m.id))
        return needed.every((cid) => s.has(cid))
      }).length
      completionRate = (completedCount / memberCount) * 100
    }

    const value =
      metric === 'duration'
        ? Math.round(durationHours * 10) / 10
        : metric === 'avg_score'
          ? Math.round(avgScore)
          : metric === 'pass_rate'
            ? Math.round(passRate)
            : Math.round(completionRate)

    series.push({ name: String(o.name), value })
  }

  const chart = {
    xAxis: series.map((s) => s.name),
    values: series.map((s) => s.value),
    unit:
      metric === 'duration' ? '小时' : metric === 'avg_score' ? '分' : metric === 'pass_rate' ? '%' : '%',
    metric,
  }

  const summary = await llmText({
    purpose: 'query',
    prompt: `你是党校管理助手，请根据指标与数据给出 3 句话内结论，并给出 2 条建议。问题：${question}`,
    data: chart,
  })

  audit(userId, 'ai.query', { question, metric, orgUnitId })
  res.status(200).json({ success: true, data: { text: summary.text, chart } })
})

function scoreClamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)))
}

router.post('/report', async (req: Request, res: Response) => {
  if (!requireRole(req, ['member', 'secretary', 'admin'])) {
    res.status(403).json({ success: false, error: '未登录' })
    return
  }

  const { userId } = getUserContext(req)
  const targetUserId = String(req.body?.userId ?? userId)

  const durationRow = db
    .prepare('SELECT SUM(duration_ms) as s FROM learning_records WHERE user_id = ?')
    .get(targetUserId) as any
  const durationHours = Number(durationRow?.s ?? 0) / 3600000

  const completed = db
    .prepare('SELECT COUNT(1) as c FROM learning_records WHERE user_id = ? AND is_completed = 1')
    .get(targetUserId) as any
  const completedCount = Number(completed?.c ?? 0)

  const examRows = db
    .prepare('SELECT total_score, is_pass FROM exam_attempts WHERE user_id = ? ORDER BY created_at DESC LIMIT 3')
    .all(targetUserId) as any[]

  const avgExamScore =
    examRows.length > 0
      ? examRows.reduce((a, b) => a + Number(b.total_score ?? 0), 0) / examRows.length
      : 0

  const passCount = examRows.filter((r) => Number(r.is_pass ?? 0) === 1).length

  const score =
    scoreClamp(Math.min(20, durationHours * 5)) +
    scoreClamp(Math.min(20, completedCount * 5)) +
    scoreClamp(Math.min(60, avgExamScore * 0.6))

  const level = score >= 85 ? '优秀' : score >= 70 ? '良好' : score >= 55 ? '合格' : '需加强'

  const text = await llmText({
    purpose: 'report',
    prompt: `你是党校学习助手，请基于数据生成“评语 + 3 条改进建议（可执行）”。要求语气庄重、简洁。`,
    data: {
      durationHours: Math.round(durationHours * 10) / 10,
      completedCount,
      avgExamScore: Math.round(avgExamScore),
      passCount,
      score,
      level,
    },
  })

  const report = {
    score,
    level,
    metrics: {
      durationHours: Math.round(durationHours * 10) / 10,
      completedCount,
      avgExamScore: Math.round(avgExamScore),
      passCount,
    },
    comment: text.text,
    generatedAt: nowIso(),
  }

  db.prepare('INSERT INTO ai_reports (id, user_id, report_json, created_at) VALUES (?, ?, ?, ?)')
    .run(`rpt_${nanoid(12)}`, targetUserId, json(report), nowIso())

  audit(targetUserId, 'ai.report', { score, level })
  res.status(200).json({ success: true, data: report })
})

export default router

