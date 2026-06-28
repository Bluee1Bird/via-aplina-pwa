import type { WeatherCache, WeatherDay } from './types'
import { getDB } from './db'

const TTL_MS = 15 * 60 * 1000

export async function fetchLocationWeather(
  cacheKey: string,
  lat: number,
  lon: number,
): Promise<{ day: WeatherDay; stale: boolean; fetchedAt: number }> {
  const db = await getDB()
  const cached = await db.get('weather', cacheKey)
  const now = Date.now()

  if (cached && now - cached.fetchedAt < TTL_MS) {
    return { day: cached.day, stale: false, fetchedAt: cached.fetchedAt }
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum` +
      `&timezone=auto&forecast_days=1`
    const res = await fetch(url)
    if (!res.ok) throw new Error('Network error')
    const json = await res.json()

    const day: WeatherDay = {
      date: (json.daily.time as string[])[0],
      weathercode: (json.daily.weathercode as number[])[0],
      tmax: (json.daily.temperature_2m_max as number[])[0],
      tmin: (json.daily.temperature_2m_min as number[])[0],
      precip: (json.daily.precipitation_sum as number[])[0],
    }

    const entry: WeatherCache = { key: cacheKey, day, fetchedAt: now }
    await db.put('weather', entry)

    return { day, stale: false, fetchedAt: now }
  } catch {
    if (cached) {
      return { day: cached.day, stale: true, fetchedAt: cached.fetchedAt }
    }
    throw new Error('No weather data available offline')
  }
}

export function weatherIcon(code: number): string {
  if (code === 0) return '☀️'
  if (code <= 3) return '⛅'
  if (code <= 48) return '🌫️'
  if (code <= 55) return '🌦️'
  if (code <= 65) return '🌧️'
  if (code <= 75) return '🌨️'
  if (code <= 82) return '🌧️'
  if (code <= 86) return '🌨️'
  return '⛈️'
}

export function weatherLabel(code: number): string {
  if (code === 0) return 'Clear'
  if (code <= 3) return 'Partly cloudy'
  if (code <= 48) return 'Fog'
  if (code <= 55) return 'Drizzle'
  if (code <= 65) return 'Rain'
  if (code <= 75) return 'Snow'
  if (code <= 82) return 'Showers'
  if (code <= 86) return 'Snow showers'
  return 'Thunderstorm'
}
