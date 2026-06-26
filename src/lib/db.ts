import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { Stage, WeatherCache, Progress } from './types'

interface ViaAlpinaDB extends DBSchema {
  stages: { key: number; value: Stage }
  progress: { key: number; value: Progress }
  weather: { key: number; value: WeatherCache }
}

let dbPromise: Promise<IDBPDatabase<ViaAlpinaDB>> | null = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<ViaAlpinaDB>('via-alpina', 1, {
      upgrade(db) {
        db.createObjectStore('stages', { keyPath: 'stage' })
        db.createObjectStore('progress')
        db.createObjectStore('weather', { keyPath: 'stageId' })
      },
    })
  }
  return dbPromise
}
