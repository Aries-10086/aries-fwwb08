import { Router, type Request, type Response } from 'express'
import { audit } from '../db.js'
import {
  getAiProviderSettingsPublic,
  getProviderOverridePayload,
  resolveAiProviderSettings,
  updateAiProviderSettings,
  type AiProviderSettingsUpdate,
} from '../services/ai-settings.js'
import { callAIService, AIServiceError } from '../services/ai-service.js'
import { wrapAsyncRouter } from '../utils/async-router.js'
import { getUserContext, requireRole } from '../utils/http.js'

const router = Router()

router.get('/', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可查看 AI 设置' })
    return
  }
  const data = await getAiProviderSettingsPublic()
  res.status(200).json({ success: true, data })
})

router.put('/', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可修改 AI 设置' })
    return
  }
  const { userId } = getUserContext(req)
  const body = (req.body ?? {}) as AiProviderSettingsUpdate
  try {
    const data = await updateAiProviderSettings(body, userId)
    await audit(userId, 'ai.settings.update', {
      chatBaseUrl: data.chatBaseUrl,
      chatModel: data.chatModel,
      embeddingBaseUrl: data.embeddingBaseUrl,
      embeddingModel: data.embeddingModel,
      embeddingDimension: data.embeddingDimension,
      chatApiKeyChanged: Boolean(body.chatApiKey?.trim()) || Boolean(body.clearChatApiKey),
      embeddingApiKeyChanged:
        Boolean(body.embeddingApiKey?.trim()) || Boolean(body.clearEmbeddingApiKey),
      clearChatApiKey: Boolean(body.clearChatApiKey),
      clearEmbeddingApiKey: Boolean(body.clearEmbeddingApiKey),
    })
    res.status(200).json({ success: true, data })
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : '保存失败',
    })
  }
})

async function pingDirect(target: 'chat' | 'embedding') {
  const settings = await resolveAiProviderSettings()
  if (target === 'embedding') {
    const baseUrl = (settings.embeddingBaseUrl || settings.chatBaseUrl).replace(/\/$/, '')
    const apiKey = settings.embeddingApiKey || settings.chatApiKey
    const model = settings.embeddingModel
    if (!baseUrl || !apiKey || !model) {
      throw new Error('向量模型未配置完整（地址 / 密钥 / 名称）')
    }
    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: ['党校 AI 设置连通性测试'],
        dimensions: settings.embeddingDimension,
      }),
    })
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
    if (!response.ok) {
      const error = payload?.error as Record<string, unknown> | undefined
      throw new Error(String(error?.message ?? `向量模型返回 HTTP ${response.status}`))
    }
    const data = payload?.data as Array<Record<string, unknown>> | undefined
    const embedding = data?.[0]?.embedding as number[] | undefined
    return {
      ok: true,
      target: 'embedding' as const,
      model: String(payload?.model ?? model),
      dimension: embedding?.length ?? settings.embeddingDimension,
    }
  }

  const baseUrl = settings.chatBaseUrl.replace(/\/$/, '')
  const apiKey = settings.chatApiKey
  const model = settings.chatModel
  if (!baseUrl || !apiKey || !model) {
    throw new Error('聊天模型未配置完整（地址 / 密钥 / 名称）')
  }
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [{ role: 'user', content: '请只回复两个字：正常' }],
    }),
  })
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
  if (!response.ok) {
    const error = payload?.error as Record<string, unknown> | undefined
    throw new Error(String(error?.message ?? `聊天模型返回 HTTP ${response.status}`))
  }
  const choices = payload?.choices as Array<Record<string, unknown>> | undefined
  const message = choices?.[0]?.message as Record<string, unknown> | undefined
  return {
    ok: true,
    target: 'chat' as const,
    model: String(payload?.model ?? model),
    sample: String(message?.content ?? '').slice(0, 80),
  }
}

router.post('/test', async (req: Request, res: Response) => {
  if (!requireRole(req, ['admin'])) {
    res.status(403).json({ success: false, error: '仅管理员可测试 AI 连接' })
    return
  }
  const { userId } = getUserContext(req)
  const target = String(req.body?.target ?? 'chat') === 'embedding' ? 'embedding' : 'chat'
  try {
    const provider = await getProviderOverridePayload()
    if (!provider) {
      res.status(400).json({ success: false, error: '尚未配置模型地址或密钥' })
      return
    }
    const result = process.env.AI_SERVICE_URL
      ? await callAIService<{
          ok: boolean
          target: string
          model?: string
          sample?: string
          dimension?: number
        }>('/internal/provider-ping', { target, provider })
      : await pingDirect(target)
    await audit(userId, 'ai.settings.test', { target, ok: true })
    res.status(200).json({ success: true, data: result })
  } catch (error) {
    const message =
      error instanceof AIServiceError || error instanceof Error
        ? error.message
        : '连接测试失败'
    await audit(userId, 'ai.settings.test', { target, ok: false, error: message })
    res.status(503).json({ success: false, error: message })
  }
})

export default wrapAsyncRouter(router)
