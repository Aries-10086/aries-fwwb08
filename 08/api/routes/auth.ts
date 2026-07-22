/**
 * This is a user authentication API route demo.
 * Handle user registration, login, token management, etc.
 */
import { Router, type Request, type Response } from 'express'
import { db, audit } from '../db.js'
import type { UserRole } from '../../shared/types.js'

const router = Router()

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const role = String(req.body?.role ?? 'member') as UserRole
  const id =
    role === 'admin' ? 'u_admin_demo' : role === 'secretary' ? 'u_secretary_demo' : 'u_member_demo'

  const user = db
    .prepare('SELECT id, name, role, org_unit_id FROM users WHERE id = ?')
    .get(id) as any

  if (!user) {
    res.status(400).json({ success: false, error: '用户不存在，请先初始化演示数据' })
    return
  }

  audit(user.id, 'auth.login', { role: user.role })

  res.status(200).json({
    success: true,
    data: {
      token: `demo_${user.id}`,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        orgUnitId: user.org_unit_id,
      },
    },
  })
})

router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  const userId = String(req.body?.userId ?? '')
  if (userId) audit(userId, 'auth.logout', {})
  res.status(200).json({ success: true })
})

export default router
