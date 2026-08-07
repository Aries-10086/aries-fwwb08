import { Medal } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

const medalTone = {
  1: 'bg-gradient-to-br from-[#f0c14b] to-[#c9921a] text-white shadow-[0_4px_12px_rgba(201,146,26,0.35)]',
  2: 'bg-gradient-to-br from-[#c8d0da] to-[#8a94a3] text-white shadow-[0_4px_12px_rgba(138,148,163,0.3)]',
  3: 'bg-gradient-to-br from-[#d4a574] to-[#a06a3c] text-white shadow-[0_4px_12px_rgba(160,106,60,0.3)]',
} as const

export function RankBadge({
  rank,
  size = 'md',
  animate = true,
  className,
}: {
  rank: number | null | undefined
  size?: 'sm' | 'md'
  animate?: boolean
  className?: string
}) {
  const n = rank == null || !Number.isFinite(rank) || rank < 1 ? null : Math.floor(rank)
  const dim = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-9 w-9 text-sm'
  const delay =
    n === 1 ? 'rise-in' : n === 2 ? 'rise-in rise-in-delay-1' : n === 3 ? 'rise-in rise-in-delay-2' : ''

  if (n == null) {
    return (
      <div
        className={cn(
          'grid place-items-center rounded-full bg-black/5 font-bold text-[rgba(18,21,28,0.4)]',
          dim,
          className,
        )}
      >
        —
      </div>
    )
  }

  if (n <= 3) {
    return (
      <div
        className={cn(
          'grid place-items-center rounded-full font-bold',
          dim,
          medalTone[n as 1 | 2 | 3],
          animate && delay,
          className,
        )}
        title={`第 ${n} 名`}
      >
        <Medal weight="fill" className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'grid place-items-center rounded-full bg-[#9e1b2b]/10 font-bold tabular-nums text-[#9e1b2b]',
        dim,
        className,
      )}
      title={`第 ${n} 名`}
    >
      {n}
    </div>
  )
}
