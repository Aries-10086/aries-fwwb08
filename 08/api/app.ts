/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import orgUnitRoutes from './routes/org-units.js'
import userRoutes from './routes/users.js'
import contentRoutes from './routes/contents.js'
import taskRoutes from './routes/tasks.js'
import learningRoutes from './routes/learning.js'
import questionRoutes from './routes/questions.js'
import paperRoutes from './routes/papers.js'
import examRoutes from './routes/exams.js'
import statsRoutes from './routes/stats.js'
import aiRoutes from './routes/ai.js'
import fileRoutes from './routes/files.js'
import chatRoutes from './routes/chat.js'
import kbRoutes from './routes/kb.js'
import aiSettingsRoutes from './routes/ai-settings.js'
import { checkDatabaseHealth, initializeDatabase } from './db.js'
import { attachAuth } from './utils/http.js'
import { LlmError } from './services/llm.js'
import { AIServiceError } from './services/ai-service.js'

// load env
dotenv.config()

await initializeDatabase()

const app: express.Application = express()

const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const isProd = process.env.NODE_ENV === 'production'

/** 开发态允许本机 / 局域网前端（含手机通过 Vite --host 访问） */
function isLocalDevOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin)
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true
    return false
  } catch {
    return false
  }
}

app.use(
  cors({
    origin: (origin, cb) => {
      // 允许同机开发无 Origin（如 curl）以及白名单前端
      if (!origin || corsOrigins.includes(origin) || corsOrigins.includes('*')) {
        cb(null, true)
        return
      }
      if (!isProd && isLocalDevOrigin(origin)) {
        cb(null, true)
        return
      }
      cb(new Error('CORS blocked'))
    },
    credentials: true,
  }),
)
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use((req: Request, res: Response, next: NextFunction) => {
  void attachAuth(req, res, next).catch(next)
})

// 不再公开静态 /uploads，文件必须经鉴权路由下载
app.use('/api/files', fileRoutes)

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/org-units', orgUnitRoutes)
app.use('/api/users', userRoutes)
app.use('/api/contents', contentRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/learning', learningRoutes)
app.use('/api/questions', questionRoutes)
app.use('/api/papers', paperRoutes)
app.use('/api/exams', examRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/ai/settings', aiSettingsRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/kb', kbRoutes)

/**
 * health
 */
app.get('/api/health', async (_req: Request, res: Response): Promise<void> => {
  const healthy = await checkDatabaseHealth()
  res.status(healthy ? 200 : 503).json({
    success: healthy,
    message: healthy ? 'ok' : 'database unavailable',
  })
})

/**
 * error handler middleware
 */
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  void _next
  if (String(error?.message || '').includes('CORS')) {
    res.status(403).json({ success: false, error: '跨域请求被拒绝' })
    return
  }
  if (error instanceof LlmError || error instanceof AIServiceError) {
    res.status(error.status === 499 ? 503 : error.status).json({
      success: false,
      error: error.message,
      code: error.code,
    })
    return
  }
  console.error(error)
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
