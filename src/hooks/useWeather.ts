import { useState, useEffect } from 'react'
import type { WeatherData } from '../lib/types'
import { fetchWeather } from '../lib/weather'

export function useWeather(stageId: number, lat?: number, lon?: number) {
  const [data, setData] = useState<WeatherData | null>(null)
  const [stale, setStale] = useState(false)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!lat || !lon) return
    setLoading(true)
    setError(null)
    fetchWeather(stageId, lat, lon)
      .then(result => {
        setData(result.data)
        setStale(result.stale)
        setFetchedAt(result.fetchedAt)
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [stageId, lat, lon])

  return { data, stale, fetchedAt, error, loading }
}
