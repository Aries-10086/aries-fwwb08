import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import { ArrowRight, ClipboardList, Sparkles } from 'lucide-react'

type Attempt = {
  id: string
  totalScore: number
  isPass: boolean
  createdAt: string
}

type Exam = {
  id: string
  title: string
  durationMin: number
  passScore: number
  maxAttempts: number
  attemptCount: number
  remainingAttempts: number
  canAttempt: boolean
  bestScore: number | null
  attempts: Attempt[]
  status: string
  createdAt: string
}

export default function MobileExams() {
  const nav = useNavigate()
  const { user } = useAuthStore()
  const [items, setItems] = useState<Exam[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) nav('/login')
  }, [nav, user])

  async function load() {
    setError(null)
    try {
      const data = await apiFetch<Exam[]>('/api/exams')
      setItems(data)
    } catch (e: any) {
      setError(e?.message ?? '加载失败')
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="page-eyebrow">党员端</div>
          <h1 className="page-title text-3xl md:text-4xl">测验列表</h1>
          <div className="page-subtitle mt-2 max-w-2xl">仅展示本支部已发布测验；每位学员有作答次数限制</div>
        </div>
        <Link to="/m/report">
          <Button>
            <Sparkles className="h-4 w-4" />
            AI 报告
          </Button>
        </Link>
      </div>

      {error && (
        <div className="rounded-2xl bg-[rgba(163,24,40,0.08)] px-4 py-3 text-[#7a1020] shadow-[inset_0_0_0_1px_rgba(163,24,40,0.16)]">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-[#a31828]" />
            可参与测验
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {items.map((x) => (
              <div
                key={x.id}
                className="rounded-xl bg-white/90 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-[#0e1116]">{x.title}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {x.durationMin} 分钟 · 及格 {x.passScore} 分 · 已考 {x.attemptCount}/
                      {x.maxAttempts} 次
                      {x.bestScore != null ? ` · 最高分 ${x.bestScore}` : ''}
                    </div>
                  </div>
                  {x.canAttempt ? (
                    <Link to={`/m/exam/${x.id}`}>
                      <Button className="px-3">
                        {x.attemptCount > 0 ? '再考一次' : '开始'}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  ) : (
                    <span className="rounded-full bg-black/5 px-3 py-1 text-xs text-zinc-500">次数已用完</span>
                  )}
                </div>
                {(x.attempts?.length ?? 0) > 0 && (
                  <div className="mt-3 grid gap-1 border-t border-black/5 pt-3">
                    <div className="text-xs font-medium text-zinc-500">历史成绩</div>
                    {x.attempts.slice(0, 5).map((a) => (
                      <div key={a.id} className="flex justify-between text-xs text-[rgba(14,17,22,0.7)]">
                        <span>{new Date(a.createdAt).toLocaleString()}</span>
                        <span>
                          {a.totalScore} 分 · {a.isPass ? '通过' : '未通过'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {items.length === 0 && <div className="py-8 text-sm text-zinc-400">暂无可参与测验</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
