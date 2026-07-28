---
title: "Contributing to the documentation"
description: "Audience, ownership, Diátaxis structure, screenshots, docs demos, and review rules for OpenTrip documentation."
---

# Contributing to the documentation

OpenTrip documentation is maintained with the product in the same monorepo.
Documentation changes follow the same pull request, review, and deployment
workflow as code changes. Authoring follows
[Diátaxis](https://diataxis.fr/).

## Start with the audience

Every page belongs to one primary perspective:

| Perspective | Reader | Content |
| --- | --- | --- |
| User guide | A traveler trying to complete a task | Tutorials, how-to guides, and traveler reference |
| Developer docs | A contributor changing or operating OpenTrip | Explanation, API/domain reference, ADRs, and runbooks |

Do not mix implementation details into a user workflow. Link to the developer
page when internal context is genuinely useful.

## Choose the Diátaxis type

| Type | User asks… | Write… |
| --- | --- | --- |
| **Tutorial** | “Teach me to succeed once” | A lesson with a fixed path and a clear ending |
| **How-to** | “How do I solve X?” | Goal-oriented steps the reader can jump into |
| **Reference** | “What are the exact rules/fields?” | Tables, contracts, inventories |
| **Explanation** | “Why does it work this way?” | Discussion of rationale and trade-offs |

Examples:

- Tutorial: [user/first-trip.mdx](user/first-trip.mdx),
  [project/contributor-tutorial.md](project/contributor-tutorial.md)
- How-to: most pages under [user/](user/)
- Reference: [backend/api/](backend/api/),
  [user/roles-and-permissions.mdx](user/roles-and-permissions.mdx)
- Explanation: [backend/realtime.md](backend/realtime.md), ADRs under
  [decisions/](decisions/)

## Put content in the right place

```text
docs/
  user/          traveler tutorials, how-tos, and reference
  project/       product scope, contributor tutorial, architecture
  frontend/      client architecture and UI conventions
  backend/       domain, application, infrastructure, and HTTP contracts
  operations/    local development, deployment, observability, incidents
  quality/       repository-wide quality gates
  decisions/     durable architecture decisions
  reference/     source material and handoff records
  assets/        shared images, videos, and diagrams
  superpowers/   design drafts (not on the published developer page tree)
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
7. Do not invent features. Label previews and limits explicitly (for example
   device-local travelogues).

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

## Prefer docs demos for mouse-driven flows

Interaction clips under `docs/assets/demos/` are freshly rendered Remotion
demos (scripted cursor over real UI). Embed them with the fumadocs
`DemoVideo` MDX component:

```mdx
<DemoVideo
  src="/assets/demos/map.mp4"
  caption="Filter days and follow numbered stops on the shared trip map"
  poster="/assets/screenshots/pc-map.jpg"
/>
```

Rules:

- Prefer **MP4 H.264** demos (Safari-friendly static export). Do not use GIF.
- Keep one focused still when the video does not show a specific control or
  mobile layout the page needs to call out.
- Capture English UI for English docs; avoid mixed-locale evidence.
- Regenerate demos from the sibling Remotion project
  [`OpenTrip-video`](https://github.com/stvlynn/OpenTrip-video) with
  `npm run export:docs-demos` — see
  [assets/demos/README.md](assets/demos/README.md).
- Do **not** reuse `docs/assets/promo/` marketing chapters as docs demos.

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
