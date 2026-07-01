export interface Stage {
  stage: number
  date: string
  length_km: number
  elevation_gain_m: number
  duration_h: number
  start: string
  finish: string
  accommodation_name: string
  accommodation_url: string
  companion: string
  waypoint_start: string
  waypoint_finish: string
  lat?: number
  lon?: number
}

export interface WeatherDay {
  date: string
  weathercode: number
  tmax: number
  tmin: number
  precip: number
}


export interface WeatherCache {
  key: string      // `${stageId}-start` | `${stageId}-finish`
  day: WeatherDay
  fetchedAt: number
}

export interface Progress {
  completedStages: number[]
}

// Per-stage user data that must survive CSV re-uploads. Keyed by stage NUMBER
// (the nth entry), deliberately independent of the CSV so a fresh CSV (new
// dates/routes/accommodation) keeps these values intact.
export interface StageOverride {
  stage: number
  actualDuration_h?: number
}

export interface GpxWaypoint {
  name: string
  lat: number
  lon: number
  ele?: number
}

export interface GpxPoint {
  lat: number
  lon: number
  ele?: number
}

export interface GpxData {
  waypoints: GpxWaypoint[]
  trackPoints: GpxPoint[]
}

export interface StageGpxData {
  trackPoints: GpxPoint[]
}

export interface AccommodationContact {
  placeName?: string
  phone?: string
  website?: string
  address?: string
  lat?: number
  lon?: number
  stars?: string        // OSM hotel star classification (e.g. "3"), not a user rating
  mapsUrl?: string      // canonical/resolved Google Maps URL to open
  source?: 'google' | 'web'
  fetchedAt: number
  fetchError?: string
}

export interface AccommodationContactCache {
  stageId: number
  contact: AccommodationContact
}

// Resolved MeteoSwiss local-forecast URL for a start/finish place name (keyed by
// the raw CSV place string so start/finish towns shared across stages resolve
// once). `url` is null when the place couldn't be resolved (→ fall back to the
// MeteoSwiss home page). Rebuilt on every CSV upload.
export interface WeatherLinkCache {
  place: string
  url: string | null
  fetchedAt: number
}
