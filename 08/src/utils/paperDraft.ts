export type PaperPick = { questionId: string; score: number }

export type PaperDraft = {
  title: string
  durationMin: number
  passScore: number
  picks: PaperPick[]
}

const STORAGE_KEY = 'admin-paper-draft'

const DEFAULT_DRAFT: PaperDraft = {
  title: '新试卷（演示）',
  durationMin: 10,
  passScore: 60,
  picks: [],
}

export function loadPaperDraft(): PaperDraft {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_DRAFT }
    const parsed = JSON.parse(raw) as Partial<PaperDraft>
    return {
      title: parsed.title ?? DEFAULT_DRAFT.title,
      durationMin: Number(parsed.durationMin ?? DEFAULT_DRAFT.durationMin),
      passScore: Number(parsed.passScore ?? DEFAULT_DRAFT.passScore),
      picks: Array.isArray(parsed.picks) ? parsed.picks : [],
    }
  } catch {
    return { ...DEFAULT_DRAFT }
  }
}

export function savePaperDraft(draft: PaperDraft) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
}

export function clearPaperDraft() {
  sessionStorage.removeItem(STORAGE_KEY)
}
