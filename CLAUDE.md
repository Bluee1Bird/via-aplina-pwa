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
User uploads a CSV → `src/lib/csv.ts` (papaparse) validates + writes to IndexedDB → screens read from DB via hooks.

### IndexedDB stores (`src/lib/db.ts`, `idb` library)
- `stages` — CSV rows, keyed by `stage` (int)
- `progress` — singleton key `1`, `{ completedStages: number[] }`
- `weather` — keyed by `stageId`, 15-minute TTL cache for Open-Meteo responses

### Routing
`HashRouter` (no server needed). Three routes: `/`, `/stage/:stageId`, `/settings`.

### Key hooks (`src/hooks/`)
- `useStages` — reads all stages from DB, sorted by stage number
- `useProgress` — reads/writes completed stage IDs; computes `currentStage` (next uncompleted, sequential)
- `useCompanion` — scans consecutive stages with same companion → `{ name, dayIndex, totalDays }`
- `useWeather` — fetches Open-Meteo, caches in DB; shows stale data offline
- `useSwipe` — touchstart/touchend → calls `onSwipeLeft`/`onSwipeRight` if horizontal delta > 50px

### Weather
`src/lib/weather.ts` — Open-Meteo `/v1/forecast` (no API key). Requires `lat`/`lon` on the `Stage` object; these are **optional CSV columns**. If absent, the weather block is hidden entirely.

### CSV schema
Required: `stage`, `date`, `length_km`, `elevation_gain_m`, `duration_h`, `start`, `finish`, `accommodation_name`, `accommodation_url`, `companion`, `waypoint_start`, `waypoint_finish`
Optional: `lat`, `lon` (float, enables weather)

### PWA
`vite-plugin-pwa` + Workbox. Service worker precaches all assets; Open-Meteo is runtime-cached with `NetworkFirst` (900s). Config is in `vite.config.ts`.

### Deferred (v2)
GPX parsing, map view, elevation profiles. Settings screen has a disabled "Upload GPX" button as a placeholder.
