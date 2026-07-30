import { getProviderOverridePayload } from './ai-settings.js'

export class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly code = 'AI_SERVICE_UNAVAILABLE',
    public readonly status = 503,
  ) {
    super(message)
    this.name = 'AIServiceError'
  }
}

function serviceUrl(pathname: string): string {
  const base = String(process.env.AI_SERVICE_URL ?? '').replace(/\/$/, '')
  if (!base) throw new AIServiceError('AI 服务未配置（缺少 AI_SERVICE_URL）')
  return `${base}${pathname}`
}

async function withProviderOverride(body: unknown): Promise<unknown> {
  const provider = await getProviderOverridePayload()
  if (!provider) return body
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const record = body as Record<string, unknown>
    if (record.provider && typeof record.provider === 'object') {
      return {
        ...record,
        provider: { ...provider, ...(record.provider as Record<string, unknown>) },
      }
    }
    return { ...record, provider }
  }
  return body
}

export async function callAIService<T>(
  pathname: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const apiKey = String(process.env.AI_INTERNAL_API_KEY ?? '')
  if (!apiKey) throw new AIServiceError('AI 服务鉴权未配置（缺少 AI_INTERNAL_API_KEY）')

  const controller = new AbortController()
  const timeoutMs = Math.max(1_000, Number(process.env.AI_SERVICE_TIMEOUT_MS ?? 30_000))
  const timer = setTimeout(() => controller.abort(new Error('AI 服务请求超时')), timeoutMs)
  const abort = () => controller.abort(signal?.reason)
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const payload = await withProviderOverride(body)
    const response = await fetch(serviceUrl(pathname), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-api-key': apiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    const responseBody = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok) {
      const error = responseBody?.error as Record<string, unknown> | undefined
      const detail = typeof responseBody?.detail === 'string' ? responseBody.detail : undefined
      throw new AIServiceError(
        String(error?.message ?? detail ?? `AI 服务返回 HTTP ${response.status}`),
        String(error?.code ?? 'AI_SERVICE_ERROR'),
        response.status >= 500 ? 503 : response.status,
      )
    }
    return responseBody as T
  } catch (error) {
    if (error instanceof AIServiceError) throw error
    if (controller.signal.aborted) {
      throw new AIServiceError(
        signal?.aborted ? 'AI 请求已取消' : 'AI 服务请求超时',
        signal?.aborted ? 'AI_REQUEST_ABORTED' : 'AI_SERVICE_TIMEOUT',
        signal?.aborted ? 499 : 503,
      )
    }
    throw new AIServiceError(
      `无法连接 AI 服务：${error instanceof Error ? error.message : '未知错误'}`,
    )
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

export async function openAIServiceStream(
  body: unknown,
  signal: AbortSignal,
): Promise<Response> {
  const apiKey = String(process.env.AI_INTERNAL_API_KEY ?? '')
  if (!apiKey) throw new AIServiceError('AI 服务鉴权未配置（缺少 AI_INTERNAL_API_KEY）')
  try {
    const payload = await withProviderOverride(body)
    const response = await fetch(serviceUrl('/internal/chat/stream'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'text/event-stream',
        'x-internal-api-key': apiKey,
      },
      body: JSON.stringify(payload),
      signal,
    })
    if (!response.ok || !response.body) {
      const message = await response.text().catch(() => '')
      throw new AIServiceError(
        message || `AI 服务返回 HTTP ${response.status}`,
        'AI_STREAM_ERROR',
        response.status >= 500 ? 503 : response.status,
      )
    }
    return response
  } catch (error) {
    if (error instanceof AIServiceError) throw error
    if (signal.aborted) throw error
    throw new AIServiceError(
      `无法连接 AI 服务：${error instanceof Error ? error.message : '未知错误'}`,
    )
  }
}
