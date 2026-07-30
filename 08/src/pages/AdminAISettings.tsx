import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { Button } from '@/components/Button'
import { apiFetch } from '@/utils/api'
import { useAuthStore } from '@/store/auth'
import {
  CircleNotch,
  FloppyDisk,
  GearSix,
  Plugs,
  Trash,
} from '@phosphor-icons/react'
import type { AiProviderSettingsPublic, AiProviderSettingsUpdate } from '../../shared/types'

type TestResult = {
  ok: boolean
  target: string
  model?: string
  sample?: string
  dimension?: number
}

const SOURCE_LABEL: Record<string, string> = {
  db: '管理端',
  env: '环境变量',
  none: '未配置',
}

export default function AdminAISettings() {
  const nav = useNavigate()
  const { user } = useAuthStore()
  const [settings, setSettings] = useState<AiProviderSettingsPublic | null>(null)
  const [chatBaseUrl, setChatBaseUrl] = useState('')
  const [chatModel, setChatModel] = useState('')
  const [chatApiKey, setChatApiKey] = useState('')
  const [clearChatApiKey, setClearChatApiKey] = useState(false)
  const [embeddingBaseUrl, setEmbeddingBaseUrl] = useState('')
  const [embeddingModel, setEmbeddingModel] = useState('')
  const [embeddingApiKey, setEmbeddingApiKey] = useState('')
  const [clearEmbeddingApiKey, setClearEmbeddingApiKey] = useState(false)
  const [embeddingDimension, setEmbeddingDimension] = useState('1024')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<'chat' | 'embedding' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  useEffect(() => {
    if (!user) nav('/login')
    if (user && user.role !== 'admin') nav('/m/home')
  }, [nav, user])

  function applySettings(data: AiProviderSettingsPublic) {
    setSettings(data)
    setChatBaseUrl(data.chatBaseUrl)
    setChatModel(data.chatModel)
    setChatApiKey('')
    setClearChatApiKey(false)
    setEmbeddingBaseUrl(data.embeddingBaseUrl)
    setEmbeddingModel(data.embeddingModel)
    setEmbeddingApiKey('')
    setClearEmbeddingApiKey(false)
    setEmbeddingDimension(String(data.embeddingDimension || 1024))
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<AiProviderSettingsPublic>('/api/ai/settings')
      applySettings(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function save() {
    setSaving(true)
    setError(null)
    setMessage(null)
    setTestResult(null)
    try {
      const dim = Number(embeddingDimension)
      const body: AiProviderSettingsUpdate = {
        chatBaseUrl,
        chatModel,
        embeddingBaseUrl,
        embeddingModel,
        embeddingDimension: Number.isFinite(dim) ? dim : null,
        clearChatApiKey,
        clearEmbeddingApiKey,
      }
      if (!clearChatApiKey && chatApiKey.trim()) body.chatApiKey = chatApiKey.trim()
      if (!clearEmbeddingApiKey && embeddingApiKey.trim()) {
        body.embeddingApiKey = embeddingApiKey.trim()
      }
      const data = await apiFetch<AiProviderSettingsPublic>('/api/ai/settings', {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      applySettings(data)
      setMessage('已保存。新请求将立即使用当前配置，无需重启服务。')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function test(target: 'chat' | 'embedding') {
    setTesting(target)
    setError(null)
    setMessage(null)
    setTestResult(null)
    try {
      const data = await apiFetch<TestResult>('/api/ai/settings/test', {
        method: 'POST',
        body: JSON.stringify({ target }),
      })
      setTestResult(data)
      setMessage(target === 'chat' ? '聊天模型连接正常' : '向量模型连接正常')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '连接测试失败')
    } finally {
      setTesting(null)
    }
  }

  return (
    <div className="grid gap-6">
      <div className="hero-frame px-6 py-7 md:px-8">
        <div className="page-eyebrow">AI 设置</div>
        <h1 className="page-title text-3xl md:text-5xl">模型与密钥</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[rgba(18,21,28,0.62)]">
          在此配置国产大模型地址、模型名称和 API Key。密钥加密存储，页面仅显示脱敏信息；留空密钥表示保持原值。
        </p>
      </div>

      {error && (
        <div className="rounded-2xl bg-[#9e1b2b]/10 px-4 py-3 text-[#741220] shadow-[inset_0_0_0_1px_rgba(185,28,28,0.16)]">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-2xl bg-[rgba(31,107,74,0.08)] px-4 py-3 text-[#17553a] shadow-[inset_0_0_0_1px_rgba(31,107,74,0.16)]">
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[rgba(18,21,28,0.55)]">
          <CircleNotch className="h-4 w-4 animate-spin" />
          加载中…
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GearSix className="h-5 w-5 text-[#9e1b2b]" />
                聊天模型
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1.5 text-sm md:col-span-2">
                  <span className="text-[rgba(18,21,28,0.62)]">
                    Base URL
                    <span className="ml-2 text-xs text-[rgba(18,21,28,0.38)]">
                      来源：{SOURCE_LABEL[settings?.sources.chatBaseUrl ?? 'none']}
                    </span>
                  </span>
                  <input
                    className="input-shell"
                    value={chatBaseUrl}
                    onChange={(e) => setChatBaseUrl(e.target.value)}
                    placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
                    autoComplete="off"
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="text-[rgba(18,21,28,0.62)]">
                    模型名称
                    <span className="ml-2 text-xs text-[rgba(18,21,28,0.38)]">
                      来源：{SOURCE_LABEL[settings?.sources.chatModel ?? 'none']}
                    </span>
                  </span>
                  <input
                    className="input-shell"
                    value={chatModel}
                    onChange={(e) => setChatModel(e.target.value)}
                    placeholder="qwen-plus"
                    autoComplete="off"
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="text-[rgba(18,21,28,0.62)]">
                    API Key
                    <span className="ml-2 text-xs text-[rgba(18,21,28,0.38)]">
                      来源：{SOURCE_LABEL[settings?.sources.chatApiKey ?? 'none']}
                    </span>
                  </span>
                  <input
                    className="input-shell"
                    type="password"
                    value={clearChatApiKey ? '' : chatApiKey}
                    onChange={(e) => {
                      setClearChatApiKey(false)
                      setChatApiKey(e.target.value)
                    }}
                    placeholder={
                      clearChatApiKey
                        ? '将清除已保存的密钥'
                        : settings?.chatApiKeyConfigured
                          ? `已配置：${settings.chatApiKeyMasked}（留空保持）`
                          : '粘贴 API Key'
                    }
                    disabled={clearChatApiKey}
                    autoComplete="new-password"
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  className="px-3 py-2 text-xs"
                  onClick={() => {
                    setClearChatApiKey(true)
                    setChatApiKey('')
                  }}
                  disabled={!settings?.chatApiKeyConfigured && !chatApiKey}
                >
                  <Trash size={14} weight="bold" />
                  清除聊天密钥
                </Button>
                <Button
                  variant="secondary"
                  className="px-3 py-2 text-xs"
                  onClick={() => void test('chat')}
                  disabled={testing !== null || saving}
                >
                  {testing === 'chat' ? (
                    <CircleNotch className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plugs size={14} weight="bold" />
                  )}
                  测试聊天模型
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GearSix className="h-5 w-5 text-[#9e1b2b]" />
                向量模型（知识库）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1.5 text-sm md:col-span-2">
                  <span className="text-[rgba(18,21,28,0.62)]">
                    Base URL
                    <span className="ml-2 text-xs text-[rgba(18,21,28,0.38)]">
                      来源：{SOURCE_LABEL[settings?.sources.embeddingBaseUrl ?? 'none']}
                    </span>
                  </span>
                  <input
                    className="input-shell"
                    value={embeddingBaseUrl}
                    onChange={(e) => setEmbeddingBaseUrl(e.target.value)}
                    placeholder="可与聊天模型相同，留空则沿用聊天 Base URL"
                    autoComplete="off"
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="text-[rgba(18,21,28,0.62)]">
                    模型名称
                    <span className="ml-2 text-xs text-[rgba(18,21,28,0.38)]">
                      来源：{SOURCE_LABEL[settings?.sources.embeddingModel ?? 'none']}
                    </span>
                  </span>
                  <input
                    className="input-shell"
                    value={embeddingModel}
                    onChange={(e) => setEmbeddingModel(e.target.value)}
                    placeholder="text-embedding-v4"
                    autoComplete="off"
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="text-[rgba(18,21,28,0.62)]">
                    向量维度
                    <span className="ml-2 text-xs text-[rgba(18,21,28,0.38)]">
                      来源：{SOURCE_LABEL[settings?.sources.embeddingDimension ?? 'none']}
                    </span>
                  </span>
                  <input
                    className="input-shell"
                    value={embeddingDimension}
                    onChange={(e) => setEmbeddingDimension(e.target.value)}
                    placeholder="1024"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </label>
                <label className="grid gap-1.5 text-sm md:col-span-2">
                  <span className="text-[rgba(18,21,28,0.62)]">
                    API Key
                    <span className="ml-2 text-xs text-[rgba(18,21,28,0.38)]">
                      来源：{SOURCE_LABEL[settings?.sources.embeddingApiKey ?? 'none']}
                    </span>
                  </span>
                  <input
                    className="input-shell"
                    type="password"
                    value={clearEmbeddingApiKey ? '' : embeddingApiKey}
                    onChange={(e) => {
                      setClearEmbeddingApiKey(false)
                      setEmbeddingApiKey(e.target.value)
                    }}
                    placeholder={
                      clearEmbeddingApiKey
                        ? '将清除已保存的密钥（未配置时沿用聊天密钥）'
                        : settings?.embeddingApiKeyMasked
                          ? `已配置：${settings.embeddingApiKeyMasked}（留空保持）`
                          : '可选；留空则沿用聊天 API Key'
                    }
                    disabled={clearEmbeddingApiKey}
                    autoComplete="new-password"
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  className="px-3 py-2 text-xs"
                  onClick={() => {
                    setClearEmbeddingApiKey(true)
                    setEmbeddingApiKey('')
                  }}
                >
                  <Trash size={14} weight="bold" />
                  清除向量密钥
                </Button>
                <Button
                  variant="secondary"
                  className="px-3 py-2 text-xs"
                  onClick={() => void test('embedding')}
                  disabled={testing !== null || saving}
                >
                  {testing === 'embedding' ? (
                    <CircleNotch className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plugs size={14} weight="bold" />
                  )}
                  测试向量模型
                </Button>
              </div>
            </CardContent>
          </Card>

          {testResult && (
            <Card>
              <CardHeader>
                <CardTitle>最近一次测试</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="list-surface space-y-1 text-sm text-[rgba(18,21,28,0.72)]">
                  <div>目标：{testResult.target === 'chat' ? '聊天模型' : '向量模型'}</div>
                  {testResult.model && <div>模型：{testResult.model}</div>}
                  {typeof testResult.dimension === 'number' && (
                    <div>维度：{testResult.dimension}</div>
                  )}
                  {testResult.sample && <div>样例回复：{testResult.sample}</div>}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => void save()} disabled={saving || testing !== null}>
              {saving ? (
                <CircleNotch className="h-4 w-4 animate-spin" />
              ) : (
                <FloppyDisk size={16} weight="bold" />
              )}
              保存设置
            </Button>
            <Button variant="ghost" onClick={() => void load()} disabled={loading || saving}>
              重新加载
            </Button>
            {settings?.updatedAt && (
              <span className="text-xs text-[rgba(18,21,28,0.42)]">
                上次保存：{new Date(settings.updatedAt).toLocaleString()}
              </span>
            )}
            {!settings?.aiServiceUrlConfigured && (
              <span className="text-xs text-[#861625]">
                未配置 AI_SERVICE_URL 时，将使用 Node 直连后备路径
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
