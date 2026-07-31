import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base =
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50'
  const styles: Record<Variant, string> = {
    primary: 'bg-seal text-white shadow-[0_6px_16px_rgba(158,27,43,0.22)]',
    secondary: 'bg-white text-seal shadow-[inset_0_0_0_1px_rgba(158,27,43,0.22)]',
    ghost: 'bg-transparent text-ink/70 shadow-[inset_0_0_0_1px_rgba(18,21,28,0.1)]',
    danger: 'bg-seal-deep text-white',
  }
  return <button className={cn(base, styles[variant], className)} {...props} />
}
