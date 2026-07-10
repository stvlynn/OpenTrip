# Conventions


| Item | Rule |
| --- | --- |
| Base path | `/api` |
| Auth mount | `/api/auth/*` (Better Auth handler; `GET` and `POST`) |
| Content type | JSON (`Content-Type: application/json`) unless noted (multipart, streams, file bytes) |
| Success envelope | `{ "data": <payload> }` |
| Error envelope | `{ "error": { "code": string, "message": string } }` |
| Validation | Zod at the HTTP edge before use cases; first issue message becomes `error.message` with code `validation_error` |

### Status codes

| Code | When |
| --- | --- |
| `200` | OK |
| `201` | Created (trip create, media/avatar upload, day append, invite create) |
| `400` | Validation / domain input errors |
| `401` | No session on a guarded route |
| `403` | Member lacks permission (e.g. viewer mutating) |
| `404` | Not found — **or** non-member on a trip route (existence not leaked); agent disabled |
| `409` | Conflict (e.g. agent suggestion already resolved / stale / expired) |
| `413` | Upload too large |
| `500` | Unexpected |
| `502` / `503` / `504` | Upstream weather/FX/geo failures (see specialized docs) |

### Trip access rules

- Business routes under the session guard require an authenticated session →
  otherwise `401` with `unauthenticated`.
- Trip routes require membership: **non-members get `404`** (`trip_not_found`),
  not `403`, so trip existence is not leaked.
- Read-only **viewers** attempting an edit get **`403`**
  (`insufficient_permissions`).
- Permissions on a full trip: `{ isMember, canEdit, canInvite }` (see
  [TripDto](./dtos.md#tripdto-full-trip)).
- **Public** business route: `GET /api/trip-invites/:token` (invite preview).
- **Public** file delivery: `GET /api/uploads/*`.
- **Public** health: `GET /api/health`.

### Non-JSON responses

| Path | Response |
| --- | --- |
| `POST /api/trips/:tripId/agent/chat` | AI SDK UI message **stream** (not `{ data }`) |
| `GET /api/uploads/*` | Raw file bytes with `Content-Type`, long-lived `Cache-Control` |
| Multipart upload errors still use the JSON error envelope |

### Amounts, dates, ids

- **Money amounts** are integers in the currency’s minor units (e.g. JPY yen as
  whole integers). Clients format for display; they do **not** recompute
  settlement from expenses when the API already returns `budget`.
- **Trip / day dates**: ISO `YYYY-MM-DD`, or `""` when unknown.
- **Timestamps**: ISO 8601 strings where documented (`createdAt`, `expiresAt`,
  preferences `updatedAt`, agent message times).
- **Trip-local member ids** (`members[].id`) are used for votes, expense
  `payer` / `participants`, balances, and settlements — not Better Auth user
  ids (those are `members[].userId`).

### Mutation responses and client caches

Create/update handlers return the **written** DTO (echo), not a post-write
`SELECT` through Hyperdrive. Clients must apply that body to local caches
instead of immediately refetching the list — see
[../../frontend/data-caching.md](../../frontend/data-caching.md) and
[../../operations/cloudflare.md#hyperdrive-read-after-write](../../operations/cloudflare.md#hyperdrive-read-after-write).
Examples: `POST /api/trips`, agent `POST …/messages`, preference PATCH.

---

[← API index](./README.md)
