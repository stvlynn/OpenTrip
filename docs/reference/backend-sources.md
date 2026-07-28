---
title: "Reference: backend sources"
---

# Reference: backend sources

## DDD + Hexagonal (Clean Architecture)

### Source

- Skill: `.agents/skills/clean-ddd-hexagonal/SKILL.md` and `references/`

### Relevant rule

- Dependencies point inward: `interfaces` -> `application` -> `domain`;
  `infrastructure` implements `domain` ports.
- `domain/` has no framework/DB/transport dependencies. Behavior lives inside
  entities (no anemic models). One repository per aggregate. Keep controllers
  thin. One aggregate per transaction; cross-aggregate consistency via events.

### Project decision

- `apps/api/src/{domain,application,infrastructure,interfaces}`.
- `Trip` is the aggregate root; `Stop`, `TripMember`, `Expense` are contained.
  `Money` and `SettlementPlan` are value objects. Vote/comment/expense/split
  rules live in the domain.
- Repository ports live in `domain/*/ports`; PostgreSQL adapters implement them
  in `infrastructure/persistence`. See [../backend/domain.md](../backend/domain.md).

## Hono

### Source

- Skill retrieval + Better Auth docs (Context7 `/better-auth/better-auth`).
- Upstream: https://hono.dev

### Relevant rule

- Framework-agnostic web framework running on Node, Workers, etc. Better Auth
  mounts as `app.on(["POST","GET"], "/api/auth/*", (c) => auth.handler(c.req.raw))`.

### Project decision

- Hono is the `interfaces/http` adapter. The same app is served by a Node
  entry (`@hono/node-server`) for Docker and a Workers `fetch` entry for
  Cloudflare. Routes parse input, call use cases, and format responses.
  See [../backend/api/README.md](../backend/api/README.md).

## Better Auth

### Source

- Skill: `.agents/skills/better-auth-best-practices/SKILL.md`
- Context7 `/better-auth/better-auth`
- Upstream: https://better-auth.com/docs

### Relevant rule

- `betterAuth({ database, emailAndPassword, trustedOrigins, ... })`. Accepts a
  `pg.Pool` directly. `BETTER_AUTH_SECRET` (>= 32 chars) and `BASE_URL`
  via env. Node: `toNodeHandler(auth)`; Web/Workers: `auth.handler(request)`.
  Run the CLI migrate/generate after config or plugin changes.

### Project decision

- Config in `infrastructure/auth/auth.ts` using a `pg.Pool` from the shared
  database module, `emailAndPassword.enabled`, and `trustedOrigins` from env.
  Mounted on Hono at `/api/auth/*`. Auth tables are created by SQL migration so
  the same schema applies to Docker Postgres and Hyperdrive-fronted Postgres.
  See [../backend/auth.md](../backend/auth.md).

## PostgreSQL

### Source

- `node-postgres` (`pg`): https://node-postgres.com
- Prototype seed data (members, days, stops, expenses).

### Relevant rule

- Use a pooled client. On Cloudflare Workers, external Postgres must be reached
  through Hyperdrive with Node.js compatibility enabled.

### Project decision

- A single `pg.Pool` factory backs both Better Auth and repositories. Node
  reads `DATABASE_URL`; Workers read the Hyperdrive binding's
  `connectionString`. Plain SQL migrations in `apps/api/migrations`.
  See [../backend/database.md](../backend/database.md).
