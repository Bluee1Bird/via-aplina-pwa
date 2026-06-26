import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { Stage, WeatherCache, Progress, GpxData } from './types'

interface ViaAlpinaDB extends DBSchema {
  stages: { key: number; value: Stage }
  progress: { key: number; value: Progress }
  weather: { key: number; value: WeatherCache }
  gpx: { key: number; value: GpxData }
}

let dbPromise: Promise<IDBPDatabase<ViaAlpinaDB>> | null = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<ViaAlpinaDB>('via-alpina', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('stages', { keyPath: 'stage' })
          db.createObjectStore('progress')
          db.createObjectStore('weather', { keyPath: 'stageId' })
        }
        if (oldVersion < 2) {
          db.createObjectStore('gpx')
        }
      },
    })
  }
  return dbPromise
}
