import { useState, useEffect } from 'react'
import type { WeatherDay } from '../lib/types'
import { fetchLocationWeather } from '../lib/weather'

export function useLocationWeather(cacheKey: string, lat?: number, lon?: number) {
  const [day, setDay] = useState<WeatherDay | null>(null)
  const [stale, setStale] = useState(false)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!lat || !lon) return
    setLoading(true)
    setError(null)
    fetchLocationWeather(cacheKey, lat, lon)
      .then(result => {
        setDay(result.day)
        setStale(result.stale)
        setFetchedAt(result.fetchedAt)
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [cacheKey, lat, lon])

  return { day, stale, fetchedAt, error, loading }
}
