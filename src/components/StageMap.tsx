import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { GpxPoint } from '../lib/types'

interface Props {
  trackPoints: GpxPoint[]
  labelStart: string
  labelFinish: string
  height?: number
}

interface POI {
  lat: number
  lon: number
  name?: string
}

type PoiType = 'atm' | 'shops' | 'transport'
const POI_TYPES: PoiType[] = ['atm', 'shops', 'transport']

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
// Swiss national topographic map (swisstopo "Landeskarte", pixelkarte-farbe) via
// the official geo.admin.ch WMTS in Web Mercator (3857) — terrain-accurate for
// the Alps. Only covers Switzerland; outside CH the tiles are blank (fine, the
// Via Alpina route is Swiss).
const TOPO_URL = 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg'
const TOPO_ATTR = '&copy; <a href="https://www.swisstopo.admin.ch/">swisstopo</a>'

// Multiple Overpass mirrors — the main endpoint rate-limits aggressively, so we
// fall through to backups before giving up.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

// Keeps Leaflet's internal size in sync with the resizable container.
function MapResizer({ height }: { height: number }) {
  const map = useMap()
  useEffect(() => { map.invalidateSize(false) }, [height, map])
  return null
}

// Fit the view to the track once it's known — more accurate than guessing a zoom.
function FitBounds({ points }: { points: GpxPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length < 2) return
    const bounds = L.latLngBounds(points.map(p => [p.lat, p.lon] as [number, number]))
    map.fitBounds(bounds, { padding: [28, 28] })
  }, [points, map])
  return null
}

function computeBbox(points: GpxPoint[]): [number, number, number, number] | null {
  if (!points.length) return null
  let minLat = points[0].lat, maxLat = points[0].lat
  let minLon = points[0].lon, maxLon = points[0].lon
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat
    if (p.lat > maxLat) maxLat = p.lat
    if (p.lon < minLon) minLon = p.lon
    if (p.lon > maxLon) maxLon = p.lon
  }
  // Expand bbox slightly so POIs just outside the track are included
  const padLat = (maxLat - minLat) * 0.1 + 0.005
  const padLon = (maxLon - minLon) * 0.1 + 0.005
  return [minLat - padLat, minLon - padLon, maxLat + padLat, maxLon + padLon]
}

// Returns POIs on success (possibly empty []), or null if every mirror failed —
// so the caller can distinguish "none here" from "couldn't load" and retry.
async function fetchOverpassPOIs(
  bbox: [number, number, number, number],
  type: PoiType,
): Promise<POI[] | null> {
  const [s, w, n, e] = bbox
  const b = `${s},${w},${n},${e}`
  const queries: Record<PoiType, string> = {
    atm: `[out:json][timeout:25];(node["amenity"="atm"](${b});node["amenity"="bank"]["atm"!="no"](${b}););out body;`,
    shops: `[out:json][timeout:25];(node["shop"="supermarket"](${b});node["shop"="grocery"](${b});node["shop"="convenience"](${b});node["shop"="bakery"](${b}););out body;`,
    transport: `[out:json][timeout:25];(node["highway"="bus_stop"](${b});node["railway"="station"](${b});node["railway"="halt"](${b});node["aerialway"="station"](${b}););out body;`,
  }

  for (const endpoint of OVERPASS_ENDPOINTS) {
    // AbortController + setTimeout instead of AbortSignal.timeout() — the latter
    // is iOS Safari 16+ only and would throw on older iPhones.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 25000)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(queries[type])}`,
        signal: controller.signal,
      })
      if (res.ok) {
        const data = await res.json() as { elements?: Array<{ lat?: number; lon?: number; tags?: Record<string, string> }> }
        return (data.elements ?? [])
          .filter(el => el.lat !== undefined && el.lon !== undefined)
          .map(el => ({ lat: el.lat!, lon: el.lon!, name: el.tags?.name }))
      }
    } catch {
      // try next mirror
    } finally {
      clearTimeout(timer)
    }
  }
  return null
}

const POI_META: Record<PoiType, { emoji: string; label: string; stroke: string; fill: string; fallback: string }> = {
  atm: { emoji: '💳', label: 'ATM', stroke: '#1d4ed8', fill: '#3b82f6', fallback: 'ATM' },
  shops: { emoji: '🛒', label: 'Shops', stroke: '#c2410c', fill: '#f97316', fallback: 'Shop' },
  transport: { emoji: '🚌', label: 'Transit', stroke: '#6d28d9', fill: '#8b5cf6', fallback: 'Stop' },
}

function OverlayChip({
  active, loading, count, dotColor, onClick, children,
}: {
  active: boolean
  loading?: boolean
  count?: number | null
  dotColor?: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded-full text-xs font-medium border transition-colors select-none flex items-center gap-1.5 ${
        active
          ? 'bg-green-700 text-white border-green-700'
          : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400'
      }`}
    >
      {/* Colour swatch matching this layer's map markers */}
      {dotColor && (
        <span
          className="inline-block w-2.5 h-2.5 rounded-full ring-1 ring-black/15 shrink-0"
          style={{ backgroundColor: dotColor }}
        />
      )}
      <span>{children}</span>
      {loading && (
        <span
          className={`inline-block w-3 h-3 rounded-full border-2 border-t-transparent animate-spin ${active ? 'border-white/70' : 'border-neutral-400'}`}
          aria-label="loading"
        />
      )}
      {!loading && active && count != null && (
        <span className="text-[10px] opacity-80 tabular-nums">{count}</span>
      )}
    </button>
  )
}

// Stride-sample a long track down to ~max points for cheap rendering, always
// keeping the first and last point so the line still reaches the markers.
function decimate<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points
  const step = points.length / max
  const out: T[] = []
  for (let i = 0; i < max; i++) out.push(points[Math.floor(i * step)])
  const last = points[points.length - 1]
  if (out[out.length - 1] !== last) out.push(last)
  return out
}

export default function StageMap({ trackPoints, labelStart, labelFinish, height = 240 }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [overlays, setOverlays] = useState({ atm: false, shops: false, transport: false, topo: false })
  // null = not yet loaded (or last attempt failed → retry on re-toggle); [] = loaded, none found.
  const [pois, setPois] = useState<Record<PoiType, POI[] | null>>({ atm: null, shops: null, transport: null })
  const [poiLoading, setPoiLoading] = useState<Record<PoiType, boolean>>({ atm: false, shops: false, transport: false })

  const bbox = useMemo(() => computeBbox(trackPoints), [trackPoints])

  const loadPois = async (type: PoiType) => {
    if (!bbox || poiLoading[type]) return
    setPoiLoading(l => ({ ...l, [type]: true }))
    try {
      const data = await fetchOverpassPOIs(bbox, type)
      if (data) setPois(p => ({ ...p, [type]: data })) // leave null on failure → re-toggle retries
    } finally {
      setPoiLoading(l => ({ ...l, [type]: false }))
    }
  }

  const toggle = (key: keyof typeof overlays) => {
    const turningOn = !overlays[key]
    setOverlays(prev => ({ ...prev, [key]: !prev[key] }))
    if (turningOn && (key === 'atm' || key === 'shops' || key === 'transport') && pois[key] === null) {
      void loadPois(key)
    }
  }

  // Geometry — memoized so a resize drag (which re-renders every frame) doesn't
  // rebuild a multi-thousand-point array and force Leaflet to redraw the line.
  // Long tracks are decimated for display.
  const geo = useMemo(() => {
    if (trackPoints.length === 0) return null
    return {
      positions: decimate(trackPoints, 1500).map(p => [p.lat, p.lon] as [number, number]),
      center: trackPoints[Math.floor(trackPoints.length / 2)],
      start: trackPoints[0],
      finish: trackPoints[trackPoints.length - 1],
    }
  }, [trackPoints])

  // POI markers — memoized on [overlays, pois] so they're untouched during resize.
  const poiMarkers = useMemo(() =>
    POI_TYPES.flatMap(type =>
      overlays[type]
        ? (pois[type] ?? []).map((poi, i) => (
            <CircleMarker
              key={`${type}-${i}`}
              center={[poi.lat, poi.lon]}
              radius={5}
              pathOptions={{ color: POI_META[type].stroke, fillColor: POI_META[type].fill, fillOpacity: 0.9, weight: 1.5 }}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                {POI_META[type].emoji} {poi.name ?? POI_META[type].fallback}
              </Tooltip>
            </CircleMarker>
          ))
        : [],
    ), [overlays, pois])

  if (!geo) return null
  const { positions, center, start, finish } = geo

  // Was a fetch attempted for this overlay and it came back empty / failed?
  const emptyOverlay = POI_TYPES.find(
    t => overlays[t] && !poiLoading[t] && (pois[t]?.length === 0 || pois[t] === null),
  )

  return (
    <div>
      {/* react-leaflet's MapContainer reads `style` only once at mount, so live
          resizing must happen on a wrapper we control; the map fills it at 100%
          and MapResizer keeps Leaflet's internal pixel size in sync.
          `relative` anchors the floating layers menu that overlays the map. */}
      <div style={{ height: `${height}px`, width: '100%' }} className="relative">
      {/* Floating layers menu — collapsed by default so options don't eat space.
          It's a DOM sibling on top of the map, so taps here never reach Leaflet
          (no map-drag), and top-right stays clear of Leaflet's top-left zoom. */}
      <div className="absolute top-2 right-2 z-[1000] flex flex-col items-end gap-1.5">
        <button
          onClick={() => setMenuOpen(o => !o)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium shadow-md border transition-colors ${
            menuOpen
              ? 'bg-green-700 text-white border-green-700'
              : 'bg-white/95 text-neutral-600 border-neutral-200'
          }`}
          aria-expanded={menuOpen}
        >
          <span>⚙️</span>
          <span>Layers</span>
        </button>

        {menuOpen && (
          <div className="bg-white/95 backdrop-blur rounded-xl shadow-lg border border-neutral-200 p-2 flex flex-col items-start gap-1.5 max-w-[62vw]">
            <OverlayChip active={overlays.topo} onClick={() => toggle('topo')}>⛰️ swisstopo</OverlayChip>
            {POI_TYPES.map(t => (
              <OverlayChip
                key={t}
                active={overlays[t]}
                loading={poiLoading[t]}
                count={pois[t]?.length ?? null}
                dotColor={POI_META[t].fill}
                onClick={() => toggle(t)}
              >
                {POI_META[t].emoji} {POI_META[t].label}
              </OverlayChip>
            ))}
            {emptyOverlay && (
              <p className="text-[11px] text-neutral-400 leading-snug pt-0.5">
                {pois[emptyOverlay] === null
                  ? `Couldn't load ${POI_META[emptyOverlay].label.toLowerCase()} — tap again to retry.`
                  : `No ${POI_META[emptyOverlay].label.toLowerCase()} found near this stage.`}
              </p>
            )}
          </div>
        )}
      </div>

      <MapContainer
        center={[center.lat, center.lon]}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <MapResizer height={height} />
        <FitBounds points={trackPoints} />
        <TileLayer
          attribution={overlays.topo ? TOPO_ATTR : OSM_ATTR}
          url={overlays.topo ? TOPO_URL : OSM_URL}
          maxZoom={overlays.topo ? 18 : 19}
        />

        <Polyline positions={positions} color="#15803d" weight={4} opacity={0.9} smoothFactor={2} />

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

        {/* POI markers (memoized) */}
        {poiMarkers}
      </MapContainer>
      </div>
    </div>
  )
}
