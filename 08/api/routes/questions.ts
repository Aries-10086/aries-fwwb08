import { Router, type Request, type Response } from 'express'
import { nanoid } from 'nanoid'
import { query, withTransaction, nowIso, audit } from '../db.js'
import { getUserContext, requireRole } from '../utils/http.js'
import { json, parseJson } from '../utils/json.js'
import { wrapAsyncRouter } from '../utils/async-router.js'

const router = Router()

function parseTabular(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return []

  const delimiter = lines[0].includes('\t') ? '\t' : ','
  const header = lines[0].split(delimiter).map((s) => s.trim())
  const rows: Record<string, string>[] = []
  for (const line of lines.slice(1)) {
    const cols = line.split(delimiter).map((s) => s.trim())
    const row: Record<string, string> = {}
    for (let i = 0; i < header.length; i++) row[header[i]] = cols[i] ?? ''
    rows.push(row)
  }
  return rows
}

router.get('/', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const category = req.query.category ? String(req.query.category) : null
  const type = req.query.type ? String(req.query.type) : null
  const q = req.query.q ? String(req.query.q) : null

  const where: string[] = []
  const params: unknown[] = []

  if (category) {
    where.push(`category = $${params.length + 1}`)
    params.push(category)
  }
  if (type) {
    where.push(`type = $${params.length + 1}`)
    params.push(type)
  }
  if (q) {
    where.push(`stem ILIKE $${params.length + 1}`)
    params.push(`%${q}%`)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  const { rows } = await query(
    `SELECT id, type, category, stem, options_json, answer_key_json, created_at, updated_at
     FROM questions
     ${whereSql}
     ORDER BY updated_at DESC
     LIMIT 500`,
    params,
  )

  const data = rows.map((r) => ({
    id: r.id,
    type: r.type,
    category: r.category,
    stem: r.stem,
    options: parseJson(r.options_json),
    answerKey: parseJson(r.answer_key_json),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }))

  res.status(200).json({ success: true, data })
})

router.post('/', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = `q_${nanoid(10)}`
  const ts = nowIso()

  await query(
    `INSERT INTO questions (id, type, category, stem, options_json, answer_key_json, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)`,
    [
      id,
      String(req.body?.type ?? 'single'),
      String(req.body?.category ?? ''),
      String(req.body?.stem ?? ''),
      json(req.body?.options ?? null),
      json(req.body?.answerKey ?? null),
      ts,
      ts,
    ],
  )

  await audit(userId || 'u_admin_demo', 'questions.create', { id })
  res.status(200).json({ success: true, data: { id } })
})

router.put('/:id', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = String(req.params.id)
  const ts = nowIso()

  await query(
    `UPDATE questions SET type = $1, category = $2, stem = $3,
       options_json = $4::jsonb, answer_key_json = $5::jsonb, updated_at = $6
     WHERE id = $7`,
    [
      String(req.body?.type ?? 'single'),
      String(req.body?.category ?? ''),
      String(req.body?.stem ?? ''),
      json(req.body?.options ?? null),
      json(req.body?.answerKey ?? null),
      ts,
      id,
    ],
  )

  await audit(userId || 'u_admin_demo', 'questions.update', { id })
  res.status(200).json({ success: true })
})

router.delete('/:id', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const id = String(req.params.id)
  const exists = (await query('SELECT id FROM questions WHERE id = $1', [id])).rows[0]
  if (!exists) {
    res.status(404).json({ success: false, error: '题目不存在' })
    return
  }

  const used = (
    await query('SELECT paper_id FROM paper_questions WHERE question_id = $1 LIMIT 1', [id])
  ).rows[0]
  if (used) {
    res.status(400).json({ success: false, error: '题目已被试卷引用，请先从试卷中移除' })
    return
  }

  await query('DELETE FROM questions WHERE id = $1', [id])
  await audit(userId || 'u_admin_demo', 'questions.delete', { id })
  res.status(200).json({ success: true })
})

router.post('/import', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可操作' })
    return
  }

  const { userId } = getUserContext(req)
  const rawText = String(req.body?.csvText ?? '')
  const rows = parseTabular(rawText)

  if (rows.length === 0) {
    res.status(400).json({ success: false, error: '导入内容为空或格式不正确' })
    return
  }

  const ts = nowIso()
  const result: { ok: number; failed: number; errors: Array<{ line: number; reason: string }> } = {
    ok: 0,
    failed: 0,
    errors: [],
  }

  await withTransaction(async (client) => {
    for (const [idx, r] of rows.entries()) {
      const line = idx + 2
      const type = String(r.type ?? r.题型 ?? 'single').trim()
      const category = String(r.category ?? r.分类 ?? '未分类').trim()
      const stem = String(r.stem ?? r.题干 ?? '').trim()
      const optionsRaw = String(r.optionsJson ?? r.options ?? r.选项 ?? '').trim()
      const answerRaw = String(r.answerKeyJson ?? r.answerKey ?? r.答案 ?? '').trim()

      if (!stem) {
        result.failed += 1
        result.errors.push({ line, reason: '缺少题干' })
        continue
      }
      if (!['single', 'multiple', 'tf'].includes(type)) {
        result.failed += 1
        result.errors.push({ line, reason: '题型必须为 single、multiple 或 tf' })
        continue
      }

      let options: unknown = null
      let answerKey: unknown = null

      try {
        options = optionsRaw ? JSON.parse(optionsRaw) : null
        answerKey = answerRaw ? JSON.parse(answerRaw) : null
      } catch {
        result.failed += 1
        result.errors.push({ line, reason: 'optionsJson 或 answerKeyJson 不是合法 JSON' })
        continue
      }

      const id = `q_${nanoid(10)}`
      await client.query(
        `INSERT INTO questions
          (id, type, category, stem, options_json, answer_key_json, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)`,
        [id, type, category, stem, json(options), json(answerKey), ts, ts],
      )
      result.ok += 1
    }
  })

  await audit(userId || 'u_admin_demo', 'questions.import', { ok: result.ok, failed: result.failed })
  res.status(200).json({ success: true, data: result })
})

export default wrapAsyncRouter(router)
