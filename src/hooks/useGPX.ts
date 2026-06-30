import { useState, useEffect, useRef, useCallback } from 'react'
import type { GpxPoint } from '../lib/types'
import { getDB } from '../lib/db'

export function useStageGPX(stageId: number) {
  const [trackPoints, setTrackPoints] = useState<GpxPoint[] | null>(null)
  const [loading, setLoading] = useState(true)
  // Monotonic request id — guards against an older load resolving after a newer
  // one when the user navigates stages quickly.
  const reqId = useRef(0)

  const load = useCallback(async () => {
    const id = ++reqId.current
    setLoading(true)
    const db = await getDB()
    const data = await db.get('gpx', stageId)
    if (id !== reqId.current) return // superseded by a newer load
    setTrackPoints(data?.trackPoints ?? null)
    setLoading(false)
  }, [stageId])

  useEffect(() => {
    setTrackPoints(null) // drop the previous stage's route immediately — no stale flash
    load()
  }, [load])

  return { trackPoints, loading, reload: load }
}

export function useGPXStatus() {
  const [loadedStages, setLoadedStages] = useState<number[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const db = await getDB()
    const keys = await db.getAllKeys('gpx')
    setLoadedStages(keys as number[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return { loadedStages, loading, reload: load }
}
