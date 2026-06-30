import { useState, useEffect } from 'react'
import type { WeatherDay } from '../lib/types'
import { fetchLocationWeather } from '../lib/weather'

export function useLocationWeather(cacheKey: string, lat?: number, lon?: number, isoDate?: string) {
  const [day, setDay] = useState<WeatherDay | null>(null)
  const [stale, setStale] = useState(false)
  const [tooFar, setTooFar] = useState(false)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!lat || !lon || !isoDate) return
    setLoading(true)
    setError(null)
    fetchLocationWeather(cacheKey, lat, lon, isoDate)
      .then(result => {
        setDay(result.day)
        setStale(result.stale)
        setTooFar(result.tooFar)
        setFetchedAt(result.fetchedAt)
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [cacheKey, lat, lon, isoDate])

  return { day, stale, tooFar, fetchedAt, error, loading }
}
