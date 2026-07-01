import { getDB } from './db'
import type { Stage, StageOverride, AccommodationContactCache, Progress, StageGpxData } from './types'

// Full-app backup → a single JSON file the user can save off-device, so a
// reinstall (or moving between iPhone/Android) never loses data. Persistent
// storage stops *automatic* eviction; this covers *manual* uninstall, which
// nothing in-browser can prevent. The volatile `weather` cache (15-min TTL,
// re-fetchable) is deliberately excluded.

interface BackupEntry {
  key?: number // only for out-of-line stores (progress, gpx)
  value: unknown
}

interface BackupData {
  stages?: BackupEntry[]
  stageOverrides?: BackupEntry[]
  accommodationContacts?: BackupEntry[]
  progress?: BackupEntry[]
  gpx?: BackupEntry[]
}

export interface BackupFile {
  app: 'via-alpina-pwa'
  kind: 'backup'
  version: number
  exportedAt: string
  data: BackupData
}

export async function exportBackup(): Promise<BackupFile> {
  const db = await getDB()

  const [stages, stageOverrides, accommodationContacts] = await Promise.all([
    db.getAll('stages'),
    db.getAll('stageOverrides'),
    db.getAll('accommodationContacts'),
  ])
  // progress + gpx use out-of-line keys, so capture keys alongside values.
  const [progressKeys, progressVals, gpxKeys, gpxVals] = await Promise.all([
    db.getAllKeys('progress'),
    db.getAll('progress'),
    db.getAllKeys('gpx'),
    db.getAll('gpx'),
  ])

  return {
    app: 'via-alpina-pwa',
    kind: 'backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      stages: stages.map(value => ({ value })),
      stageOverrides: stageOverrides.map(value => ({ value })),
      accommodationContacts: accommodationContacts.map(value => ({ value })),
      progress: progressVals.map((value, i) => ({ key: progressKeys[i] as number, value })),
      gpx: gpxVals.map((value, i) => ({ key: gpxKeys[i] as number, value })),
    },
  }
}

// Build the backup and trigger a download. Filename carries the date.
export async function downloadBackup(): Promise<void> {
  const backup = await exportBackup()
  const stamp = new Date().toISOString().slice(0, 10)
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `via-alpina-backup-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke a tick later so the download has grabbed the blob (iOS is picky).
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

function validateBackup(json: unknown): BackupFile {
  if (!json || typeof json !== 'object') throw new Error('Not a valid backup file.')
  const file = json as Partial<BackupFile>
  if (file.app !== 'via-alpina-pwa' || file.kind !== 'backup' || !file.data) {
    throw new Error('This file is not a Via Alpina backup.')
  }
  return file as BackupFile
}

// Replace all app data from a backup file. Each store is cleared then refilled
// in its own transaction (idb auto-commits, so keep each atomic).
export async function importBackup(json: unknown): Promise<{ stages: number; gpx: number }> {
  const file = validateBackup(json)
  const db = await getDB()
  const d = file.data

  {
    const tx = db.transaction('stages', 'readwrite')
    await tx.store.clear()
    for (const e of d.stages ?? []) await tx.store.put(e.value as Stage)
    await tx.done
  }
  {
    const tx = db.transaction('stageOverrides', 'readwrite')
    await tx.store.clear()
    for (const e of d.stageOverrides ?? []) await tx.store.put(e.value as StageOverride)
    await tx.done
  }
  {
    const tx = db.transaction('accommodationContacts', 'readwrite')
    await tx.store.clear()
    for (const e of d.accommodationContacts ?? []) await tx.store.put(e.value as AccommodationContactCache)
    await tx.done
  }
  {
    const tx = db.transaction('progress', 'readwrite')
    await tx.store.clear()
    for (const e of d.progress ?? []) await tx.store.put(e.value as Progress, e.key as number)
    await tx.done
  }
  {
    const tx = db.transaction('gpx', 'readwrite')
    await tx.store.clear()
    for (const e of d.gpx ?? []) await tx.store.put(e.value as StageGpxData, e.key as number)
    await tx.done
  }

  return { stages: d.stages?.length ?? 0, gpx: d.gpx?.length ?? 0 }
}

export async function readBackupFile(file: File): Promise<unknown> {
  const text = await file.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Could not read file — not valid JSON.')
  }
}
