import { createHash } from 'crypto'
import { nanoid } from 'nanoid'
import { nowIso, query } from '../db.js'
import { resolveAiProviderSettings } from './ai-settings.js'
import { AIServiceError, callAIService } from './ai-service.js'

export type LlmPurpose =
  | 'recommend'
  | 'query'
  | 'report'
  | 'wrong-explain'
  | 'exam-feedback'
  | 'content-summary'

export interface LlmTextInput {
  purpose: LlmPurpose
  prompt: string
  data?: unknown
  userId?: string
  responseFormat?: 'text' | 'json'
  jsonSchema?: Record<string, unknown>
  signal?: AbortSignal
}

export interface LlmTextOutput<T = string> {
  text: string
  data: T
  model: string
  usage: unknown
  latencyMs: number
}

export class LlmError extends Error {
  constructor(
    message: string,
    public readonly code = 'MODEL_UNAVAILABLE',
    public readonly status = 503,
  ) {
    super(message)
    this.name = 'LlmError'
  }
}

const PYTHON_PURPOSE: Record<LlmPurpose, string> = {
  recommend: 'study_advice',
  query: 'study_advice',
  report: 'study_advice',
  'wrong-explain': 'wrong_answer_explanation',
  'exam-feedback': 'study_advice',
  'content-summary': 'content_summary',
}

function hashPrompt(input: LlmTextInput): string {
  return createHash('sha256')
    .update(JSON.stringify({ prompt: input.prompt, data: input.data }))
    .digest('hex')
}

async function recordCall(input: LlmTextInput, record: {
  provider: string
  model?: string
  status: 'success' | 'error' | 'aborted'
  usage?: unknown
  latencyMs: number
  errorCode?: string
}) {
  await query(
    `INSERT INTO llm_calls
      (id, user_id, purpose, provider, model, status, prompt_hash, usage_json,
       latency_ms, error_code, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)`,
    [
      `llm_${nanoid(12)}`,
      input.userId || null,
      input.purpose,
      record.provider,
      record.model ?? null,
      record.status,
      hashPrompt(input),
      record.usage == null ? null : JSON.stringify(record.usage),
      record.latencyMs,
      record.errorCode ?? null,
      nowIso(),
    ],
  ).catch((error) => {
    console.error('Failed to record llm call:', error instanceof Error ? error.message : error)
  })
}

async function callDirectOpenAI(input: LlmTextInput, signal: AbortSignal) {
  const settings = await resolveAiProviderSettings()
  const baseUrl = settings.chatBaseUrl.replace(/\/$/, '')
  const apiKey = settings.chatApiKey
  const model = settings.chatModel
  if (!baseUrl || !apiKey || !model) {
    throw new LlmError(
      '大模型未配置，请在管理端「AI 设置」填写模型地址/密钥/名称，或设置 AI_SERVICE_URL / LLM_* 环境变量',
    )
  }
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: input.prompt },
        { role: 'user', content: JSON.stringify(input.data ?? {}, null, 2) },
      ],
      ...(input.responseFormat === 'json'
        ? {
            response_format: {
              type: 'json_schema',
              json_schema: { name: 'node_requested_output', strict: true, schema: input.jsonSchema },
            },
          }
        : {}),
    }),
    signal,
  })
  const payload = await response.json().catch(() => null) as Record<string, unknown> | null
  if (!response.ok) {
    const error = payload?.error as Record<string, unknown> | undefined
    throw new LlmError(String(error?.message ?? `模型返回 HTTP ${response.status}`))
  }
  const choices = payload?.choices as Array<Record<string, unknown>> | undefined
  const message = choices?.[0]?.message as Record<string, unknown> | undefined
  return {
    data: message?.content,
    meta: { model: payload?.model ?? model, usage: payload?.usage },
  }
}

function isAiServiceConnectionError(error: unknown): boolean {
  if (!(error instanceof AIServiceError)) return false
  return (
    error.code === 'AI_SERVICE_UNAVAILABLE' ||
    error.code === 'AI_SERVICE_TIMEOUT' ||
    error.message.includes('无法连接 AI 服务')
  )
}

async function callViaAiService(input: LlmTextInput, signal: AbortSignal) {
  return callAIService<{ data: unknown; meta?: { model?: string; usage?: unknown } }>(
    '/text',
    {
      purpose: PYTHON_PURPOSE[input.purpose],
      messages: [
        { role: 'system', content: input.prompt },
        { role: 'user', content: JSON.stringify(input.data ?? {}, null, 2) },
      ],
      response_format: input.responseFormat ?? 'text',
      ...(input.responseFormat === 'json' ? { json_schema: input.jsonSchema } : {}),
    },
    signal,
  )
}

export async function llmText<T = string>(input: LlmTextInput): Promise<LlmTextOutput<T>> {
  const started = Date.now()
  let provider = process.env.AI_SERVICE_URL ? 'ai-service' : 'openai-compatible'
  const controller = new AbortController()
  const timeoutMs = Math.max(1_000, Number(process.env.LLM_TIMEOUT_MS ?? 30_000))
  const timer = setTimeout(() => controller.abort(new Error('模型请求超时')), timeoutMs)
  const abort = () => controller.abort(input.signal?.reason)
  input.signal?.addEventListener('abort', abort, { once: true })
  try {
    let raw: { data: unknown; meta?: { model?: string; usage?: unknown } }
    if (process.env.AI_SERVICE_URL) {
      try {
        raw = await callViaAiService(input, controller.signal)
      } catch (error) {
        // Python AI 服务未启动时，回退到 Node 直连 CHAT_*/LLM_*（报告/推荐等文案能力）
        if (!isAiServiceConnectionError(error) || controller.signal.aborted) throw error
        console.warn(
          '[llm] AI 服务不可用，回退直连模型:',
          error instanceof Error ? error.message : error,
        )
        raw = await callDirectOpenAI(input, controller.signal)
        provider = 'openai-compatible-fallback'
      }
    } else {
      raw = await callDirectOpenAI(input, controller.signal)
    }
    let data = raw.data as T
    if (input.responseFormat === 'json' && typeof data === 'string') {
      try {
        data = JSON.parse(data) as T
      } catch {
        throw new LlmError('模型未返回有效 JSON', 'INVALID_MODEL_JSON')
      }
    }
    const text = typeof data === 'string' ? data : JSON.stringify(data)
    if (!text) throw new LlmError('模型返回内容为空', 'EMPTY_MODEL_RESPONSE')
    const fallbackModel = (await resolveAiProviderSettings()).chatModel || process.env.LLM_MODEL || 'unknown'
    const result = {
      text,
      data,
      model: String(raw.meta?.model ?? fallbackModel),
      usage: raw.meta?.usage ?? null,
      latencyMs: Date.now() - started,
    }
    await recordCall(input, {
      provider,
      model: result.model,
      status: 'success',
      usage: result.usage,
      latencyMs: result.latencyMs,
    })
    return result
  } catch (error) {
    const aborted = controller.signal.aborted
    const normalized = error instanceof LlmError
      ? error
      : error instanceof AIServiceError
        ? new LlmError(error.message, error.code, error.status)
        : new LlmError(
            aborted && !input.signal?.aborted ? '模型请求超时' : '模型服务调用失败',
            aborted ? 'MODEL_TIMEOUT' : 'MODEL_UNAVAILABLE',
          )
    await recordCall(input, {
      provider,
      status: aborted ? 'aborted' : 'error',
      latencyMs: Date.now() - started,
      errorCode: normalized.code,
    })
    throw normalized
  } finally {
    clearTimeout(timer)
    input.signal?.removeEventListener('abort', abort)
  }
}

export async function getAICache<T>(cacheKey: string, version: string): Promise<T | null> {
  const row = (
    await query(
      `SELECT result_json FROM ai_cache
       WHERE cache_key = $1 AND version = $2 AND expires_at > NOW()`,
      [cacheKey, version],
    )
  ).rows[0]
  return row ? row.result_json as T : null
}

export async function setAICache(
  cacheKey: string,
  version: string,
  result: unknown,
  options: { userId?: string; model?: string; sourceUpdatedAt?: string; ttlMs?: number } = {},
): Promise<void> {
  const expiresAt = new Date(Date.now() + (options.ttlMs ?? 24 * 60 * 60 * 1_000)).toISOString()
  await query(
    `INSERT INTO ai_cache
      (cache_key, version, user_id, result_json, model, source_updated_at, expires_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
     ON CONFLICT (cache_key, version) DO UPDATE SET
       result_json = EXCLUDED.result_json, model = EXCLUDED.model,
       source_updated_at = EXCLUDED.source_updated_at, expires_at = EXCLUDED.expires_at,
       updated_at = NOW()`,
    [
      cacheKey,
      version,
      options.userId || null,
      JSON.stringify(result),
      options.model ?? null,
      options.sourceUpdatedAt ?? null,
      expiresAt,
    ],
  )
}

