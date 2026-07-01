import { useCallback, useEffect, useState } from 'react'
import { getDB } from '../lib/db'
import type { StageOverride } from '../lib/types'

// Per-stage user data keyed by stage number, independent of the CSV so it
// survives re-uploads (see StageOverride). Currently just the actual duration.
export function useStageOverride(stageNum: number) {
  const [override, setOverride] = useState<StageOverride | null>(null)

  useEffect(() => {
    let active = true
    setOverride(null)
    getDB()
      .then(db => db.get('stageOverrides', stageNum))
      .then(o => { if (active) setOverride(o ?? null) })
    return () => { active = false }
  }, [stageNum])

  const setActualDuration = useCallback(async (hours: number | undefined) => {
    const db = await getDB()
    const existing = (await db.get('stageOverrides', stageNum)) ?? { stage: stageNum }
    const updated: StageOverride = { ...existing }
    if (hours === undefined) delete updated.actualDuration_h
    else updated.actualDuration_h = hours
    await db.put('stageOverrides', updated)
    setOverride(updated)
  }, [stageNum])

  return { override, setActualDuration }
}
