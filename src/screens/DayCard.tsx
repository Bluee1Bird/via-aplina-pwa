import { lazy, Suspense } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStages } from '../hooks/useStages'
import { useProgress } from '../hooks/useProgress'
import { useCompanion } from '../hooks/useCompanion'
import { useSwipe } from '../hooks/useSwipe'
import { useWeather } from '../hooks/useWeather'
import { useGPX } from '../hooks/useGPX'
import { weatherIcon, weatherLabel } from '../lib/weather'

// Lazy-load the map so Leaflet CSS doesn't block initial render
const StageMap = lazy(() => import('../components/StageMap'))

export default function DayCard() {
  const { stageId } = useParams<{ stageId: string }>()
  const { stages, loading } = useStages()
  const navigate = useNavigate()

  const stageNum = Number(stageId)
  const sorted = [...stages].sort((a, b) => a.stage - b.stage)
  const idx = sorted.findIndex(s => s.stage === stageNum)
  const stage = sorted[idx]
  const prev = sorted[idx - 1]
  const next = sorted[idx + 1]

  const goNext = () => next && navigate(`/stage/${next.stage}`)
  const goPrev = () => prev && navigate(`/stage/${prev.stage}`)
  const { onTouchStart, onTouchEnd } = useSwipe(goNext, goPrev)

  const { completedStages, toggleStage } = useProgress(stages)
  const companion = useCompanion(stage, stages)
  const weather = useWeather(stageNum, stage?.lat, stage?.lon)
  const { gpx } = useGPX()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-neutral-400 text-sm">Loading…</p>
      </div>
    )
  }

  if (!stage) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <p className="text-neutral-500">Stage not found.</p>
        <button onClick={() => navigate('/')} className="text-sm text-green-700 underline">
          Back to home
        </button>
      </div>
    )
  }

  const isDone = completedStages.has(stage.stage)
  const minAgo = weather.fetchedAt ? Math.round((Date.now() - weather.fetchedAt) / 60000) : null
  const stagePosition = `Stage ${idx + 1} of ${sorted.length}`

  const hasMap = gpx !== null && (stage.waypoint_start || stage.waypoint_finish)

  return (
    <div
      className="flex flex-col min-h-screen bg-neutral-50"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-4 pt-12 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-1.5 -ml-1.5 text-neutral-500 shrink-0"
            aria-label="Back to home"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">{stagePosition}</p>
            <h1 className="text-base font-semibold text-neutral-800 leading-snug truncate">
              {stage.start} → {stage.finish}
            </h1>
          </div>
          {/* Done toggle */}
          <button
            onClick={() => toggleStage(stage.stage)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              isDone
                ? 'bg-green-100 border-green-300 text-green-800'
                : 'bg-white border-neutral-300 text-neutral-500'
            }`}
          >
            <span>{isDone ? '✓' : '○'}</span>
            <span>{isDone ? 'Done' : 'Mark done'}</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-28">

        {/* Route stats */}
        <div className="bg-white rounded-2xl border border-neutral-200 px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Route</span>
            <span className="text-xs text-neutral-400">{formatDay(stage.date)}</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Metric icon="📍" label="Distance" value={`${stage.length_km} km`} />
            <Metric icon="⛰️" label="Elevation" value={`+${stage.elevation_gain_m} m`} />
            <Metric icon="⏱️" label="Duration" value={`${stage.duration_h} h`} />
          </div>

          {/* Waypoints breadcrumb — only shown when names differ from start/finish */}
          {waypointsDiffer(stage) && (
            <div className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
              <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
              <span className="truncate">{stage.waypoint_start}</span>
              <span className="flex-1 border-t border-dashed border-neutral-300 mx-1" />
              <span className="truncate">{stage.waypoint_finish}</span>
              <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
            </div>
          )}
        </div>

        {/* Map */}
        {hasMap && (
          <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Route map</span>
            </div>
            <Suspense fallback={
              <div className="h-60 flex items-center justify-center bg-neutral-50">
                <p className="text-xs text-neutral-400">Loading map…</p>
              </div>
            }>
              <StageMap
                gpx={gpx!}
                waypointStart={stage.waypoint_start}
                waypointFinish={stage.waypoint_finish}
                labelStart={stage.waypoint_start || stage.start}
                labelFinish={stage.waypoint_finish || stage.finish}
              />
            </Suspense>
          </div>
        )}

        {/* Accommodation */}
        {stage.accommodation_name && (
          <div className="bg-white rounded-2xl border border-neutral-200 px-4 py-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Accommodation</span>
            <div className="mt-2 flex items-start gap-2">
              <span className="text-base shrink-0">🏠</span>
              <div className="flex-1 min-w-0">
                {stage.accommodation_url ? (
                  <a
                    href={stage.accommodation_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-green-700 underline underline-offset-2 break-words"
                  >
                    {stage.accommodation_name}
                  </a>
                ) : (
                  <p className="text-sm font-medium text-neutral-800 break-words">{stage.accommodation_name}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Companion */}
        {companion && (
          <div className="bg-white rounded-2xl border border-neutral-200 px-4 py-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Companion</span>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-base">👤</span>
              <div>
                <p className="text-sm font-medium text-neutral-800">{formatCompanions(companion.name)}</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Day {companion.dayIndex} of {companion.totalDays} together
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Weather */}
        {(stage.lat && stage.lon) && (
          <div className="bg-white rounded-2xl border border-neutral-200 px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Weather at finish
              </span>
              {weather.stale && minAgo !== null && (
                <span className="text-xs text-amber-500">⚠️ {minAgo} min ago</span>
              )}
            </div>

            {weather.loading && (
              <p className="text-xs text-neutral-400 py-2">Fetching forecast…</p>
            )}
            {weather.error && !weather.data && (
              <p className="text-xs text-red-500 py-2">{weather.error}</p>
            )}
            {weather.data && (
              <div className="grid grid-cols-3 gap-2">
                {weather.data.daily.map((day, i) => (
                  <div
                    key={day.date}
                    className={`rounded-xl p-3 text-center border ${
                      i === 0 ? 'bg-green-50 border-green-200' : 'bg-neutral-50 border-neutral-200'
                    }`}
                  >
                    <p className="text-xs text-neutral-500 font-medium">{shortDate(day.date)}</p>
                    <p className="text-3xl mt-1.5">{weatherIcon(day.weathercode)}</p>
                    <p className="text-xs text-neutral-500 mt-1 leading-tight">{weatherLabel(day.weathercode)}</p>
                    <p className="text-xs font-semibold text-neutral-800 mt-1.5">
                      {Math.round(day.tmax)}°{' '}
                      <span className="font-normal text-neutral-400">/ {Math.round(day.tmin)}°</span>
                    </p>
                    {day.precip > 0 && (
                      <p className="text-xs text-blue-500 mt-0.5">💧 {day.precip} mm</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Prev / Next */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 px-4 py-4 flex gap-3">
        <button
          onClick={goPrev}
          disabled={!prev}
          className="flex-1 py-3 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-600 disabled:opacity-30 active:bg-neutral-50 transition-colors"
        >
          {prev ? `← Stage ${prev.stage}` : '← Prev'}
        </button>
        <button
          onClick={goNext}
          disabled={!next}
          className="flex-1 py-3 rounded-xl bg-green-700 text-white text-sm font-medium disabled:opacity-30 active:bg-green-800 transition-colors"
        >
          {next ? `Stage ${next.stage} →` : 'Next →'}
        </button>
      </div>
    </div>
  )
}

function Metric({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="text-xl">{icon}</span>
      <p className="text-xs text-neutral-400 mt-1">{label}</p>
      <p className="text-sm font-semibold text-neutral-800 mt-0.5">{value}</p>
    </div>
  )
}

function formatCompanions(raw: string): string {
  return raw.split(',').map(s => s.trim()).filter(Boolean).join(' & ')
}

function waypointsDiffer(stage: { start: string; finish: string; waypoint_start: string; waypoint_finish: string }): boolean {
  const ws = stage.waypoint_start?.trim()
  const wf = stage.waypoint_finish?.trim()
  return !!(ws || wf) && (ws !== stage.start.trim() || wf !== stage.finish.trim())
}

function formatDay(iso: string): string {
  if (!iso) return ''
  return new Date(iso + 'T00:00:00').toLocaleDateString('en', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

function shortDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}
