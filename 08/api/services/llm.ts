export interface LlmTextInput {
  purpose: 'recommend' | 'query' | 'report'
  prompt: string
  data?: unknown
}

export interface LlmTextOutput {
  text: string
  confidence: number
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function mockText(input: LlmTextInput): LlmTextOutput {
  const base =
    input.purpose === 'recommend'
      ? '根据你的学习历史与错题记录，建议优先补齐薄弱知识点，并以“时间线/边界条件/案例对照”的方式学习。'
      : input.purpose === 'query'
        ? '已为你汇总查询结果：总体完成率较高，但不同支部存在差异，建议针对低完成率支部增加提醒与任务复盘。'
        : '综合学习频率、完成率与测验成绩，你的学习表现稳定。建议：每周固定学习节奏；对错题按知识点归纳；用案例进行对照复盘。'

  return { text: base, confidence: 0.55 }
}

export async function llmText(input: LlmTextInput): Promise<LlmTextOutput> {
  const baseUrl = process.env.LLM_BASE_URL
  const apiKey = process.env.LLM_API_KEY

  if (!baseUrl) return mockText(input)

  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/text`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(input),
  })

  if (!res.ok) return mockText(input)

  const json = (await res.json()) as any
  const text = typeof json?.text === 'string' ? json.text : ''
  return {
    text: text || mockText(input).text,
    confidence: typeof json?.confidence === 'number' ? clamp(json.confidence, 0, 1) : 0.6,
  }
}

