import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[16px] border border-[rgba(18,21,28,0.08)] bg-white shadow-[0_1px_2px_rgba(18,21,28,0.04),0_8px_24px_rgba(18,21,28,0.05)] transition duration-200 hover:border-[rgba(158,27,43,0.16)] hover:shadow-[0_2px_8px_rgba(158,27,43,0.05),0_12px_28px_rgba(18,21,28,0.06)]',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pb-3 md:p-6 md:pb-3', className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('text-base font-semibold tracking-tight text-[#12151c]', className)}
      {...props}
    />
  )
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pt-0 md:p-6 md:pt-0', className)} {...props} />
}
