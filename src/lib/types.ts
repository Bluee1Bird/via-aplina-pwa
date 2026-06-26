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

export interface WeatherData {
  daily: WeatherDay[]
}

export interface WeatherCache {
  stageId: number
  data: WeatherData
  fetchedAt: number
}

export interface Progress {
  completedStages: number[]
}
