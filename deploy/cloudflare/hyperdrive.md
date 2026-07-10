# Hyperdrive

Hyperdrive pools and caches connections to an external PostgreSQL from Workers.
The API reads the connection string from the binding at runtime.

Until Hyperdrive is configured, the GitHub Actions workflow still deploys
**Pages**, but **skips** the API Worker deploy (placeholder id detection).

## Create (cached + cache-disabled)

Hyperdrive **does not invalidate** cached `SELECT` results when the Worker
writes. For auth/session and agent message/events reads that need
read-after-write consistency, use a **second** Hyperdrive configuration with
caching disabled (same origin database).

```bash
# Ordinary reads (trip board, weather-adjacent SQL, etc.) — query cache on
npx wrangler hyperdrive create opentrip-db \
  --connection-string "postgres://USER:PASSWORD@HOST:5432/DBNAME"

# Fresh reads (Better Auth + agent session) — query cache off
npx wrangler hyperdrive create opentrip-db-fresh \
  --connection-string "postgres://USER:PASSWORD@HOST:5432/DBNAME" \
  --caching-disabled
```

**Do not commit** the ids. Store them as GitHub secrets:

```bash
gh secret set HYPERDRIVE_ID -R stvlynn/OpenTrip
# paste the cached config id

gh secret set HYPERDRIVE_CACHE_DISABLED_ID -R stvlynn/OpenTrip
# paste the cache-disabled config id
```

CI (`deploy-api.mjs`) injects both bindings at deploy time:

```jsonc
"hyperdrive": [
  { "binding": "HYPERDRIVE", "id": "<cached>" },
  { "binding": "HYPERDRIVE_CACHE_DISABLED", "id": "<fresh>" }
]
```

Manual local wrangler edit (not for production ids):

```bash
node deploy/cloudflare/scripts/set-hyperdrive.mjs <cached-id>
```

## How the API consumes it

`apps/api/src/worker.ts` builds the container with:

| Binding | Client | Used by |
| --- | --- | --- |
| `HYPERDRIVE` | cached `pool` | Trip, invites, preferences, … |
| `HYPERDRIVE_CACHE_DISABLED` | `poolFresh` | Better Auth, `SqlAgentSessionRepository` |

If `HYPERDRIVE_CACHE_DISABLED` is missing, `poolFresh` falls back to the same
connection string as `HYPERDRIVE` (local / single-binding deploys still work).
`nodejs_compat_v2` is required for `pg`.

Account for total origin connections across both Hyperdrive configs when
tuning pool sizes (Worker uses short-lived per-request pools: cached max 3,
fresh max 2).

## Local dev

For `wrangler dev`, set local connection strings:

```bash
# Cached binding
WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=postgres://postgres:postgres@localhost:5430/opentrip

# Fresh binding (can be the same local URL)
WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE_CACHE_DISABLED=postgres://postgres:postgres@localhost:5430/opentrip
```

Or create local Hyperdrive configs and put the ids in a generated wrangler
config the same way CI does.

## Update / delete

```bash
wrangler hyperdrive list
wrangler hyperdrive update <id> --connection-string "postgres://…"
wrangler hyperdrive update <id> --caching-disabled true
wrangler hyperdrive delete <id>
```

See also [Query caching — read-after-write](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/#read-after-write-behavior)
and [docs/operations/cloudflare.md](../../docs/operations/cloudflare.md).
