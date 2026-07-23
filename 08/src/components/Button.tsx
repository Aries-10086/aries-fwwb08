import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold tracking-wide transition duration-200 ease-out focus:outline-none disabled:pointer-events-none disabled:opacity-50'

  const styles: Record<Variant, string> = {
    primary:
      'bg-[#a31828] text-white shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_8px_20px_rgba(163,24,40,0.22)] hover:bg-[#8a1422] hover:-translate-y-px active:translate-y-0 focus:ring-2 focus:ring-[#a31828]/25',
    secondary:
      'bg-white text-[#a31828] shadow-[inset_0_0_0_1px_rgba(163,24,40,0.28)] hover:bg-[rgba(163,24,40,0.04)] hover:-translate-y-px active:translate-y-0 focus:ring-2 focus:ring-[#a31828]/15',
    ghost:
      'bg-transparent text-[rgba(14,17,22,0.7)] shadow-[inset_0_0_0_1px_rgba(14,17,22,0.12)] hover:bg-[rgba(163,24,40,0.05)] hover:text-[#a31828] hover:-translate-y-px active:translate-y-0 focus:ring-2 focus:ring-[#a31828]/12',
    danger:
      'bg-[#7a1020] text-white shadow-[0_8px_20px_rgba(122,16,32,0.22)] hover:bg-[#5c0d18] hover:-translate-y-px active:translate-y-0 focus:ring-2 focus:ring-[#7a1020]/25',
    success:
      'bg-[#1f6b4a] text-white shadow-[0_8px_20px_rgba(31,107,74,0.2)] hover:bg-[#17553a] hover:-translate-y-px active:translate-y-0 focus:ring-2 focus:ring-[#1f6b4a]/25',
  }

  return <button className={cn(base, styles[variant], className)} {...props} />
}
