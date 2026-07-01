import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { Stage, WeatherCache, Progress, StageGpxData, AccommodationContactCache, StageOverride, WeatherLinkCache } from './types'

interface ViaAlpinaDB extends DBSchema {
  stages: { key: number; value: Stage }
  progress: { key: number; value: Progress }
  weather: { key: string; value: WeatherCache }
  gpx: { key: number; value: StageGpxData }
  accommodationContacts: { key: number; value: AccommodationContactCache }
  stageOverrides: { key: number; value: StageOverride }
  weatherLinks: { key: string; value: WeatherLinkCache }
}

let dbPromise: Promise<IDBPDatabase<ViaAlpinaDB>> | null = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<ViaAlpinaDB>('via-alpina', 7, {
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
        if (oldVersion < 5) {
          db.createObjectStore('accommodationContacts', { keyPath: 'stageId' })
        }
        if (oldVersion < 6) {
          // Keyed by stage number, NOT wiped on CSV re-upload — see StageOverride.
          db.createObjectStore('stageOverrides', { keyPath: 'stage' })
        }
        if (oldVersion < 7) {
          // Resolved MeteoSwiss forecast URLs per place name (rebuilt per upload).
          db.createObjectStore('weatherLinks', { keyPath: 'place' })
        }
      },
      // Another tab/page holding the DB open at an older version would otherwise
      // block this version upgrade indefinitely and every getDB() await hangs
      // (→ app stuck on "Loading…"). Step aside so the upgrade can proceed.
      blocking() {
        void dbPromise?.then(db => db.close())
        dbPromise = null
      },
      blocked() {
        console.warn('[db] upgrade blocked by another open tab of this app — close it and reload')
      },
      terminated() {
        dbPromise = null
      },
    })
  }
  return dbPromise
}
