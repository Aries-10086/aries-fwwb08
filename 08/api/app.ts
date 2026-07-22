/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
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
import { initDb, seedIfEmpty } from './db.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

initDb()
seedIfEmpty()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

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
app.use('/api/ai', aiRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
