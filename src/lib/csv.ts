import Papa from 'papaparse'
import type { Stage } from './types'
import { getDB } from './db'

const REQUIRED_COLUMNS = [
  'stage', 'date', 'length_km', 'elevation_gain_m', 'duration_h',
  'start', 'finish', 'accommodation_name', 'accommodation_url',
  'companion', 'waypoint_start', 'waypoint_finish',
]

export async function parseAndStoreCSV(file: File): Promise<{ count: number }> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const missing = REQUIRED_COLUMNS.filter(col => !results.meta.fields?.includes(col))
        if (missing.length > 0) {
          reject(new Error(`Missing columns: ${missing.join(', ')}`))
          return
        }

        const stages: Stage[] = results.data.map((row) => ({
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

        try {
          const db = await getDB()
          const tx = db.transaction('stages', 'readwrite')
          await tx.store.clear()
          await Promise.all(stages.map(s => tx.store.put(s)))
          await tx.done
          resolve({ count: stages.length })
        } catch (e) {
          reject(e)
        }
      },
      error: (err) => reject(new Error(err.message)),
    })
  })
}
