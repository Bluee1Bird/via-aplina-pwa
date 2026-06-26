import type { Stage } from '../lib/types'

export interface CompanionInfo {
  name: string
  dayIndex: number
  totalDays: number
}

export function useCompanion(stage: Stage | undefined, allStages: Stage[]): CompanionInfo | null {
  if (!stage?.companion) return null

  const sorted = [...allStages].sort((a, b) => a.stage - b.stage)
  const idx = sorted.findIndex(s => s.stage === stage.stage)
  if (idx === -1) return null

  let start = idx
  while (start > 0 && sorted[start - 1].companion === stage.companion) start--

  let end = idx
  while (end < sorted.length - 1 && sorted[end + 1].companion === stage.companion) end++

  return {
    name: stage.companion,
    dayIndex: idx - start + 1,
    totalDays: end - start + 1,
  }
}
