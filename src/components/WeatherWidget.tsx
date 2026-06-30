import type { WeatherDay } from '../lib/types'
import { weatherIcon, weatherLabel } from '../lib/weather'

interface Props {
  label: string
  forDate?: string // ISO date the forecast is for
  day: WeatherDay | null
  loading: boolean
  error: string | null
  fetchedAt: number | null
  stale: boolean
  tooFar?: boolean
  collapsed: boolean
  onToggle: () => void
}

function shortDate(iso?: string): string {
  if (!iso) return ''
  return new Date(iso + 'T00:00:00').toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function WeatherWidget({ label, forDate, day, loading, error, fetchedAt, stale, tooFar, collapsed, onToggle }: Props) {
  const minAgo = fetchedAt ? Math.round((Date.now() - fetchedAt) / 60000) : null

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2.5 flex items-center justify-between gap-1"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400 truncate">
          {label}
          {forDate && <span className="font-normal normal-case tracking-normal text-neutral-300"> · {shortDate(forDate)}</span>}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-neutral-400 shrink-0 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 border-t border-neutral-100">
          {tooFar && (
            <p className="text-xs text-neutral-400 py-2 leading-snug">
              📅 Forecast not available yet — check back within ~16 days of {shortDate(forDate)}.
            </p>
          )}
          {!tooFar && loading && !day && (
            <p className="text-xs text-neutral-400 py-2">Fetching…</p>
          )}
          {!tooFar && error && !day && (
            <p className="text-xs text-red-500 py-2 leading-snug">{error}</p>
          )}
          {!tooFar && day && (
            <div className="pt-2.5">
              <div className="flex items-center gap-2">
                <span className="text-3xl leading-none">{weatherIcon(day.weathercode)}</span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-neutral-700 leading-snug">{weatherLabel(day.weathercode)}</p>
                  <p className="text-sm font-semibold text-neutral-800 mt-0.5">
                    {Math.round(day.tmax)}°
                    <span className="text-neutral-400 font-normal text-xs"> / {Math.round(day.tmin)}°</span>
                  </p>
                  {/* Always rendered so both widgets stay the same height */}
                  <p className={`text-xs mt-0.5 ${day.precip > 0 ? 'text-blue-500' : 'invisible'}`}>
                    💧 {day.precip} mm
                  </p>
                </div>
              </div>
              {stale && minAgo !== null && (
                <p className="text-xs text-amber-600 mt-2 leading-snug">
                  ⚠️ {minAgo === 0 ? 'just now' : `${minAgo} min ago`}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
