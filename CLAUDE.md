# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # dev server at localhost:5173
npm run build     # tsc + vite build → dist/
npm run preview   # serve dist/ locally
npm run lint      # oxlint
npx tsc --noEmit  # type-check only
```

## Architecture

**Via Alpina PWA** — offline-first personal hike tracker. No backend. React 19 + Vite 8 + TypeScript (strict) + Tailwind v4 + IndexedDB.

### Data flow
User uploads CSV → `src/lib/csv.ts` (papaparse) validates + writes to IndexedDB `stages` store → screens read via hooks. GPX upload → `src/lib/gpx.ts` (DOMParser, no lib) → `gpx` store. Progress is a singleton array of completed stage IDs in the `progress` store.

### IndexedDB schema (`src/lib/db.ts`, `idb` library) — DB version 2
| Store | Key | Value |
|---|---|---|
| `stages` | `stage` (int) | `Stage` CSV row |
| `progress` | `1` (singleton) | `{ completedStages: number[] }` |
| `weather` | `stageId` (int) | `WeatherCache` (15-min TTL) |
| `gpx` | `1` (singleton) | `GpxData` (waypoints + trackPoints) |

### Routing
`HashRouter`. Three routes: `/`, `/stage/:stageId`, `/settings`.

### Key hooks (`src/hooks/`)
- `useStages` — all stages from DB, sorted by stage number
- `useProgress(stages)` — `completedStages: Set<number>`, `currentStage` (next uncompleted, sequential), `toggleStage(id)` (done↔undone), `markNextDone()` (used by Home button)
- `useGPX` — reads `GpxData` from DB
- `useCompanion(stage, allStages)` — consecutive stages with same companion → `{ name, dayIndex, totalDays }`; accepts `Stage | undefined`
- `useWeather(stageId, lat?, lon?)` — Open-Meteo fetch + 15-min DB cache; skips if no coordinates
- `useSwipe(onLeft, onRight)` — touchstart/touchend, fires if horizontal delta > 50px

### Screens
- **Home** — progress bar, stats, stage list (circle tappable to toggle done), "Mark today as done" button
- **DayCard** — route stats, optional map (if GPX loaded), accommodation link, companion, weather; done toggle in header; swipe left/right navigates stages
- **Settings** — CSV upload + GPX upload (both live)

### GPX (`src/lib/gpx.ts`)
- Parsed with `DOMParser` — no external library
- `sliceTrackForStage(gpx, waypointStart, waypointFinish)` finds waypoints by name (exact then fuzzy), snaps to closest track point, slices the array
- Falls back to full track if waypoints don't match

### Map (`src/components/StageMap.tsx`)
- Leaflet + react-leaflet, **lazy-loaded** (`lazy()` + `Suspense`) so Leaflet CSS doesn't block initial render
- Uses `CircleMarker` (no default icon path issues with Vite)
- OSM tiles; zoom auto-calculated from track span
- Shown in DayCard only when GPX is loaded and waypoints are set

### Weather
Open-Meteo `/v1/forecast` (no API key). Requires `lat`/`lon` on the `Stage` object — **optional CSV columns**. Weather block hidden if absent.

### CSV schema (current real data)
```
stage, date, length_km, elevation_gain_m, duration_h,
start, finish, accommodation_name, accommodation_url,
companion, waypoint_start, waypoint_finish
```
Optional: `lat`, `lon` (float) — enables weather per stage.

**Known patterns in the actual CSV:**
- `waypoint_start`/`waypoint_finish` are identical to `start`/`finish` — breadcrumb only shown when they differ
- `companion` can be comma-separated (`"Gogos,M"`) — rendered as "Gogos & M" via `formatCompanions()`
- `accommodation_url` is often empty — rendered as plain text when absent
- No `lat`/`lon` columns yet — weather section not visible until user adds them

## What's next (planned)
- GPX file: user will provide it — need to test waypoint name matching against `start`/`finish` values (e.g. "Vaduz", "Weisstannen", "Elm", "Leglerhütte")
- Adding `lat`/`lon` to CSV for weather support
- Possibly drop redundant `waypoint_start`/`waypoint_finish` columns from CSV (they duplicate `start`/`finish`)
