import { useState, useEffect } from 'react'
import type { GpxPoint } from '../lib/types'
import { getDB } from '../lib/db'

export function useStageGPX(stageId: number) {
  const [trackPoints, setTrackPoints] = useState<GpxPoint[] | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const db = await getDB()
    const data = await db.get('gpx', stageId)
    setTrackPoints(data?.trackPoints ?? null)
    setLoading(false)
  }

  useEffect(() => { load() }, [stageId])

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
