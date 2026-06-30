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

### IndexedDB schema (`src/lib/db.ts`, `idb` library) — **DB version 5**
| Store | Key | Value |
|---|---|---|
| `stages` | `stage` (int) | `Stage` CSV row |
| `progress` | `1` (singleton) | `{ completedStages: number[] }` |
| `weather` | `key` (string `"N-start-<date>"` / `"N-finish-<date>"`) | `WeatherCache` (15-min TTL) |
| `gpx` | `stageNumber` (int) | `StageGpxData` (`trackPoints`) — **per-stage**, not a singleton |
| `accommodationContacts` | `stageId` (int) | `AccommodationContactCache` |

Upgrade history lives in `getDB()`'s `upgrade()`: v2 added `gpx`, v3 cleared it, v4 re-keyed `weather` from numeric `stageId` to string `key`, v5 added `accommodationContacts`. Bump the version + add an `if (oldVersion < N)` block for any new store/key change.

### Routing
`HashRouter`. Three routes: `/`, `/stage/:stageId`, `/settings`.

### Key hooks (`src/hooks/`)
- `useStages` — all stages from DB, sorted by stage number
- `useProgress(stages)` — `completedStages: Set<number>`, `currentStage` (next uncompleted, sequential), `toggleStage(id)` (done↔undone), `markNextDone()` (used by Home button)
- `useStageGPX(stageId)` — per-stage `trackPoints` from the `gpx` store (race-guarded, clears on stage change); `useGPXStatus` lists which stages have GPX
- `useCompanion(stage, allStages)` — consecutive stages with same companion → `{ name, dayIndex, totalDays }`; accepts `Stage | undefined`
- `useLocationWeather(cacheKey, lat?, lon?, isoDate?)` — Open-Meteo forecast **for `isoDate`** + 15-min DB cache; returns `tooFar` when the date is beyond the ~16-day horizon; skips if no coords/date
- `useAccommodationContacts()` — `Map<stageId, AccommodationContact>` from the cache, debounced refresh on update event
- `useSwipe(onLeft, onRight)` — touchstart/touchend, fires if horizontal delta > 50px; ignores touches starting inside `[data-no-swipe]`

### Screens
- **Home** — progress bar, stats, stage list (circle tappable to toggle done), "Mark today as done" button
- **DayCard** — route stats, optional map (if GPX loaded), accommodation link, companion, weather; done toggle in header; swipe left/right navigates stages
- **Settings** — CSV upload + GPX upload (both live)

### GPX (`src/lib/gpx.ts`)
- Parsed with `DOMParser` — no external library. **One GPX file per stage**, keyed by stage number.
- Stage number is read from `#N` in the GPX `metadata > name` or the filename (`parseAndStoreStageGPX(file, stageOverride?)`). Multi-file upload in Settings; single-file "Upload/Replace GPX" per stage in DayCard.
- Only `trackPoints` are stored (`StageGpxData`); weather uses the first/last point.

### Map (`src/components/StageMap.tsx`)
- Leaflet + react-leaflet, **lazy-loaded** (`lazy()` + `Suspense`) so Leaflet CSS doesn't block initial render
- Uses `CircleMarker` (no default icon path issues with Vite); `FitBounds` fits the view to the track (replaced manual zoom calc)
- OSM or OpenTopoMap tiles (Topo layer toggle); shown in DayCard whenever the stage has GPX `trackPoints`
- See the **Map resize**, **Map performance**, and **POI overlays** sections below for the important gotchas

### Weather
Open-Meteo `/v1/forecast` (no API key). Coordinates come from the stage's GPX start/finish points (falling back to CSV `lat`/`lon` for the finish). Weather block hidden if no coordinates.
- Forecast is for the **stage's planned date** (`start_date=end_date=stage.date`), **not** today.
- Open-Meteo's free forecast horizon is ~16 days. If the stage date is further out, `fetchLocationWeather` returns `{ tooFar: true }` without hitting the API and the widget shows a "check back within ~16 days" note.
- Cache key includes the date (`N-start-<date>`) so editing the CSV date invalidates the cached forecast.
- **Model selection (`modelParam`):** within ≤5 days of the hike it pins **`models=meteoswiss_icon_ch2`** (MeteoSwiss ~2 km, terrain-tuned for the Alps); beyond that it uses `best_match` (which already prefers MeteoSwiss ICON-CH near-term in CH but extends to 16 days with global models). Pinning the Swiss model further out returns `null` — it only forecasts ~5 days (`icon_ch1` ~1 km is even shorter, ~1.5 days). This serves MeteoSwiss's *raw model* data; their official post-processed forecasts/warnings/nowcasting are not available via Open-Meteo.

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

## Deployment — GitHub Pages (primary target: install as a PWA on iPhone/Android)

- `vite.config.ts` sets **`base: '/via-aplina-pwa/'`** (the repo name) because Pages serves project sites under that sub-path. Every asset/manifest/SW path must stay under it. If the repo is ever renamed, update `base`, `manifest.scope`, and `manifest.start_url` together.
- `index.html` uses `%BASE_URL%` for icon hrefs so they pick up the base.
- `.github/workflows/deploy.yml` builds and publishes on every push to `main` (needs repo Settings → Pages → Source = "GitHub Actions").
- **HashRouter is essential here** — routes live in the URL hash, so no SPA 404-fallback / server rewrites are needed on Pages.
- Icons: PNGs in `public/` (`apple-touch-icon.png` 180, `pwa-192.png`, `pwa-512.png` + maskable). iOS **ignores SVG** for the home-screen icon, hence the PNGs + `<link rel="apple-touch-icon">`. Regenerate by rendering an SVG to PNG with headless Chrome (no image lib needed).
- **Private repo caveat:** Pages from a *private* repo needs a paid plan. On free, the repo must be **public** to publish. No accidental bills: free accounts default to a **$0 spending limit**, and public-repo Actions are free/unlimited. The owner can distribute by temporarily making the repo public (install window), then private again — already-installed PWAs keep working offline from their service-worker cache; only *new* installs/updates need the site up.

## Cross-platform / PWA compatibility (iOS Safari + Android Chrome)

The two install targets use different engines (WebKit vs Blink). Verified gotchas / rules:
- **No `AbortSignal.timeout()`** — iOS Safari 16+ only. Use `AbortController` + `setTimeout` (see `fetchOverpassPOIs`).
- **CSS viewport units need fallbacks** — `min-height: 100svh` must be preceded by `100vh` for older WebKit.
- **Safe areas** — fixed bottom bars use the `.safe-area-bottom` utility (`env(safe-area-inset-bottom)`); headers use `pt-12` so content clears the iOS status bar with `apple-mobile-web-app-status-bar-style: black-translucent` + `viewport-fit=cover`.
- **Drag must use Pointer Events + `setPointerCapture`** (works on touch; see below). SMIL (`<animateMotion>`) and CSS transforms on SVG work in both engines.
- IndexedDB, service workers, `flatMap`, optional chaining all fine on both. iOS *can* evict IndexedDB/PWA cache under storage pressure or long disuse — data is per-device, no sync.
- Testing: a headless-Chrome harness (Playwright `playwright-core` + the system Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`) drives the real app (upload fixtures → exercise map/overlays/nav/celebration). WebKit testing needs `npx playwright install webkit` (was blocked by a CDN-DNS restriction in one environment — fall back to static audit there).

## Map resize — TWO bugs, both fixed (don't regress)

1. **`react-leaflet`'s `<MapContainer>` ignores its `style` prop after mount.** Changing the `height` prop does nothing. Fix: size a **wrapper `<div style={{height}}>`** and give `MapContainer` `style={{height:'100%'}}`, plus a child that calls `useMap().invalidateSize(false)` on height change.
2. **Touch.** The old full-screen-overlay drag approach only worked for mouse (touch events stay bound to their `touchstart` target). Fix: `onPointerDown` → `setPointerCapture(e.pointerId)`, then `onPointerMove`/`onPointerUp` on the handle, `touchAction:'none'`. The drag is rAF-coalesced in DayCard so a heavy map re-renders once per frame.

See `memory/feedback_map_resize.md` for the full write-up.

## Map performance (StageMap)

Real GPX tracks have thousands of points; naive rendering janks badly on resize. Rules:
- `positions`, center/start/finish, and POI markers are **`useMemo`-ized** (stable refs → Leaflet doesn't redraw the polyline / markers every render).
- Long tracks are **decimated** (`decimate(points, 1500)`, keeps endpoints) before becoming the polyline; `Polyline smoothFactor={2}`.
- `<StageMap key={stageNum} …>` — remounted per stage so overlay/POI state can't bleed between stages.
- `useStageGPX` clears `trackPoints` on stage change and has a request-id race guard (no stale-route flash).

## POI overlays (ATM / Shops / Transit)

- Overpass via 3 mirrors (`overpass-api.de`, `kumi.systems`, `maps.mail.ru`) with fallback; `AbortController` timeout.
- Per-chip **loading spinner + result count + colour swatch matching the marker colour**. `pois[type]` is `null` = not loaded (re-toggle retries on failure), `[]` = loaded/none-found (shows "none found").
- Swipe-to-navigate is disabled inside the map via a `[data-no-swipe]` region (so panning the map doesn't flip stages).

## Accommodation place info + Google Maps data-source findings

- Fetched **once at CSV-upload time** (`csv.ts` fires `fetchAccommodationContact` per stage with a URL) and cached in `accommodationContacts`. **Never re-fetched except on a new CSV upload** — this is a deliberate product rule; do NOT add retry-on-view.
- `useAccommodationContacts` reads the cache and refreshes (debounced) on the `accommodationContactsUpdated` event. Generic-site scraping (`parseContactFromHtml`) reads JSON-LD / `tel:` / OG tags via a 3-proxy CORS chain (allorigins → codetabs → corsproxy).
### Google Maps accommodation links (IMPLEMENTED — `fetchAccommodationPlace`)
`csv.ts` routes `accommodation_url`s: Google Maps links → `fetchAccommodationPlace`, other URLs → the generic `fetchAccommodationContact`. The Maps path:
1. `parseGoogleMapsUrl` extracts **name + pin coords** straight from the URL (`!3d<lat>!4d<lon>`, then `@lat,lng`, then `?q=`). Reliable, no network.
2. Short links (`maps.app.goo.gl` / `goo.gl/maps`) carry no coords, so `resolveShortLink` fetches the **fully-resolved place page through a CORS proxy** and runs `parseGoogleMapsUrl` over the HTML body (the page embeds `/maps/place/<Name>/…` + the pin's `!3d<lat>!4d<lon>`). The proxy chain (allorigins `/get` → allorigins `/raw` → codetabs → corsproxy) is **swept up to 4 times with backoff** because allorigins is the only mirror that currently works and it intermittently 522s on the first hit — see the reliability note below.
3. **Caches name+coords immediately**, then enriches **phone / website / star-class / address from OpenStreetMap** (`enrichFromOSM`, Overpass `tourism=hotel|guest_house|…` within 220 m, nearest match) and re-caches. Verified: a real place yields phone, website, 5-star class, address.
4. DayCard shows name, an OSM **star-class** badge (labelled "N-star", NOT a Google user rating), phone (`tel:`), website, address, and an **Open in Google Maps** button.

**Why not Google ratings/phone directly:** scraping a Maps *place* page client-side is NOT reliable — Google serves consent/interstitial pages to datacenter proxies and the data is JS-rendered/obfuscated. The Places API would work but needs an API key + billing (rejected per free/no-backend constraint). Confirmed empirically.

**⚠️ CSV gotcha — Google Maps URLs contain commas.** A *full* `/maps/place/...@lat,lng,zoom...` URL has commas, so in a CSV the `accommodation_url` field **must be quoted** (`"https://…"`) or papaparse splits it mid-value AND shifts every later column (companion/waypoints/lat/lon get corrupted). **Short links (`maps.app.goo.gl/...`) have no commas and are safe** — recommend those (the Google Maps app "Share → Copy link" produces them).

**⚠️ CSV gotcha — the link must go in `accommodation_url`, NOT `accommodation_name`.** Resolution + the clickable "Open in Google Maps" button both key off `accommodation_url`; `csv.ts` skips resolution for rows whose `accommodation_url` is empty (`if (!url) continue`), and DayCard's `accLink` is `undefined`, so a link mistakenly placed in `accommodation_name` renders as **plain, non-clickable text** and never gets resolved/enriched. (Hit in practice — the symptom is "the link just shows as text.")

## Hedgehog celebration (`CompletionCelebration.tsx`)

- Night mountain scene; hedgehog climbs the **left** slope up-and-to-the-right via SMIL `<animateMotion>` along `#climbPath`, ending on the summit. **No `rotate="auto"`** — that aligned the right-facing hedgehog to the near-vertical tangent and tipped it onto its head. Instead it stays upright the whole way (its drawn facing-right = direction of travel). Confetti fires *after* it arrives (~2.8s).
- Three nested `<g>` keep the motions from fighting over `transform`: outer = `animateMotion` (climb), middle = `summitCheer` (joyful hops on arrival), inner = `hedgehogWaddle` (gentle step-bob during the climb). Keyframes live in `src/index.css`.
- Hedgehog is drawn facing right (+X = forward); spines are data-driven triangle paths (`SPINES_BACK`/`SPINES_FRONT` + `spinePath`). Style brief: cute but **not too cartoonish** — no flag, no floating hearts, modest eye with one catchlight.

### Short-link resolution reliability (FIXED — `resolveShortLink`)
Short-link resolution parses coords+name out of the **resolved page body**, not redirect metadata. Verified empirically: allorigins reports the *short* URL in `status.url` (not the redirect target) and the Maps place page has **no `og:url`** — both dead ends. What works: allorigins still fetches the fully-resolved place page, whose HTML embeds `/maps/place/<Name>/…` and the pin's `!3d<lat>!4d<lon>`; `parseGoogleMapsUrl` run over the *HTML string* extracts both (confirmed: the real link `maps.app.goo.gl/4QcDyPqcJNe5wNEn8` → `{name:"Zeltplatz", lat:46.9881297, lon:9.3352719}`).

**The bug that made it look broken:** of the proxies, only **allorigins** currently works (codetabs 400s, corsproxy 403s — gates anonymous use) and allorigins **intermittently 522s on the first request, succeeding on a retry**. The old `resolveShortLink` tried each proxy exactly *once*, so a single transient 522 → permanent `'could not read link'`, cached until the next CSV upload. Fix: sweep the whole `SHORTLINK_PROXIES` chain **up to 4 rounds with backoff** (0.8s → 1.6s → 2.4s), plus added allorigins `/raw` as a second variant. Reproduced + verified against the real link via a node harness: round-0 522 → round-1 success.

> Caching is still **CSV-upload-only** (deliberate product rule, do NOT add retry-on-view), so a stale `'could not read link'` entry from before this fix clears only on re-upload.

## What's next / open
- Possibly drop redundant `waypoint_start`/`waypoint_finish` CSV columns (they duplicate `start`/`finish`).
- *Considered, not done:* fall back to `accommodation_name` when it's itself a URL (so a link in the wrong column still resolves + is clickable). Skipped — the CSV-column gotcha above is documented instead; revisit if it recurs.
