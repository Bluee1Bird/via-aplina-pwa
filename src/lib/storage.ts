// Persistent storage — keeps the uploaded CSV/GPX (and progress/overrides) in
// IndexedDB exempt from automatic eviction under storage pressure or long
// disuse. App/version updates never touch IndexedDB, so eviction is the only
// real data-loss vector; requesting persistence closes it.
//
// Cross-platform: the Storage API (`navigator.storage.persist/persisted/
// estimate`) exists on Android Chrome and iOS Safari 16.4+. On Android it's
// granted via site engagement/installation; on iOS it's durable for installed
// (Add-to-Home-Screen) web apps. Every call guards for missing APIs so older
// engines just no-op instead of throwing.

export interface StorageStatus {
  supported: boolean
  persisted: boolean
  usageBytes?: number
  quotaBytes?: number
}

async function estimate(): Promise<{ usageBytes?: number; quotaBytes?: number }> {
  const storage = navigator.storage
  if (!storage || typeof storage.estimate !== 'function') return {}
  try {
    const { usage, quota } = await storage.estimate()
    return { usageBytes: usage, quotaBytes: quota }
  } catch {
    return {}
  }
}

// Idempotent — safe to call on every launch. Only actually prompts the browser
// (`persist()`) when not already granted.
export async function requestPersistentStorage(): Promise<StorageStatus> {
  const storage = navigator.storage
  if (!storage || typeof storage.persisted !== 'function') {
    return { supported: false, persisted: false }
  }
  let persisted = await storage.persisted()
  if (!persisted && typeof storage.persist === 'function') {
    try {
      persisted = await storage.persist()
    } catch {
      // Some engines reject instead of resolving false — treat as not granted.
    }
  }
  return { supported: true, persisted, ...(await estimate()) }
}

// Read-only status (no persist() prompt) for display.
export async function getStorageStatus(): Promise<StorageStatus> {
  const storage = navigator.storage
  if (!storage || typeof storage.persisted !== 'function') {
    return { supported: false, persisted: false }
  }
  const persisted = await storage.persisted()
  return { supported: true, persisted, ...(await estimate()) }
}

export function formatBytes(bytes?: number): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}
