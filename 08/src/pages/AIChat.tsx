import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowUp,
  BookOpen,
  Brain,
  CircleNotch,
  Plus,
  Stop,
  Trash,
  Wrench,
} from '@phosphor-icons/react'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { postSSE } from '@/utils/sse'
import { useAuthStore } from '@/store/auth'
import type { ChatCitation, ChatMessage, ChatSession, ChatToolStatus } from '../../shared/types'

const starterQuestions = ['推荐适合我的学习内容', '总结我最近的学习进度', '分析我的考试薄弱知识点']

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function listFrom<T>(value: unknown, keys: string[]): T[] {
  if (Array.isArray(value)) return value
  const record = asRecord(value)
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as T[]
  }
  return []
}

function normalizeSession(value: unknown): ChatSession {
  const data = asRecord(value)
  return {
    id: String(data.id ?? data.sessionId ?? ''),
    title: String(data.title ?? data.name ?? '新会话'),
    contentId: data.contentId == null ? null : String(data.contentId),
    createdAt: data.createdAt == null ? undefined : String(data.createdAt),
    updatedAt: data.updatedAt == null ? undefined : String(data.updatedAt),
  }
}

function normalizeMessage(value: unknown): ChatMessage {
  const data = asRecord(value)
  return {
    id: String(data.id ?? `msg_${crypto.randomUUID()}`),
    role: data.role === 'user' ? 'user' : 'assistant',
    content: String(data.content ?? data.text ?? ''),
    createdAt: data.createdAt == null ? undefined : String(data.createdAt),
    citations: listFrom<ChatCitation>(data.citations, ['items']),
    tools: listFrom<ChatToolStatus>(data.tools, ['items']),
  }
}

export default function AIChat() {
  const nav = useNavigate()
  const location = useLocation()
  const { sessionId: pathSessionId } = useParams()
  const [search] = useSearchParams()
  const { user } = useAuthStore()
  const contentId = search.get('contentId') || undefined
  const selectedId = pathSessionId || search.get('sessionId') || undefined
  const adminMode = location.pathname.startsWith('/admin/')
  const basePath = adminMode ? '/admin/chat' : '/m/chat'
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const skipNextMessageLoadRef = useRef<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedId),
    [selectedId, sessions],
  )

  function sessionUrl(id: string) {
    return adminMode ? `${basePath}?sessionId=${encodeURIComponent(id)}` : `${basePath}/${encodeURIComponent(id)}`
  }

  async function loadSessions() {
    setLoadingSessions(true)
    try {
      const data = await apiFetch<ChatSession[] | { sessions: ChatSession[] }>('/api/chat/sessions')
      setSessions(listFrom<unknown>(data, ['sessions', 'items']).map(normalizeSession).filter((item) => item.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载会话失败')
    } finally {
      setLoadingSessions(false)
    }
  }

  useEffect(() => {
    if (!user) {
      nav('/login')
      return
    }
    void loadSessions()
    return () => abortRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }
    if (skipNextMessageLoadRef.current === selectedId) {
      skipNextMessageLoadRef.current = null
      return
    }
    setLoadingMessages(true)
    setError(null)
    apiFetch<ChatMessage[] | { messages: ChatMessage[] }>(
      `/api/chat/sessions/${encodeURIComponent(selectedId)}/messages`,
    )
      .then((data) => setMessages(listFrom<unknown>(data, ['messages', 'items']).map(normalizeMessage)))
      .catch((e) => setError(e instanceof Error ? e.message : '加载消息失败'))
      .finally(() => setLoadingMessages(false))
  }, [selectedId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: sending ? 'smooth' : 'auto' })
  }, [messages, sending])

  async function createSession(): Promise<string> {
    const data = await apiFetch<ChatSession | { session: ChatSession }>('/api/chat/sessions', {
      method: 'POST',
      body: JSON.stringify(contentId ? { contentId } : {}),
    })
    const sessionData = asRecord(data).session ?? data
    const session = normalizeSession(sessionData)
    if (!session.id) throw new Error('创建会话失败')
    setSessions((previous) => [session, ...previous.filter((item) => item.id !== session.id)])
    skipNextMessageLoadRef.current = session.id
    nav(sessionUrl(session.id), { replace: !selectedId })
    return session.id
  }

  async function deleteSession(id: string) {
    if (!window.confirm('确定删除这个会话吗？删除后无法恢复。')) return
    setError(null)
    try {
      await apiFetch<unknown>(`/api/chat/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
      setSessions((previous) => previous.filter((item) => item.id !== id))
      if (selectedId === id) nav(basePath)
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除会话失败')
    }
  }

  function updateAssistant(id: string, update: (message: ChatMessage) => ChatMessage) {
    setMessages((previous) => previous.map((message) => message.id === id ? update(message) : message))
  }

  async function sendMessage(event?: FormEvent, preset?: string) {
    event?.preventDefault()
    const content = (preset ?? input).trim()
    if (!content || sending) return
    setInput('')
    setError(null)
    setSending(true)
    const userMessage: ChatMessage = { id: `local_user_${Date.now()}`, role: 'user', content }
    const assistantId = `local_ai_${Date.now()}`
    setMessages((previous) => [...previous, userMessage, { id: assistantId, role: 'assistant', content: '' }])

    try {
      const id = selectedId ?? await createSession()
      const controller = new AbortController()
      abortRef.current = controller
      await postSSE(`/api/chat/sessions/${encodeURIComponent(id)}/messages`, {
        body: { content, ...(contentId ? { contentId } : {}) },
        signal: controller.signal,
        onEvent: ({ event: eventName, data }) => {
          const payload = typeof data === 'object' && data
            ? asRecord(data)
            : { content: String(data ?? '') }
          const type = eventName === 'message' ? String(payload.type ?? 'delta') : eventName
          if (['delta', 'token', 'content_delta', 'message_delta'].includes(type)) {
            const delta = String(payload.delta ?? payload.content ?? payload.text ?? payload.token ?? '')
            updateAssistant(assistantId, (message) => ({ ...message, content: message.content + delta }))
          } else if (['citation', 'source', 'references'].includes(type)) {
            const citations = listFrom<ChatCitation>(payload, ['citations', 'sources', 'references', 'items'])
            const fallback = payload.citation ?? payload.source ?? payload
            const next = citations.length ? citations : [fallback as ChatCitation]
            updateAssistant(assistantId, (message) => ({ ...message, citations: [...(message.citations ?? []), ...next] }))
          } else if (type.startsWith('tool') || payload.tool) {
            const tool = asRecord(payload.tool ?? payload)
            const status: ChatToolStatus = {
              id: tool.id == null && tool.toolCallId == null
                ? undefined
                : String(tool.id ?? tool.toolCallId),
              name: String(tool.name ?? tool.toolName ?? '工具调用'),
              label: tool.label == null ? undefined : String(tool.label),
              status: type.includes('error') || tool.status === 'error'
                ? 'error'
                : type.includes('end') || type.includes('result') || tool.status === 'success'
                  ? 'success'
                  : 'running',
              message: tool.message == null && tool.result == null
                ? undefined
                : String(tool.message ?? tool.result),
            }
            updateAssistant(assistantId, (message) => {
              const tools = [...(message.tools ?? [])]
              const index = tools.findIndex((item) => (status.id && item.id === status.id) || item.name === status.name)
              if (index >= 0) tools[index] = status
              else tools.push(status)
              return { ...message, tools }
            })
          } else if (['done', 'message_end', 'complete'].includes(type)) {
            const finalContent = asRecord(payload.message).content ?? payload.content
            if (finalContent) updateAssistant(assistantId, (message) => ({ ...message, content: String(finalContent) }))
          } else if (type === 'error') {
            throw new Error(String(payload.error ?? payload.message ?? '生成回答失败'))
          }
        },
      })
      void loadSessions()
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') {
        updateAssistant(assistantId, (item) => ({
          ...item,
          content: item.content || '已停止生成。',
        }))
      } else {
        const message = e instanceof Error ? e.message : '生成回答失败'
        setError(message)
        updateAssistant(assistantId, (item) => ({ ...item, content: item.content || `回答失败：${message}` }))
      }
    } finally {
      abortRef.current = null
      setSending(false)
    }
  }

  return (
    <div className="grid min-h-[calc(100dvh-10rem)] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-black/[0.07] bg-white p-3 shadow-[0_8px_24px_rgba(18,21,28,0.05)]">
        <Button className="w-full" onClick={() => nav(contentId ? `${basePath}?contentId=${encodeURIComponent(contentId)}` : basePath)}>
          <Plus className="h-4 w-4" />新建会话
        </Button>
        <div className="mt-3 max-h-52 space-y-1 overflow-y-auto lg:max-h-[calc(100dvh-15rem)]">
          {loadingSessions && <div className="px-3 py-5 text-center text-sm text-zinc-400">加载会话中…</div>}
          {!loadingSessions && sessions.length === 0 && (
            <div className="px-3 py-5 text-center text-sm text-zinc-400">还没有历史会话</div>
          )}
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`group flex items-center rounded-xl ${selectedId === session.id ? 'bg-[rgba(158,27,43,0.08)]' : 'hover:bg-black/[0.03]'}`}
            >
              <Link to={sessionUrl(session.id)} className="min-w-0 flex-1 px-3 py-3 text-sm">
                <div className="truncate font-medium text-[#12151c]">{session.title}</div>
                {session.updatedAt && <div className="mt-0.5 text-xs text-zinc-400">{new Date(session.updatedAt).toLocaleDateString()}</div>}
              </Link>
              <button
                type="button"
                aria-label={`删除会话：${session.title}`}
                onClick={() => void deleteSession(session.id)}
                className="mr-1 grid h-10 w-10 place-items-center rounded-lg text-zinc-400 opacity-70 hover:bg-white hover:text-[#9e1b2b] lg:opacity-0 lg:group-hover:opacity-100"
              >
                <Trash className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <section className="flex min-h-[620px] min-w-0 flex-col overflow-hidden rounded-2xl border border-black/[0.07] bg-white shadow-[0_8px_24px_rgba(18,21,28,0.05)]">
        <header className="border-b border-black/[0.06] px-5 py-4">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-[#9e1b2b]" />
            <h1 className="font-semibold text-[#12151c]">{selectedSession?.title ?? (contentId ? '问这篇内容' : 'AI 学习助手')}</h1>
          </div>
          <p className="mt-1 text-xs text-zinc-500">回答会标注资料引用；重要信息请以原文为准。</p>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto bg-[#f7f7f6] px-4 py-6 md:px-8">
          {error && <div className="rounded-xl bg-[rgba(158,27,43,0.08)] px-4 py-3 text-sm text-[#741220]">{error}</div>}
          {loadingMessages && <div className="py-12 text-center text-sm text-zinc-400">加载消息中…</div>}
          {!loadingMessages && messages.length === 0 && (
            <div className="mx-auto flex max-w-xl flex-col items-center py-12 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#9e1b2b] text-white">
                <Brain className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-xl font-semibold text-[#12151c]">今天想了解什么？</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">可查询学习资料、个人学习进度和考试情况。</p>
              <div className="mt-5 grid w-full gap-2">
                {starterQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => void sendMessage(undefined, question)}
                    className="min-h-11 rounded-xl bg-white px-4 py-3 text-left text-sm text-[#12151c] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.07)] hover:bg-[rgba(158,27,43,0.04)]"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((message) => (
            <article key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-7 md:max-w-[78%] ${message.role === 'user' ? 'bg-[#9e1b2b] text-white' : 'bg-white text-[rgba(18,21,28,0.78)] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.07)]'}`}>
                <div className="whitespace-pre-wrap">{message.content || (sending ? '正在思考…' : '')}</div>
                {(message.tools?.length ?? 0) > 0 && (
                  <div className="mt-3 space-y-1 border-t border-black/[0.06] pt-3">
                    {message.tools!.map((tool, index) => (
                      <div key={tool.id ?? `${tool.name}_${index}`} className="flex items-center gap-2 text-xs text-zinc-500">
                        {tool.status === 'running' ? <CircleNotch className="h-3.5 w-3.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5" />}
                        {tool.label ?? tool.name} · {tool.status === 'running' ? '调用中' : tool.status === 'success' ? '已完成' : '失败'}
                      </div>
                    ))}
                  </div>
                )}
                {(message.citations?.length ?? 0) > 0 && (
                  <div className="mt-3 border-t border-black/[0.06] pt-3">
                    <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-[#12151c]"><BookOpen className="h-3.5 w-3.5" />资料引用</div>
                    {message.citations!.map((citation, index) => {
                      const href = citation.url ?? (citation.contentId ? `/m/content/${citation.contentId}` : undefined)
                      return href ? (
                        <a key={citation.id ?? index} href={href} className="block text-xs text-[#9e1b2b] underline-offset-2 hover:underline">{index + 1}. {citation.title}</a>
                      ) : (
                        <div key={citation.id ?? index} className="text-xs text-zinc-500">{index + 1}. {citation.title}</div>
                      )
                    })}
                  </div>
                )}
              </div>
            </article>
          ))}
          <div ref={endRef} />
        </div>

        <form onSubmit={(event) => void sendMessage(event)} className="border-t border-black/[0.06] bg-white p-3 md:p-4">
          <div className="flex items-end gap-2 rounded-2xl bg-[#f7f7f6] p-2 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]">
            <label htmlFor="chat-input" className="sr-only">输入问题</label>
            <textarea
              id="chat-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void sendMessage()
                }
              }}
              rows={1}
              disabled={sending}
              placeholder="输入问题，Shift + Enter 换行"
              className="max-h-36 min-h-11 flex-1 resize-y bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-zinc-400"
            />
            {sending ? (
              <button type="button" aria-label="停止生成" onClick={() => abortRef.current?.abort()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#12151c] text-white">
                <Stop className="h-4 w-4" weight="fill" />
              </button>
            ) : (
              <button type="submit" aria-label="发送问题" disabled={!input.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#9e1b2b] text-white disabled:opacity-40">
                <ArrowUp className="h-5 w-5" weight="bold" />
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  )
}
