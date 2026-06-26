import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { parseAndStoreCSV } from '../lib/csv'
import { parseAndStoreGPX } from '../lib/gpx'
import { useStages } from '../hooks/useStages'
import { useGPX } from '../hooks/useGPX'

export default function Settings() {
  const { stages, reload: reloadStages } = useStages()
  const { gpx, reload: reloadGPX } = useGPX()

  const csvInputRef = useRef<HTMLInputElement>(null)
  const gpxInputRef = useRef<HTMLInputElement>(null)

  const [csvStatus, setCsvStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [gpxStatus, setGpxStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [csvUploading, setCsvUploading] = useState(false)
  const [gpxUploading, setGpxUploading] = useState(false)

  const handleCSVChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvUploading(true)
    setCsvStatus(null)
    try {
      const { count } = await parseAndStoreCSV(file)
      await reloadStages()
      setCsvStatus({ type: 'success', message: `${count} stages loaded.` })
    } catch (err) {
      setCsvStatus({ type: 'error', message: (err as Error).message })
    } finally {
      setCsvUploading(false)
      if (csvInputRef.current) csvInputRef.current.value = ''
    }
  }

  const handleGPXChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setGpxUploading(true)
    setGpxStatus(null)
    try {
      const { waypoints, trackPoints } = await parseAndStoreGPX(file)
      await reloadGPX()
      setGpxStatus({
        type: 'success',
        message: `Route loaded: ${trackPoints.toLocaleString()} track points, ${waypoints} waypoints.`,
      })
    } catch (err) {
      setGpxStatus({ type: 'error', message: (err as Error).message })
    } finally {
      setGpxUploading(false)
      if (gpxInputRef.current) gpxInputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50">
      <header className="flex items-center gap-3 px-4 pt-12 pb-4 bg-white border-b border-neutral-200">
        <Link to="/" className="p-1.5 -ml-1.5 text-neutral-500" aria-label="Back">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-base font-semibold text-neutral-800">Settings</h1>
      </header>

      <div className="px-4 py-6 space-y-4">

        {/* CSV upload */}
        <UploadCard
          title="Stage Data (CSV)"
          statusLine={stages.length > 0 ? `${stages.length} stages loaded` : 'No data loaded yet'}
          hint={
            <>
              Required: stage, date, length_km, elevation_gain_m, duration_h, start, finish,
              accommodation_name, accommodation_url, companion, waypoint_start, waypoint_finish.{' '}
              <span className="text-neutral-500">Optional: lat, lon (enables weather).</span>
            </>
          }
          buttonLabel={csvUploading ? 'Uploading…' : stages.length > 0 ? 'Replace CSV' : 'Upload CSV'}
          disabled={csvUploading}
          onButtonClick={() => csvInputRef.current?.click()}
          status={csvStatus}
        />
        <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVChange} />

        {/* GPX upload */}
        <UploadCard
          title="Route File (GPX)"
          statusLine={
            gpx
              ? `Route loaded: ${gpx.trackPoints.length.toLocaleString()} pts, ${gpx.waypoints.length} waypoints`
              : 'No route file loaded'
          }
          hint="Upload a single GPX file for the full route. Waypoint names should match the waypoint_start / waypoint_finish values in your CSV — they're used to slice the map view per stage."
          buttonLabel={gpxUploading ? 'Uploading…' : gpx ? 'Replace GPX' : 'Upload GPX'}
          disabled={gpxUploading}
          onButtonClick={() => gpxInputRef.current?.click()}
          status={gpxStatus}
        />
        <input ref={gpxInputRef} type="file" accept=".gpx" className="hidden" onChange={handleGPXChange} />
      </div>
    </div>
  )
}

function UploadCard({
  title,
  statusLine,
  hint,
  buttonLabel,
  disabled,
  onButtonClick,
  status,
}: {
  title: string
  statusLine: string
  hint: React.ReactNode
  buttonLabel: string
  disabled: boolean
  onButtonClick: () => void
  status: { type: 'success' | 'error'; message: string } | null
}) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 px-4 py-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-neutral-800">{title}</h2>
        <p className="text-xs text-neutral-500 mt-0.5">{statusLine}</p>
      </div>
      <p className="text-xs text-neutral-400 leading-relaxed">{hint}</p>
      <button
        onClick={onButtonClick}
        disabled={disabled}
        className="w-full py-2.5 rounded-xl border border-green-700 text-green-700 text-sm font-medium disabled:opacity-50 active:bg-green-50 transition-colors"
      >
        {buttonLabel}
      </button>
      {status && (
        <div className={`rounded-xl px-3 py-2.5 text-xs ${
          status.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {status.message}
        </div>
      )}
    </div>
  )
}
