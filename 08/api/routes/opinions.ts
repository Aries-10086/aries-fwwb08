import { Router, type Request, type Response } from 'express'
import { nanoid } from 'nanoid'
import { query, nowIso, audit } from '../db.js'
import { getUserContext, requireRole } from '../utils/http.js'
import { toIso } from '../utils/json.js'
import { wrapAsyncRouter } from '../utils/async-router.js'

const router = Router()

async function getOrgUnitIdForUser(userId: string) {
  const row = (await query('SELECT org_unit_id FROM users WHERE id = $1', [userId])).rows[0]
  return row?.org_unit_id ? String(row.org_unit_id) : ''
}

/** 党员向书记提交学习意见 */
router.post('/', async (req: Request, res: Response) => {
  if (!requireRole(req, ['member'])) {
    res.status(403).json({ success: false, error: '仅党员可提交学习意见' })
    return
  }

  const { userId } = getUserContext(req)
  const content = String(req.body?.content ?? '').trim()
  if (!content) {
    res.status(400).json({ success: false, error: '请您填写学习意见后再提交' })
    return
  }
  if (content.length > 2000) {
    res.status(400).json({ success: false, error: '意见内容过长，请您精简后重试' })
    return
  }

  const orgUnitId = await getOrgUnitIdForUser(userId)
  if (!orgUnitId) {
    res.status(400).json({ success: false, error: '您尚未绑定支部，无法提交' })
    return
  }

  const id = `opinion_${nanoid(12)}`
  const createdAt = nowIso()
  await query(
    `INSERT INTO learning_opinions (id, user_id, org_unit_id, content, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, userId, orgUnitId, content, createdAt],
  )
  await audit(userId, 'opinion.submit', { opinionId: id })
  res.status(200).json({ success: true, data: { id, content, createdAt } })
})

/** 党员查看本人已提交意见 */
router.get('/mine', async (req: Request, res: Response) => {
  if (!requireRole(req, ['member'])) {
    res.status(403).json({ success: false, error: '无权限访问' })
    return
  }

  const { userId } = getUserContext(req)
  const { rows } = await query(
    `SELECT id, content, created_at FROM learning_opinions
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [userId],
  )
  res.status(200).json({
    success: true,
    data: rows.map((r) => ({
      id: String(r.id),
      content: String(r.content),
      createdAt: toIso(r.created_at),
    })),
  })
})

/** 书记查看本支部党员学习意见 */
router.get('/branch', async (req: Request, res: Response) => {
  if (!requireRole(req, ['secretary', 'admin'])) {
    res.status(403).json({ success: false, error: '无权限访问' })
    return
  }

  const { userId, role } = getUserContext(req)
  const orgUnitId =
    role === 'admin' && req.query.orgUnitId
      ? String(req.query.orgUnitId)
      : await getOrgUnitIdForUser(userId)

  if (!orgUnitId) {
    res.status(400).json({ success: false, error: '未绑定所属支部' })
    return
  }

  const orgName = String(
    (await query('SELECT name FROM org_units WHERE id = $1', [orgUnitId])).rows[0]?.name ?? '',
  )

  const { rows } = await query(
    `SELECT o.id, o.content, o.created_at, u.name AS user_name, u.id AS user_id
     FROM learning_opinions o
     JOIN users u ON u.id = o.user_id
     WHERE o.org_unit_id = $1
     ORDER BY o.created_at DESC
     LIMIT 100`,
    [orgUnitId],
  )

  res.status(200).json({
    success: true,
    data: {
      orgName,
      items: rows.map((r) => ({
        id: String(r.id),
        userId: String(r.user_id),
        userName: String(r.user_name),
        content: String(r.content),
        createdAt: toIso(r.created_at),
      })),
    },
  })
})

export default wrapAsyncRouter(router)
