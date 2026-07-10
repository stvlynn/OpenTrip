# React Query cache and write-echo

OpenTrip’s SPA uses TanStack Query (`@tanstack/react-query`) for server state.
On Cloudflare, many `SELECT`s go through **Hyperdrive query caching**. A refetch
right after a write can return a **stale** row for up to ~60s. Local Docker has
no Hyperdrive, so this class of bug often **only reproduces in production**.

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
| Use `HYPERDRIVE_CACHE_DISABLED` / `poolFresh` only for auth + agent history | Disable Hyperdrive caching globally to “fix” UI staleness |

## Established patterns in this repo

| Flow | Mutation | Client update |
| --- | --- | --- |
| Create trip wizard | `POST /api/trips` → full `Trip` | `setQueryData(tripId)` + prepend `toTripSummary(trip)` on `queryKeys.trips`, then `navigate(/trips/:id)` — see `CreateTripWizardDialog` |
| Trip mutations (stops, days, …) | Most return full `Trip` | `setQueryData(queryKeys.trip(id), trip)` via `useTripActions` |
| Agent message | `POST …/agent/messages` echoes `message` | `setQueryData` on agent history (no immediate list GET) |
| Agent panel preference | PATCH preferences returns written row | `setQueryData(queryKeys.preferences, data)` — must not re-read cached SELECT |

Helpers:

- Query keys: `apps/web/src/shared/config` → `queryKeys`
- List summary from full trip: `toTripSummary` in `@/entities/trip`

## Symptoms of getting this wrong

| Symptom | Likely cause |
| --- | --- |
| New trip missing from home grid for ~30–60s after wizard success (prod only) | `invalidateQueries(trips)` → stale `GET /api/trips` |
| Agent panel snaps shut after open | Preference PATCH response re-`SELECT`ed a cached `collapsed: true` |
| New agent bubble missing until poll/refresh | History list GET after insert hit stale cache |

## When invalidate is still OK

- User-driven refresh / retry after an error.
- Background sync **after** the UI already shows echoed data, if you accept a
  possible brief regression within `max_age` (prefer avoiding for list creates).
- Reads that use `poolFresh` (auth, agent session) — still prefer echo when the
  mutation already returns the row.

## Checklist for new mutations

1. Does the HTTP handler return the written DTO (not a post-write `find*`)?
2. Does the SPA `setQueryData` every query key the UI reads for that entity?
3. If a list must update, is the new/updated item merged from the response
   (prepend/replace) rather than refetched?
4. Did you verify on **Cloudflare**, not only `make dev`?
