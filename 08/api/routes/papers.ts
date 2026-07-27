import { Router, type Request, type Response } from 'express'
import { nanoid } from 'nanoid'
import { query, withTransaction, nowIso, audit } from '../db.js'
import { getUserContext, requireRole } from '../utils/http.js'
import { wrapAsyncRouter } from '../utils/async-router.js'

const router = Router()

async function getQuestions(paperId: string) {
  const { rows } = await query(
    `SELECT question_id, score, order_no
     FROM paper_questions
     WHERE paper_id = $1
     ORDER BY order_no ASC`,
    [paperId],
  )

  return rows.map((r) => ({
    questionId: r.question_id,
    score: Number(r.score ?? 0),
    orderNo: Number(r.order_no ?? 0),
  }))
}

router.get('/', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { rows } = await query(
    'SELECT id, title, duration_min, pass_score, created_at FROM papers ORDER BY created_at DESC',
  )

  const data = await Promise.all(rows.map(async (r) => ({
    id: r.id,
    title: r.title,
    durationMin: Number(r.duration_min ?? 0),
    passScore: Number(r.pass_score ?? 0),
    createdAt: r.created_at,
    questions: await getQuestions(String(r.id)),
  })))

  res.status(200).json({ success: true, data })
})

router.get('/:id', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const id = String(req.params.id)
  const paper = (
    await query(
      'SELECT id, title, duration_min, pass_score, created_at FROM papers WHERE id = $1',
      [id],
    )
  ).rows[0]

  if (!paper) {
    res.status(404).json({ success: false, error: '试卷不存在' })
    return
  }

  const { rows: pqRows } = await query(
    `SELECT pq.question_id, pq.score, pq.order_no,
            q.type, q.category, q.stem, q.options_json, q.answer_key_json
     FROM paper_questions pq
     JOIN questions q ON q.id = pq.question_id
     WHERE pq.paper_id = $1
     ORDER BY pq.order_no ASC`,
    [id],
  )

  res.status(200).json({
    success: true,
    data: {
      id: paper.id,
      title: paper.title,
      durationMin: Number(paper.duration_min ?? 0),
      passScore: Number(paper.pass_score ?? 0),
      createdAt: paper.created_at,
      questions: pqRows.map((r) => ({
        questionId: String(r.question_id),
        score: Number(r.score ?? 0),
        orderNo: Number(r.order_no ?? 0),
        type: String(r.type ?? ''),
        category: String(r.category ?? ''),
        stem: String(r.stem ?? ''),
        options: r.options_json ?? null,
        answerKey: r.answer_key_json ?? null,
      })),
    },
  })
})

router.post('/', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = `paper_${nanoid(10)}`
  const ts = nowIso()

  const durationMin = Number(req.body?.durationMin ?? 10)
  const passScore = Number(req.body?.passScore ?? 60)

  const questions: Array<{ questionId: string; score: number; orderNo: number }> = Array.isArray(
    req.body?.questions,
  )
    ? req.body.questions
    : []

  await withTransaction(async (client) => {
    await client.query(
      'INSERT INTO papers (id, title, duration_min, pass_score, created_at) VALUES ($1, $2, $3, $4, $5)',
      [id, String(req.body?.title ?? ''), durationMin, passScore, ts],
    )
    for (const q of questions) {
      await client.query(
        'INSERT INTO paper_questions (paper_id, question_id, score, order_no) VALUES ($1, $2, $3, $4)',
        [id, String(q.questionId), Number(q.score ?? 0), Number(q.orderNo ?? 0)],
      )
    }
  })

  await audit(userId || 'u_admin_demo', 'papers.create', { id })
  res.status(200).json({ success: true, data: { id } })
})

router.put('/:id', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = String(req.params.id)

  const durationMin = Number(req.body?.durationMin ?? 10)
  const passScore = Number(req.body?.passScore ?? 60)

  const questions: Array<{ questionId: string; score: number; orderNo: number }> = Array.isArray(
    req.body?.questions,
  )
    ? req.body.questions
    : []

  await withTransaction(async (client) => {
    await client.query(
      'UPDATE papers SET title = $1, duration_min = $2, pass_score = $3 WHERE id = $4',
      [String(req.body?.title ?? ''), durationMin, passScore, id],
    )
    await client.query('DELETE FROM paper_questions WHERE paper_id = $1', [id])
    for (const q of questions) {
      await client.query(
        'INSERT INTO paper_questions (paper_id, question_id, score, order_no) VALUES ($1, $2, $3, $4)',
        [id, String(q.questionId), Number(q.score ?? 0), Number(q.orderNo ?? 0)],
      )
    }
  })

  await audit(userId || 'u_admin_demo', 'papers.update', { id })
  res.status(200).json({ success: true })
})

router.delete('/:id', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = String(req.params.id)
  const exists = (await query('SELECT id FROM papers WHERE id = $1', [id])).rows[0]
  if (!exists) {
    res.status(404).json({ success: false, error: '试卷不存在' })
    return
  }

  const used = (await query('SELECT id FROM exams WHERE paper_id = $1 LIMIT 1', [id])).rows[0]
  if (used) {
    res.status(400).json({ success: false, error: '试卷已被测验引用，请先删除相关测验' })
    return
  }

  await withTransaction(async (client) => {
    await client.query('DELETE FROM paper_questions WHERE paper_id = $1', [id])
    await client.query('DELETE FROM papers WHERE id = $1', [id])
  })
  await audit(userId || 'u_admin_demo', 'papers.delete', { id })
  res.status(200).json({ success: true })
})

export default wrapAsyncRouter(router)

