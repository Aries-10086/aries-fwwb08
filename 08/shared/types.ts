export type UserRole = 'member' | 'secretary' | 'admin'

export type ContentType = 'article' | 'video'

export type QuestionType = 'single' | 'multiple' | 'tf'

export type ExamStatus = 'draft' | 'published' | 'closed'

export interface OrgUnit {
  id: string
  name: string
  parentId: string | null
}

export interface User {
  id: string
  name: string
  role: UserRole
  orgUnitId: string
}

export interface Content {
  id: string
  type: ContentType
  title: string
  body: string
  category: string
  tags: string[]
  isPublic: boolean
}

export interface LearningTask {
  id: string
  orgUnitId: string
  title: string
  dueAt: string | null
  contentIds: string[]
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
  options?: QuestionOption[]
  answerKey?: string | string[] | boolean
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
}

export interface Exam {
  id: string
  orgUnitId: string
  paperId: string
  title: string
  durationMin: number
  passScore: number
  status: ExamStatus
}

