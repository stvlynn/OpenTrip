---
title: "0002 — Cloudflare and Docker deployment"
---

# 0002 — Cloudflare and Docker deployment

## Status

Accepted.

## Context

The app must deploy to Cloudflare (Pages + Workers) and, separately, via Docker
Compose. PostgreSQL is external to Cloudflare, and Workers cannot open arbitrary
TCP pools efficiently without help.

## Decision

- **Two entry points, one core**: `src/worker.ts` (Workers `fetch`) and
  `src/node-server.ts` (`@hono/node-server`) both compose the same
  application/domain/infrastructure code.
- **Cloudflare**: frontend on Pages, API on Workers with
  `nodejs_compat`, and **Hyperdrive** fronting the external PostgreSQL. The
  DB connection string comes from the Hyperdrive binding.
- **Docker**: `postgres` + `api` + `web` services; the API connects with a plain
  `DATABASE_URL`.
- Deployment assets live under `deploy/cloudflare` and `deploy/docker`; only
  secret key names are committed.

## Consequences

- The only runtime-specific code is the connection-string source and the server
  entry; everything else is shared.
- Hyperdrive adds pooling/caching for Postgres from Workers, at the cost of a
  one-time `wrangler hyperdrive create` step.
- Migrations/seed run from a machine (or CI) that can reach the database, not
  from the Worker.
