import { FormEvent, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowUp, Plus } from '@phosphor-icons/react'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { postSSE } from '@/utils/sse'
import { friendlyAiError } from '@/utils/aiError'

type Msg = { id: string; role: 'user' | 'assistant'; content: string }

export default function Chat() {
  const nav = useNavigate()
  const [search] = useSearchParams()
  const contentId = search.get('contentId') || undefined
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusHint, setStatusHint] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const st = await apiFetch<{ degraded?: boolean; message?: string | null }>('/api/ai/status')
        if (st.degraded && st.message) setStatusHint(st.message)
      } catch {
        /* ignore */
      }
    })()
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function ensureSession() {
    if (sessionId) return sessionId
    const data = await apiFetch<{ id: string } | { session: { id: string } }>('/api/chat/sessions', {
      method: 'POST',
      body: JSON.stringify(contentId ? { contentId } : {}),
    })
    const id =
      typeof data === 'object' && data && 'session' in data
        ? String((data as { session: { id: string } }).session.id)
        : String((data as { id: string }).id)
    if (!id) throw new Error('创建会话失败')
    setSessionId(id)
    return id
  }

  async function send(event?: FormEvent, preset?: string) {
    event?.preventDefault()
    const content = (preset ?? input).trim()
    if (!content || sending) return
    setInput('')
    setError(null)
    setSending(true)
    const userMsg: Msg = { id: `u_${Date.now()}`, role: 'user', content }
    const assistantId = `a_${Date.now()}`
    setMessages((p) => [...p, userMsg, { id: assistantId, role: 'assistant', content: '' }])
    try {
      const id = await ensureSession()
      const controller = new AbortController()
      abortRef.current = controller
      await postSSE(`/api/chat/sessions/${encodeURIComponent(id)}/messages`, {
        body: { content, ...(contentId ? { contentId } : {}) },
        signal: controller.signal,
        onEvent: ({ event: eventName, data }) => {
          const payload =
            typeof data === 'object' && data ? (data as Record<string, unknown>) : { content: String(data ?? '') }
          const type = eventName === 'message' ? String(payload.type ?? 'delta') : eventName
          if (['delta', 'token', 'content_delta', 'message_delta'].includes(type)) {
            const delta = String(payload.delta ?? payload.content ?? payload.text ?? payload.token ?? '')
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m)),
            )
          } else if (type === 'error') {
            throw new Error(String(payload.error ?? payload.message ?? '生成失败'))
          }
        },
      })
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return
      const msg = friendlyAiError(e instanceof Error ? e.message : '生成失败')
      setError(msg)
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: m.content || msg } : m)),
      )
    } finally {
      abortRef.current = null
      setSending(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col px-4 pb-4 pt-[max(0.75rem,var(--safe-top))]">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="inline-flex items-center gap-1 text-sm text-ink/55" onClick={() => nav(-1)}>
          <ArrowLeft size={16} /> 返回
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-seal"
          onClick={() => {
            setSessionId(null)
            setMessages([])
            setError(null)
          }}
        >
          <Plus size={14} /> 新会话
        </button>
      </div>
      <h1 className="mt-3 text-xl font-bold">AI 助手</h1>
      <p className="mt-1 text-xs text-ink/45">
        {contentId ? '围绕当前学习内容问答' : '学习推荐 / 进度 / 薄弱点咨询'}
      </p>
      {(statusHint || error) && (
        <div className="mt-3 rounded-xl bg-seal/10 px-3 py-2 text-xs text-seal-deep">{error || statusHint}</div>
      )}

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <div className="grid gap-2">
            {['推荐适合我的学习内容', '总结我最近的学习进度', '分析我的薄弱知识点'].map((q) => (
              <button
                key={q}
                type="button"
                className="m-card px-3 py-3 text-left text-sm"
                onClick={() => void send(undefined, q)}
              >
                {q}
              </button>
            ))}
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-2xl px-3 py-2.5 text-sm leading-6 whitespace-pre-wrap ${
              m.role === 'user' ? 'ml-8 bg-seal text-white' : 'mr-8 bg-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]'
            }`}
          >
            {m.content || (sending ? '…' : '')}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form className="mt-3 flex gap-2" onSubmit={(e) => void send(e)}>
        <input
          className="m-input flex-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入问题…"
          disabled={sending}
        />
        <Button type="submit" className="!min-h-11 px-3" disabled={sending || !input.trim()}>
          <ArrowUp size={18} />
        </Button>
      </form>
      <Link to="/home" className="mt-2 block text-center text-xs text-ink/40">
        返回学习首页
      </Link>
    </div>
  )
}
