import { Router, type Request, type Response } from 'express'
import { nanoid } from 'nanoid'
import { db, nowIso, audit } from '../db.js'
import { getUserContext, requireAuth, requireRole, rejectUnauthorized } from '../utils/http.js'
import { parseJson, json } from '../utils/json.js'
import type { QuestionType } from '../../shared/types.js'

const router = Router()

function getOrgUnitIdForUser(userId: string) {
  const row = db.prepare('SELECT org_unit_id FROM users WHERE id = ?').get(userId) as any
  return row?.org_unit_id ? String(row.org_unit_id) : ''
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

router.get('/', (req: Request, res: Response) => {
  if (!requireAuth(req)) {
    rejectUnauthorized(res)
    return
  }

  const { role, userId } = getUserContext(req)

  if (role === 'admin') {
    const rows = db
      .prepare(
        'SELECT id, org_unit_id, paper_id, title, duration_min, pass_score, status, created_at FROM exams ORDER BY created_at DESC',
      )
      .all() as any[]
    res.status(200).json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        orgUnitId: r.org_unit_id,
        paperId: r.paper_id,
        title: r.title,
        durationMin: Number(r.duration_min ?? 0),
        passScore: Number(r.pass_score ?? 0),
        status: r.status,
        createdAt: r.created_at,
      })),
    })
    return
  }

  if (role === 'member' || role === 'secretary') {
    const orgUnitId = getOrgUnitIdForUser(userId)
    const rows = db
      .prepare(
        'SELECT id, org_unit_id, paper_id, title, duration_min, pass_score, status, created_at FROM exams WHERE org_unit_id = ? AND status = ? ORDER BY created_at DESC',
      )
      .all(orgUnitId, 'published') as any[]
    res.status(200).json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        orgUnitId: r.org_unit_id,
        paperId: r.paper_id,
        title: r.title,
        durationMin: Number(r.duration_min ?? 0),
        passScore: Number(r.pass_score ?? 0),
        status: r.status,
        createdAt: r.created_at,
      })),
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
      'SELECT id, org_unit_id, paper_id, title, duration_min, pass_score, status, created_at FROM exams WHERE id = ?',
    )
    .get(id) as any

  if (!exam) {
    res.status(404).json({ success: false, error: '测验不存在' })
    return
  }

  if (role === 'member' || role === 'secretary') {
    const orgUnitId = getOrgUnitIdForUser(userId)
    if (String(exam.org_unit_id) !== orgUnitId || String(exam.status) !== 'published') {
      res.status(403).json({ success: false, error: '无权限访问该测验' })
      return
    }
  }

  const paper = getPaperWithQuestions(String(exam.paper_id))
  res.status(200).json({
    success: true,
    data: {
      id: exam.id,
      orgUnitId: exam.org_unit_id,
      paperId: exam.paper_id,
      title: exam.title,
      durationMin: Number(exam.duration_min ?? 0),
      passScore: Number(exam.pass_score ?? 0),
      status: exam.status,
      createdAt: exam.created_at,
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

  db.prepare(
    'INSERT INTO exams (id, org_unit_id, paper_id, title, duration_min, pass_score, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    id,
    String(req.body?.orgUnitId ?? ''),
    String(req.body?.paperId ?? ''),
    String(req.body?.title ?? ''),
    Number(req.body?.durationMin ?? 10),
    Number(req.body?.passScore ?? 60),
    String(req.body?.status ?? 'draft'),
    ts,
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

  db.prepare(
    'UPDATE exams SET org_unit_id = ?, paper_id = ?, title = ?, duration_min = ?, pass_score = ?, status = ? WHERE id = ?',
  ).run(
    String(req.body?.orgUnitId ?? ''),
    String(req.body?.paperId ?? ''),
    String(req.body?.title ?? ''),
    Number(req.body?.durationMin ?? 10),
    Number(req.body?.passScore ?? 60),
    String(req.body?.status ?? 'draft'),
    id,
  )

  audit(userId || 'u_admin_demo', 'exams.update', { id })
  res.status(200).json({ success: true })
})

router.post('/:id/submit', (req: Request, res: Response) => {
  if (!requireRole(req, ['member', 'secretary', 'admin'])) {
    res.status(403).json({ success: false, error: '未登录' })
    return
  }

  const { userId } = getUserContext(req)
  const examId = String(req.params.id)

  const exam = db
    .prepare('SELECT id, org_unit_id, paper_id, pass_score, status FROM exams WHERE id = ?')
    .get(examId) as any

  if (!exam) {
    res.status(404).json({ success: false, error: '测验不存在' })
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

  db.prepare(
    'INSERT INTO exam_attempts (id, exam_id, user_id, total_score, is_pass, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(attemptId, examId, userId, totalScore, isPass ? 1 : 0, ts)

  const ansInsert = db.prepare(
    'INSERT INTO exam_answers (id, attempt_id, question_id, answer_json, score) VALUES (?, ?, ?, ?, ?)',
  )
  for (const d of details) {
    ansInsert.run(`ea_${nanoid(12)}`, attemptId, d.questionId, json(submitted[d.questionId] ?? null), d.score)
  }

  audit(userId, 'exam.submit', { examId, totalScore, isPass })
  res.status(200).json({ success: true, data: { attemptId, totalScore, passScore, isPass, details } })
})

export default router

