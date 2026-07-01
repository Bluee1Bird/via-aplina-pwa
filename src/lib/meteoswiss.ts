import { getDB } from './db'

// Resolves a CSV place name (a stage's start/finish town) to its exact
// MeteoSwiss local-forecast page — the "normal MeteoSwiss site", located by the
// town rather than by GPX coordinates. Done once at CSV-upload time and cached.
//
// MeteoSwiss offers no name- or coordinate-based deep link: pages are keyed by
// /local-forecasts/<slug>/<postcode>.html and a wrong slug 404s. So we resolve
// via Switzerland's official geo API (api3.geo.admin.ch, CORS-enabled — no proxy
// needed): a *feature search* on the official postcode layer, by name, returns
// the exact locality's postcode + name in one call (its `detail` is e.g.
// "3822 lauterbrunnen", already ASCII-transliterated to match MeteoSwiss's own
// slugs — "3925 graechen", "1660 chateau-d'oex"). This beats geocode-to-coords +
// reverse-lookup, which drifted to a municipality's centroid (Lauterbrunnen →
// the up-valley Stechelberg postcode).

const GEOADMIN_SEARCH = 'https://api3.geo.admin.ch/rest/services/api/SearchServer'
const PLZ_LAYER = 'ch.swisstopo-vd.ortschaftenverzeichnis_plz'

export const METEOSWISS_HOME = 'https://www.meteoswiss.admin.ch/'

// German umlauts expand (ä→ae, ö→oe, ü→ue — matches MeteoSwiss's own slugs, e.g.
// Grächen→graechen); other diacritics are stripped (é→e); apostrophes/dots/
// spaces collapse to single hyphens. NOTE: a few anglicised big-city slugs don't
// follow this (Zürich→"zurich", not "zuerich") — not on the Via Alpina route, so
// those would 404 and simply fall back to the MeteoSwiss home page.
export function slugifyLocality(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip remaining accents (é→e)
    .replace(/[^a-z0-9]+/g, '-')                      // spaces/apostrophes/dots → hyphen
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// Look up a place by name on the official postcode layer → { plz, name }.
// `detail` looks like "3822 lauterbrunnen": leading 4+-digit postcode then the
// (already transliterated) locality name.
async function lookupLocality(place: string): Promise<{ plz: number; name: string } | null> {
  const url =
    `${GEOADMIN_SEARCH}?type=featuresearch&features=${PLZ_LAYER}` +
    `&searchText=${encodeURIComponent(place)}&sr=4326&limit=1`
  const res = await fetch(url)
  if (!res.ok) return null
  const json = await res.json()
  const detail = json?.results?.[0]?.attrs?.detail
  const m = /^(\d{4,})\s+(.+)$/.exec(String(detail ?? '').trim())
  if (!m) return null
  return { plz: Number(m[1]), name: m[2] }
}

// Returns the MeteoSwiss forecast URL for the place, or null if unresolvable.
export async function resolveMeteoSwissForecastUrl(place: string): Promise<string | null> {
  const trimmed = place.trim()
  if (!trimmed) return null
  try {
    const loc = await lookupLocality(trimmed)
    if (!loc) return null
    const slug = slugifyLocality(loc.name)
    if (!slug) return null
    return `https://www.meteoswiss.admin.ch/local-forecasts/${slug}/${loc.plz}.html`
  } catch {
    return null
  }
}

// Resolve every unique place once and cache. Fire-and-forget from CSV upload;
// dispatches an update event per place so the UI can refresh incrementally.
export async function resolveAndCacheWeatherLinks(places: string[]): Promise<void> {
  const unique = [...new Set(places.map(p => p.trim()).filter(Boolean))]
  const db = await getDB()
  for (const place of unique) {
    try {
      const url = await resolveMeteoSwissForecastUrl(place)
      await db.put('weatherLinks', { place, url, fetchedAt: Date.now() })
      window.dispatchEvent(new CustomEvent('weatherLinksUpdated'))
    } catch {
      // Skip this place; others still resolve.
    }
  }
}

export async function getAllWeatherLinks(): Promise<Map<string, string | null>> {
  try {
    const db = await getDB()
    const all = await db.getAll('weatherLinks')
    return new Map(all.map(w => [w.place, w.url]))
  } catch {
    return new Map()
  }
}
