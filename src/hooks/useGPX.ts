import { useState, useEffect } from 'react'
import type { GpxData } from '../lib/types'
import { getDB } from '../lib/db'

export function useGPX() {
  const [gpx, setGpx] = useState<GpxData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const db = await getDB()
    const data = await db.get('gpx', 1)
    setGpx(data ?? null)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return { gpx, loading, reload: load }
}
