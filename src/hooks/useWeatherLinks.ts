import { useEffect, useState } from 'react'
import { getAllWeatherLinks } from '../lib/meteoswiss'

// Map of place name → resolved MeteoSwiss forecast URL (null if unresolvable).
// Refreshes (debounced) as resolution completes after a CSV upload.
export function useWeatherLinks(): Map<string, string | null> {
  const [links, setLinks] = useState<Map<string, string | null>>(new Map())

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = () => { getAllWeatherLinks().then(setLinks).catch(() => {}) }
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(load, 250)
    }
    load()
    window.addEventListener('weatherLinksUpdated', refresh)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('weatherLinksUpdated', refresh)
    }
  }, [])

  return links
}
