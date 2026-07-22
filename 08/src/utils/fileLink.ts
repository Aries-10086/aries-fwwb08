/** 为需要鉴权的附件链接附加 access_token（供新窗口下载） */
export function withAccessToken(url: string, token: string | null | undefined) {
  if (!url) return url
  if (!token) return url
  if (url.startsWith('http') && !url.includes(window.location.host)) return url
  const join = url.includes('?') ? '&' : '?'
  return `${url}${join}access_token=${encodeURIComponent(token)}`
}
