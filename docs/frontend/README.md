---
title: "Frontend (Feature-Sliced Design)"
---

# Frontend (Feature-Sliced Design)

The browser frontend (`apps/web`) is a React + TypeScript + Vite PWA organized
with Feature-Sliced Design v2.1. WeChat is served by a separate native Mini
Program client (`apps/miniapp`, Taro + React, also FSD) that reuses the API but
not this code. Reference:
[../reference/frontend-sources.md](../reference/frontend-sources.md).

## Layers

`app` -> `pages` -> `widgets` -> `features` -> `entities` -> `shared`.
Imports go only downward. Details in [layers.md](layers.md).

## Pages First

Prototype-specific logic stays in the page (`pages/travel-planner`,
`pages/trips`) with page-private widgets. Only genuinely reusable code
(UI primitives, API client, map wrapper, formatters, i18n) lives in `shared`.

## Unauthenticated routing

Signed-out web visitors land on the marketing page (`pages/landing`) at the
root; the auth form lives at `/signin`. Deep links (e.g. a shared trip) route
straight to sign-in so the target path survives login. The gate lives in
`app/App.tsx`. Landing
copy is centralized in the `landing` i18n namespace (EN + 中文) and its
screenshots reuse the README captures under `pages/landing/assets`.

Every landing section is centred in a `max-w-6xl` column except the closing
call to action, which is the page's one full-bleed surface: an edge-to-edge
band (navy in light, the raised card surface in dark) that butts straight into
the footer, so the page ends on a single weighted block. `LandingFooter`
therefore carries no top margin of its own. The ask sits left and the mobile
schedule capture rises out of the band's bottom edge, cropped by it. Behind
both, a travel photo is washed in at ~10% opacity (`CTA_PHOTO_ID` in
`pages/landing/lib/content`) purely as texture — it is decorative, so it is
`aria-hidden` with no alt text, and it removes itself if the CDN request fails
rather than leaving a broken-image glyph.

Unsplash CDN urls are built with `unsplashSrc` / `unsplashSrcSet`
(`shared/lib/unsplash`), shared by the landing CTA and the error surfaces. Photo
ids are stable and referenced literally at the call site.

## Error pages

`pages/error` is one variant-driven surface for every error state — `404`,
`500`, `403`, `503` and `offline` — so the whole family shares layout, motion
and actions. `ErrorPage` takes a `variant`; copy lives in the `error` i18n
namespace (EN + 中文) and imagery is pulled at random from a per-variant pool of
Unsplash CDN photos (alt text only — nothing overlaid on the image). Every
action maps to a real destination (`home`, `signIn`, `retry`) — no dead-end
buttons. The gate in `app/App.tsx` renders the `404` surface for unrecognized
paths (`isKnownPath` in `app/router.tsx`), and `app/AppErrorBoundary.tsx`
catches render-time crashes and shows the `500` surface with a working
"Try again".

## Known routes

`isKnownPath` (in `app/router.tsx`) is the single allow-list the gate consults
before rendering the `404` surface, so **every new client route must be
registered there** (with a regression test in `app/router.test.ts`). Current
routes:

- `/`, `/today`, `/journal` — the authenticated home hub surfaces owned by
  `pages/trips` (Trips grid, Today, Travelogues). Grouped as `HUB_PATHS`.
- `/journal/:entryId` — travelogue reader (`matchJournalEntryId`).
- `/trips/:id` — the single-trip planner (`matchTripId`).
- `/invite/:token` — invite accept surface (`matchInviteToken`).
- `/signin` — auth form.

The web app has no embedded/WebView host mode; WeChat runs the native client in
[miniapp.md](miniapp.md).

## Today and travelogues (hub)

Both surfaces live under `pages/trips` with the trips grid:

- **Today** — place selection persisted per user in `localStorage`, weather via
  the shared `/api/weather` client, and shortcuts into upcoming or recent trips.
- **Travelogues** — versioned **device-local** draft documents
  (`local-journal` preview). Do not document them as synced or shared until a
  backend adapter exists. Composer/reader details and mobile sheets are in
  [mobile-pwa.md](mobile-pwa.md).

Traveler-facing guidance: [../user/today-and-weather.mdx](../user/today-and-weather.mdx)
and [../user/travelogues.mdx](../user/travelogues.mdx).

## Path aliases

`@/*` maps to `apps/web/src/*` (see `apps/web/tsconfig.json` and
`apps/web/vite.config.ts`). Import primitives as `@/shared/ui/button`, the map
as `@/shared/ui/map`, etc.

## Public API

Each slice exposes an `index.ts`. Import the slice, never its internals:

```ts
// good
import { Button } from "@/shared/ui/button";
// bad
import { Button } from "@/shared/ui/button/button";
```

## Where does code go?

| Kind | Location |
| --- | --- |
| Providers, router, global styles | `app/` |
| A route/screen composition | `pages/<name>/` |
| Reused composite block | `widgets/<name>/` |
| Reusable user scenario | `features/<name>/` |
| Reusable domain data/rules | `entities/<name>/` |
| UI primitives, api client, map, i18n, utils | `shared/` |

## Related

- [ui-system.md](ui-system.md) — cossUI tokens, primitives, polish.
- [miniapp.md](miniapp.md) — native Taro Mini Program client, bearer auth, setup.
- [map.md](map.md) — MapLibre wrapper.
- [i18n.md](i18n.md) — internationalization.
- [data-caching.md](data-caching.md) — React Query write-echo vs Hyperdrive
  stale SELECTs (create-trip and other mutations).
- [mobile-pwa.md](mobile-pwa.md) — mobile breakpoint contract, planner mobile
  shell, responsive dialogs, PWA install metadata and headers.
