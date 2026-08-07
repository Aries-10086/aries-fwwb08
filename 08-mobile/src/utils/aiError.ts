/** 将模型/密钥相关错误转成演示友好的降级文案 */
export function friendlyAiError(raw: string): string {
  const msg = String(raw ?? '').trim()
  if (!msg) return 'AI 暂不可用；学习与测验主流程不受影响'
  if (/未配置|密钥|MODEL_UNAVAILABLE|不可用|AI 服务|连接失败|ECONNREFUSED|timed?\s*out|超时/i.test(msg)) {
    return '未配置模型密钥或 AI 服务不可用，讲解/问答暂不可用；学习与测验不受影响'
  }
  return msg
}
