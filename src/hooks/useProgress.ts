import { useState, useEffect, useCallback } from 'react'
import { getDB } from '../lib/db'
import type { Stage } from '../lib/types'

export function useProgress(stages: Stage[]) {
  const [completedStages, setCompletedStages] = useState<number[]>([])

  useEffect(() => {
    getDB()
      .then(db => db.get('progress', 1))
      .then(p => setCompletedStages(p?.completedStages ?? []))
  }, [stages.length])

  const persist = useCallback(async (updated: number[]) => {
    const db = await getDB()
    await db.put('progress', { completedStages: updated }, 1)
    setCompletedStages(updated)
  }, [])

  const toggleStage = useCallback(async (stageId: number) => {
    const updated = completedStages.includes(stageId)
      ? completedStages.filter(id => id !== stageId)
      : [...completedStages, stageId]
    await persist(updated)
  }, [completedStages, persist])

  const markNextDone = useCallback(async () => {
    const completed = new Set(completedStages)
    const next = stages.find(s => !completed.has(s.stage))
    if (!next) return
    await persist([...completedStages, next.stage])
  }, [completedStages, stages, persist])

  const completedSet = new Set(completedStages)
  const currentStage = stages.find(s => !completedSet.has(s.stage))
  const allDone = stages.length > 0 && completedStages.length === stages.length

  return {
    completedStages: completedSet,
    currentStage,
    completedCount: completedStages.length,
    allDone,
    toggleStage,
    markNextDone,
  }
}
