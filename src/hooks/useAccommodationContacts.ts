import { useEffect, useState } from 'react'
import { getAllAccommodationContacts } from '../lib/accommodations'
import type { AccommodationContact } from '../lib/types'

export function useAccommodationContacts(): Map<number, AccommodationContact> {
  const [contacts, setContacts] = useState<Map<number, AccommodationContact>>(new Map())

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = () => { getAllAccommodationContacts().then(setContacts).catch(() => {}) }
    // Coalesce the burst of update events fired while many contacts resolve.
    const refresh = () => {
      clearTimeout(timer)
      timer = setTimeout(load, 250)
    }
    load()
    window.addEventListener('accommodationContactsUpdated', refresh)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('accommodationContactsUpdated', refresh)
    }
  }, [])

  return contacts
}
