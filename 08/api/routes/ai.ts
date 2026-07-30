import { Router, type Request, type Response } from 'express'
import { nanoid } from 'nanoid'
import { query, nowIso, audit } from '../db.js'
import { getUserContext, requireRole } from '../utils/http.js'
import { parseJson, json } from '../utils/json.js'
import { getAICache, llmText, setAICache } from '../services/llm.js'
import { wrapAsyncRouter } from '../utils/async-router.js'
import { computeEvaluation } from '../utils/evaluation.js'
import { loadExamAggByUserIds } from '../utils/aggregates.js'
import { loadLearningAggByUserIds } from '../utils/learning-records.js'
import { getAccessibleContentIds, canAccessContent } from '../utils/content-access.js'
import { hitRateLimit } from '../utils/rateLimit.js'

const router = Router()
const AI_CACHE_VERSION = 'v1'

router.use((req, res, next) => {
  const userId = req.auth?.userId
  if (!userId) {
    next()
    return
  }
  const limit = Math.max(1, Number(process.env.AI_RATE_LIMIT_MAX ?? 30))
  const windowMs = Math.max(1_000, Number(process.env.AI_RATE_LIMIT_WINDOW_MS ?? 60_000))
  const rate = hitRateLimit(`ai:${userId}`, limit, windowMs)
  if (!rate.ok) {
    res.setHeader('Retry-After', String(rate.retryAfterSec))
    res.status(429).json({ success: false, error: `AI 请求过于频繁，请 ${rate.retryAfterSec} 秒后重试` })
    return
  }
  next()
})

async function getOrgIdByName() {
  const { rows } = await query('SELECT id, name FROM org_units')
  const m = new Map<string, string>()
  for (const r of rows) m.set(String(r.name), String(r.id))
  return m
}

async function userOrgId(userId: string) {
  const row = (await query('SELECT org_unit_id FROM users WHERE id = $1', [userId])).rows[0]
  return row?.org_unit_id ? String(row.org_unit_id) : ''
}

async function topWeakCategories(userId: string) {
  const { rows } = await query(
    `SELECT q.category, COUNT(*) AS wrong_count
     FROM (
       SELECT id FROM exam_attempts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 3
     ) recent
     JOIN exam_answers ea ON ea.attempt_id = recent.id
     JOIN questions q ON q.id = ea.question_id
     WHERE ea.score = 0
     GROUP BY q.category
     ORDER BY wrong_count DESC
     LIMIT 2`,
    [userId],
  )
  const map = new Map<string, number>()
  for (const row of rows) map.set(String(row.category ?? ''), Number(row.wrong_count ?? 0))

  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
    .slice(0, 2)
}

async function completedContentIds(userId: string) {
  const { rows } = await query(
    'SELECT content_id FROM learning_records WHERE user_id = $1 AND is_completed = true',
    [userId],
  )
  return new Set(rows.map((r) => String(r.content_id)))
}

router.post('/recommend', async (req: Request, res: Response) => {
  if (!requireRole(req, ['member', 'secretary', 'admin'])) {
    res.status(403).json({ success: false, error: '未登录' })
    return
  }

  const { userId } = getUserContext(req)
  const targetUserId = userId
  const weak = await topWeakCategories(targetUserId)
  const done = await completedContentIds(targetUserId)

  const accessibleIds = await getAccessibleContentIds({ userId, role: req.auth!.role })
  const { rows } = accessibleIds.size
    ? await query(
        `SELECT id, type, title, category, tags_json, is_public
         FROM contents WHERE id = ANY($1::text[]) ORDER BY updated_at DESC`,
        [[...accessibleIds]],
      )
    : { rows: [] }

  const picks = rows
    .map((r) => ({
      id: String(r.id),
      type: String(r.type),
      title: String(r.title),
      category: String(r.category),
      tags: parseJson<string[]>(r.tags_json) ?? [],
      isPublic: Boolean(r.is_public),
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
    userId,
    prompt: `你是党校学习助手，请基于薄弱知识点（${weak.join('、') || '暂无'}）解释推荐理由，并给出 3 条学习建议。`,
    data: { weak, picks: picks.map((p) => ({ title: p.title, category: p.category, tags: p.tags })) },
  })

  await audit(targetUserId, 'ai.recommend', { weak, count: picks.length })
  res.status(200).json({ success: true, data: { weakCategories: weak, items: picks, text: explanation.text } })
})

function metricFromQuestion(q: string) {
  if (q.includes('学习时长')) return 'duration'
  if (q.includes('平均分')) return 'avg_score'
  if (q.includes('通过率')) return 'pass_rate'
  if (q.includes('完成率')) return 'completion_rate'
  return 'completion_rate'
}

async function orgFromQuestion(q: string) {
  const nameMap = await getOrgIdByName()
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
  const orgUnitIdFromQ = await orgFromQuestion(question)
  const orgUnitId = role === 'secretary' ? await userOrgId(userId) : orgUnitIdFromQ

  const { rows: orgRows } = await query(
    'SELECT id, name FROM org_units WHERE parent_id IS NOT NULL',
  )

  const series: Array<{ name: string; value: number }> = []

  for (const o of orgRows) {
    const orgId = String(o.id)
    if (orgUnitId && orgId !== orgUnitId) continue

    const { rows: members } = await query(
      'SELECT id FROM users WHERE role = $1 AND org_unit_id = $2',
      ['member', orgId],
    )

    const memberCount = members.length

    const durationRow = (
      await query(
        `SELECT SUM(lr.duration_ms) as s
         FROM learning_records lr
         JOIN users u ON u.id = lr.user_id
         WHERE u.org_unit_id = $1`,
        [orgId],
      )
    ).rows[0]
    const durationHours = Number(durationRow?.s ?? 0) / 3600000

    const { rows: examRows } = await query(
        `SELECT ea.total_score as total_score, ea.is_pass as is_pass
         FROM exam_attempts ea
         JOIN users u ON u.id = ea.user_id
         WHERE u.org_unit_id = $1`,
      [orgId],
    )

    const avgScore =
      examRows.length > 0
        ? examRows.reduce((a, b) => a + Number(b.total_score ?? 0), 0) / examRows.length
        : 0
    const passRate =
      examRows.length > 0
        ? (examRows.filter((r) => Boolean(r.is_pass)).length / examRows.length) * 100
        : 0

    let completionRate = 0
    const { rows: tasks } = await query(
      'SELECT id FROM learning_tasks WHERE org_unit_id = $1 ORDER BY created_at DESC',
      [orgId],
    )
    if (tasks.length > 0 && memberCount > 0) {
      const task = tasks[0]
      const { rows: cids } = await query(
        'SELECT content_id FROM task_contents WHERE task_id = $1',
        [String(task.id)],
      )
      const needed = cids.map((x) => String(x.content_id))
      const doneSets = await Promise.all(members.map((member) => completedContentIds(String(member.id))))
      const completedCount = doneSets.filter((done) => needed.every((cid) => done.has(cid))).length
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
    userId,
    prompt: `你是党校管理助手，请根据指标与数据给出 3 句话内结论，并给出 2 条建议。问题：${question}`,
    data: chart,
  })

  await audit(userId, 'ai.query', { question, metric, orgUnitId })
  res.status(200).json({ success: true, data: { text: summary.text, chart } })
})

router.post('/report', async (req: Request, res: Response) => {
  if (!requireRole(req, ['member', 'secretary', 'admin'])) {
    res.status(403).json({ success: false, error: '未登录' })
    return
  }

  const { userId, role } = getUserContext(req)
  const targetUserId = userId

  const [learnAggMap, examAggMap] = await Promise.all([
    loadLearningAggByUserIds([targetUserId]),
    loadExamAggByUserIds([targetUserId]),
  ])
  const learn = learnAggMap.get(targetUserId) ?? {
    durationMs: 0,
    completedContentCount: 0,
    recordCount: 0,
  }
  const exam = examAggMap.get(targetUserId)!
  const evaluation = computeEvaluation({
    durationMs: learn.durationMs,
    completedContentCount: learn.completedContentCount,
    avgExamScore: exam.avgScore,
  })

  // 支部内个人排名
  let branchRank: number | null = null
  let branchMemberCount: number | null = null
  const orgId = await userOrgId(targetUserId)
  if (orgId && role === 'member') {
    const { rows: peers } = await query(
      `SELECT id FROM users WHERE role = 'member' AND org_unit_id = $1`,
      [orgId],
    )
    const peerIds = peers.map((p) => String(p.id))
    const [peerLearn, peerExam] = await Promise.all([
      loadLearningAggByUserIds(peerIds),
      loadExamAggByUserIds(peerIds),
    ])
    const peerScores = peerIds
      .map((id) => {
        const l = peerLearn.get(id) ?? { durationMs: 0, completedContentCount: 0, recordCount: 0 }
        const e = peerExam.get(id)!
        return {
          userId: id,
          score: computeEvaluation({
            durationMs: l.durationMs,
            completedContentCount: l.completedContentCount,
            avgExamScore: e.avgScore,
          }).score,
        }
      })
      .sort((a, b) => b.score - a.score)
    branchMemberCount = peerScores.length
    const idx = peerScores.findIndex((p) => p.userId === targetUserId)
    branchRank = idx >= 0 ? idx + 1 : null
  }

  const text = await llmText({
    purpose: 'report',
    userId,
    prompt: `你是党校学习助手，请基于数据生成“评语 + 3 条改进建议（可执行）”。要求语气庄重、简洁。可提及综合排名位置（若有）。`,
    data: {
      durationHours: evaluation.metrics.durationHours,
      completedCount: evaluation.metrics.completedCount,
      avgExamScore: evaluation.metrics.avgExamScore,
      passCount: exam.passCount,
      score: evaluation.score,
      level: evaluation.level,
      branchRank,
      branchMemberCount,
    },
  })

  const report = {
    score: evaluation.score,
    level: evaluation.level,
    metrics: {
      durationHours: evaluation.metrics.durationHours,
      completedCount: evaluation.metrics.completedCount,
      avgExamScore: evaluation.metrics.avgExamScore,
      passCount: exam.passCount,
    },
    ranking: {
      branchRank,
      branchMemberCount,
    },
    parts: evaluation.parts,
    comment: text.text,
    generatedAt: nowIso(),
  }

  await query(
    `INSERT INTO ai_reports (id, user_id, report_json, created_at)
     VALUES ($1, $2, $3::jsonb, $4)`,
    [`rpt_${nanoid(12)}`, targetUserId, json(report), nowIso()],
  )

  await audit(targetUserId, 'ai.report', { score: evaluation.score, level: evaluation.level, branchRank })
  res.status(200).json({ success: true, data: report })
})

router.post('/wrong-explain', async (req: Request, res: Response) => {
  if (!requireRole(req, ['member', 'secretary', 'admin'])) {
    res.status(401).json({ success: false, error: '请先登录' })
    return
  }
  const { userId } = getUserContext(req)
  const questionId = String(req.body?.questionId ?? '').trim()
  const attemptId = req.body?.attemptId ? String(req.body.attemptId) : ''
  if (!questionId) {
    res.status(400).json({ success: false, error: '缺少 questionId' })
    return
  }

  const params: unknown[] = [userId, questionId]
  const attemptFilter = attemptId ? `AND ea.id = $${params.push(attemptId)}` : ''
  const row = (
    await query(
      `SELECT ea.id AS attempt_id, ea.created_at AS attempt_created_at,
              ans.answer_json, ans.score, q.type, q.category, q.stem,
              q.options_json, q.answer_key_json, q.updated_at,
              pq.score AS max_score
       FROM exam_attempts ea
       JOIN exam_answers ans ON ans.attempt_id = ea.id
       JOIN questions q ON q.id = ans.question_id
       JOIN exams e ON e.id = ea.exam_id
       LEFT JOIN paper_questions pq ON pq.paper_id = e.paper_id AND pq.question_id = q.id
       WHERE ea.user_id = $1 AND q.id = $2 ${attemptFilter}
         AND ans.score < COALESCE(pq.score, 1)
       ORDER BY ea.created_at DESC LIMIT 1`,
      params,
    )
  ).rows[0]
  if (!row) {
    res.status(attemptId ? 403 : 404).json({
      success: false,
      error: attemptId ? '该成绩不属于本人或此题并未答错' : '仅可讲解本人实际答错的题目',
    })
    return
  }

  const cacheKey = `wrong:${userId}:${String(row.attempt_id)}:${questionId}`
  const cached = await getAICache<Record<string, unknown>>(cacheKey, AI_CACHE_VERSION)
  if (cached) {
    await audit(userId, 'ai.wrong_explain', { questionId, attemptId: row.attempt_id, cacheHit: true })
    res.status(200).json({ success: true, data: cached })
    return
  }
  const generated = await llmText<Record<string, unknown>>({
    purpose: 'wrong-explain',
    userId,
    responseFormat: 'json',
    jsonSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['explanation', 'errorReason', 'approach', 'knowledgePoints', 'reviewTips'],
      properties: {
        explanation: { type: 'string' },
        errorReason: { type: 'string' },
        approach: { type: 'string' },
        knowledgePoints: { type: 'array', items: { type: 'string' } },
        reviewTips: { type: 'array', items: { type: 'string' } },
      },
    },
    prompt: '根据题目、标准答案和用户答案解释错误。不得改动标准答案，不得臆测题目外事实。',
    data: {
      question: {
        id: questionId,
        type: row.type,
        category: row.category,
        stem: row.stem,
        options: parseJson(row.options_json),
      },
      // pg 已将 JSONB 解码为 JS 值；字符串答案（如 "B"）不能再次 JSON.parse。
      correctAnswer: row.answer_key_json,
      userAnswer: row.answer_json,
    },
  })
  await setAICache(cacheKey, AI_CACHE_VERSION, generated.data, {
    userId,
    model: generated.model,
    sourceUpdatedAt: new Date(row.updated_at as string | Date).toISOString(),
  })
  await audit(userId, 'ai.wrong_explain', { questionId, attemptId: row.attempt_id, cacheHit: false })
  res.status(200).json({ success: true, data: generated.data })
})

router.post('/exam-feedback', async (req: Request, res: Response) => {
  if (!requireRole(req, ['member', 'secretary', 'admin'])) {
    res.status(401).json({ success: false, error: '请先登录' })
    return
  }
  const { userId } = getUserContext(req)
  const attemptId = String(req.body?.attemptId ?? '').trim()
  if (!attemptId) {
    res.status(400).json({ success: false, error: '缺少 attemptId' })
    return
  }
  const attempt = (
    await query(
      `SELECT ea.id, ea.total_score, ea.is_pass, ea.created_at, e.title, e.pass_score, e.paper_id
       FROM exam_attempts ea JOIN exams e ON e.id = ea.exam_id
       WHERE ea.id = $1 AND ea.user_id = $2`,
      [attemptId, userId],
    )
  ).rows[0]
  if (!attempt) {
    res.status(403).json({ success: false, error: '成绩不存在或不属于本人' })
    return
  }
  const answers = (
    await query(
      `SELECT ans.score, q.type, q.category, pq.score AS max_score
       FROM exam_answers ans
       JOIN questions q ON q.id = ans.question_id
       LEFT JOIN paper_questions pq ON pq.paper_id = $2 AND pq.question_id = q.id
       WHERE ans.attempt_id = $1`,
      [attemptId, String(attempt.paper_id)],
    )
  ).rows
  const wrong = answers.filter((item) => Number(item.score) < Number(item.max_score ?? 1))
  const counts = (key: 'category' | 'type') =>
    [...wrong.reduce((map, item) => {
      const value = String(item[key] ?? '未分类')
      map.set(value, (map.get(value) ?? 0) + 1)
      return map
    }, new Map<string, number>()).entries()]
      .sort((a, b) => b[1] - a[1])
  const categoryCounts = counts('category')
  const typeCounts = counts('type')
  const weakKnowledgePoints = categoryCounts.map(([name]) => name)
  const weakQuestionTypes = typeCounts.map(([name]) => name)
  const cacheKey = `exam-feedback:${userId}:${attemptId}`
  const cached = await getAICache<Record<string, unknown>>(cacheKey, AI_CACHE_VERSION)
  if (cached) {
    await audit(userId, 'ai.exam_feedback', { attemptId, cacheHit: true })
    res.status(200).json({ success: true, data: cached })
    return
  }
  const generated = await llmText<{ summary: string; suggestions: string[] }>({
    purpose: 'exam-feedback',
    userId,
    responseFormat: 'json',
    jsonSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'suggestions'],
      properties: {
        summary: { type: 'string' },
        suggestions: { type: 'array', items: { type: 'string' } },
      },
    },
    prompt: '只解释服务端给出的分数和错题统计并提出学习建议；不得重新计算或修改统计。',
    data: {
      examTitle: attempt.title,
      totalScore: Number(attempt.total_score),
      passScore: Number(attempt.pass_score),
      isPass: Boolean(attempt.is_pass),
      totalQuestionCount: answers.length,
      wrongQuestionCount: wrong.length,
      wrongCategoryCounts: categoryCounts,
      wrongQuestionTypeCounts: typeCounts,
    },
  })
  const result = {
    summary: generated.data.summary,
    weakKnowledgePoints,
    weakQuestionTypes,
    suggestions: generated.data.suggestions,
  }
  await setAICache(cacheKey, AI_CACHE_VERSION, result, { userId, model: generated.model })
  await audit(userId, 'ai.exam_feedback', { attemptId, cacheHit: false })
  res.status(200).json({ success: true, data: result })
})

router.post('/content-summary', async (req: Request, res: Response) => {
  if (!requireRole(req, ['member', 'secretary', 'admin'])) {
    res.status(401).json({ success: false, error: '请先登录' })
    return
  }
  const { userId, role } = getUserContext(req)
  const contentId = String(req.body?.contentId ?? '').trim()
  if (!contentId) {
    res.status(400).json({ success: false, error: '缺少 contentId' })
    return
  }
  if (!(await canAccessContent({ userId, role }, contentId))) {
    res.status(403).json({ success: false, error: '无权限访问该内容' })
    return
  }
  const content = (
    await query(
      `SELECT id, title, body, category, updated_at FROM contents WHERE id = $1`,
      [contentId],
    )
  ).rows[0]
  if (!content) {
    res.status(404).json({ success: false, error: '内容不存在' })
    return
  }
  const updatedAt = new Date(content.updated_at as string | Date).toISOString()
  const cacheKey = `content-summary:${contentId}:${updatedAt}`
  const cached = await getAICache<Record<string, unknown>>(cacheKey, AI_CACHE_VERSION)
  if (cached) {
    await audit(userId, 'ai.content_summary', { contentId, cacheHit: true })
    res.status(200).json({ success: true, data: cached })
    return
  }
  const generated = await llmText<Record<string, unknown>>({
    purpose: 'content-summary',
    userId,
    responseFormat: 'json',
    jsonSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'highlights', 'tips', 'quizQuestions'],
      properties: {
        summary: { type: 'string' },
        highlights: { type: 'array', items: { type: 'string' } },
        tips: { type: 'array', items: { type: 'string' } },
        quizQuestions: { type: 'array', items: { type: 'string' } },
      },
    },
    prompt: '只根据后端提供的正文生成导读、重点、学习提示和自测问题；正文不足时明确说明。',
    data: { title: content.title, category: content.category, body: content.body },
  })
  await setAICache(cacheKey, AI_CACHE_VERSION, generated.data, {
    model: generated.model,
    sourceUpdatedAt: updatedAt,
  })
  await audit(userId, 'ai.content_summary', { contentId, cacheHit: false })
  res.status(200).json({ success: true, data: generated.data })
})

export default wrapAsyncRouter(router)

