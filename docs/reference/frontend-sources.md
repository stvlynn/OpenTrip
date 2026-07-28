---
title: "Reference: frontend sources"
---

# Reference: frontend sources

## Feature-Sliced Design (FSD v2.1)

### Source

- Skill: `.agents/skills/feature-sliced-design/SKILL.md`
- Upstream: https://feature-sliced.design

### Relevant rule

- Layers, top to bottom: `app`, `pages`, `widgets`, `features`, `entities`,
  `shared`. Imports go only downward.
- Pages First: keep code in pages/widgets until reuse actually emerges; do not
  extract entities/features prematurely.
- Every slice exposes a public API via `index.ts`; never import slice
  internals. No cross-imports between slices on the same layer.

### Project decision

- `apps/web/src/{app,pages,widgets,features,entities,shared}`.
- The prototype is one product surface, so most logic starts in
  `pages/trips` and `pages/travel-planner` with page-private widgets.
- Reused primitives, the API client, the map wrapper, and formatters live in
  `shared`. See [../frontend/layers.md](../frontend/layers.md).

## cossUI

### Source

- Skill: `.agents/skills/coss/SKILL.md` and `references/`
- Design system in the handoff bundle (tokens, fonts, component notes).
- Upstream: https://coss.com/ui

### Relevant rule

- Base UI + CVA primitives with a shadcn-like DX. Use semantic tokens
  (`text-muted-foreground`, `bg-destructive`) over raw palette classes.
- Prefer variants/size props over ad-hoc class overrides. Icon-only buttons
  need `aria-label`. Set explicit `type` on inputs and form buttons.
- Font variable contract: `--font-sans`, `--font-heading`, `--font-mono`.

### Project decision

- We port the cossUI token CSS from the handoff verbatim into
  `apps/web/src/app/styles` and implement a focused primitive set
  (`Button`, `Badge`, `Input`, `Checkbox`, `Tabs`, `Card`, `Avatar`,
  `Spinner`, `Autocomplete`, `Select`) in `apps/web/src/shared/ui`, matching
  cossUI APIs.
- `Autocomplete` and `Select` are adapted from the coss components and install
  Base UI (`@base-ui/react`) as their only headless dependency; the sources were
  taken from the coss registry and re-tokenized to our theme. `Select` backs the
  schedule time/date option pickers.

## Geocoding (Photon)

### Source

- Photon (OpenStreetMap-based, keyless): https://photon.komoot.io

### Relevant rule

- Photon returns features ordered by importance, i.e. relevance-sorted, and is
  CORS-enabled, so it can be called directly from the browser without a key.
  Supports `lat`/`lon` bias and a `/reverse` endpoint.

### Project decision

- `apps/web/src/shared/api/geocode.ts` wraps Photon for the stop-name
  autocomplete (`searchPlaces`, biased toward the trip footprint) and for map
  picking (`reversePlace`). No API key or backend proxy is required.

## make-interfaces-feel-better

### Source

- Skill: `.agents/skills/make-interfaces-feel-better/SKILL.md`

### Relevant rule

- Concentric radius, optical alignment, shadows over borders, interruptible
  (specific-property) transitions, split/staggered enters, subtle exits,
  tabular numerics, balanced/pretty text wrapping, font smoothing, image
  outlines, `scale(0.96)` on press, 40x40 hit areas, never `transition: all`.

### Project decision

- Applied globally (root font smoothing, heading `balance`, body `pretty`) and
  per-component (tabular-nums on money/time, `active:scale-[0.96]`, explicit
  `transition-*` utilities, min hit areas on small icon buttons). Documented in
  [../frontend/ui-system.md](../frontend/ui-system.md).

## mapcn / MapLibre GL

### Source

- https://www.mapcn.dev/llms.txt
- Prototype `trip-map.js` (MapLibre wrapper, CARTO positron basemap).
- MapLibre GL JS: https://maplibre.org

### Relevant rule

- mapcn is a shadcn-style registry of MapLibre components; the base component
  installs to `@/components/ui/map` and exposes `Map`, `MapControls`,
  `MapMarkers`, `MapRoutes`, etc. CARTO basemap is the default free style.

### Project decision

- We ship a self-contained mapcn-style wrapper at
  `apps/web/src/shared/ui/map` built on `maplibre-gl`, using the CARTO positron
  style, per-day colored route lines, numbered markers (rounded-square for
  transit), an active-stop popup, and day filtering — matching `trip-map.js`
  behavior. See [../frontend/map.md](../frontend/map.md).
