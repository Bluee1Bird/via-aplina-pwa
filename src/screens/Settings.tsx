import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { parseAndStoreCSV } from '../lib/csv'
import { useStages } from '../hooks/useStages'

export default function Settings() {
  const { stages, reload } = useStages()
  const csvInputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleCSVChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setStatus(null)

    try {
      const { count } = await parseAndStoreCSV(file)
      await reload()
      setStatus({ type: 'success', message: `${count} stages loaded successfully.` })
    } catch (err) {
      setStatus({ type: 'error', message: (err as Error).message })
    } finally {
      setUploading(false)
      if (csvInputRef.current) csvInputRef.current.value = ''
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
        <div className="bg-white rounded-2xl border border-neutral-200 px-4 py-4">
          <h2 className="text-sm font-semibold text-neutral-800">Stage Data (CSV)</h2>
          {stages.length > 0 ? (
            <p className="text-xs text-neutral-500 mt-1">{stages.length} stages loaded</p>
          ) : (
            <p className="text-xs text-neutral-500 mt-1">No data loaded yet</p>
          )}

          <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
            Required columns: stage, date, length_km, elevation_gain_m, duration_h, start, finish,
            accommodation_name, accommodation_url, companion, waypoint_start, waypoint_finish.
            Optional: lat, lon (enables weather).
          </p>

          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleCSVChange}
          />
          <button
            onClick={() => csvInputRef.current?.click()}
            disabled={uploading}
            className="mt-3 w-full py-2.5 rounded-xl border border-green-700 text-green-700 text-sm font-medium disabled:opacity-50 active:bg-green-50 transition-colors"
          >
            {uploading ? 'Uploading…' : stages.length > 0 ? 'Replace CSV' : 'Upload CSV'}
          </button>
        </div>

        {/* GPX upload — v2 */}
        <div className="bg-white rounded-2xl border border-neutral-200 px-4 py-4 opacity-50">
          <h2 className="text-sm font-semibold text-neutral-800">Route File (GPX)</h2>
          <p className="text-xs text-neutral-500 mt-1">Coming in v2 — enables map view and elevation profiles.</p>
          <button
            disabled
            className="mt-3 w-full py-2.5 rounded-xl border border-neutral-300 text-neutral-400 text-sm font-medium"
          >
            Upload GPX
          </button>
        </div>

        {/* Status message */}
        {status && (
          <div className={`rounded-xl px-4 py-3 text-sm ${
            status.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {status.message}
          </div>
        )}
      </div>
    </div>
  )
}
