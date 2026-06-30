import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useStages } from '../hooks/useStages'
import { useProgress } from '../hooks/useProgress'
import { useCompanion } from '../hooks/useCompanion'
import { useSwipe } from '../hooks/useSwipe'
import { useLocationWeather } from '../hooks/useWeather'
import { useStageGPX } from '../hooks/useGPX'
import { useAccommodationContacts } from '../hooks/useAccommodationContacts'
import { parseAndStoreStageGPX } from '../lib/gpx'
import { isUrl, isGoogleMapsUrl } from '../lib/accommodations'
import WeatherWidget from '../components/WeatherWidget'

const StageMap = lazy(() => import('../components/StageMap'))

const MAP_MIN = 120
const MAP_MAX = 520
const MAP_DEFAULT = 240

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
  const contacts = useAccommodationContacts()
  const contact = stage ? contacts.get(stage.stage) : undefined
  // Link to open the place externally (resolved Maps URL preferred, else the raw CSV URL)
  const accLink = contact?.mapsUrl ?? (stage?.accommodation_url && isUrl(stage.accommodation_url) ? stage.accommodation_url : undefined)
  const accLinkIsMaps = !!accLink && isGoogleMapsUrl(accLink)
  const companionStaysOvernight = companion ? companion.dayIndex < companion.totalDays : false
  const { trackPoints, reload: reloadGPX } = useStageGPX(stageNum)

  // Map resize via Pointer Events + setPointerCapture — works uniformly for
  // mouse, touch and pen (touch events stay bound to their start target, which
  // is why the old full-screen-overlay approach silently failed on mobile).
  const [mapHeight, setMapHeight] = useState(MAP_DEFAULT)
  const [mapDragging, setMapDragging] = useState(false)
  const mapDragRef = useRef<{ startY: number; startH: number } | null>(null)
  // Pointer events fire faster than the screen refreshes; coalesce to one
  // setState per animation frame so a heavy map doesn't re-render per event.
  const latestY = useRef(0)
  const rafRef = useRef<number | null>(null)

  const onHandleDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    mapDragRef.current = { startY: e.clientY, startH: mapHeight }
    setMapDragging(true)
  }
  const onHandleMove = (e: React.PointerEvent) => {
    if (!mapDragRef.current) return
    latestY.current = e.clientY
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const d = mapDragRef.current
      if (!d) return
      setMapHeight(Math.max(MAP_MIN, Math.min(MAP_MAX, d.startH + latestY.current - d.startY)))
    })
  }
  const onHandleUp = (e: React.PointerEvent) => {
    if (!mapDragRef.current) return
    mapDragRef.current = null
    setMapDragging(false)
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }

  // Per-stage GPX upload
  const gpxInputRef = useRef<HTMLInputElement>(null)
  const [gpxUploading, setGpxUploading] = useState(false)
  const [gpxError, setGpxError] = useState<string | null>(null)

  const handleGPXUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setGpxUploading(true)
    setGpxError(null)
    try {
      await parseAndStoreStageGPX(file, stageNum)
      await reloadGPX()
    } catch (err) {
      setGpxError((err as Error).message)
    } finally {
      setGpxUploading(false)
      if (gpxInputRef.current) gpxInputRef.current.value = ''
    }
  }

  // Weather — coordinates from GPX endpoints, fall back to CSV lat/lon for finish
  const startPoint = trackPoints?.[0]
  const finishPoint = trackPoints && trackPoints.length > 0 ? trackPoints[trackPoints.length - 1] : undefined
  const finishLat = finishPoint?.lat ?? stage?.lat
  const finishLon = finishPoint?.lon ?? stage?.lon

  // Weather is for the stage's planned date (cache key includes the date so a
  // changed CSV date invalidates it).
  const stageDate = stage?.date
  const startWeather = useLocationWeather(`${stageNum}-start-${stageDate ?? ''}`, startPoint?.lat, startPoint?.lon, stageDate)
  const finishWeather = useLocationWeather(`${stageNum}-finish-${stageDate ?? ''}`, finishLat, finishLon, stageDate)

  const [mapCollapsed, setMapCollapsed] = useState(false)
  const [startWeatherCollapsed, setStartWeatherCollapsed] = useState(false)
  const [finishWeatherCollapsed, setFinishWeatherCollapsed] = useState(false)

  const hasStartWeather = !!(startPoint?.lat && startPoint?.lon)
  const hasFinishWeather = !!(finishLat && finishLon)

  // Reset scroll to the top when moving between stages (the screen doesn't
  // remount on param change, so it would otherwise stay scrolled down).
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => { scrollRef.current?.scrollTo(0, 0) }, [stageNum])

  // NOTE: accommodation place info is fetched once at CSV-upload time and cached
  // forever (only re-fetched when a new CSV is uploaded). We intentionally do NOT
  // retry on view — the data doesn't change on hiking timescales.

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
  const stagePosition = `Stage ${idx + 1} of ${sorted.length}`

  return (
    <div
      className="flex flex-col min-h-screen bg-neutral-50"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 px-4 pt-12 pb-4">
        <div className="flex items-center gap-2">
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
          {/* Settings */}
          <Link
            to="/settings"
            className="shrink-0 p-1.5 -mr-1 text-neutral-400"
            aria-label="Settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-32">

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

        {/* Map — collapsable, with resize handle. data-no-swipe stops map panning
            and handle dragging from triggering stage navigation. */}
        <div data-no-swipe className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <div className="flex items-center">
            <button
              onClick={() => setMapCollapsed(c => !c)}
              className="flex-1 px-4 py-3 flex items-center gap-2 text-left"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Route map</span>
              <svg
                className={`w-3.5 h-3.5 text-neutral-400 shrink-0 transition-transform duration-200 ${mapCollapsed ? '' : 'rotate-180'}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              onClick={() => gpxInputRef.current?.click()}
              disabled={gpxUploading}
              className="px-4 py-3 text-xs text-green-700 font-medium disabled:opacity-50 shrink-0 border-l border-neutral-100"
            >
              {gpxUploading ? 'Uploading…' : trackPoints ? 'Replace GPX' : 'Upload GPX'}
            </button>
          </div>

          {!mapCollapsed && (
            <>
              <div className="border-t border-neutral-100">
                {trackPoints ? (
                  <Suspense fallback={
                    <div style={{ height: mapHeight }} className="flex items-center justify-center bg-neutral-50">
                      <p className="text-xs text-neutral-400">Loading map…</p>
                    </div>
                  }>
                    <StageMap
                      key={stageNum}
                      trackPoints={trackPoints}
                      labelStart={stage.start}
                      labelFinish={stage.finish}
                      height={mapHeight}
                    />
                  </Suspense>
                ) : (
                  <div style={{ height: mapHeight }} className="flex flex-col items-center justify-center gap-1.5 bg-neutral-50">
                    <p className="text-xs text-neutral-400">No route file for this stage</p>
                    {gpxError && <p className="text-xs text-red-500 px-6 text-center">{gpxError}</p>}
                  </div>
                )}
              </div>

              {/* Drag-to-resize handle (pointer events + capture → works on touch) */}
              <div
                onPointerDown={onHandleDown}
                onPointerMove={onHandleMove}
                onPointerUp={onHandleUp}
                onPointerCancel={onHandleUp}
                style={{ touchAction: 'none' }}
                className={`h-7 flex items-center justify-center gap-2 cursor-ns-resize border-t border-neutral-100 select-none transition-colors ${mapDragging ? 'bg-green-50' : 'bg-neutral-50'}`}
                aria-label="Drag to resize map"
              >
                <div className={`w-10 h-1 rounded-full transition-colors ${mapDragging ? 'bg-green-500' : 'bg-neutral-300'}`} />
                {mapDragging && <span className="text-[10px] text-neutral-400 tabular-nums">{Math.round(mapHeight)}px</span>}
              </div>
            </>
          )}
        </div>
        <input ref={gpxInputRef} type="file" accept=".gpx" className="hidden" onChange={handleGPXUpload} />

        {/* Accommodation */}
        {stage.accommodation_name && (
          <div className="bg-white rounded-2xl border border-neutral-200 px-4 py-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Accommodation</span>
            <div className="mt-2 flex items-start gap-2">
              <span className="text-base shrink-0">🏠</span>
              <div className="flex-1 min-w-0">
                {/* Name (resolved place name preferred) + optional OSM star class */}
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-neutral-800 break-words">
                    {contact?.placeName || stage.accommodation_name}
                  </p>
                  {contact?.stars && (
                    <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                      {'★'.repeat(Math.min(5, parseInt(contact.stars, 10) || 0))} {contact.stars}-star
                    </span>
                  )}
                </div>

                {/* Contact info (best-effort from OpenStreetMap) */}
                {(contact?.phone || contact?.website || contact?.address) && (
                  <div className="mt-2 space-y-1">
                    {contact?.phone && (
                      <a href={`tel:${contact.phone.replace(/\s+/g, '')}`} className="flex items-center gap-1.5 text-xs text-neutral-700 hover:text-green-700">
                        <span>📞</span>
                        <span>{contact.phone}</span>
                      </a>
                    )}
                    {contact?.website && (
                      <a href={contact.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-green-700 underline underline-offset-1 break-all">
                        <span>🌐</span>
                        <span>{contact.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                      </a>
                    )}
                    {contact?.address && (
                      <p className="flex items-start gap-1.5 text-xs text-neutral-500">
                        <span>📍</span>
                        <span>{contact.address}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Open externally */}
                {accLink && (
                  <a
                    href={accLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1.5 active:bg-green-100"
                  >
                    <span>{accLinkIsMaps ? '🗺️' : '🌐'}</span>
                    <span>{accLinkIsMaps ? 'Open in Google Maps' : 'Open website'}</span>
                  </a>
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
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-neutral-800">{formatCompanions(companion.name)}</p>
                  {companionStaysOvernight && (
                    <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                      🌙 Staying tonight
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Day {companion.dayIndex} of {companion.totalDays} together
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Weather — side by side when both present */}
        {(hasStartWeather || hasFinishWeather) && (
          <div className={`flex gap-3 ${hasStartWeather && hasFinishWeather ? '' : ''}`}>
            {hasStartWeather && (
              <div className="flex-1 min-w-0">
                <WeatherWidget
                  label="Start"
                  forDate={stage.date}
                  day={startWeather.day}
                  loading={startWeather.loading}
                  error={startWeather.error}
                  fetchedAt={startWeather.fetchedAt}
                  stale={startWeather.stale}
                  tooFar={startWeather.tooFar}
                  collapsed={startWeatherCollapsed}
                  onToggle={() => setStartWeatherCollapsed(c => !c)}
                />
              </div>
            )}
            {hasFinishWeather && (
              <div className="flex-1 min-w-0">
                <WeatherWidget
                  label="Finish"
                  forDate={stage.date}
                  day={finishWeather.day}
                  loading={finishWeather.loading}
                  error={finishWeather.error}
                  fetchedAt={finishWeather.fetchedAt}
                  stale={finishWeather.stale}
                  tooFar={finishWeather.tooFar}
                  collapsed={finishWeatherCollapsed}
                  onToggle={() => setFinishWeatherCollapsed(c => !c)}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Prev / Next */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 px-4 py-4 flex gap-3 safe-area-bottom">
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

