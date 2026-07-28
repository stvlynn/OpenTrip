---
title: "React Query cache and write-echo"
---

# React Query cache and write-echo

OpenTrip’s SPA uses TanStack Query (`@tanstack/react-query`) for server state.
Hyperdrive does not invalidate cached `SELECT`s after a write. OpenTrip routes
consistency-critical repositories through the cache-disabled binding, while the
SPA still uses mutation echo to avoid an unnecessary request and response race.

Canonical ops detail:
[../operations/cloudflare.md#hyperdrive-read-after-write](../operations/cloudflare.md#hyperdrive-read-after-write).
ADR: [../decisions/0006-mutation-echo-over-refetch.md](../decisions/0006-mutation-echo-over-refetch.md).

## Rule

After a successful **create/update** mutation whose response body is the new
truth:

1. **`setQueryData`** from the mutation response (and any derived list summary).
2. **Do not** immediately `invalidateQueries` / `refetch` a list or detail GET
   that hits the cached Hyperdrive pool for that same row/list.
3. Prefer navigating or rendering from the echoed data.

TanStack Query documents this as
[Updates from Mutation Responses](https://tanstack.com/query/latest/docs/framework/react/guides/updates-from-mutation-responses).

## Do / don’t

| Do | Don’t |
| --- | --- |
| `onSuccess: (data) => queryClient.setQueryData(key, data)` | `onSuccess: () => invalidateQueries(listKey)` as the only update |
| Map `Trip` → `TripSummary` with `toTripSummary` and prepend the list | Assume `GET /api/trips` is fresh right after `POST /api/trips` |
| Echo inserts from the API (agent messages, preferences, trip create) | Re-`SELECT` in the Worker after UPSERT and return that as the HTTP body |
| Use `poolFresh` for business state and authorization; reserve cached pools for explicit stale-tolerant projections | Route a consistency-critical repository through cached Hyperdrive |

## Established patterns in this repo

| Flow | Mutation | Client update |
| --- | --- | --- |
| Create trip wizard | `POST /api/trips` → full `Trip` | `setQueryData(tripId)` + prepend `toTripSummary(trip)` on `queryKeys.trips`, then `navigate(/trips/:id)` — see `CreateTripWizardDialog` |
| Trip mutations (stops, days, …) | Most return full `Trip` | `cancelQueries` + `setQueryData(queryKeys.trip(id), trip)` via `useTripActions` |
| Rename trip | `PATCH` → full `Trip` | `setQueryData` trip + merge `toTripSummary` into `queryKeys.trips` |
| Agent write tools | Tool `execute` returns `{ ok, summary, trip }` | Live stream: merge each echo by op (`mergeTripToolEcho`) into `queryKeys.trip` — **never** replace the whole trip with a later half-stale echo, and **never** `invalidateQueries(trip)` after stream settle |
| Agent message | `POST …/agent/messages` echoes `message` | `setQueryData` on agent history (no immediate list GET) |
| Agent `@agent` stream settle | Server persists in `onFinish` (may lag SSE close) | Write-echo live `UIMessage`s into `queryKeys.agentMessages` by id, then clear `useChat` — **never** `invalidateQueries(agentMessages)` on settle |
| Agent panel preference | PATCH preferences returns written row | `setQueryData(queryKeys.preferences, data)` — must not re-read cached SELECT |

Helpers:

- Query keys: `apps/web/src/shared/config` → `queryKeys`
- List summary from full trip: `toTripSummary` in `@/entities/trip`

## Symptoms of getting this wrong

Before attributing a stale GET to Hyperdrive, inspect the HTTP response. A
`cf-cache-status: HIT` on authenticated `/api/*` traffic means the request did
not execute the Worker at all; follow the
[Workers Caching incident runbook](../operations/incidents/2026-07-14-workers-caching.md).
Hyperdrive staleness occurs inside an executed Worker and therefore has a new
application `x-request-id` / completion log for the request.

| Symptom | Likely cause |
| --- | --- |
| New trip missing from home grid for ~30–60s after wizard success (prod only) | `invalidateQueries(trips)` → stale `GET /api/trips` |
| Stop appears then vanishes after add (prod only) | `invalidateQueries(trip)` after agent stream/events → stale `GET /api/trips/:id` overwrites write-echo |
| Approve suggestion applies but UI reverts (prod only) | API `applySuggestion` re-`SELECT`ed trip for response body |
| Joined trip missing from home after invite accept | Accept response omitted the Trip echo or the SPA did not merge it into detail/list caches |
| Agent panel snaps shut after open | Preference PATCH response re-`SELECT`ed a cached `collapsed: true` |
| New agent bubble missing until poll/refresh | History list GET after insert hit stale cache |
| Agent stream reply appears then vanishes on settle | `invalidateQueries(agentMessages)` + clear live before Workers `onFinish` — write-echo live ids instead |
| Parallel `updateDay` / `insertStop`: Day 1 city or earlier stops “roll back” (prod only) | Same-turn `findById` between patches (stale Hyperdrive SELECT) and/or SPA last-wins full trip echo — see agent write-tool echo below |

## When invalidate is still OK

- User-driven refresh / retry after an error.
- Background sync **after** the UI already shows echoed data, if you accept a
  possible brief regression within `max_age` (prefer avoiding for list creates).
- Reads that use `poolFresh` — still prefer echo when the
  mutation already returns the row.

## Checklist for new mutations

1. Does the HTTP handler return the written DTO (not a post-write `find*`)?
2. Does the SPA `setQueryData` every query key the UI reads for that entity?
3. If a list must update, is the new/updated item merged from the response
   (prepend/replace) rather than refetched?
4. Does the command and every authorization/precondition read use `poolFresh`?
5. Did you verify on **Cloudflare**, not only `make dev`?
