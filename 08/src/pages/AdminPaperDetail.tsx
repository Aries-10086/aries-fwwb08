import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import {
  ArrowLeft,
  ArrowsClockwise,
  CheckSquare,
  Circle,
  ListChecks,
  Trash,
} from '@phosphor-icons/react'

type PaperQuestion = {
  questionId: string
  score: number
  orderNo: number
  type: string
  category: string
  stem: string
  options: { key: string; text: string }[] | null
  answerKey: unknown
}

type PaperDetail = {
  id: string
  title: string
  durationMin: number
  passScore: number
  createdAt: string
  questions: PaperQuestion[]
}

const TYPE_LABEL: Record<string, string> = {
  single: '单选',
  multiple: '多选',
  tf: '判断',
}

const TYPE_ICON: Record<string, typeof Circle> = {
  single: Circle,
  multiple: ListChecks,
  tf: CheckSquare,
}

function formatAnswer(type: string, answerKey: unknown, options: PaperQuestion['options']) {
  if (answerKey === null || answerKey === undefined) return '—'
  if (type === 'tf') return answerKey === true || answerKey === 'true' ? '正确' : '错误'
  const optMap = new Map((options ?? []).map((o) => [String(o.key), o.text]))
  const keys = Array.isArray(answerKey) ? answerKey.map(String) : [String(answerKey)]
  return keys.map((k) => (optMap.get(k) ? `${k}. ${optMap.get(k)}` : k)).join('；')
}

export default function AdminPaperDetail() {
  const nav = useNavigate()
  const { id } = useParams()
  const { user } = useAuthStore()
  const [paper, setPaper] = useState<PaperDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!user) nav('/login')
    if (user && user.role !== 'admin') nav('/m/home')
  }, [nav, user])

  async function load() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<PaperDetail>(`/api/papers/${id}`)
      setPaper(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败')
      setPaper(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [id])

  const totalScore = useMemo(
    () => (paper?.questions ?? []).reduce((sum, q) => sum + Number(q.score ?? 0), 0),
    [paper],
  )

  async function remove() {
    if (!paper) return
    if (!confirm('确认删除该试卷？若已被测验引用将无法删除。')) return
    setDeleting(true)
    setError(null)
    try {
      await apiFetch<void>(`/api/papers/${paper.id}`, { method: 'DELETE' })
      nav('/admin/papers')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            to="/admin/papers"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-[rgba(18,21,28,0.55)] hover:text-[#9e1b2b]"
          >
            <ArrowLeft className="h-4 w-4" />
            返回试卷列表
          </Link>
          <div className="page-eyebrow">管理后台 · 试卷</div>
          <h1 className="page-title text-3xl md:text-4xl">{paper?.title ?? '试卷详情'}</h1>
          <div className="page-subtitle mt-2 max-w-2xl">
            {paper
              ? `${paper.durationMin} 分钟 · 及格 ${paper.passScore} · 共 ${paper.questions.length} 题 · 总分 ${totalScore}`
              : '查看试卷题目、分值与答案'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => void load()} disabled={loading}>
            <ArrowsClockwise className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            刷新
          </Button>
          <Button variant="danger" onClick={() => void remove()} disabled={!paper || deleting}>
            <Trash className="h-4 w-4" />
            删除
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-[rgba(158,27,43,0.08)] px-4 py-3 text-[#741220] shadow-[inset_0_0_0_1px_rgba(158,27,43,0.16)]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-zinc-400">加载中…</div>
      ) : !paper ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-zinc-400">试卷不存在或已删除</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ['时长', `${paper.durationMin} 分钟`],
              ['及格线', `${paper.passScore} 分`],
              ['题量', `${paper.questions.length} 题`],
              ['总分', `${totalScore} 分`],
            ].map(([k, v]) => (
              <div
                key={k}
                className="rounded-xl bg-white/90 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
              >
                <div className="text-[11px] uppercase tracking-[0.18em] text-[rgba(18,21,28,0.4)]">{k}</div>
                <div className="mt-1 text-xl font-bold text-[#12151c]">{v}</div>
              </div>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>题目明细</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {paper.questions.map((q, idx) => {
                  const Icon = TYPE_ICON[q.type] ?? Circle
                  return (
                    <div
                      key={q.questionId}
                      className="rounded-xl bg-white/90 p-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                            <span className="font-medium text-[#9e1b2b]">第 {idx + 1} 题</span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                              <Icon className="h-3.5 w-3.5" />
                              {TYPE_LABEL[q.type] ?? q.type}
                            </span>
                            <span>·</span>
                            <span>{q.category || '未分类'}</span>
                          </div>
                          <div className="mt-2 text-sm font-medium text-[#12151c]">{q.stem}</div>
                        </div>
                        <div className="shrink-0 rounded-full bg-[rgba(158,27,43,0.08)] px-2.5 py-0.5 text-xs font-semibold text-[#9e1b2b]">
                          {q.score} 分
                        </div>
                      </div>

                      {q.type !== 'tf' && (q.options?.length ?? 0) > 0 && (
                        <div className="mt-3 grid gap-1.5">
                          {q.options!.map((op) => (
                            <div
                              key={op.key}
                              className="rounded-lg bg-[rgba(18,21,28,0.02)] px-3 py-2 text-sm text-[rgba(18,21,28,0.75)]"
                            >
                              <span className="mr-2 text-xs font-medium text-zinc-500">{op.key}.</span>
                              {op.text}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="mt-3 text-xs">
                        <span className="text-zinc-500">正确答案：</span>
                        <span className="font-medium text-[#1f6b4a]">
                          {formatAnswer(q.type, q.answerKey, q.options)}
                        </span>
                      </div>
                    </div>
                  )
                })}
                {paper.questions.length === 0 && (
                  <div className="py-10 text-sm text-zinc-400">该试卷暂无题目</div>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
