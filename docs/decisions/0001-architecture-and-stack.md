---
title: "0001 — Architecture and stack"
---

# 0001 — Architecture and stack

## Status

Accepted.

## Context

We are implementing a Travel Planner SaaS from a design handoff
([../reference/handoff.md](../reference/handoff.md)). Requirements fixed the
methodology (FSD frontend, DDD/Hexagonal backend), the stack (pnpm, React, TS,
PostgreSQL, Better Auth, mapcn), and the repo template
([../reference/template-agentic-coding.md](../reference/template-agentic-coding.md)).

## Decision

- **Monorepo** with pnpm workspaces: `apps/web` and `apps/api`.
- **Frontend**: React + TypeScript + Vite, Feature-Sliced Design v2.1, cossUI
  primitives, make-interfaces-feel-better polish, mapcn/MapLibre for maps.
- **Backend**: Hono + TypeScript, Domain-Driven Design with a Hexagonal
  (ports & adapters) layout; the `Trip` aggregate holds the business rules.
- **Persistence**: PostgreSQL via `pg`, plain SQL migrations.
- **Auth**: Better Auth (email + password) sharing the DB pool.
- **Docs & tooling**: template-style `AGENTS.md`, `docs/` tree, `Makefile`,
  `docs:check`, and `CLAUDE.md`/`.claude` symlinks.

## Consequences

- Clear separation lets domain logic be unit-tested without DB/HTTP.
- FSD's downward import rule and DDD's inward dependency rule are enforced by
  structure and review.
- Rebuilding the prototype's template-engine components as real cossUI React
  primitives is upfront work but removes the `dc-runtime` dependency.
