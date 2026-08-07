import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import { ArrowsClockwise, ListChecks } from '@phosphor-icons/react'

type LogItem = {
  id: string
  userName: string
  type: string
  status?: string
  ok?: boolean
  provider?: string
  model?: string
  latencyMs?: number
  errorCode?: string | null
  createdAt: string
}

export default function AdminAILogs() {
  const nav = useNavigate()
  const { user } = useAuthStore()
  const [kind, setKind] = useState<'audit' | 'llm'>('audit')
  const [items, setItems] = useState<LogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) nav('/login')
    else if (user.role !== 'admin') nav('/m/home')
  }, [user, nav])

  async function load(nextKind = kind) {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<{ items: LogItem[] }>(`/api/ai/logs?kind=${nextKind}&limit=100`)
      setItems(data.items ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.role === 'admin') void load(kind)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, kind])

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="page-eyebrow">管理后台</div>
          <h1 className="page-title text-3xl md:text-4xl">AI / 操作审计</h1>
          <p className="page-subtitle mt-2">只读查看调用成败与操作记录</p>
        </div>
        <Button variant="ghost" disabled={loading} onClick={() => void load()}>
          <ArrowsClockwise className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          刷新
        </Button>
      </div>

      <div className="flex gap-2">
        {(
          [
            ['audit', '操作审计'],
            ['llm', 'AI 调用日志'],
          ] as const
        ).map(([k, label]) => (
          <Button
            key={k}
            variant={kind === k ? 'primary' : 'secondary'}
            className="px-3"
            onClick={() => setKind(k)}
          >
            {label}
          </Button>
        ))}
      </div>

      {error && (
        <div className="rounded-2xl bg-[rgba(158,27,43,0.08)] px-4 py-3 text-[#741220]">{error}</div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-[#9e1b2b]" />
            {kind === 'llm' ? 'llm_calls' : 'ai_logs'} · 最近 {items.length} 条
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-[rgba(18,21,28,0.45)]">
                <tr>
                  <th className="pb-2 font-medium">时间</th>
                  <th className="pb-2 font-medium">用户</th>
                  <th className="pb-2 font-medium">类型</th>
                  <th className="pb-2 font-medium">成败</th>
                  {kind === 'llm' && <th className="pb-2 font-medium">耗时</th>}
                  {kind === 'llm' && <th className="pb-2 font-medium">模型</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-black/5">
                    <td className="py-2.5 text-xs text-[rgba(18,21,28,0.55)]">
                      {new Date(it.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5">{it.userName}</td>
                    <td className="py-2.5 font-medium">{it.type}</td>
                    <td className="py-2.5">
                      <span className={it.ok ? 'text-[#1f6b4a]' : 'text-[#9e1b2b]'}>
                        {it.ok ? '成功' : it.status === 'aborted' ? '超时' : '失败'}
                        {it.errorCode ? ` · ${it.errorCode}` : ''}
                      </span>
                    </td>
                    {kind === 'llm' && (
                      <td className="py-2.5 text-xs">{it.latencyMs != null ? `${it.latencyMs}ms` : '—'}</td>
                    )}
                    {kind === 'llm' && (
                      <td className="py-2.5 text-xs text-[rgba(18,21,28,0.55)]">
                        {it.provider ? `${it.provider}/` : ''}
                        {it.model || '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && !loading && (
              <div className="py-10 text-center text-sm text-zinc-400">暂无日志</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
