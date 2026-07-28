---
title: "Trip realtime"
---

# Trip realtime

Connected planner sessions receive ordered trip-change notifications and
presence after committed writes. PostgreSQL remains the source of truth;
Durable Objects coordinate ephemeral WebSocket fans-out on Cloudflare.

## Goals

- Tell other members that specific trip scopes changed so clients can refresh.
- Show who is currently connected to the planner (presence).
- Avoid turning the Durable Object into a second business database.

## Non-goals

- Full operational transform / conflict-free collaborative editing of the same
  field.
- A separate WebSocket stack for Docker-only deploys (local HTTP still works;
  complete realtime behavior is exercised with the Workers runtime).

## Domain model

`domain/realtime` defines:

| Type | Role |
| --- | --- |
| `TripChange` | Durable invalidation after a committed write (`eventId`, `tripId`, `revision`, `actorId`, `occurredAt`, `scopes`) |
| `TripChangeScope` | `trip`, `days`, `stops`, `expenses`, `members`, `reservations`, `comments` |
| `RealtimeConnectionIdentity` | Hibernating socket identity (no credentials) |
| `RealtimePresenceMember` | Collapsed per-user presence (`connectionCount` merges tabs) |
| `TripChangePublisher` | Port implemented by infrastructure after successful mutations |

Application services publish through the port only **after** the SQL write
commits. Publication failures must not roll back the business write; clients
can still recover via HTTP refetch.

## Transport (Cloudflare)

1. The worker upgrades `GET /api/trips/:tripId/realtime` to a WebSocket after
   authenticating the session and verifying trip membership.
2. A short-lived realtime grant binds the socket to the trip and user.
3. The trip’s Durable Object accepts the socket, emits `hello` with presence,
   then fans out `change` / `presence` / `resync_required` messages.
4. Clients may send `{ type: "resume", afterSequence }` to replay after a gap.

### Server → client messages

| Type | Purpose |
| --- | --- |
| `hello` | `connectionId`, `sequence`, initial `presence` |
| `change` | Monotonic `sequence` + `TripChange` |
| `presence` | Updated member list |
| `resync_required` | Client should refetch authoritative HTTP state |

### Client → server messages

| Type | Purpose |
| --- | --- |
| `resume` | Request replay after `afterSequence` |

## Web client

`apps/web` connects while the planner is open (`useTripRealtime`), invalidates
or patches React Query caches from change scopes, and renders presence in the
floating members UI. Multiple tabs for the same user collapse to one presence
row with `connectionCount > 1`.

## Related

- [domain.md](domain.md) — trip aggregate and permissions
- [trip-ops.md](trip-ops.md) — mutations that bump `trips.version` / revision
- [../operations/cloudflare.md](../operations/cloudflare.md) — Workers bindings
- [../frontend/data-caching.md](../frontend/data-caching.md) — write-echo vs refetch
- Superpowers design notes under `docs/superpowers/specs/` (historical drafts;
  this page is the product documentation surface)
