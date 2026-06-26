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

  const markDone = useCallback(async () => {
    const completed = new Set(completedStages)
    const next = stages.find(s => !completed.has(s.stage))
    if (!next) return

    const updated = [...completedStages, next.stage]
    const db = await getDB()
    await db.put('progress', { completedStages: updated }, 1)
    setCompletedStages(updated)
  }, [completedStages, stages])

  const completedSet = new Set(completedStages)
  const currentStage = stages.find(s => !completedSet.has(s.stage))
  const allDone = stages.length > 0 && completedStages.length === stages.length

  return {
    completedStages: completedSet,
    currentStage,
    completedCount: completedStages.length,
    allDone,
    markDone,
  }
}
