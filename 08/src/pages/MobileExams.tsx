import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import { ArrowRight, ClipboardList, Sparkles } from 'lucide-react'

type Exam = {
  id: string
  title: string
  durationMin: number
  passScore: number
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
          <div className="page-subtitle mt-2">仅展示本支部已发布测验</div>
        </div>
        <Link to="/m/report">
          <Button>
            <Sparkles className="h-4 w-4" />
            AI 报告
          </Button>
        </Link>
      </div>

      {error && (
        <div className="border border-[rgba(163,24,40,0.2)] bg-[rgba(163,24,40,0.08)] px-4 py-3 text-[#7a1020]">
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
          <div className="grid gap-2">
            {items.map((x) => (
              <Link
                key={x.id}
                to={`/m/exam/${x.id}`}
                className="list-surface flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-medium text-[#0e1116]">{x.title}</div>
                  <div className="mt-1 text-xs text-[rgba(14,17,22,0.45)]">
                    {x.durationMin} 分钟 · 及格 {x.passScore} 分
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[rgba(14,17,22,0.45)]" />
              </Link>
            ))}
            {items.length === 0 && <div className="py-8 text-sm text-[rgba(14,17,22,0.4)]">暂无可参与测验</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

