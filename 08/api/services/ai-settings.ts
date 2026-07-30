import { nowIso, query } from '../db.js'
import { decryptSecret, encryptSecret, maskSecret } from '../utils/secret-box.js'

export type AiSettingSource = 'db' | 'env' | 'none'

export type ResolvedAiProviderSettings = {
  chatBaseUrl: string
  chatApiKey: string
  chatModel: string
  embeddingBaseUrl: string
  embeddingApiKey: string
  embeddingModel: string
  embeddingDimension: number
}

export type AiProviderSettingsPublic = {
  chatBaseUrl: string
  chatModel: string
  chatApiKeyConfigured: boolean
  chatApiKeyMasked: string
  embeddingBaseUrl: string
  embeddingModel: string
  embeddingApiKeyConfigured: boolean
  embeddingApiKeyMasked: string
  embeddingDimension: number
  sources: {
    chatBaseUrl: AiSettingSource
    chatModel: AiSettingSource
    chatApiKey: AiSettingSource
    embeddingBaseUrl: AiSettingSource
    embeddingModel: AiSettingSource
    embeddingApiKey: AiSettingSource
    embeddingDimension: AiSettingSource
  }
  aiServiceUrlConfigured: boolean
  updatedAt: string | null
}

export type AiProviderSettingsUpdate = {
  chatBaseUrl?: string
  chatModel?: string
  chatApiKey?: string
  clearChatApiKey?: boolean
  embeddingBaseUrl?: string
  embeddingModel?: string
  embeddingApiKey?: string
  clearEmbeddingApiKey?: boolean
  embeddingDimension?: number | null
}

type DbRow = {
  chat_base_url: string
  chat_model: string
  chat_api_key_enc: string | null
  embedding_base_url: string
  embedding_model: string
  embedding_api_key_enc: string | null
  embedding_dimension: number | null
  updated_at: string | Date | null
}

function env(name: string, fallback = ''): string {
  return String(process.env[name] ?? fallback).trim()
}

function pickText(
  dbValue: string | null | undefined,
  envValue: string,
): { value: string; source: AiSettingSource } {
  const fromDb = String(dbValue ?? '').trim()
  if (fromDb) return { value: fromDb, source: 'db' }
  if (envValue) return { value: envValue, source: 'env' }
  return { value: '', source: 'none' }
}

function pickSecret(
  enc: string | null | undefined,
  envValue: string,
): { value: string; source: AiSettingSource } {
  const packed = String(enc ?? '').trim()
  if (packed) {
    try {
      const value = decryptSecret(packed)
      if (value) return { value, source: 'db' }
    } catch (error) {
      console.error(
        'Failed to decrypt AI provider secret:',
        error instanceof Error ? error.message : error,
      )
    }
  }
  if (envValue) return { value: envValue, source: 'env' }
  return { value: '', source: 'none' }
}

function pickDimension(
  dbValue: number | null | undefined,
  envValue: string,
): { value: number; source: AiSettingSource } {
  if (typeof dbValue === 'number' && Number.isFinite(dbValue) && dbValue >= 64) {
    return { value: Math.trunc(dbValue), source: 'db' }
  }
  const fromEnv = Number(envValue)
  if (Number.isFinite(fromEnv) && fromEnv >= 64) {
    return { value: Math.trunc(fromEnv), source: 'env' }
  }
  return { value: 1024, source: 'none' }
}

async function loadDbRow(): Promise<DbRow | null> {
  const row = (
    await query(
      `SELECT chat_base_url, chat_model, chat_api_key_enc,
              embedding_base_url, embedding_model, embedding_api_key_enc,
              embedding_dimension, updated_at
       FROM ai_provider_settings WHERE id = 'default'`,
    )
  ).rows[0] as DbRow | undefined
  return row ?? null
}

export async function resolveAiProviderSettings(): Promise<ResolvedAiProviderSettings> {
  const row = await loadDbRow()
  const chatBaseUrl = pickText(row?.chat_base_url, env('CHAT_BASE_URL') || env('LLM_BASE_URL'))
  const chatModel = pickText(row?.chat_model, env('CHAT_MODEL') || env('LLM_MODEL', 'qwen-plus'))
  const chatApiKey = pickSecret(row?.chat_api_key_enc, env('CHAT_API_KEY') || env('LLM_API_KEY'))
  const embeddingBaseUrl = pickText(
    row?.embedding_base_url,
    env('EMBEDDING_BASE_URL') || chatBaseUrl.value,
  )
  const embeddingModel = pickText(
    row?.embedding_model,
    env('EMBEDDING_MODEL', 'text-embedding-v4'),
  )
  const embeddingApiKey = pickSecret(
    row?.embedding_api_key_enc,
    env('EMBEDDING_API_KEY') || chatApiKey.value,
  )
  const embeddingDimension = pickDimension(row?.embedding_dimension, env('EMBEDDING_DIMENSION', '1024'))

  return {
    chatBaseUrl: chatBaseUrl.value,
    chatApiKey: chatApiKey.value,
    chatModel: chatModel.value,
    embeddingBaseUrl: embeddingBaseUrl.value || chatBaseUrl.value,
    embeddingApiKey: embeddingApiKey.value || chatApiKey.value,
    embeddingModel: embeddingModel.value,
    embeddingDimension: embeddingDimension.value,
  }
}

export async function getAiProviderSettingsPublic(): Promise<AiProviderSettingsPublic> {
  const row = await loadDbRow()
  const chatBaseUrl = pickText(row?.chat_base_url, env('CHAT_BASE_URL') || env('LLM_BASE_URL'))
  const chatModel = pickText(row?.chat_model, env('CHAT_MODEL') || env('LLM_MODEL', 'qwen-plus'))
  const chatApiKey = pickSecret(row?.chat_api_key_enc, env('CHAT_API_KEY') || env('LLM_API_KEY'))
  const embeddingBaseUrl = pickText(
    row?.embedding_base_url,
    env('EMBEDDING_BASE_URL') || chatBaseUrl.value,
  )
  const embeddingModel = pickText(
    row?.embedding_model,
    env('EMBEDDING_MODEL', 'text-embedding-v4'),
  )
  const embeddingApiKey = pickSecret(row?.embedding_api_key_enc, env('EMBEDDING_API_KEY'))
  const embeddingDimension = pickDimension(row?.embedding_dimension, env('EMBEDDING_DIMENSION', '1024'))

  const updatedAt =
    row?.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : row?.updated_at
        ? String(row.updated_at)
        : null

  return {
    chatBaseUrl: chatBaseUrl.value,
    chatModel: chatModel.value,
    chatApiKeyConfigured: Boolean(chatApiKey.value),
    chatApiKeyMasked: chatApiKey.value ? maskSecret(chatApiKey.value) : '',
    embeddingBaseUrl: embeddingBaseUrl.value || chatBaseUrl.value,
    embeddingModel: embeddingModel.value,
    embeddingApiKeyConfigured: Boolean(embeddingApiKey.value || chatApiKey.value),
    embeddingApiKeyMasked: embeddingApiKey.value
      ? maskSecret(embeddingApiKey.value)
      : chatApiKey.value
        ? `${maskSecret(chatApiKey.value)}（沿用聊天密钥）`
        : '',
    embeddingDimension: embeddingDimension.value,
    sources: {
      chatBaseUrl: chatBaseUrl.source,
      chatModel: chatModel.source,
      chatApiKey: chatApiKey.source,
      embeddingBaseUrl: embeddingBaseUrl.source,
      embeddingModel: embeddingModel.source,
      embeddingApiKey: embeddingApiKey.source === 'none' && chatApiKey.source !== 'none'
        ? chatApiKey.source
        : embeddingApiKey.source,
      embeddingDimension: embeddingDimension.source,
    },
    aiServiceUrlConfigured: Boolean(env('AI_SERVICE_URL')),
    updatedAt,
  }
}

export async function updateAiProviderSettings(
  input: AiProviderSettingsUpdate,
  updatedBy: string,
): Promise<AiProviderSettingsPublic> {
  const row = await loadDbRow()
  const next = {
    chatBaseUrl:
      input.chatBaseUrl !== undefined ? String(input.chatBaseUrl).trim() : String(row?.chat_base_url ?? ''),
    chatModel:
      input.chatModel !== undefined ? String(input.chatModel).trim() : String(row?.chat_model ?? ''),
    embeddingBaseUrl:
      input.embeddingBaseUrl !== undefined
        ? String(input.embeddingBaseUrl).trim()
        : String(row?.embedding_base_url ?? ''),
    embeddingModel:
      input.embeddingModel !== undefined
        ? String(input.embeddingModel).trim()
        : String(row?.embedding_model ?? ''),
    embeddingDimension:
      input.embeddingDimension === null
        ? null
        : input.embeddingDimension !== undefined
          ? Math.trunc(Number(input.embeddingDimension))
          : row?.embedding_dimension ?? null,
    chatApiKeyEnc: row?.chat_api_key_enc ?? null as string | null,
    embeddingApiKeyEnc: row?.embedding_api_key_enc ?? null as string | null,
  }

  if (input.clearChatApiKey) {
    next.chatApiKeyEnc = null
  } else if (typeof input.chatApiKey === 'string' && input.chatApiKey.trim()) {
    next.chatApiKeyEnc = encryptSecret(input.chatApiKey.trim())
  }

  if (input.clearEmbeddingApiKey) {
    next.embeddingApiKeyEnc = null
  } else if (typeof input.embeddingApiKey === 'string' && input.embeddingApiKey.trim()) {
    next.embeddingApiKeyEnc = encryptSecret(input.embeddingApiKey.trim())
  }

  if (
    next.embeddingDimension !== null &&
    (next.embeddingDimension < 64 || next.embeddingDimension > 65536)
  ) {
    throw new Error('向量维度须在 64–65536 之间')
  }

  const ts = nowIso()
  await query(
    `INSERT INTO ai_provider_settings (
       id, chat_base_url, chat_model, chat_api_key_enc,
       embedding_base_url, embedding_model, embedding_api_key_enc,
       embedding_dimension, updated_at, updated_by
     ) VALUES (
       'default', $1, $2, $3, $4, $5, $6, $7, $8, $9
     )
     ON CONFLICT (id) DO UPDATE SET
       chat_base_url = EXCLUDED.chat_base_url,
       chat_model = EXCLUDED.chat_model,
       chat_api_key_enc = EXCLUDED.chat_api_key_enc,
       embedding_base_url = EXCLUDED.embedding_base_url,
       embedding_model = EXCLUDED.embedding_model,
       embedding_api_key_enc = EXCLUDED.embedding_api_key_enc,
       embedding_dimension = EXCLUDED.embedding_dimension,
       updated_at = EXCLUDED.updated_at,
       updated_by = EXCLUDED.updated_by`,
    [
      next.chatBaseUrl,
      next.chatModel,
      next.chatApiKeyEnc,
      next.embeddingBaseUrl,
      next.embeddingModel,
      next.embeddingApiKeyEnc,
      next.embeddingDimension,
      ts,
      updatedBy,
    ],
  )

  return getAiProviderSettingsPublic()
}

/** 传给 Python AI 服务的 provider 覆盖字段（snake_case） */
export async function getProviderOverridePayload(): Promise<Record<string, unknown> | undefined> {
  const settings = await resolveAiProviderSettings()
  const payload: Record<string, unknown> = {}
  if (settings.chatBaseUrl) payload.chat_base_url = settings.chatBaseUrl
  if (settings.chatApiKey) payload.chat_api_key = settings.chatApiKey
  if (settings.chatModel) payload.chat_model = settings.chatModel
  if (settings.embeddingBaseUrl) payload.embedding_base_url = settings.embeddingBaseUrl
  if (settings.embeddingApiKey) payload.embedding_api_key = settings.embeddingApiKey
  if (settings.embeddingModel) payload.embedding_model = settings.embeddingModel
  if (settings.embeddingDimension) payload.embedding_dimension = settings.embeddingDimension
  return Object.keys(payload).length ? payload : undefined
}
