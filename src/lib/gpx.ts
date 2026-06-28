import type { GpxPoint, StageGpxData } from './types'
import { getDB } from './db'

function extractStageNumber(filename: string, doc: Document): number | null {
  const metaName = doc.querySelector('metadata > name')?.textContent ?? ''
  const metaMatch = metaName.match(/#(\d+)/)
  if (metaMatch) return parseInt(metaMatch[1], 10)

  const filenameMatch = filename.match(/#(\d+)/)
  if (filenameMatch) return parseInt(filenameMatch[1], 10)

  return null
}

function parseTrackPoints(doc: Document): GpxPoint[] {
  return Array.from(doc.querySelectorAll('trkpt')).map(el => ({
    lat: parseFloat(el.getAttribute('lat') ?? '0'),
    lon: parseFloat(el.getAttribute('lon') ?? '0'),
    ele: parseFloat(el.querySelector('ele')?.textContent ?? '') || undefined,
  }))
}

export async function parseAndStoreStageGPX(
  file: File,
  stageOverride?: number,
): Promise<{ stageNumber: number; trackPoints: number }> {
  const text = await file.text()
  const doc = new DOMParser().parseFromString(text, 'application/xml')

  if (doc.querySelector('parsererror')) throw new Error('Invalid GPX file')

  const stageNumber = stageOverride ?? extractStageNumber(file.name, doc)
  if (stageNumber === null) {
    throw new Error(
      `Cannot determine stage number from "${file.name}". Expected "#N" in filename or GPX metadata name.`,
    )
  }

  const trackPoints = parseTrackPoints(doc)
  if (trackPoints.length === 0) throw new Error('No track points found in GPX file')

  const data: StageGpxData = { trackPoints }
  const db = await getDB()
  await db.put('gpx', data, stageNumber)

  return { stageNumber, trackPoints: trackPoints.length }
}
