import { Router, type Request, type Response } from 'express'
import { nanoid } from 'nanoid'
import { db, nowIso, audit } from '../db.js'
import { getUserContext, requireAuth, requireRole, rejectUnauthorized } from '../utils/http.js'
import { parseJson, json } from '../utils/json.js'
import type { QuestionType } from '../../shared/types.js'

const router = Router()
const SUBMIT_GRACE_MS = 60_000
const DEFAULT_MAX_ATTEMPTS = 3

function getOrgUnitIdForUser(userId: string) {
  const row = db.prepare('SELECT org_unit_id FROM users WHERE id = ?').get(userId) as any
  return row?.org_unit_id ? String(row.org_unit_id) : ''
}

function getMaxAttempts(exam: any) {
  const n = Number(exam?.max_attempts ?? DEFAULT_MAX_ATTEMPTS)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MAX_ATTEMPTS
}

function countAttempts(examId: string, userId: string) {
  const row = db
    .prepare('SELECT COUNT(1) as c FROM exam_attempts WHERE exam_id = ? AND user_id = ?')
    .get(examId, userId) as { c: number }
  return Number(row?.c ?? 0)
}

function listAttempts(examId: string, userId: string) {
  const rows = db
    .prepare(
      `SELECT id, total_score, is_pass, created_at FROM exam_attempts
       WHERE exam_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 20`,
    )
    .all(examId, userId) as any[]
  return rows.map((r) => ({
    id: r.id,
    totalScore: Number(r.total_score ?? 0),
    isPass: Number(r.is_pass ?? 0) === 1,
    createdAt: r.created_at,
  }))
}

function assertExamAccess(exam: any, role: string, userId: string) {
  if (role === 'admin') return { ok: true as const }
  const orgUnitId = getOrgUnitIdForUser(userId)
  if (!orgUnitId || String(exam.org_unit_id) !== orgUnitId) {
    return { ok: false as const, status: 403, error: '无权限访问该测验（支部不匹配）' }
  }
  if (String(exam.status) !== 'published') {
    return { ok: false as const, status: 403, error: '测验未发布或已关闭' }
  }
  return { ok: true as const }
}

function getPaperWithQuestions(paperId: string) {
  const paper = db
    .prepare('SELECT id, title, duration_min, pass_score FROM papers WHERE id = ?')
    .get(paperId) as any
  if (!paper) return null

  const pqs = db
    .prepare(
      `SELECT pq.question_id, pq.score, pq.order_no, q.type, q.category, q.stem, q.options_json
       FROM paper_questions pq
       JOIN questions q ON q.id = pq.question_id
       WHERE pq.paper_id = ?
       ORDER BY pq.order_no ASC`,
    )
    .all(paperId) as any[]

  return {
    id: paper.id,
    title: paper.title,
    durationMin: Number(paper.duration_min ?? 0),
    passScore: Number(paper.pass_score ?? 0),
    questions: pqs.map((r) => ({
      id: r.question_id,
      type: r.type as QuestionType,
      category: r.category,
      stem: r.stem,
      options: parseJson(r.options_json),
      score: Number(r.score ?? 0),
      orderNo: Number(r.order_no ?? 0),
    })),
  }
}

function mapExamRow(r: any, extra?: Record<string, unknown>) {
  return {
    id: r.id,
    orgUnitId: r.org_unit_id,
    paperId: r.paper_id,
    title: r.title,
    durationMin: Number(r.duration_min ?? 0),
    passScore: Number(r.pass_score ?? 0),
    maxAttempts: getMaxAttempts(r),
    status: r.status,
    createdAt: r.created_at,
    ...extra,
  }
}

router.get('/', (req: Request, res: Response) => {
  if (!requireAuth(req)) {
    rejectUnauthorized(res)
    return
  }

  const { role, userId } = getUserContext(req)

  if (role === 'admin') {
    const rows = db
      .prepare(
        'SELECT id, org_unit_id, paper_id, title, duration_min, pass_score, max_attempts, status, created_at FROM exams ORDER BY created_at DESC',
      )
      .all() as any[]
    res.status(200).json({ success: true, data: rows.map((r) => mapExamRow(r)) })
    return
  }

  if (role === 'member' || role === 'secretary') {
    const orgUnitId = getOrgUnitIdForUser(userId)
    const rows = db
      .prepare(
        'SELECT id, org_unit_id, paper_id, title, duration_min, pass_score, max_attempts, status, created_at FROM exams WHERE org_unit_id = ? AND status = ? ORDER BY created_at DESC',
      )
      .all(orgUnitId, 'published') as any[]
    res.status(200).json({
      success: true,
      data: rows.map((r) => {
        const attemptCount = countAttempts(String(r.id), userId)
        const maxAttempts = getMaxAttempts(r)
        const attempts = listAttempts(String(r.id), userId)
        const bestScore = attempts.reduce((m, a) => Math.max(m, a.totalScore), 0)
        return mapExamRow(r, {
          attemptCount,
          remainingAttempts: Math.max(0, maxAttempts - attemptCount),
          canAttempt: attemptCount < maxAttempts,
          bestScore: attempts.length ? bestScore : null,
          attempts,
        })
      }),
    })
    return
  }

  res.status(403).json({ success: false, error: '未登录' })
})

router.get('/:id', (req: Request, res: Response) => {
  if (!requireAuth(req)) {
    rejectUnauthorized(res)
    return
  }

  const { role, userId } = getUserContext(req)
  const id = String(req.params.id)

  const exam = db
    .prepare(
      'SELECT id, org_unit_id, paper_id, title, duration_min, pass_score, max_attempts, status, created_at FROM exams WHERE id = ?',
    )
    .get(id) as any

  if (!exam) {
    res.status(404).json({ success: false, error: '测验不存在' })
    return
  }

  const access = assertExamAccess(exam, role, userId)
  if (!access.ok) {
    res.status(access.status).json({ success: false, error: access.error })
    return
  }

  const attemptCount = countAttempts(id, userId)
  const maxAttempts = getMaxAttempts(exam)
  const paper = getPaperWithQuestions(String(exam.paper_id))
  res.status(200).json({
    success: true,
    data: {
      ...mapExamRow(exam, {
        attemptCount,
        remainingAttempts: Math.max(0, maxAttempts - attemptCount),
        canAttempt: attemptCount < maxAttempts,
        attempts: listAttempts(id, userId),
      }),
      paper,
    },
  })
})

router.post('/', (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const ts = nowIso()
  const id = `exam_${nanoid(10)}`
  const maxAttempts = Math.max(1, Number(req.body?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS) || DEFAULT_MAX_ATTEMPTS)

  db.prepare(
    'INSERT INTO exams (id, org_unit_id, paper_id, title, duration_min, pass_score, status, created_at, max_attempts) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    id,
    String(req.body?.orgUnitId ?? ''),
    String(req.body?.paperId ?? ''),
    String(req.body?.title ?? ''),
    Number(req.body?.durationMin ?? 10),
    Number(req.body?.passScore ?? 60),
    String(req.body?.status ?? 'draft'),
    ts,
    maxAttempts,
  )

  audit(userId || 'u_admin_demo', 'exams.create', { id })
  res.status(200).json({ success: true, data: { id } })
})

router.put('/:id', (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = String(req.params.id)
  const maxAttempts = Math.max(1, Number(req.body?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS) || DEFAULT_MAX_ATTEMPTS)

  db.prepare(
    'UPDATE exams SET org_unit_id = ?, paper_id = ?, title = ?, duration_min = ?, pass_score = ?, status = ?, max_attempts = ? WHERE id = ?',
  ).run(
    String(req.body?.orgUnitId ?? ''),
    String(req.body?.paperId ?? ''),
    String(req.body?.title ?? ''),
    Number(req.body?.durationMin ?? 10),
    Number(req.body?.passScore ?? 60),
    String(req.body?.status ?? 'draft'),
    maxAttempts,
    id,
  )

  audit(userId || 'u_admin_demo', 'exams.update', { id })
  res.status(200).json({ success: true })
})

router.delete('/:id', (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = String(req.params.id)
  const exists = db.prepare('SELECT id FROM exams WHERE id = ?').get(id)
  if (!exists) {
    res.status(404).json({ success: false, error: '测验不存在' })
    return
  }

  db.prepare(
    'DELETE FROM exam_answers WHERE attempt_id IN (SELECT id FROM exam_attempts WHERE exam_id = ?)',
  ).run(id)
  db.prepare('DELETE FROM exam_attempts WHERE exam_id = ?').run(id)
  db.prepare('DELETE FROM exam_sessions WHERE exam_id = ?').run(id)
  db.prepare('DELETE FROM exams WHERE id = ?').run(id)

  audit(userId || 'u_admin_demo', 'exams.delete', { id })
  res.status(200).json({ success: true })
})

/** 开始作答：创建服务端会话，用于倒计时与超时校验 */
router.post('/:id/start', (req: Request, res: Response) => {
  if (!requireRole(req, ['member', 'secretary', 'admin'])) {
    res.status(403).json({ success: false, error: '未登录' })
    return
  }

  const { userId, role } = getUserContext(req)
  const examId = String(req.params.id)
  const exam = db
    .prepare(
      'SELECT id, org_unit_id, paper_id, title, duration_min, pass_score, max_attempts, status, created_at FROM exams WHERE id = ?',
    )
    .get(examId) as any

  if (!exam) {
    res.status(404).json({ success: false, error: '测验不存在' })
    return
  }

  const access = assertExamAccess(exam, role, userId)
  if (!access.ok) {
    res.status(access.status).json({ success: false, error: access.error })
    return
  }

  const attemptCount = countAttempts(examId, userId)
  const maxAttempts = getMaxAttempts(exam)
  if (attemptCount >= maxAttempts) {
    res.status(400).json({ success: false, error: `已达最大作答次数（${maxAttempts} 次）` })
    return
  }

  const open = db
    .prepare(
      'SELECT id, started_at FROM exam_sessions WHERE exam_id = ? AND user_id = ? AND submitted = 0 ORDER BY started_at DESC LIMIT 1',
    )
    .get(examId, userId) as any

  const durationMin = Number(exam.duration_min ?? 10)
  if (open?.id) {
    const startedAt = String(open.started_at)
    const expiresAt = new Date(new Date(startedAt).getTime() + durationMin * 60_000).toISOString()
    res.status(200).json({
      success: true,
      data: { sessionId: open.id, startedAt, expiresAt, durationMin, attemptCount, maxAttempts },
    })
    return
  }

  const sessionId = `es_${nanoid(12)}`
  const startedAt = nowIso()
  db.prepare(
    'INSERT INTO exam_sessions (id, exam_id, user_id, started_at, submitted) VALUES (?, ?, ?, ?, 0)',
  ).run(sessionId, examId, userId, startedAt)

  const expiresAt = new Date(new Date(startedAt).getTime() + durationMin * 60_000).toISOString()
  audit(userId, 'exam.start', { examId, sessionId })
  res.status(200).json({
    success: true,
    data: { sessionId, startedAt, expiresAt, durationMin, attemptCount, maxAttempts },
  })
})

router.post('/:id/submit', (req: Request, res: Response) => {
  if (!requireRole(req, ['member', 'secretary', 'admin'])) {
    res.status(403).json({ success: false, error: '未登录' })
    return
  }

  const { userId, role } = getUserContext(req)
  const examId = String(req.params.id)
  const sessionId = String(req.body?.sessionId ?? '')

  const exam = db
    .prepare(
      'SELECT id, org_unit_id, paper_id, duration_min, pass_score, max_attempts, status FROM exams WHERE id = ?',
    )
    .get(examId) as any

  if (!exam) {
    res.status(404).json({ success: false, error: '测验不存在' })
    return
  }

  const access = assertExamAccess(exam, role, userId)
  if (!access.ok) {
    res.status(access.status).json({ success: false, error: access.error })
    return
  }

  const attemptCount = countAttempts(examId, userId)
  const maxAttempts = getMaxAttempts(exam)
  if (attemptCount >= maxAttempts) {
    res.status(400).json({ success: false, error: `已达最大作答次数（${maxAttempts} 次）` })
    return
  }

  if (!sessionId) {
    res.status(400).json({ success: false, error: '缺少作答会话，请重新进入测验' })
    return
  }

  const session = db
    .prepare(
      'SELECT id, exam_id, user_id, started_at, submitted FROM exam_sessions WHERE id = ?',
    )
    .get(sessionId) as any

  if (!session || String(session.exam_id) !== examId || String(session.user_id) !== userId) {
    res.status(400).json({ success: false, error: '作答会话无效' })
    return
  }
  if (Number(session.submitted) === 1) {
    res.status(400).json({ success: false, error: '该会话已交卷' })
    return
  }

  const startedMs = new Date(String(session.started_at)).getTime()
  const durationMs = Number(exam.duration_min ?? 10) * 60_000
  const elapsed = Date.now() - startedMs
  if (!Number.isFinite(startedMs) || elapsed < 0) {
    res.status(400).json({ success: false, error: '作答开始时间无效' })
    return
  }
  if (elapsed > durationMs + SUBMIT_GRACE_MS) {
    res.status(400).json({ success: false, error: '已超过考试时限，无法交卷' })
    return
  }

  const paper = getPaperWithQuestions(String(exam.paper_id))
  if (!paper) {
    res.status(400).json({ success: false, error: '试卷不存在' })
    return
  }

  const submitted: Record<string, any> = req.body?.answers ?? {}

  let totalScore = 0
  const details: Array<{ questionId: string; score: number; maxScore: number }> = []

  for (const q of paper.questions) {
    const answer = submitted[q.id]
    const row = db.prepare('SELECT answer_key_json FROM questions WHERE id = ?').get(q.id) as any
    const expected = parseJson<any>(row?.answer_key_json ?? null)

    let score = 0
    if (q.type === 'single') {
      score = expected && answer && String(expected) === String(answer) ? q.score : 0
    } else if (q.type === 'tf') {
      score = typeof expected === 'boolean' && typeof answer === 'boolean' && expected === answer ? q.score : 0
    } else if (q.type === 'multiple') {
      const exp = Array.isArray(expected) ? expected.map(String).sort().join('|') : ''
      const got = Array.isArray(answer) ? answer.map(String).sort().join('|') : ''
      score = exp && got && exp === got ? q.score : 0
    }

    totalScore += score
    details.push({ questionId: q.id, score, maxScore: q.score })
  }

  const passScore = Number(exam.pass_score ?? paper.passScore ?? 60)
  const isPass = totalScore >= passScore
  const attemptId = `attempt_${nanoid(12)}`
  const ts = nowIso()

  const tx = db.transaction(() => {
    db.prepare(
      'INSERT INTO exam_attempts (id, exam_id, user_id, total_score, is_pass, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(attemptId, examId, userId, totalScore, isPass ? 1 : 0, ts)

    const ansInsert = db.prepare(
      'INSERT INTO exam_answers (id, attempt_id, question_id, answer_json, score) VALUES (?, ?, ?, ?, ?)',
    )
    for (const d of details) {
      ansInsert.run(`ea_${nanoid(12)}`, attemptId, d.questionId, json(submitted[d.questionId] ?? null), d.score)
    }
    db.prepare('UPDATE exam_sessions SET submitted = 1 WHERE id = ?').run(sessionId)
  })
  tx()

  audit(userId, 'exam.submit', { examId, totalScore, isPass, sessionId })
  res.status(200).json({
    success: true,
    data: {
      attemptId,
      totalScore,
      passScore,
      isPass,
      details,
      attemptCount: attemptCount + 1,
      remainingAttempts: Math.max(0, maxAttempts - attemptCount - 1),
    },
  })
})

export default router
