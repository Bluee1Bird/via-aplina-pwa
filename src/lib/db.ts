import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { Stage, WeatherCache, Progress, StageGpxData } from './types'

interface ViaAlpinaDB extends DBSchema {
  stages: { key: number; value: Stage }
  progress: { key: number; value: Progress }
  weather: { key: string; value: WeatherCache }
  gpx: { key: number; value: StageGpxData }
}

let dbPromise: Promise<IDBPDatabase<ViaAlpinaDB>> | null = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<ViaAlpinaDB>('via-alpina', 4, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (oldVersion < 1) {
          db.createObjectStore('stages', { keyPath: 'stage' })
          db.createObjectStore('progress')
          db.createObjectStore('weather', { keyPath: 'stageId' })
        }
        if (oldVersion < 2) {
          db.createObjectStore('gpx')
        }
        if (oldVersion < 3) {
          void transaction.objectStore('gpx').clear()
        }
        if (oldVersion < 4) {
          // Weather store key changed from numeric stageId to string "N-start"/"N-finish"
          db.deleteObjectStore('weather')
          db.createObjectStore('weather', { keyPath: 'key' })
        }
      },
    })
  }
  return dbPromise
}
