import { useState, useEffect } from 'react'
import type { Stage } from '../lib/types'
import { getDB } from '../lib/db'

export function useStages() {
  const [stages, setStages] = useState<Stage[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const db = await getDB()
    const all = await db.getAll('stages')
    all.sort((a, b) => a.stage - b.stage)
    setStages(all)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return { stages, loading, reload: load }
}
