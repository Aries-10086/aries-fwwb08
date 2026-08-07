import { createPortal } from 'react-dom'
import { useEffect, useState } from 'react'
import { CheckCircle } from '@phosphor-icons/react'

export function SuccessToast({ message }: { message: string | null }) {
  if (!message || typeof document === 'undefined') return null
  return createPortal(
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex justify-center px-4 pt-4"
    >
      <div className="rise-in flex max-w-xl items-start gap-2 rounded-2xl border border-[rgba(31,107,74,0.22)] bg-white px-4 py-3 text-[#1f6b4a] shadow-[0_8px_28px_rgba(18,21,28,0.16),0_2px_8px_rgba(31,107,74,0.1)]">
        <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" weight="fill" />
        <div className="text-sm font-medium">{message}</div>
      </div>
    </div>,
    document.body,
  )
}

/** 展示成功提示，默认 3.5s 后自动清除 */
export function useSuccessToast(durationMs = 3500) {
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    if (!message) return
    const t = window.setTimeout(() => setMessage(null), durationMs)
    return () => window.clearTimeout(t)
  }, [message, durationMs])
  return { message, showSuccess: setMessage, clearSuccess: () => setMessage(null) }
}
