/** 前后端共用的领域类型 —— 与 API 响应 / SQLite 字段保持同步 */

export type UserRole = 'member' | 'secretary' | 'admin'

export type ContentType = 'article' | 'video'

export type QuestionType = 'single' | 'multiple' | 'tf'

export type ExamStatus = 'draft' | 'published' | 'closed'

export interface OrgUnit {
  id: string
  name: string
  parentId: string | null
  createdAt?: string
}

export interface OrgUnitStats {
  memberCount: number
  taskCount: number
  avgExamScore: number
  completionRate: number
}

export interface OrgUnitDetail extends OrgUnit {
  stats?: OrgUnitStats
  members?: Array<{ id: string; name: string; role: string }>
}

export interface User {
  id: string
  name: string
  /** 登录账号；库表列 username */
  username: string
  role: UserRole
  orgUnitId: string
  createdAt?: string
}

export interface ContentAttachment {
  id: string
  name: string
  url: string
  size: number
  mime: string
}

export interface Content {
  id: string
  type: ContentType
  title: string
  body: string
  category: string
  tags: string[]
  /** 附件列表；库表列 attachments_json */
  attachments: ContentAttachment[]
  isPublic: boolean
  createdAt?: string
  updatedAt?: string
}

export interface TaskContentItem {
  id: string
  title: string
  type: ContentType | string
  isCompleted: boolean
}

export interface LearningTask {
  id: string
  orgUnitId: string
  title: string
  dueAt: string | null
  contentIds: string[]
  createdAt?: string
  /** 任务内容明细（含个人完成状态） */
  contents?: TaskContentItem[]
  completedCount?: number
  totalCount?: number
  progressPercent?: number
  isCompleted?: boolean
  branchMemberCount?: number | null
  branchCompletedMemberCount?: number | null
  branchCompletionRate?: number | null
}

export interface LearningProgress {
  contentId: string
  /** 累计学习时长（毫秒） */
  durationMs: number
  isCompleted: boolean
  updatedAt?: string | null
}

export interface LearningRecord {
  id: string
  userId?: string
  contentId?: string
  /** 累计学习时长（毫秒）；写入时入参为增量 */
  durationMs: number
  isCompleted: boolean
  createdAt?: string
  updatedAt?: string
}

export interface QuestionOption {
  key: string
  text: string
}

export interface Question {
  id: string
  type: QuestionType
  category: string
  stem: string
  options?: QuestionOption[] | null
  answerKey?: string | string[] | boolean | null
  createdAt?: string
  updatedAt?: string
}

export interface PaperQuestion {
  questionId: string
  score: number
  orderNo: number
}

export interface Paper {
  id: string
  title: string
  durationMin: number
  passScore: number
  questions: PaperQuestion[]
  createdAt?: string
}

/** 组卷后随试卷下发的题目（含分值，不含标准答案） */
export interface ExamPaperQuestion {
  id: string
  type: QuestionType
  category: string
  stem: string
  options?: QuestionOption[] | null
  score: number
  orderNo: number
}

export interface Exam {
  id: string
  orgUnitId: string
  paperId: string
  title: string
  durationMin: number
  passScore: number
  /** 最大作答次数；库表列 max_attempts */
  maxAttempts: number
  status: ExamStatus
  createdAt?: string
  /** 当前用户已作答次数（列表/详情附加） */
  attemptCount?: number
  remainingAttempts?: number
  canAttempt?: boolean
  bestScore?: number | null
  attempts?: ExamAttemptSummary[]
}

export interface ExamAttemptSummary {
  id: string
  totalScore: number
  isPass: boolean
  createdAt: string
}

export interface ExamSession {
  sessionId: string
  startedAt: string
  expiresAt: string
  durationMin: number
  attemptCount: number
  maxAttempts: number
}

export interface ExamAnswerDetail {
  orderNo: number
  questionId: string
  type: QuestionType
  category: string
  stem: string
  options?: QuestionOption[] | null
  userAnswer: unknown
  correctAnswer: unknown
  userAnswerLabel: string
  correctAnswerLabel: string
  score: number
  maxScore: number
  isCorrect: boolean
}

export interface ExamAttemptReview {
  attemptId: string
  examId: string
  examTitle: string
  userId: string
  totalScore: number
  passScore: number
  isPass: boolean
  createdAt: string
  correctCount: number
  wrongCount: number
  details: ExamAnswerDetail[]
}

export interface ApiSuccess<T> {
  success: true
  data: T
}

export interface ApiFailure {
  success: false
  error: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure
