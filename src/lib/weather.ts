import type { WeatherCache, WeatherData, WeatherDay } from './types'
import { getDB } from './db'

const TTL_MS = 15 * 60 * 1000

export async function fetchWeather(
  stageId: number,
  lat: number,
  lon: number,
): Promise<{ data: WeatherData; stale: boolean; fetchedAt: number }> {
  const db = await getDB()
  const cached = await db.get('weather', stageId)
  const now = Date.now()

  if (cached && now - cached.fetchedAt < TTL_MS) {
    return { data: cached.data, stale: false, fetchedAt: cached.fetchedAt }
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum` +
      `&timezone=auto&forecast_days=3`
    const res = await fetch(url)
    if (!res.ok) throw new Error('Network error')
    const json = await res.json()

    const daily: WeatherDay[] = (json.daily.time as string[]).map((date, i) => ({
      date,
      weathercode: json.daily.weathercode[i] as number,
      tmax: json.daily.temperature_2m_max[i] as number,
      tmin: json.daily.temperature_2m_min[i] as number,
      precip: json.daily.precipitation_sum[i] as number,
    }))

    const data: WeatherData = { daily }
    const entry: WeatherCache = { stageId, data, fetchedAt: now }
    await db.put('weather', entry)

    return { data, stale: false, fetchedAt: now }
  } catch {
    if (cached) {
      return { data: cached.data, stale: true, fetchedAt: cached.fetchedAt }
    }
    throw new Error('No weather data available')
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
