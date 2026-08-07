/** 移动端简易排名徽章 */
export function RankBadge({ rank }: { rank: number | null | undefined }) {
  const n = rank == null || !Number.isFinite(rank) || rank < 1 ? null : Math.floor(rank)
  if (n == null) {
    return (
      <div className="grid h-8 w-8 place-items-center rounded-full bg-black/5 text-xs font-bold text-ink/40">—</div>
    )
  }
  if (n === 1) {
    return (
      <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#f0c14b] to-[#c9921a] text-[10px] font-bold text-white shadow">
        金
      </div>
    )
  }
  if (n === 2) {
    return (
      <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#c8d0da] to-[#8a94a3] text-[10px] font-bold text-white shadow">
        银
      </div>
    )
  }
  if (n === 3) {
    return (
      <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#d4a574] to-[#a06a3c] text-[10px] font-bold text-white shadow">
        铜
      </div>
    )
  }
  return (
    <div className="grid h-8 w-8 place-items-center rounded-full bg-seal/10 text-xs font-bold text-seal">{n}</div>
  )
}
