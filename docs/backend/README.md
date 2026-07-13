# Backend (DDD + Hexagonal)

The backend (`apps/api`) is a Hono + TypeScript app following Domain-Driven
Design and Hexagonal architecture. Reference:
[../reference/backend-sources.md](../reference/backend-sources.md).

## Layers and dependency direction

```
interfaces  ->  application  ->  domain
                                   ^
infrastructure  --- implements ----|
```

- **domain** (`src/domain`) — aggregates, entities, value objects, domain
  services, and repository ports. No framework/DB/transport imports.
- **application** (`src/application`) — use cases orchestrating the domain
  through ports; returns DTOs.
- **infrastructure** (`src/infrastructure`) — PostgreSQL repository adapters,
  the database pool, Better Auth, filesystem/S3 storage adapters, and runtime
  composition (Node + Workers).
- **interfaces** (`src/interfaces/http`) — Hono routes: parse input, call a use
  case, format output. Thin.

## Composition

`infrastructure/composition` builds a `Container` (pool + repositories + use
cases). Two entry points share it:

- `src/node-server.ts` — `@hono/node-server` for Docker/local.
- `src/worker.ts` — Workers `fetch` entry for Cloudflare (connection string
  from the Hyperdrive binding).

Both entry points inject storage through an application port. Node supports
explicit `fs` or `s3` configuration; Workers require `s3` so their dependency
graph never imports the Node filesystem adapter. Avatars and trip note images
share that port (`AvatarService`, `TripMediaService`).

## Client developers (mobile and other apps)

Use **[api/README.md](api/README.md)** as the client-facing HTTP contract
(split into focused files under `api/`):

- [conventions](api/conventions.md) — envelopes, status codes, access rules
- [auth-session](api/auth-session.md) — cookies / session for non-browser clients
- [routes](api/routes.md) — full method/path/auth table
- Resource endpoints — [platform](api/platform.md), [trips](api/trips.md),
  [itinerary](api/itinerary.md), [expenses](api/expenses.md),
  [invites](api/invites.md), [user](api/user.md), [agent](api/agent-endpoints.md)
- [dtos](api/dtos.md) — response DTO field catalog
- [errors](api/errors.md) · [multi-client](api/multi-client.md)

Auth deep-dive: [auth.md](auth.md). Do not treat
`apps/web/src/shared/api/` as the contract source — it is a web convenience
wrapper only.

## Related

- [api/README.md](api/README.md) — **client HTTP contract and DTOs** (start here for apps).
- [domain.md](domain.md) — the model and business rules.
- [trip-ops.md](trip-ops.md) — trip-scoped mutation registry (shared HTTP + agent tools).
- [agent.md](agent.md) — trip agent session, tools, and approval.
- [weather.md](weather.md) — internal weather service, cache, and agent tool boundary.
- [cover.md](cover.md) — Unsplash trip cover search on create.
- [fx.md](fx.md) — internal FX rates service for settle-up display conversion.
- [geo.md](geo.md) — internal geo service (OSM/Google), cache, and agent read tools.
- [lodging.md](lodging.md) — Airbnb lodging search (openbnb-style), agent read tools.
- [street-view.md](street-view.md) — provider-neutral imagery search, previews, viewer, and agent tools.
- [database.md](database.md) — schema, migrations, seed.
- [auth.md](auth.md) — Better Auth integration.
