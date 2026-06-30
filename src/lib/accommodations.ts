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

// ───────────────────────── Google Maps place links ─────────────────────────

const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

const GMAPS_RE = /^https?:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i

export function isGoogleMapsUrl(url: string): boolean {
  return GMAPS_RE.test(url.trim())
}

function isShortGoogleLink(url: string): boolean {
  return /(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(url)
}

// Pull place name + pin coordinates straight out of a full Maps URL (no network).
export function parseGoogleMapsUrl(url: string): { name?: string; lat?: number; lon?: number } {
  const out: { name?: string; lat?: number; lon?: number } = {}
  try {
    const pm = url.match(/\/maps\/place\/([^/@]+)/i)
    if (pm) {
      const raw = decodeURIComponent(pm[1].replace(/\+/g, ' ')).trim()
      if (raw && !/^[-\d.,\s]+$/.test(raw)) out.name = raw
    }
    const data = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) // the actual place pin
    if (data) { out.lat = parseFloat(data[1]); out.lon = parseFloat(data[2]) }
    if (out.lat === undefined) {
      const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
      if (at) { out.lat = parseFloat(at[1]); out.lon = parseFloat(at[2]) }
    }
    if (out.lat === undefined) {
      const u = new URL(url)
      const q = u.searchParams.get('q') || u.searchParams.get('query') || u.searchParams.get('ll') || ''
      const m = q.match(/(-?\d+\.\d+),\s*(-?\d+\.\d+)/)
      if (m) { out.lat = parseFloat(m[1]); out.lon = parseFloat(m[2]) }
      else if (q && !out.name && /[a-z]/i.test(q)) out.name = q
    }
  } catch { /* ignore */ }
  return out
}

// Short links (maps.app.goo.gl) carry no coordinates — they must be followed to
// the full place page. Each proxy is flaky on its own (allorigins throws 522/408s;
// codetabs/corsproxy have been 400/403-ing), so try several — AND retry.
//
// IMPORTANT: allorigins reports the *requested* (short) URL in `status.url`, NOT
// the redirect target, and the resolved Maps page has no og:url — so neither of
// those gives us the expanded link. What DOES work: allorigins still fetches the
// fully-resolved place page, whose HTML embeds the canonical `/maps/place/Name/…`
// path and the pin's `!3d<lat>!4d<lon>`. parseGoogleMapsUrl's regexes match those
// straight out of the page body, so we just run it over the HTML. (Verified
// empirically: allorigins/get often 522s on the FIRST hit then succeeds on a
// retry — so a single-pass chain spuriously fails. Hence the retry rounds below.)
const SHORTLINK_PROXIES: ((u: string) => Promise<{ html: string; finalUrl?: string }>)[] = [
  async u => {
    const res = await withTimeout(fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(u)}`), 15000)
    if (!res.ok) throw new Error('allorigins/get')
    const data = await res.json() as { contents?: string; status?: { url?: string } }
    return { html: data.contents ?? '', finalUrl: data.status?.url }
  },
  async u => {
    const res = await withTimeout(fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`), 15000)
    if (!res.ok) throw new Error('allorigins/raw')
    return { html: await res.text() }
  },
  async u => {
    const res = await withTimeout(fetch(`https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`), 15000)
    if (!res.ok) throw new Error('codetabs')
    return { html: await res.text() }
  },
  async u => {
    const res = await withTimeout(fetch(`https://corsproxy.io/?url=${encodeURIComponent(u)}`), 15000)
    if (!res.ok) throw new Error('corsproxy')
    return { html: await res.text() }
  },
]

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function resolveShortLink(url: string): Promise<{ name?: string; lat?: number; lon?: number }> {
  // The proxies (esp. allorigins) are transiently flaky — a 522/408/429 on one
  // attempt usually clears on the next. Sweep the whole chain several times with
  // a short backoff rather than giving up after one failed pass.
  const ROUNDS = 4
  for (let round = 0; round < ROUNDS; round++) {
    for (const proxy of SHORTLINK_PROXIES) {
      try {
        const { html, finalUrl } = await proxy(url)
        // If a proxy did expose the expanded URL, parse that (cleanest).
        if (finalUrl && !isShortGoogleLink(finalUrl)) {
          const fromUrl = parseGoogleMapsUrl(finalUrl)
          if (fromUrl.lat !== undefined) return fromUrl
        }
        // Otherwise mine name + pin coords from the resolved page body itself.
        const fromHtml = parseGoogleMapsUrl(html)
        if (fromHtml.lat !== undefined) return fromHtml
      } catch {
        // try next proxy
      }
    }
    if (round < ROUNDS - 1) await sleep(800 * (round + 1)) // 0.8s, 1.6s, 2.4s backoff
  }
  return {}
}

function dist2(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dx = aLat - bLat, dy = aLon - bLon
  return dx * dx + dy * dy
}

// Best-effort phone/website/stars/address from OpenStreetMap near the pin.
async function enrichFromOSM(lat: number, lon: number): Promise<Partial<AccommodationContact>> {
  const query =
    `[out:json][timeout:20];` +
    `nwr["tourism"~"^(hotel|guest_house|hostel|chalet|motel|apartment|alpine_hut|wilderness_hut)$"](around:220,${lat},${lon});` +
    `out tags center 20;`
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      })
      if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) continue
      const data = await res.json() as {
        elements?: Array<{ lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }>
      }
      const nodes = (data.elements ?? []).filter(e => e.tags)
      if (!nodes.length) return {}
      nodes.sort((a, b) => {
        const ac = a.center ?? { lat: a.lat!, lon: a.lon! }
        const bc = b.center ?? { lat: b.lat!, lon: b.lon! }
        return dist2(lat, lon, ac.lat, ac.lon) - dist2(lat, lon, bc.lat, bc.lon)
      })
      const t = nodes[0].tags!
      const result: Partial<AccommodationContact> = {}
      if (t.name) result.placeName = t.name
      const phone = t.phone || t['contact:phone'] || t['contact:mobile']
      if (phone) result.phone = phone
      const website = t.website || t['contact:website'] || t.url
      if (website) result.website = website
      if (t.stars) result.stars = t.stars
      const addr = [t['addr:street'], t['addr:housenumber'], t['addr:postcode'], t['addr:city']].filter(Boolean).join(' ')
      if (addr) result.address = addr
      return result
    } catch {
      // try next mirror
    } finally {
      clearTimeout(timer)
    }
  }
  return {}
}

// Resolve a Google Maps accommodation link → name + coords (+ OSM phone/website/
// stars). Called once per stage at CSV-upload time and cached forever.
export async function fetchAccommodationPlace(url: string, stageId: number): Promise<AccommodationContact> {
  const contact: AccommodationContact = { fetchedAt: Date.now(), source: 'google', mapsUrl: url }
  if (!isGoogleMapsUrl(url)) {
    contact.fetchError = 'not a Google Maps link'
    await cacheContact(stageId, contact)
    return contact
  }

  // Full URLs carry coords inline; short links must be followed (via proxy) to
  // the resolved page, where parseGoogleMapsUrl mines the same fields from the body.
  const parsed = isShortGoogleLink(url)
    ? await resolveShortLink(url)
    : parseGoogleMapsUrl(url)
  if (parsed.name && !contact.placeName) contact.placeName = parsed.name
  if (parsed.lat !== undefined) { contact.lat = parsed.lat; contact.lon = parsed.lon }
  if (!contact.placeName && contact.lat === undefined) contact.fetchError = 'could not read link'

  // Cache immediately so the name + "Open in Google Maps" appear without waiting
  // on Overpass (which can be slow); then enrich and re-cache.
  await cacheContact(stageId, contact)

  if (contact.lat !== undefined && contact.lon !== undefined) {
    const osm = await enrichFromOSM(contact.lat, contact.lon)
    if (osm.placeName && !contact.placeName) contact.placeName = osm.placeName
    if (osm.phone) contact.phone = osm.phone
    if (osm.website) contact.website = osm.website
    if (osm.stars) contact.stars = osm.stars
    if (osm.address) contact.address = osm.address
    if (osm.phone || osm.website || osm.stars || osm.address || osm.placeName) {
      await cacheContact(stageId, contact)
    }
  }
  return contact
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
