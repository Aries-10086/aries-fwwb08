import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-[10px] px-5 py-2.5 text-sm font-medium transition duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]'

  const styles: Record<Variant, string> = {
    primary:
      'bg-[#9e1b2b] text-white shadow-[0_1px_2px_rgba(158,27,43,0.2),0_6px_16px_rgba(158,27,43,0.18)] hover:bg-[#861625] focus-visible:ring-[#9e1b2b]/3',
    secondary:
      'bg-white text-[#9e1b2b] shadow-[inset_0_0_0_1px_rgba(158,27,43,0.22)] hover:bg-[rgba(158,27,43,0.04)] focus-visible:ring-[#9e1b2b]/2',
    ghost:
      'bg-transparent text-[rgba(18,21,28,0.68)] shadow-[inset_0_0_0_1px_rgba(18,21,28,0.1)] hover:bg-[rgba(158,27,43,0.05)] hover:text-[#9e1b2b] focus-visible:ring-[#9e1b2b]/15',
    danger:
      'bg-[#741220] text-white shadow-[0_6px_16px_rgba(116,18,32,0.18)] hover:bg-[#5a0e18] focus-visible:ring-[#741220]/3',
    success:
      'bg-[#1f6b4a] text-white shadow-[0_6px_16px_rgba(31,107,74,0.16)] hover:bg-[#17553a] focus-visible:ring-[#1f6b4a]/25',
  }

  return <button className={cn(base, styles[variant], className)} {...props} />
}
