import type { WeatherCache, WeatherDay } from './types'
import { getDB } from './db'

const TTL_MS = 15 * 60 * 1000
// Open-Meteo's free forecast reaches ~16 days ahead; beyond that there's no data.
const FORECAST_MAX_DAYS = 16

export interface WeatherResult {
  day: WeatherDay | null
  stale: boolean
  fetchedAt: number | null
  tooFar: boolean // requested date is beyond the forecast horizon
}

// Whole days from local "today" to the given ISO date (negative = in the past).
export function daysUntil(isoDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(isoDate + 'T00:00:00')
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

// MeteoSwiss ICON-CH2 (~2 km, terrain-tuned for the Alps) only forecasts ~5 days
// out, so pin it when the hike is imminent (where accuracy matters most) and fall
// back to Open-Meteo's best_match for longer-range dates to keep the 16-day reach.
// best_match already prefers MeteoSwiss ICON-CH in Switzerland for the near term.
function modelParam(isoDate: string): string {
  const d = daysUntil(isoDate)
  return d >= 0 && d <= 5 ? '&models=meteoswiss_icon_ch2' : ''
}

export interface WeatherSource {
  name: string
  url: string
}

export async function fetchLocationWeather(
  cacheKey: string,
  lat: number,
  lon: number,
  isoDate: string,
): Promise<WeatherResult> {
  // No point hitting the API for a date no forecast model covers yet.
  if (daysUntil(isoDate) > FORECAST_MAX_DAYS) {
    return { day: null, stale: false, fetchedAt: null, tooFar: true }
  }

  const db = await getDB()
  const cached = await db.get('weather', cacheKey)
  const now = Date.now()

  if (cached && now - cached.fetchedAt < TTL_MS) {
    return { day: cached.day, stale: false, fetchedAt: cached.fetchedAt, tooFar: false }
  }

  try {
    // Pin the request to the planned hiking day, not "today".
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum` +
      `&timezone=auto&start_date=${isoDate}&end_date=${isoDate}` +
      modelParam(isoDate)
    const res = await fetch(url)
    if (!res.ok) throw new Error('Network error')
    const json = await res.json()
    const time = json?.daily?.time as string[] | undefined
    if (!time || time.length === 0) throw new Error('No forecast for date')

    const day: WeatherDay = {
      date: time[0],
      weathercode: (json.daily.weathercode as number[])[0],
      tmax: (json.daily.temperature_2m_max as number[])[0],
      tmin: (json.daily.temperature_2m_min as number[])[0],
      precip: (json.daily.precipitation_sum as number[])[0],
    }

    const entry: WeatherCache = { key: cacheKey, day, fetchedAt: now }
    await db.put('weather', entry)

    return { day, stale: false, fetchedAt: now, tooFar: false }
  } catch {
    if (cached) {
      return { day: cached.day, stale: true, fetchedAt: cached.fetchedAt, tooFar: false }
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
