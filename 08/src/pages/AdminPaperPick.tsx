import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import { loadPaperDraft, savePaperDraft, type PaperDraft } from '@/utils/paperDraft'
import {
  ArrowLeft,
  ArrowsClockwise,
  CheckCircle,
  CheckSquare,
  Circle,
  ListChecks,
  Plus,
} from '@phosphor-icons/react'

type QuestionType = 'single' | 'multiple' | 'tf'

type Question = {
  id: string
  type: QuestionType
  category: string
  stem: string
}

const TYPE_META: Record<
  QuestionType,
  { label: string; icon: typeof Circle }
> = {
  single: {
    label: '单选题',
    icon: Circle,
  },
  tf: {
    label: '判断题',
    icon: CheckSquare,
  },
  multiple: {
    label: '多选题',
    icon: ListChecks,
  },
}

function isQuestionType(value: string | undefined): value is QuestionType {
  return value === 'single' || value === 'multiple' || value === 'tf'
}

export default function AdminPaperPick() {
  const nav = useNavigate()
  const { type: typeParam } = useParams()
  const { user } = useAuthStore()
  const questionType = isQuestionType(typeParam) ? typeParam : null

  const [questions, setQuestions] = useState<Question[]>([])
  const [draft, setDraft] = useState<PaperDraft>(() => loadPaperDraft())
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [addedId, setAddedId] = useState<string | null>(null)

  const meta = questionType ? TYPE_META[questionType] : null
  const filtered = useMemo(
    () => (questionType ? questions.filter((q) => q.type === questionType) : []),
    [questions, questionType],
  )
  const pickedIds = useMemo(() => new Set(draft.picks.map((p) => p.questionId)), [draft.picks])

  useEffect(() => {
    if (!user) nav('/login')
    if (user && user.role !== 'admin') nav('/m/home')
    if (typeParam && !isQuestionType(typeParam)) nav('/admin/papers', { replace: true })
  }, [nav, user, typeParam])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<Question[]>('/api/questions')
      setQuestions(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (questionType) void load()
  }, [questionType])

  useEffect(() => {
    setDraft(loadPaperDraft())
  }, [])

  function addQuestion(questionId: string) {
    if (pickedIds.has(questionId)) return
    const next: PaperDraft = {
      ...draft,
      picks: [...draft.picks, { questionId, score: 30 }],
    }
    setDraft(next)
    savePaperDraft(next)
    setAddedId(questionId)
    window.setTimeout(() => setAddedId(null), 1200)
  }

  if (!questionType || !meta) return null

  const Icon = meta.icon

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            to="/admin/papers"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-[rgba(18,21,28,0.55)] hover:text-[#9e1b2b]"
          >
            <ArrowLeft className="h-4 w-4" />
            返回试卷管理
          </Link>
          <div className="page-eyebrow">管理后台 · 组卷</div>
          <h1 className="page-title text-3xl md:text-4xl">选择{meta.label}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => void load()} disabled={loading}>
            <ArrowsClockwise className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            刷新
          </Button>
          <Link to="/admin/papers">
            <Button>
              已选 {draft.picks.length} 题 · 完成选择
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-[rgba(158,27,43,0.08)] px-4 py-3 text-[#741220] shadow-[inset_0_0_0_1px_rgba(158,27,43,0.16)]">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-[#9e1b2b]" weight="duotone" />
            {meta.label}库
            <span className="ml-2 text-sm font-normal text-zinc-500">({filtered.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2">
            {filtered.map((q) => {
              const picked = pickedIds.has(q.id)
              const justAdded = addedId === q.id
              return (
                <button
                  key={q.id}
                  type="button"
                  disabled={picked}
                  onClick={() => addQuestion(q.id)}
                  className={[
                    'rounded-xl px-4 py-3 text-left transition',
                    'shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]',
                    picked
                      ? 'bg-[rgba(31,107,74,0.06)] text-[rgba(18,21,28,0.55)]'
                      : justAdded
                        ? 'bg-[rgba(31,107,74,0.12)] text-[#12151c]'
                        : 'bg-white/90 text-[#12151c] hover:bg-[rgba(158,27,43,0.05)]',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs text-zinc-500">{q.category}</div>
                    {picked ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-[#1f6b4a]">
                        <CheckCircle className="h-3.5 w-3.5" weight="fill" />
                        已加入
                      </span>
                    ) : justAdded ? (
                      <span className="text-xs font-medium text-[#1f6b4a]">已添加</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-[#9e1b2b]">
                        <Plus className="h-3.5 w-3.5" />
                        添加
                      </span>
                    )}
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm">{q.stem}</div>
                </button>
              )
            })}
            {filtered.length === 0 && !loading && (
              <div className="col-span-full py-10 text-center text-sm text-zinc-400">
                暂无{meta.label}
                <div className="mt-3">
                  <Link to={`/admin/questions/${questionType}`}>
                    <Button variant="secondary">去题库添加题目</Button>
                  </Link>
                </div>
              </div>
            )}
            {loading && filtered.length === 0 && (
              <div className="col-span-full py-10 text-center text-sm text-zinc-400">加载中…</div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {(['single', 'tf', 'multiple'] as QuestionType[])
          .filter((t) => t !== questionType)
          .map((t) => (
            <Link key={t} to={`/admin/papers/pick/${t}`}>
              <Button variant="secondary">去选择{TYPE_META[t].label}</Button>
            </Link>
          ))}
      </div>
    </div>
  )
}
