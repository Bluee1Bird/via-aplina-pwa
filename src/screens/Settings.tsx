import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { parseAndStoreCSV } from '../lib/csv'
import { parseAndStoreStageGPX } from '../lib/gpx'
import { useStages } from '../hooks/useStages'
import { useGPXStatus } from '../hooks/useGPX'

export default function Settings() {
  const { stages, reload: reloadStages } = useStages()
  const { loadedStages, reload: reloadGPX } = useGPXStatus()

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
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setGpxUploading(true)
    setGpxStatus(null)

    const succeeded: { stageNumber: number; trackPoints: number }[] = []
    const errors: string[] = []

    for (const file of files) {
      try {
        const result = await parseAndStoreStageGPX(file)
        succeeded.push(result)
      } catch (err) {
        errors.push(`${file.name}: ${(err as Error).message}`)
      }
    }

    await reloadGPX()

    if (errors.length === 0) {
      const label = succeeded.length === 1
        ? `Stage #${succeeded[0].stageNumber} loaded (${succeeded[0].trackPoints.toLocaleString()} pts).`
        : `${succeeded.length} stages loaded (${succeeded.map(r => `#${r.stageNumber}`).join(', ')}).`
      setGpxStatus({ type: 'success', message: label })
    } else {
      const parts = [
        succeeded.length > 0 ? `${succeeded.length} loaded.` : '',
        ...errors,
      ].filter(Boolean)
      setGpxStatus({ type: errors.length < files.length ? 'success' : 'error', message: parts.join(' ') })
    }

    setGpxUploading(false)
    if (gpxInputRef.current) gpxInputRef.current.value = ''
  }

  const gpxStatusLine = loadedStages.length > 0
    ? `${loadedStages.length} stage${loadedStages.length !== 1 ? 's' : ''} with GPX (${[...loadedStages].sort((a, b) => a - b).map(n => `#${n}`).join(', ')})`
    : 'No GPX files loaded'

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
        {/* accept lists both extensions AND MIME types: iOS Files resolves `accept`
            to UTIs, where bare `.csv` (→ public.comma-separated-values-text) greys
            out `.txt` files. Adding text/plain + .txt makes both selectable. */}
        <input ref={csvInputRef} type="file" accept=".csv,.txt,text/csv,text/plain,text/comma-separated-values" className="hidden" onChange={handleCSVChange} />

        {/* GPX upload — multi-file */}
        <UploadCard
          title="Route Files (GPX)"
          statusLine={gpxStatusLine}
          hint="Select one or multiple GPX files exported from Swisstopo. Stage number is read from the filename or metadata — files must include #N (e.g. VA #4.gpx). You can also upload files one by one on each stage's detail screen."
          buttonLabel={gpxUploading ? 'Uploading…' : loadedStages.length > 0 ? 'Add / Replace GPX' : 'Upload GPX files'}
          disabled={gpxUploading}
          onButtonClick={() => gpxInputRef.current?.click()}
          status={gpxStatus}
        />
        <input ref={gpxInputRef} type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" multiple className="hidden" onChange={handleGPXChange} />
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
