---
title: "OpenTrip documentation"
---

# OpenTrip documentation

Travel Planner SaaS — plan trips together, split everything.

## Published documentation

The Fumadocs site in `apps/docs` publishes this directory from two
perspectives, structured with [Diátaxis](https://diataxis.fr/):

| Perspective | Path | Diátaxis focus |
| --- | --- | --- |
| [User guide](user/index.mdx) | `/user` | Tutorials, how-to guides, and traveler reference |
| Developer docs | `/developer` | Explanation, reference, contributor tutorial, runbooks |

Run `make dev-docs` to preview both perspectives at
`http://localhost:5171`. The perspective switcher keeps user workflows separate
from internal architecture without duplicating the underlying documentation.
See [CONTRIBUTING.md](CONTRIBUTING.md) for audience, structure, screenshot,
docs demo, and review rules. Interaction clips live under
[assets/demos/](assets/demos/) and embed via the fumadocs `DemoVideo`
component. Marketing README chapters under [assets/promo/](assets/promo/)
are separate and must not be reused as docs demos.

## Map

### Project

- [project/README.md](project/README.md) — product overview and scope.
- [project/contributor-tutorial.md](project/contributor-tutorial.md) —
  first-time contributor lesson.
- [project/architecture.md](project/architecture.md) — system architecture.
- [project/handoff-implementation.md](project/handoff-implementation.md) —
  prototype-to-product mapping.

### Frontend (FSD)

- [frontend/README.md](frontend/README.md)
- [frontend/layers.md](frontend/layers.md)
- [frontend/ui-system.md](frontend/ui-system.md)
- [frontend/map.md](frontend/map.md)
- [frontend/i18n.md](frontend/i18n.md)
- [frontend/data-caching.md](frontend/data-caching.md) — React Query write-echo
  (Hyperdrive read-after-write)
- [frontend/mobile-pwa.md](frontend/mobile-pwa.md) — responsive shells and PWA
- [frontend/miniapp.md](frontend/miniapp.md) — native WeChat Mini Program client
  (Taro + React), bearer auth, and its parity substitutions.

### Client API (web, mobile, other apps)

Start here for multi-client development:

- **[backend/api/README.md](backend/api/README.md)** — client HTTP contract index
  (routes, envelopes, DTOs, multi-client notes; split by resource)
- [backend/auth.md](backend/auth.md) — Better Auth mount, cookies/session, OAuth

### Backend (DDD + Hexagonal)

- [backend/README.md](backend/README.md)
- [backend/domain.md](backend/domain.md)
- [backend/api/README.md](backend/api/README.md) — client-facing HTTP contract and DTOs
- [backend/database.md](backend/database.md)
- [backend/auth.md](backend/auth.md)
- [backend/realtime.md](backend/realtime.md) — trip WebSocket changes and presence
- [backend/agent.md](backend/agent.md)
- [backend/trip-ops.md](backend/trip-ops.md) — trip mutation registry (HTTP + agent)
- [backend/weather.md](backend/weather.md) — weather proxy, cache, agent tool
- [backend/cover.md](backend/cover.md) — Unsplash trip cover on create
- [backend/fx.md](backend/fx.md) — FX rates proxy for settle-up conversion
- [backend/geo.md](backend/geo.md) — geo places/routes (OSM/Google), agent tools
- [backend/lodging.md](backend/lodging.md) — Airbnb lodging search, agent tools
- [backend/street-view.md](backend/street-view.md) — provider-neutral street-view search, cards, viewer, and agent tools

### Operations and quality

- [operations/README.md](operations/README.md)
- [operations/cloudflare.md](operations/cloudflare.md)
- [operations/docker.md](operations/docker.md)
- [operations/observability.md](operations/observability.md)
- [quality/README.md](quality/README.md)
- [decisions/README.md](decisions/README.md)

### Reference sources

- [reference/README.md](reference/README.md)

### Implementation specifications

- [superpowers/README.md](superpowers/README.md) — design drafts (not published
  on the Fumadocs developer tree; keep for agents and historical design work)

## Repository layout

```
apps/
  web/   React + Vite frontend (FSD)
  docs/  Fumadocs static documentation site
  miniapp/ native WeChat Mini Program client (Taro + React, FSD)
  api/   Hono backend (DDD + Hexagonal)
packages/
  agent-ui-catalog/  shared json-render catalog and spec safety boundary
deploy/
  cloudflare/  Pages + Workers + Hyperdrive
  docker/      Compose (postgres + api + web)
docs/          this documentation
scripts/       repo tooling (docs:check)
```
