# 0006 — Mutation echo over immediate refetch

## Status

Accepted.

## Context

Cloudflare Hyperdrive caches eligible PostgreSQL `SELECT` responses (default
`max_age` ≈ 60s) and does **not** invalidate that cache when the Worker writes
to the origin. A matching list or detail `SELECT` immediately after
`INSERT`/`UPDATE` can therefore omit or reverse the write.

Local Docker Postgres has no Hyperdrive, so “create then invalidateQueries”
looks correct in development and fails intermittently (or for ~a minute) in
production.

We already hit this for:

- Agent panel preference UPSERT (re-`SELECT` returned a stale `collapsed`).
- Agent message history (list GET after insert).
- Trip create wizard (`invalidateQueries` on `GET /api/trips` hid the new trip).

TanStack Query’s recommended pattern for this shape is to update the cache from
the mutation response
([Updates from Mutation Responses](https://tanstack.com/query/latest/docs/framework/react/guides/updates-from-mutation-responses)).

## Decision

1. **API:** Mutation success bodies echo the written domain/DTO snapshot. Do not
   re-`SELECT` the same row through the cached Hyperdrive pool to build the
   response.
2. **SPA:** On mutation success, `setQueryData` for detail and list keys from
   that echo (derive list rows with pure mappers such as `toTripSummary`). Do
   not treat an immediate `invalidateQueries` + list GET as the source of truth
   for the just-written entity.
3. **Fresh reads:** Keep a second, cache-disabled Hyperdrive binding
   (`HYPERDRIVE_CACHE_DISABLED` / `poolFresh`) for auth and agent session polls
   only — not as a substitute for write-echo on ordinary trip CRUD.
4. **Trip create UX:** After `POST /api/trips`, update caches and navigate to
   the planner so the one-shot `@agent` seed can run without waiting on a fresh
   list card.

## Consequences

- New mutations must document the echo + client cache update (see
  [../frontend/data-caching.md](../frontend/data-caching.md) and
  [../operations/cloudflare.md#hyperdrive-read-after-write](../operations/cloudflare.md#hyperdrive-read-after-write)).
- Production QA is required for write-then-list flows; local green is not enough.
- Agents and humans must not “fix” missing list items by globally disabling
  Hyperdrive query caching.
