import { Router, type Request, type Response } from 'express'
import { nanoid } from 'nanoid'
import { db, nowIso, audit } from '../db.js'
import { getUserContext, requireRole } from '../utils/http.js'

const router = Router()

function getQuestions(paperId: string) {
  const rows = db
    .prepare(
      `SELECT question_id, score, order_no
       FROM paper_questions
       WHERE paper_id = ?
       ORDER BY order_no ASC`,
    )
    .all(paperId) as any[]

  return rows.map((r) => ({
    questionId: r.question_id,
    score: Number(r.score ?? 0),
    orderNo: Number(r.order_no ?? 0),
  }))
}

router.get('/', (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const rows = db
    .prepare('SELECT id, title, duration_min, pass_score, created_at FROM papers ORDER BY created_at DESC')
    .all() as any[]

  const data = rows.map((r) => ({
    id: r.id,
    title: r.title,
    durationMin: Number(r.duration_min ?? 0),
    passScore: Number(r.pass_score ?? 0),
    createdAt: r.created_at,
    questions: getQuestions(String(r.id)),
  }))

  res.status(200).json({ success: true, data })
})

router.post('/', (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = `paper_${nanoid(10)}`
  const ts = nowIso()

  const durationMin = Number(req.body?.durationMin ?? 10)
  const passScore = Number(req.body?.passScore ?? 60)

  db.prepare('INSERT INTO papers (id, title, duration_min, pass_score, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, String(req.body?.title ?? ''), durationMin, passScore, ts)

  const questions: Array<{ questionId: string; score: number; orderNo: number }> = Array.isArray(
    req.body?.questions,
  )
    ? req.body.questions
    : []

  const insert = db.prepare(
    'INSERT INTO paper_questions (paper_id, question_id, score, order_no) VALUES (?, ?, ?, ?)',
  )
  for (const q of questions) {
    insert.run(id, String(q.questionId), Number(q.score ?? 0), Number(q.orderNo ?? 0))
  }

  audit(userId || 'u_admin_demo', 'papers.create', { id })
  res.status(200).json({ success: true, data: { id } })
})

router.put('/:id', (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = String(req.params.id)

  const durationMin = Number(req.body?.durationMin ?? 10)
  const passScore = Number(req.body?.passScore ?? 60)

  db.prepare('UPDATE papers SET title = ?, duration_min = ?, pass_score = ? WHERE id = ?')
    .run(String(req.body?.title ?? ''), durationMin, passScore, id)

  db.prepare('DELETE FROM paper_questions WHERE paper_id = ?').run(id)

  const questions: Array<{ questionId: string; score: number; orderNo: number }> = Array.isArray(
    req.body?.questions,
  )
    ? req.body.questions
    : []

  const insert = db.prepare(
    'INSERT INTO paper_questions (paper_id, question_id, score, order_no) VALUES (?, ?, ?, ?)',
  )
  for (const q of questions) {
    insert.run(id, String(q.questionId), Number(q.score ?? 0), Number(q.orderNo ?? 0))
  }

  audit(userId || 'u_admin_demo', 'papers.update', { id })
  res.status(200).json({ success: true })
})

router.delete('/:id', (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = String(req.params.id)
  const exists = db.prepare('SELECT id FROM papers WHERE id = ?').get(id)
  if (!exists) {
    res.status(404).json({ success: false, error: '试卷不存在' })
    return
  }

  const used = db.prepare('SELECT id FROM exams WHERE paper_id = ? LIMIT 1').get(id)
  if (used) {
    res.status(400).json({ success: false, error: '试卷已被测验引用，请先删除相关测验' })
    return
  }

  db.prepare('DELETE FROM paper_questions WHERE paper_id = ?').run(id)
  db.prepare('DELETE FROM papers WHERE id = ?').run(id)
  audit(userId || 'u_admin_demo', 'papers.delete', { id })
  res.status(200).json({ success: true })
})

export default router

