import { useCallback, useEffect, useState } from 'react'
import { getStorageStatus, requestPersistentStorage } from '../lib/storage'
import type { StorageStatus } from '../lib/storage'

// Reads current persistence status on mount (no prompt) and exposes request()
// to actively ask the browser to keep data — wired to the Settings button.
export function usePersistentStorage() {
  const [status, setStatus] = useState<StorageStatus | null>(null)
  const [requesting, setRequesting] = useState(false)

  useEffect(() => {
    let active = true
    getStorageStatus().then(s => { if (active) setStatus(s) })
    return () => { active = false }
  }, [])

  const request = useCallback(async () => {
    setRequesting(true)
    try {
      const s = await requestPersistentStorage()
      setStatus(s)
      return s
    } finally {
      setRequesting(false)
    }
  }, [])

  return { status, request, requesting }
}
