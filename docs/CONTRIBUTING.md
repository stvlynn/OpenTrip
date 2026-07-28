---
title: "Contributing to the documentation"
description: "Audience, ownership, structure, screenshots, and review rules for OpenTrip documentation."
---

# Contributing to the documentation

OpenTrip documentation is maintained with the product in the same monorepo.
Documentation changes follow the same pull request, review, and deployment
workflow as code changes.

## Start with the audience

Every page belongs to one primary perspective:

| Perspective | Reader | Content |
| --- | --- | --- |
| User guide | A traveler trying to complete a task | Outcomes, ordered workflows, screenshots, and safety notes |
| Developer docs | A contributor changing or operating OpenTrip | Architecture, contracts, decisions, configuration, and runbooks |

Do not mix implementation details into a user workflow. Link to the developer
page when internal context is genuinely useful.

## Put content in the right place

```text
docs/
  user/          traveler workflows
  project/       product scope and system architecture
  frontend/      client architecture and UI conventions
  backend/       domain, application, infrastructure, and HTTP contracts
  operations/    local development, deployment, observability, incidents
  quality/       repository-wide quality gates
  decisions/     durable architecture decisions
  reference/     source material and handoff records
  assets/        shared images, videos, and diagrams
```

Keep one authoritative page for each topic. Prefer a link over copying a
paragraph into another section.

## Write task-first user guidance

1. Name the outcome in the page title.
2. Explain prerequisites before the procedure.
3. Use ordered steps for actions that must happen in sequence.
4. Use the exact labels visible in the product.
5. Put warnings immediately before the risky action.
6. End with the next likely task.

## Maintain developer documentation with code

When product behavior, architecture, configuration, API contracts, or
operations change, update the corresponding document in the same change set.
Architecture decisions that constrain future work belong in `docs/decisions/`.
Time-sensitive production failures belong in `docs/operations/incidents/`.

## Use screenshots as evidence

- Capture the real OpenTrip interface; do not use generic mockups.
- Remove or avoid personal data, credentials, private invite links, and secrets.
- Store committed captures under `docs/assets/screenshots/`.
- Use descriptive alt text that explains what the reader should notice.
- Update a screenshot when the documented control, label, or workflow changes.
- Prefer one focused screenshot per decision point over decorative image grids.

The docs app copies `docs/assets/` into its generated `public/assets/`
directory before development and builds. Generated copies are not committed.

## Preview and validate

```bash
make dev-docs
pnpm docs:check
pnpm --filter @opentrip/docs typecheck
pnpm --filter @opentrip/docs build
```

Before requesting review, verify relative links, both documentation
perspectives, the perspective dialog with keyboard navigation, image loading,
mobile layout, search, and the static export.
