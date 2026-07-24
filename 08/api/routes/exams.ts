import { Router, type Request, type Response } from 'express'
import { nanoid } from 'nanoid'
import { query, withTransaction, nowIso, audit, type TransactionClient } from '../db.js'
import { getUserContext, requireAuth, requireRole, rejectUnauthorized } from '../utils/http.js'
import { parseJson, json, toIso } from '../utils/json.js'
import type { QuestionType } from '../../shared/types.js'
import { wrapAsyncRouter } from '../utils/async-router.js'

const router = Router()
const SUBMIT_GRACE_MS = 60_000
const DEFAULT_MAX_ATTEMPTS = 3

async function getOrgUnitIdForUser(userId: string, client?: TransactionClient) {
  const result = await (client ?? { query }).query(
    'SELECT org_unit_id FROM users WHERE id = $1',
    [userId],
  )
  const row = result.rows[0]
  return row?.org_unit_id ? String(row.org_unit_id) : ''
}

function getMaxAttempts(exam: Record<string, unknown>) {
  const n = Number(exam?.max_attempts ?? DEFAULT_MAX_ATTEMPTS)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MAX_ATTEMPTS
}

async function countAttempts(examId: string, userId: string, client?: TransactionClient) {
  const result = await (client ?? { query }).query(
    'SELECT COUNT(1) as c FROM exam_attempts WHERE exam_id = $1 AND user_id = $2',
    [examId, userId],
  )
  const row = result.rows[0] as { c: number }
  return Number(row?.c ?? 0)
}

async function listAttempts(examId: string, userId: string) {
  const { rows } = await query(
    `SELECT id, total_score, is_pass, created_at FROM exam_attempts
     WHERE exam_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 20`,
    [examId, userId],
  )
  return rows.map((r) => ({
    id: r.id,
    totalScore: Number(r.total_score ?? 0),
    isPass: Boolean(r.is_pass),
    createdAt: r.created_at,
  }))
}

async function assertExamAccess(
  exam: Record<string, unknown>,
  role: string,
  userId: string,
  client?: TransactionClient,
) {
  if (role === 'admin') return { ok: true as const }
  const orgUnitId = await getOrgUnitIdForUser(userId, client)
  if (!orgUnitId || String(exam.org_unit_id) !== orgUnitId) {
    return { ok: false as const, status: 403, error: '无权限访问该测验（支部不匹配）' }
  }
  if (String(exam.status) !== 'published') {
    return { ok: false as const, status: 403, error: '测验未发布或已关闭' }
  }
  return { ok: true as const }
}

async function getPaperWithQuestions(paperId: string, client?: TransactionClient) {
  const runner = client ?? { query }
  const paper = (
    await runner.query('SELECT id, title, duration_min, pass_score FROM papers WHERE id = $1', [
      paperId,
    ])
  ).rows[0]
  if (!paper) return null

  const { rows: pqs } = await runner.query(
      `SELECT pq.question_id, pq.score, pq.order_no, q.type, q.category, q.stem,
              q.options_json, q.answer_key_json
       FROM paper_questions pq
       JOIN questions q ON q.id = pq.question_id
       WHERE pq.paper_id = $1
       ORDER BY pq.order_no ASC`,
    [paperId],
  )

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
      answerKey: parseJson(r.answer_key_json),
      score: Number(r.score ?? 0),
      orderNo: Number(r.order_no ?? 0),
    })),
  }
}

function mapExamRow(r: Record<string, unknown>, extra?: Record<string, unknown>) {
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

function formatAnswerLabel(
  type: QuestionType,
  value: unknown,
  options: Array<{ key: string; text: string }> | null,
): string {
  if (value === null || value === undefined || value === '') return '未作答'
  if (type === 'tf') {
    if (typeof value === 'boolean') return value ? '正确' : '错误'
    if (value === 'true' || value === '1') return '正确'
    if (value === 'false' || value === '0') return '错误'
    return String(value)
  }
  const optMap = new Map((options ?? []).map((o) => [String(o.key), o.text]))
  const keys = Array.isArray(value) ? value.map(String) : [String(value)]
  return keys
    .map((k) => {
      const text = optMap.get(k)
      return text ? `${k}. ${text}` : k
    })
    .join('；')
}

function scoreAnswer(type: QuestionType, expected: unknown, answer: unknown, maxScore: number) {
  if (type === 'single') {
    return expected && answer && String(expected) === String(answer) ? maxScore : 0
  }
  if (type === 'tf') {
    return typeof expected === 'boolean' && typeof answer === 'boolean' && expected === answer ? maxScore : 0
  }
  if (type === 'multiple') {
    const exp = Array.isArray(expected) ? expected.map(String).sort().join('|') : ''
    const got = Array.isArray(answer) ? answer.map(String).sort().join('|') : ''
    return exp && got && exp === got ? maxScore : 0
  }
  return 0
}

async function buildAttemptReview(attemptId: string, requesterId: string, role: string) {
  const attempt = (
    await query(
      `SELECT ea.id, ea.exam_id, ea.user_id, ea.total_score, ea.is_pass, ea.created_at,
              e.title as exam_title, e.pass_score, e.org_unit_id, e.paper_id, e.status
       FROM exam_attempts ea
       JOIN exams e ON e.id = ea.exam_id
       WHERE ea.id = $1`,
      [attemptId],
    )
  ).rows[0]

  if (!attempt) return { ok: false as const, status: 404, error: '成绩不存在' }

  const ownerId = String(attempt.user_id)
  if (role !== 'admin' && ownerId !== requesterId) {
    // 书记可看本支部成员成绩回顾
    if (role === 'secretary') {
      const ownOrg = await getOrgUnitIdForUser(requesterId)
      if (!ownOrg || String(attempt.org_unit_id) !== ownOrg) {
        return { ok: false as const, status: 403, error: '无权限查看该成绩' }
      }
    } else {
      return { ok: false as const, status: 403, error: '无权限查看该成绩' }
    }
  }

  const { rows: answers } = await query(
      `SELECT ea.question_id, ea.answer_json, ea.score,
              q.type, q.category, q.stem, q.options_json, q.answer_key_json,
              pq.score as max_score, pq.order_no
       FROM exam_answers ea
       JOIN questions q ON q.id = ea.question_id
       LEFT JOIN paper_questions pq ON pq.paper_id = $1 AND pq.question_id = ea.question_id
       WHERE ea.attempt_id = $2
       ORDER BY COALESCE(pq.order_no, 0) ASC`,
    [String(attempt.paper_id), attemptId],
  )

  const details = answers.map((row, idx) => {
    const type = String(row.type) as QuestionType
    const options = parseJson<Array<{ key: string; text: string }>>(row.options_json)
    const expected = parseJson<unknown>(row.answer_key_json ?? null)
    const userAnswer = parseJson<unknown>(row.answer_json ?? null)
    const maxScore = Number(row.max_score ?? 0)
    const score = Number(row.score ?? 0)
    const isCorrect = score >= maxScore && maxScore > 0
    return {
      orderNo: Number(row.order_no ?? idx + 1),
      questionId: String(row.question_id),
      type,
      category: String(row.category ?? ''),
      stem: String(row.stem ?? ''),
      options,
      userAnswer,
      correctAnswer: expected,
      userAnswerLabel: formatAnswerLabel(type, userAnswer, options),
      correctAnswerLabel: formatAnswerLabel(type, expected, options),
      score,
      maxScore,
      isCorrect,
    }
  })

  const wrongCount = details.filter((d) => !d.isCorrect).length
  const correctCount = details.filter((d) => d.isCorrect).length

  return {
    ok: true as const,
    data: {
      attemptId: String(attempt.id),
      examId: String(attempt.exam_id),
      examTitle: String(attempt.exam_title ?? '测验'),
      userId: ownerId,
      totalScore: Number(attempt.total_score ?? 0),
      passScore: Number(attempt.pass_score ?? 60),
      isPass: Boolean(attempt.is_pass),
      createdAt: toIso(attempt.created_at),
      correctCount,
      wrongCount,
      details,
      wrongDetails: details.filter((d) => !d.isCorrect),
    },
  }
}

/** 我的全部历史成绩 */
router.get('/attempts/mine', async (req: Request, res: Response) => {
  if (!requireRole(req, ['member', 'secretary', 'admin'])) {
    res.status(403).json({ success: false, error: '未登录' })
    return
  }

  const { userId } = getUserContext(req)
  const { rows } = await query(
      `SELECT ea.id, ea.exam_id, ea.total_score, ea.is_pass, ea.created_at,
              e.title as exam_title, e.pass_score
       FROM exam_attempts ea
       LEFT JOIN exams e ON e.id = ea.exam_id
       WHERE ea.user_id = $1
       ORDER BY ea.created_at DESC
       LIMIT 100`,
    [userId],
  )

  res.status(200).json({
    success: true,
    data: rows.map((r) => ({
      id: String(r.id),
      examId: String(r.exam_id),
      examTitle: r.exam_title ? String(r.exam_title) : '测验',
      totalScore: Number(r.total_score ?? 0),
      passScore: r.pass_score != null ? Number(r.pass_score) : null,
      isPass: Boolean(r.is_pass),
      createdAt: toIso(r.created_at),
    })),
  })
})

/** 单次成绩详情（含错题回顾） */
router.get('/attempts/:attemptId', async (req: Request, res: Response) => {
  if (!requireRole(req, ['member', 'secretary', 'admin'])) {
    res.status(403).json({ success: false, error: '未登录' })
    return
  }

  const { userId, role } = getUserContext(req)
  const review = await buildAttemptReview(String(req.params.attemptId), userId, role)
  if (!review.ok) {
    res.status(review.status).json({ success: false, error: review.error })
    return
  }
  res.status(200).json({ success: true, data: review.data })
})

router.get('/', async (req: Request, res: Response) => {
  if (!requireAuth(req)) {
    rejectUnauthorized(res)
    return
  }

  const { role, userId } = getUserContext(req)

  if (role === 'admin') {
    const { rows } = await query(
      'SELECT id, org_unit_id, paper_id, title, duration_min, pass_score, max_attempts, status, created_at FROM exams ORDER BY created_at DESC',
    )
    res.status(200).json({ success: true, data: rows.map((r) => mapExamRow(r)) })
    return
  }

  if (role === 'member' || role === 'secretary') {
    const orgUnitId = await getOrgUnitIdForUser(userId)
    const { rows } = await query(
      `SELECT id, org_unit_id, paper_id, title, duration_min, pass_score, max_attempts, status, created_at
       FROM exams WHERE org_unit_id = $1 AND status = $2 ORDER BY created_at DESC`,
      [orgUnitId, 'published'],
    )
    const data = await Promise.all(
      rows.map(async (r) => {
        const attemptCount = await countAttempts(String(r.id), userId)
        const maxAttempts = getMaxAttempts(r)
        const attempts = await listAttempts(String(r.id), userId)
        const bestScore = attempts.reduce((m, a) => Math.max(m, a.totalScore), 0)
        return mapExamRow(r, {
          attemptCount,
          remainingAttempts: Math.max(0, maxAttempts - attemptCount),
          canAttempt: attemptCount < maxAttempts,
          bestScore: attempts.length ? bestScore : null,
          attempts,
        })
      }),
    )
    res.status(200).json({
      success: true,
      data,
    })
    return
  }

  res.status(403).json({ success: false, error: '未登录' })
})

router.get('/:id', async (req: Request, res: Response) => {
  if (!requireAuth(req)) {
    rejectUnauthorized(res)
    return
  }

  const { role, userId } = getUserContext(req)
  const id = String(req.params.id)

  const exam = (
    await query(
      `SELECT id, org_unit_id, paper_id, title, duration_min, pass_score, max_attempts, status, created_at
       FROM exams WHERE id = $1`,
      [id],
    )
  ).rows[0]

  if (!exam) {
    res.status(404).json({ success: false, error: '测验不存在' })
    return
  }

  const access = await assertExamAccess(exam, role, userId)
  if (!access.ok) {
    res.status(access.status).json({ success: false, error: access.error })
    return
  }

  const attemptCount = await countAttempts(id, userId)
  const maxAttempts = getMaxAttempts(exam)
  const paper = await getPaperWithQuestions(String(exam.paper_id))
  const attempts = await listAttempts(id, userId)
  res.status(200).json({
    success: true,
    data: {
      ...mapExamRow(exam, {
        attemptCount,
        remainingAttempts: Math.max(0, maxAttempts - attemptCount),
        canAttempt: attemptCount < maxAttempts,
        attempts,
      }),
      paper,
    },
  })
})

router.post('/', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const ts = nowIso()
  const id = `exam_${nanoid(10)}`
  const maxAttempts = Math.max(1, Number(req.body?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS) || DEFAULT_MAX_ATTEMPTS)

  await query(
    `INSERT INTO exams
      (id, org_unit_id, paper_id, title, duration_min, pass_score, status, created_at, max_attempts)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      String(req.body?.orgUnitId ?? ''),
      String(req.body?.paperId ?? ''),
      String(req.body?.title ?? ''),
      Number(req.body?.durationMin ?? 10),
      Number(req.body?.passScore ?? 60),
      String(req.body?.status ?? 'draft'),
      ts,
      maxAttempts,
    ],
  )

  await audit(userId || 'u_admin_demo', 'exams.create', { id })
  res.status(200).json({ success: true, data: { id } })
})

router.put('/:id', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = String(req.params.id)
  const maxAttempts = Math.max(1, Number(req.body?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS) || DEFAULT_MAX_ATTEMPTS)

  await query(
    `UPDATE exams SET org_unit_id = $1, paper_id = $2, title = $3, duration_min = $4,
       pass_score = $5, status = $6, max_attempts = $7 WHERE id = $8`,
    [
      String(req.body?.orgUnitId ?? ''),
      String(req.body?.paperId ?? ''),
      String(req.body?.title ?? ''),
      Number(req.body?.durationMin ?? 10),
      Number(req.body?.passScore ?? 60),
      String(req.body?.status ?? 'draft'),
      maxAttempts,
      id,
    ],
  )

  await audit(userId || 'u_admin_demo', 'exams.update', { id })
  res.status(200).json({ success: true })
})

router.delete('/:id', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = String(req.params.id)
  const exists = (await query('SELECT id FROM exams WHERE id = $1', [id])).rows[0]
  if (!exists) {
    res.status(404).json({ success: false, error: '测验不存在' })
    return
  }

  await withTransaction(async (client) => {
    await client.query(
      'DELETE FROM exam_answers WHERE attempt_id IN (SELECT id FROM exam_attempts WHERE exam_id = $1)',
      [id],
    )
    await client.query('DELETE FROM exam_attempts WHERE exam_id = $1', [id])
    await client.query('DELETE FROM exam_sessions WHERE exam_id = $1', [id])
    await client.query('DELETE FROM exams WHERE id = $1', [id])
  })

  await audit(userId || 'u_admin_demo', 'exams.delete', { id })
  res.status(200).json({ success: true })
})

/** 开始作答：创建服务端会话，用于倒计时与超时校验 */
router.post('/:id/start', async (req: Request, res: Response) => {
  if (!requireRole(req, ['member', 'secretary', 'admin'])) {
    res.status(403).json({ success: false, error: '未登录' })
    return
  }

  const { userId, role } = getUserContext(req)
  const examId = String(req.params.id)
  const result = await withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${examId}:${userId}`])
    const exam = (
      await client.query(
        `SELECT id, org_unit_id, paper_id, title, duration_min, pass_score, max_attempts, status, created_at
         FROM exams WHERE id = $1`,
        [examId],
      )
    ).rows[0]
    if (!exam) return { error: '测验不存在', status: 404 } as const

    const access = await assertExamAccess(exam, role, userId, client)
    if (!access.ok) return { error: access.error, status: access.status } as const

    const attemptCount = await countAttempts(examId, userId, client)
    const maxAttempts = getMaxAttempts(exam)
    if (attemptCount >= maxAttempts) {
      return { error: `已达最大作答次数（${maxAttempts} 次）`, status: 400 } as const
    }

    const open = (
      await client.query(
        `SELECT id, started_at FROM exam_sessions
         WHERE exam_id = $1 AND user_id = $2 AND submitted = false
         ORDER BY started_at DESC LIMIT 1`,
        [examId, userId],
      )
    ).rows[0]
    const durationMin = Number(exam.duration_min ?? 10)
    if (open?.id) {
      const startedAt = toIso(open.started_at) ?? String(open.started_at)
      const expiresAt = new Date(new Date(startedAt).getTime() + durationMin * 60_000).toISOString()
      return {
        data: { sessionId: open.id, startedAt, expiresAt, durationMin, attemptCount, maxAttempts },
        created: false,
      } as const
    }

    const sessionId = `es_${nanoid(12)}`
    const startedAt = nowIso()
    await client.query(
      `INSERT INTO exam_sessions (id, exam_id, user_id, started_at, submitted)
       VALUES ($1, $2, $3, $4, false)`,
      [sessionId, examId, userId, startedAt],
    )
    const expiresAt = new Date(new Date(startedAt).getTime() + durationMin * 60_000).toISOString()
    return {
      data: { sessionId, startedAt, expiresAt, durationMin, attemptCount, maxAttempts },
      created: true,
    } as const
  })

  if ('error' in result) {
    res.status(result.status).json({ success: false, error: result.error })
    return
  }
  if (result.created) {
    await audit(userId, 'exam.start', { examId, sessionId: result.data.sessionId })
  }
  res.status(200).json({
    success: true,
    data: result.data,
  })
})

router.post('/:id/submit', async (req: Request, res: Response) => {
  if (!requireRole(req, ['member', 'secretary', 'admin'])) {
    res.status(403).json({ success: false, error: '未登录' })
    return
  }

  const { userId, role } = getUserContext(req)
  const examId = String(req.params.id)
  const sessionId = String(req.body?.sessionId ?? '')

  if (!sessionId) {
    res.status(400).json({ success: false, error: '缺少作答会话，请重新进入测验' })
    return
  }
  const submitted: Record<string, unknown> = req.body?.answers ?? {}
  const result = await withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${examId}:${userId}`])
    const exam = (
      await client.query(
        `SELECT id, org_unit_id, paper_id, title, duration_min, pass_score, max_attempts, status
         FROM exams WHERE id = $1`,
        [examId],
      )
    ).rows[0]
    if (!exam) return { error: '测验不存在', status: 404 } as const

    const access = await assertExamAccess(exam, role, userId, client)
    if (!access.ok) return { error: access.error, status: access.status } as const

    const attemptCount = await countAttempts(examId, userId, client)
    const maxAttempts = getMaxAttempts(exam)
    if (attemptCount >= maxAttempts) {
      return { error: `已达最大作答次数（${maxAttempts} 次）`, status: 400 } as const
    }

    const session = (
      await client.query(
        `SELECT id, exam_id, user_id, started_at, submitted
         FROM exam_sessions WHERE id = $1 FOR UPDATE`,
        [sessionId],
      )
    ).rows[0]
    if (!session || String(session.exam_id) !== examId || String(session.user_id) !== userId) {
      return { error: '作答会话无效', status: 400 } as const
    }
    if (session.submitted) return { error: '该会话已交卷', status: 400 } as const

    const startedMs = new Date(session.started_at as Date | string).getTime()
    const elapsed = Date.now() - startedMs
    if (!Number.isFinite(startedMs) || elapsed < 0) {
      return { error: '作答开始时间无效', status: 400 } as const
    }
    if (elapsed > Number(exam.duration_min ?? 10) * 60_000 + SUBMIT_GRACE_MS) {
      return { error: '已超过考试时限，无法交卷', status: 400 } as const
    }

    const paper = await getPaperWithQuestions(String(exam.paper_id), client)
    if (!paper) return { error: '试卷不存在', status: 400 } as const

    let totalScore = 0
    const details = paper.questions.map((question) => {
      const answer = submitted[question.id]
      const expected = question.answerKey
      const options = (question.options as Array<{ key: string; text: string }> | null) ?? null
      const score = scoreAnswer(question.type, expected, answer, question.score)
      totalScore += score
      return {
        questionId: question.id,
        type: question.type,
        category: question.category,
        stem: question.stem,
        options,
        userAnswer: answer ?? null,
        correctAnswer: expected,
        userAnswerLabel: formatAnswerLabel(question.type, answer, options),
        correctAnswerLabel: formatAnswerLabel(question.type, expected, options),
        score,
        maxScore: question.score,
        isCorrect: score >= question.score && question.score > 0,
        orderNo: question.orderNo,
      }
    })
    const passScore = Number(exam.pass_score ?? paper.passScore ?? 60)
    const isPass = totalScore >= passScore
    const attemptId = `attempt_${nanoid(12)}`
    await client.query(
      `INSERT INTO exam_attempts (id, exam_id, user_id, total_score, is_pass, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [attemptId, examId, userId, totalScore, isPass, nowIso()],
    )
    for (const detail of details) {
      await client.query(
        `INSERT INTO exam_answers (id, attempt_id, question_id, answer_json, score)
         VALUES ($1, $2, $3, $4::jsonb, $5)`,
        [`ea_${nanoid(12)}`, attemptId, detail.questionId, json(detail.userAnswer), detail.score],
      )
    }
    await client.query('UPDATE exam_sessions SET submitted = true WHERE id = $1', [sessionId])
    return { exam, paper, attemptId, attemptCount, maxAttempts, totalScore, passScore, isPass, details }
  })

  if ('error' in result) {
    res.status(result.status).json({ success: false, error: result.error })
    return
  }
  const { exam, paper, attemptId, attemptCount, maxAttempts, totalScore, passScore, isPass, details } =
    result
  const wrongDetails = details.filter((detail) => !detail.isCorrect)
  await audit(userId, 'exam.submit', { examId, totalScore, isPass, sessionId })
  res.status(200).json({
    success: true,
    data: {
      attemptId,
      examId,
      examTitle: String(exam.title ?? paper.title ?? '测验'),
      totalScore,
      passScore,
      isPass,
      details,
      wrongDetails,
      correctCount: details.filter((d) => d.isCorrect).length,
      wrongCount: wrongDetails.length,
      attemptCount: attemptCount + 1,
      remainingAttempts: Math.max(0, maxAttempts - attemptCount - 1),
    },
  })
})

export default wrapAsyncRouter(router)
