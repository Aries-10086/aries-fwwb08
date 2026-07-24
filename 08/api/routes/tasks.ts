import { Router, type Request, type Response } from 'express'
import { nanoid } from 'nanoid'
import { query, withTransaction, nowIso, audit } from '../db.js'
import { getUserContext, requireAuth, requireRole, rejectUnauthorized } from '../utils/http.js'
import { loadCompletedByUserIds, loadMemberIdsByOrg, loadTaskContentsMap } from '../utils/aggregates.js'
import { wrapAsyncRouter } from '../utils/async-router.js'

const router = Router()

async function getOrgUnitIdForUser(userId: string) {
  const row = (await query('SELECT org_unit_id FROM users WHERE id = $1', [userId])).rows[0]
  return row?.org_unit_id ? String(row.org_unit_id) : ''
}

async function getContentIdsForTask(taskId: string) {
  const { rows } = await query('SELECT content_id FROM task_contents WHERE task_id = $1', [taskId])
  return rows.map((r) => String(r.content_id))
}

async function getContentMetaMap(contentIds: string[]) {
  const map = new Map<string, { id: string; title: string; type: string }>()
  if (contentIds.length === 0) return map
  const placeholders = contentIds.map((_, i) => `$${i + 1}`).join(',')
  const { rows } = await query(
    `SELECT id, title, type FROM contents WHERE id IN (${placeholders})`,
    contentIds,
  )
  for (const r of rows) {
    map.set(String(r.id), { id: String(r.id), title: String(r.title ?? ''), type: String(r.type ?? 'article') })
  }
  return map
}

function buildTaskPayload(
  r: Record<string, unknown>,
  contentIds: string[],
  opts: {
    contentMeta: Map<string, { id: string; title: string; type: string }>
    completedIds: Set<string> | null
    branchMemberIds: string[] | null
    completedByMember?: Map<string, Set<string>>
  },
) {
  const items = contentIds.map((cid) => {
    const meta = opts.contentMeta.get(cid)
    return {
      id: cid,
      title: meta?.title ?? cid,
      type: meta?.type ?? 'article',
      isCompleted: opts.completedIds ? opts.completedIds.has(cid) : false,
    }
  })
  const totalCount = items.length
  const completedCount = items.filter((x) => x.isCompleted).length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  let branchCompletionRate: number | null = null
  let branchCompletedMemberCount: number | null = null
  let branchMemberCount: number | null = null
  if (opts.branchMemberIds && opts.completedByMember) {
    branchMemberCount = opts.branchMemberIds.length
    if (branchMemberCount === 0 || totalCount === 0) {
      branchCompletionRate = 0
      branchCompletedMemberCount = 0
    } else {
      branchCompletedMemberCount = opts.branchMemberIds.filter((uid) => {
        const done = opts.completedByMember!.get(uid) ?? new Set()
        return contentIds.every((cid) => done.has(cid))
      }).length
      branchCompletionRate = Math.round((branchCompletedMemberCount / branchMemberCount) * 100)
    }
  }

  return {
    id: r.id,
    orgUnitId: r.org_unit_id,
    title: r.title,
    dueAt: r.due_at,
    createdAt: r.created_at,
    contentIds,
    contents: items,
    completedCount,
    totalCount,
    progressPercent,
    isCompleted: totalCount > 0 && completedCount === totalCount,
    branchMemberCount,
    branchCompletedMemberCount,
    branchCompletionRate,
  }
}

router.get('/', async (req: Request, res: Response) => {
  if (!requireAuth(req)) {
    rejectUnauthorized(res)
    return
  }

  const { role, userId } = getUserContext(req)
  const orgUnitIdParam = req.query.orgUnitId ? String(req.query.orgUnitId) : null

  const orgUnitId =
    role === 'admin'
      ? orgUnitIdParam
      : role === 'secretary' || role === 'member'
        ? await getOrgUnitIdForUser(userId)
        : null

  // 非管理员必须绑定支部，避免未登录/未知角色拉全量
  if (role !== 'admin' && !orgUnitId) {
    res.status(200).json({ success: true, data: [] })
    return
  }

  const where: string[] = []
  const params: unknown[] = []

  if (orgUnitId) {
    where.push(`org_unit_id = $${params.length + 1}`)
    params.push(orgUnitId)
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  const { rows } = await query(
    `SELECT id, org_unit_id, title, due_at, created_at
     FROM learning_tasks
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT 200`,
    params,
  )

  const taskIds = rows.map((r) => String(r.id))
  const contentsByTask = await loadTaskContentsMap(taskIds)
  const allContentIds = [...new Set([...contentsByTask.values()].flat())]
  const contentMeta = await getContentMetaMap(allContentIds)

  const personalCompleted =
    role === 'member' || role === 'secretary'
      ? ((await loadCompletedByUserIds([userId])).get(userId) ?? new Set<string>())
      : null

  // 批量取相关支部党员与完成记录（管理员全量时一次取齐）
  const relatedOrgIds =
    role === 'admin' || role === 'secretary'
      ? orgUnitId
        ? [orgUnitId]
        : [...new Set(rows.map((r) => String(r.org_unit_id)))]
      : []
  const membersByOrg = await loadMemberIdsByOrg(relatedOrgIds)
  const allBranchMemberIds = [...new Set([...membersByOrg.values()].flat())]
  const completedByMember =
    role === 'admin' || role === 'secretary'
      ? await loadCompletedByUserIds(allBranchMemberIds)
      : undefined

  const data = rows.map((r) => {
    const tid = String(r.id)
    const cids = contentsByTask.get(tid) ?? []
    const members =
      role === 'admin' || role === 'secretary' ? (membersByOrg.get(String(r.org_unit_id)) ?? []) : null
    return buildTaskPayload(r, cids, {
      contentMeta,
      completedIds: personalCompleted,
      branchMemberIds: members,
      completedByMember,
    })
  })

  res.status(200).json({ success: true, data })
})

router.post('/', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin', 'secretary'])) {
    res.status(403).json({ success: false, error: '无权限操作' })
    return
  }

  const { userId, role } = getUserContext(req)
  const orgUnitId =
    role === 'secretary' ? await getOrgUnitIdForUser(userId) : String(req.body?.orgUnitId ?? '')
  if (!orgUnitId) {
    res.status(400).json({ success: false, error: '缺少 orgUnitId' })
    return
  }

  const id = `task_${nanoid(10)}`
  const ts = nowIso()
  const contentIds = Array.isArray(req.body?.contentIds) ? (req.body.contentIds as string[]) : []

  await withTransaction(async (client) => {
    await client.query(
      'INSERT INTO learning_tasks (id, org_unit_id, title, due_at, created_at) VALUES ($1, $2, $3, $4, $5)',
      [id, orgUnitId, String(req.body?.title ?? ''), req.body?.dueAt ? String(req.body.dueAt) : null, ts],
    )
    for (const cid of contentIds) {
      await client.query('INSERT INTO task_contents (task_id, content_id) VALUES ($1, $2)', [id, cid])
    }
  })

  await audit(userId || 'u_admin_demo', 'tasks.create', { id, orgUnitId, contentCount: contentIds.length })
  res.status(200).json({ success: true, data: { id } })
})

router.get('/:id', async (req: Request, res: Response) => {
  if (!requireAuth(req)) {
    rejectUnauthorized(res)
    return
  }

  const { role, userId } = getUserContext(req)
  const id = String(req.params.id)

  const row = (
    await query(
      'SELECT id, org_unit_id, title, due_at, created_at FROM learning_tasks WHERE id = $1',
      [id],
    )
  ).rows[0]

  if (!row) {
    res.status(404).json({ success: false, error: '任务不存在' })
    return
  }

  if (role === 'member' || role === 'secretary') {
    const ownOrg = await getOrgUnitIdForUser(userId)
    if (String(row.org_unit_id) !== ownOrg) {
      res.status(403).json({ success: false, error: '无权限访问该任务' })
      return
    }
  }

  res.status(200).json({
    success: true,
    data: {
      id: row.id,
      orgUnitId: row.org_unit_id,
      title: row.title,
      dueAt: row.due_at,
      createdAt: row.created_at,
      contentIds: await getContentIdsForTask(id),
    },
  })
})

router.put('/:id', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin', 'secretary'])) {
    res.status(403).json({ success: false, error: '无权限操作' })
    return
  }

  const { userId, role } = getUserContext(req)
  const id = String(req.params.id)
  const row = (await query('SELECT id, org_unit_id FROM learning_tasks WHERE id = $1', [id])).rows[0]
  if (!row) {
    res.status(404).json({ success: false, error: '任务不存在' })
    return
  }

  if (role === 'secretary') {
    const ownOrg = await getOrgUnitIdForUser(userId)
    if (String(row.org_unit_id) !== ownOrg) {
      res.status(403).json({ success: false, error: '只能编辑本支部任务' })
      return
    }
  }

  const orgUnitId =
    role === 'secretary' ? String(row.org_unit_id) : String(req.body?.orgUnitId ?? row.org_unit_id)
  const title = String(req.body?.title ?? '')
  const dueAt = req.body?.dueAt ? String(req.body.dueAt) : null
  const contentIds = Array.isArray(req.body?.contentIds) ? (req.body.contentIds as string[]) : null

  await withTransaction(async (client) => {
    await client.query(
      'UPDATE learning_tasks SET org_unit_id = $1, title = $2, due_at = $3 WHERE id = $4',
      [orgUnitId, title, dueAt, id],
    )
    if (contentIds) {
      await client.query('DELETE FROM task_contents WHERE task_id = $1', [id])
      for (const cid of contentIds) {
        await client.query('INSERT INTO task_contents (task_id, content_id) VALUES ($1, $2)', [id, cid])
      }
    }
  })

  await audit(userId || 'u_admin_demo', 'tasks.update', { id })
  res.status(200).json({ success: true })
})

router.delete('/:id', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin', 'secretary'])) {
    res.status(403).json({ success: false, error: '无权限操作' })
    return
  }

  const { userId, role } = getUserContext(req)
  const id = String(req.params.id)
  const row = (await query('SELECT id, org_unit_id FROM learning_tasks WHERE id = $1', [id])).rows[0]
  if (!row) {
    res.status(404).json({ success: false, error: '任务不存在' })
    return
  }

  if (role === 'secretary') {
    const ownOrg = await getOrgUnitIdForUser(userId)
    if (String(row.org_unit_id) !== ownOrg) {
      res.status(403).json({ success: false, error: '只能删除本支部任务' })
      return
    }
  }

  await withTransaction(async (client) => {
    await client.query('DELETE FROM task_contents WHERE task_id = $1', [id])
    await client.query('DELETE FROM learning_tasks WHERE id = $1', [id])
  })
  await audit(userId || 'u_admin_demo', 'tasks.delete', { id })
  res.status(200).json({ success: true })
})

export default wrapAsyncRouter(router)

