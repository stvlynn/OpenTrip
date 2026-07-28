---
title: "Reference sources"
---

# Reference sources

Auditable record of the material this implementation is based on, so future
maintainers do not have to reverse-engineer decisions from chat logs or the
prototype bundle.

## Usage priority

1. This repository's `docs/` (project decisions and conventions).
2. The reference notes below (source of truth per external dependency).
3. The upstream links inside each note (only when the note is insufficient).

## Index

- [handoff.md](handoff.md) — the Claude Design handoff bundle: prototype HTML,
  `trip-map.js`, and the cossUI design system.
- [template-agentic-coding.md](template-agentic-coding.md) — the
  `stvlynn/agentic-coding` template conventions adopted here.
- [frontend-sources.md](frontend-sources.md) — FSD, cossUI,
  make-interfaces-feel-better, mapcn/MapLibre.
- [backend-sources.md](backend-sources.md) — DDD/Hexagonal, Hono, Better Auth,
  PostgreSQL.
- [deployment-sources.md](deployment-sources.md) — Cloudflare
  Workers/Pages/Hyperdrive/Wrangler and Docker Compose.

## Note format

Each note uses three sections per topic:

- **Source** — the link or local path.
- **Relevant rule** — the upstream rule or constraint that matters here.
- **Project decision** — how this repository applies it.
