import type { GpxData, GpxPoint, GpxWaypoint } from './types'
import { getDB } from './db'

export async function parseAndStoreGPX(file: File): Promise<{ waypoints: number; trackPoints: number }> {
  const text = await file.text()
  const doc = new DOMParser().parseFromString(text, 'application/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) throw new Error('Invalid GPX file')

  const waypoints: GpxWaypoint[] = Array.from(doc.querySelectorAll('wpt')).map(el => ({
    name: el.querySelector('name')?.textContent?.trim() ?? '',
    lat: parseFloat(el.getAttribute('lat') ?? '0'),
    lon: parseFloat(el.getAttribute('lon') ?? '0'),
    ele: parseFloat(el.querySelector('ele')?.textContent ?? '') || undefined,
  }))

  const trackPoints: GpxPoint[] = Array.from(doc.querySelectorAll('trkpt')).map(el => ({
    lat: parseFloat(el.getAttribute('lat') ?? '0'),
    lon: parseFloat(el.getAttribute('lon') ?? '0'),
    ele: parseFloat(el.querySelector('ele')?.textContent ?? '') || undefined,
  }))

  if (trackPoints.length === 0) throw new Error('No track points found in GPX file')

  const data: GpxData = { waypoints, trackPoints }
  const db = await getDB()
  await db.put('gpx', data, 1)

  return { waypoints: waypoints.length, trackPoints: trackPoints.length }
}

/** Return track points between the two named waypoints (inclusive). Falls back to full track. */
export function sliceTrackForStage(
  data: GpxData,
  waypointStart: string,
  waypointFinish: string,
): GpxPoint[] {
  const startWpt = findWaypoint(data.waypoints, waypointStart)
  const finishWpt = findWaypoint(data.waypoints, waypointFinish)

  if (!startWpt || !finishWpt) return data.trackPoints

  const startIdx = closestTrackIndex(data.trackPoints, startWpt)
  const finishIdx = closestTrackIndex(data.trackPoints, finishWpt)

  const lo = Math.min(startIdx, finishIdx)
  const hi = Math.max(startIdx, finishIdx)
  return data.trackPoints.slice(lo, hi + 1)
}

function findWaypoint(waypoints: GpxWaypoint[], name: string): GpxWaypoint | undefined {
  if (!name) return undefined
  const lower = name.toLowerCase().trim()
  return (
    waypoints.find(w => w.name.toLowerCase().trim() === lower) ??
    waypoints.find(w => w.name.toLowerCase().includes(lower) || lower.includes(w.name.toLowerCase()))
  )
}

function closestTrackIndex(points: GpxPoint[], target: { lat: number; lon: number }): number {
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < points.length; i++) {
    const d = (points[i].lat - target.lat) ** 2 + (points[i].lon - target.lon) ** 2
    if (d < bestDist) { bestDist = d; best = i }
  }
  return best
}
