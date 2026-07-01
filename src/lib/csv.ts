import Papa from 'papaparse'
import type { Stage } from './types'
import { getDB } from './db'
import { isUrl, isGoogleMapsUrl, fetchAccommodationContact, fetchAccommodationPlace } from './accommodations'
import { resolveAndCacheWeatherLinks } from './meteoswiss'

const REQUIRED_COLUMNS = [
  'stage', 'date', 'length_km', 'elevation_gain_m', 'duration_h',
  'start', 'finish', 'accommodation_name', 'accommodation_url',
  'companion', 'waypoint_start', 'waypoint_finish',
]

// Shared back-end for every import format (CSV, XLS/XLSX, …): given parsed rows
// + their column names, validate, map → Stage[], replace the store, and kick off
// accommodation resolution. Parsers differ only in how they produce these rows.
export async function storeStageRows(
  rows: Record<string, unknown>[],
  fields: string[],
): Promise<{ count: number }> {
  const missing = REQUIRED_COLUMNS.filter(col => !fields.includes(col))
  if (missing.length > 0) {
    throw new Error(`Missing columns: ${missing.join(', ')}`)
  }

  const stages: Stage[] = rows.map((row) => ({
    stage: Number(row.stage),
    date: String(row.date ?? ''),
    length_km: Number(row.length_km),
    elevation_gain_m: Number(row.elevation_gain_m),
    duration_h: Number(row.duration_h),
    start: String(row.start ?? ''),
    finish: String(row.finish ?? ''),
    accommodation_name: String(row.accommodation_name ?? ''),
    accommodation_url: String(row.accommodation_url ?? ''),
    companion: String(row.companion ?? ''),
    waypoint_start: String(row.waypoint_start ?? ''),
    waypoint_finish: String(row.waypoint_finish ?? ''),
    lat: row.lat ? Number(row.lat) : undefined,
    lon: row.lon ? Number(row.lon) : undefined,
  }))

  const db = await getDB()
  const tx = db.transaction(['stages', 'accommodationContacts', 'weatherLinks'], 'readwrite')
  await tx.objectStore('stages').clear()
  await tx.objectStore('accommodationContacts').clear()
  await tx.objectStore('weatherLinks').clear()
  await Promise.all(stages.map(s => tx.objectStore('stages').put(s)))
  await tx.done

  // Fire-and-forget: resolve accommodation place info once, now. Cached forever
  // — only re-run when new data is uploaded (clears the store above).
  for (const stage of stages) {
    const url = stage.accommodation_url
    if (!url) continue
    if (isGoogleMapsUrl(url)) {
      fetchAccommodationPlace(url, stage.stage).catch(() => {})
    } else if (isUrl(url)) {
      fetchAccommodationContact(url, stage.stage).catch(() => {})
    }
  }

  // Fire-and-forget: resolve each start/finish town to its MeteoSwiss forecast
  // URL (deduped). Cached until the next upload (store cleared above).
  resolveAndCacheWeatherLinks(stages.flatMap(s => [s.start, s.finish])).catch(() => {})

  return { count: stages.length }
}

export async function parseAndStoreCSV(file: File): Promise<{ count: number }> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        storeStageRows(results.data, results.meta.fields ?? []).then(resolve, reject)
      },
      error: (err) => reject(new Error(err.message)),
    })
  })
}

// A date-only cell becomes a UTC-midnight Date in SheetJS; format from its UTC
// components so the day never shifts under the viewer's timezone, and so it
// matches the "yyyy-mm-dd" the rest of the app (weather, cache keys) expects.
function isoDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

// Excel (.xls / .xlsx). SheetJS is lazy-imported so it never weighs on the
// initial bundle / CSV path — it loads only when a spreadsheet is actually picked.
// First worksheet only; the header row drives column validation, like CSV.
export async function parseAndStoreSpreadsheet(file: File): Promise<{ count: number }> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(await file.arrayBuffer(), { dense: true, cellDates: true })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) throw new Error('No worksheet found in file')

  // header:1 gives the raw header row for the required-columns check.
  const headerRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false })
  const fields = (headerRows[0] ?? []).map(h => String(h ?? '').trim())

  // raw:true keeps real types (numbers stay numbers, real date cells stay Date);
  // defval:'' keeps every column present even when a cell is blank. Then collapse
  // any Date back to a yyyy-mm-dd string (text dates already arrive as strings).
  const rows = XLSX.utils
    .sheet_to_json<Record<string, unknown>>(sheet, { raw: true, defval: '' })
    .filter(r => String(r.stage ?? '').trim() !== '') // drop blank/trailing rows
    .map(r => {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(r)) out[k] = v instanceof Date ? isoDate(v) : v
      return out
    })

  return storeStageRows(rows, fields)
}
