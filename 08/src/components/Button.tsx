import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'

export function Button({
  className,
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold tracking-[0.02em] transition-all duration-200 ease-out focus:outline-none disabled:pointer-events-none disabled:opacity-50 disabled:transform-none'

  const styles: Record<Variant, string> = {
    primary:
      'bg-[linear-gradient(180deg,#d92b2b_0%,#b91c1c_38%,#8c2424_72%,#5b1717_100%)] text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.3),inset_0_-2px_0_rgba(69,10,10,0.28),0_6px_0_#5b1717,0_16px_28px_rgba(140,36,36,0.22)] hover:-translate-y-[2px] hover:brightness-105 hover:shadow-[inset_0_2px_0_rgba(255,255,255,0.34),inset_0_-2px_0_rgba(69,10,10,0.32),0_8px_0_#5b1717,0_20px_34px_rgba(140,36,36,0.24)] active:translate-y-[3px] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.24),inset_0_-1px_0_rgba(69,10,10,0.24),0_2px_0_#5b1717,0_10px_18px_rgba(140,36,36,0.18)] focus:ring-4 focus:ring-[#8c2424]/18',
    secondary:
      'bg-[linear-gradient(180deg,#ffffff_0%,#fff8f8_100%)] text-[#8c2424] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-2px_0_rgba(140,36,36,0.08),0_5px_0_rgba(140,36,36,0.12),0_12px_24px_rgba(17,17,17,0.08)] hover:-translate-y-[2px] hover:bg-[#fff6f6] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-2px_0_rgba(140,36,36,0.1),0_7px_0_rgba(140,36,36,0.14),0_16px_28px_rgba(17,17,17,0.1)] active:translate-y-[3px] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.8),inset_0_-1px_0_rgba(140,36,36,0.06),0_2px_0_rgba(140,36,36,0.12),0_8px_16px_rgba(17,17,17,0.07)] focus:ring-4 focus:ring-[#8c2424]/12',
    ghost:
      'bg-[linear-gradient(180deg,#e33b3b_0%,#c92525_34%,#9f1d1d_68%,#6f1111_100%)] text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.28),inset_0_-3px_0_rgba(79,8,8,0.34),0_7px_0_#5f0e0e,0_18px_32px_rgba(140,36,36,0.24)] hover:-translate-y-[3px] hover:brightness-105 hover:shadow-[inset_0_2px_0_rgba(255,255,255,0.34),inset_0_-3px_0_rgba(79,8,8,0.38),0_10px_0_#5f0e0e,0_24px_38px_rgba(140,36,36,0.28)] active:translate-y-[4px] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.2),inset_0_-1px_0_rgba(79,8,8,0.24),0_3px_0_#5f0e0e,0_12px_20px_rgba(140,36,36,0.18)] focus:ring-4 focus:ring-[#8c2424]/12',
    danger:
      'bg-[linear-gradient(180deg,#d92b2b_0%,#b91c1c_34%,#7f1d1d_72%,#450a0a_100%)] text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.24),inset_0_-2px_0_rgba(69,10,10,0.28),0_6px_0_#450a0a,0_16px_30px_rgba(69,10,10,0.2)] hover:-translate-y-[2px] hover:brightness-105 hover:shadow-[inset_0_2px_0_rgba(255,255,255,0.28),inset_0_-2px_0_rgba(69,10,10,0.32),0_8px_0_#450a0a,0_20px_34px_rgba(69,10,10,0.22)] active:translate-y-[3px] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(69,10,10,0.24),0_2px_0_#450a0a,0_10px_18px_rgba(69,10,10,0.16)] focus:ring-4 focus:ring-[#b91c1c]/16',
    success:
      'bg-[linear-gradient(180deg,#34d399_0%,#10b981_42%,#059669_78%,#047857_100%)] text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.28),inset_0_-2px_0_rgba(4,120,87,0.28),0_6px_0_#065f46,0_16px_28px_rgba(16,185,129,0.22)] hover:-translate-y-[2px] hover:brightness-105 hover:shadow-[inset_0_2px_0_rgba(255,255,255,0.32),inset_0_-2px_0_rgba(4,120,87,0.32),0_8px_0_#065f46,0_20px_34px_rgba(16,185,129,0.24)] active:translate-y-[3px] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(4,120,87,0.24),0_2px_0_#065f46,0_10px_18px_rgba(16,185,129,0.18)] focus:ring-4 focus:ring-emerald-500/20 disabled:opacity-100',
  }

  return <button className={cn(base, styles[variant], className)} {...props} />
}
