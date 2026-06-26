import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip } from 'react-leaflet'
import type { GpxData, GpxPoint } from '../lib/types'
import { sliceTrackForStage } from '../lib/gpx'

interface Props {
  gpx: GpxData
  waypointStart: string
  waypointFinish: string
  labelStart: string
  labelFinish: string
}

export default function StageMap({ gpx, waypointStart, waypointFinish, labelStart, labelFinish }: Props) {
  const segment = sliceTrackForStage(gpx, waypointStart, waypointFinish)

  if (segment.length === 0) return null

  const positions = segment.map(p => [p.lat, p.lon] as [number, number])
  const center = midpoint(segment)
  const start = segment[0]
  const finish = segment[segment.length - 1]

  return (
    <MapContainer
      center={[center.lat, center.lon]}
      zoom={calculateZoom(segment)}
      scrollWheelZoom={false}
      style={{ height: '240px', width: '100%', borderRadius: '12px' }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      <Polyline positions={positions} color="#15803d" weight={3} opacity={0.85} />

      <CircleMarker
        center={[start.lat, start.lon]}
        radius={7}
        pathOptions={{ color: '#15803d', fillColor: '#22c55e', fillOpacity: 1, weight: 2 }}
      >
        <Tooltip permanent direction="top" offset={[0, -8]} className="leaflet-stage-label">
          {labelStart}
        </Tooltip>
      </CircleMarker>

      <CircleMarker
        center={[finish.lat, finish.lon]}
        radius={7}
        pathOptions={{ color: '#991b1b', fillColor: '#ef4444', fillOpacity: 1, weight: 2 }}
      >
        <Tooltip permanent direction="bottom" offset={[0, 8]} className="leaflet-stage-label">
          {labelFinish}
        </Tooltip>
      </CircleMarker>
    </MapContainer>
  )
}

function midpoint(points: GpxPoint[]): GpxPoint {
  return points[Math.floor(points.length / 2)]
}

function calculateZoom(points: GpxPoint[]): number {
  if (points.length < 2) return 13
  const lats = points.map(p => p.lat)
  const lons = points.map(p => p.lon)
  const latSpan = Math.max(...lats) - Math.min(...lats)
  const lonSpan = Math.max(...lons) - Math.min(...lons)
  const span = Math.max(latSpan, lonSpan)
  if (span > 0.5) return 10
  if (span > 0.2) return 11
  if (span > 0.1) return 12
  if (span > 0.05) return 13
  return 14
}
