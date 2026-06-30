import { getDB } from './db'
import type { AccommodationContact } from './types'

export function isUrl(str: string): boolean {
  return /^https?:\/\//i.test(str.trim())
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      v => { clearTimeout(timer); resolve(v) },
      e => { clearTimeout(timer); reject(e) },
    )
  })
}

// Public CORS proxies — tried in order until one returns usable HTML. Each is
// flaky on its own, so the fallback chain matters for real-world reliability.
const PROXIES: { build: (u: string) => string; extract: (r: Response) => Promise<string | null> }[] = [
  {
    build: u => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
    extract: async r => ((await r.json()) as { contents?: string }).contents ?? null,
  },
  {
    build: u => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
    extract: r => r.text(),
  },
  {
    build: u => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
    extract: r => r.text(),
  },
]

async function tryFetch(url: string): Promise<string | null> {
  for (const proxy of PROXIES) {
    try {
      const res = await withTimeout(fetch(proxy.build(url)), 15000)
      if (!res.ok) continue
      const html = await proxy.extract(res)
      if (html && html.length > 0) return html
    } catch {
      // try next proxy
    }
  }
  return null
}

function parseContactFromHtml(html: string): Partial<AccommodationContact> {
  const result: Partial<AccommodationContact> = {}

  // JSON-LD structured data — most reliable source
  const jsonLdRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = jsonLdRe.exec(html)) !== null) {
    try {
      const raw: unknown = JSON.parse(m[1])
      const entries = Array.isArray(raw) ? raw : [raw]
      for (const entry of entries) {
        if (!entry || typeof entry !== 'object') continue
        const e = entry as Record<string, unknown>
        if (!result.placeName && typeof e.name === 'string') result.placeName = e.name
        if (!result.phone && typeof e.telephone === 'string') result.phone = e.telephone
        if (!result.website && typeof e.url === 'string') result.website = e.url
        if (!result.address && e.address && typeof e.address === 'object') {
          const a = e.address as Record<string, string>
          result.address = [a.streetAddress, a.addressLocality, a.postalCode, a.addressCountry]
            .filter(Boolean).join(', ')
        }
      }
    } catch { /* skip malformed */ }
  }

  // Title fallback for place name
  if (!result.placeName) {
    const t = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (t) result.placeName = t[1].replace(/\s*[|–-].*$/, '').trim()
  }

  // tel: links — works for many accommodation sites
  if (!result.phone) {
    const tel = html.match(/href=["']tel:([^"']+)["']/i)
    if (tel) result.phone = decodeURIComponent(tel[1]).trim()
  }

  // OG address meta
  if (!result.address) {
    const og = html.match(/<meta[^>]+property=["']og:street-address["'][^>]+content=["']([^"']+)["']/i)
    if (og) result.address = og[1]
  }

  return result
}

async function cacheContact(stageId: number, contact: AccommodationContact): Promise<void> {
  try {
    const db = await getDB()
    await db.put('accommodationContacts', { stageId, contact })
    window.dispatchEvent(new CustomEvent('accommodationContactsUpdated'))
  } catch { /* ignore */ }
}

export async function fetchAccommodationContact(url: string, stageId: number): Promise<AccommodationContact> {
  const contact: AccommodationContact = { fetchedAt: Date.now() }

  if (!isUrl(url)) {
    contact.fetchError = 'not a URL'
    return contact
  }

  const html = await tryFetch(url)
  if (!html) {
    contact.fetchError = 'fetch failed'
    await cacheContact(stageId, contact)
    return contact
  }

  Object.assign(contact, parseContactFromHtml(html))
  await cacheContact(stageId, contact)
  return contact
}

export async function getAllAccommodationContacts(): Promise<Map<number, AccommodationContact>> {
  try {
    const db = await getDB()
    const all = await db.getAll('accommodationContacts')
    return new Map(all.map(c => [c.stageId, c.contact]))
  } catch {
    return new Map()
  }
}
