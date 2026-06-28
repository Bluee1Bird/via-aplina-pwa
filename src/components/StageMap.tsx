import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import type { GpxPoint } from '../lib/types'

interface Props {
  trackPoints: GpxPoint[]
  labelStart: string
  labelFinish: string
  height?: number
}

// Tells Leaflet to recalculate tile layout after container height changes
function MapResizer({ height }: { height: number }) {
  const map = useMap()
  useEffect(() => {
    map.invalidateSize()
  }, [height, map])
  return null
}

export default function StageMap({ trackPoints, labelStart, labelFinish, height = 240 }: Props) {
  if (trackPoints.length === 0) return null

  const positions = trackPoints.map(p => [p.lat, p.lon] as [number, number])
  const center = trackPoints[Math.floor(trackPoints.length / 2)]
  const start = trackPoints[0]
  const finish = trackPoints[trackPoints.length - 1]

  return (
    <MapContainer
      center={[center.lat, center.lon]}
      zoom={calculateZoom(trackPoints)}
      scrollWheelZoom={false}
      style={{ height: `${height}px`, width: '100%' }}
      zoomControl={true}
    >
      <MapResizer height={height} />
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
