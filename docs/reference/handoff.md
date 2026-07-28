---
title: "Reference: design handoff bundle"
---

# Reference: design handoff bundle

## Source

- Local bundle: `.workspace/旅行行程规划SaaS设计-handoff.zip`
- Primary design: `saas/project/Travel Planner.dc.html`
- Map component: `saas/project/trip-map.js`
- Design system: `saas/project/_ds/cossui-design-system-.../`
- Origin: Claude Design (claude.ai/design) HTML/CSS/JS prototype export.

## Relevant rule

The handoff README instructs implementers to recreate the design visually in
whatever technology fits the target codebase, not to copy the prototype's
internal structure. Prototypes are throwaway; match the visual output.

## Project decision

We rebuild the prototype as a real React product. The `dc-runtime` template
engine (`support.js`), `x-dc`/`sc-if`/`sc-for` directives, and the
`CossUIDesignSystem_2babcc` global namespace are prototype-only and are not
carried over. We reimplement the same components as real cossUI React
primitives.

## Prototype surfaces (what we rebuild)

- **Trips home** (`view: "trips"`): header, page title, grid of trip cards
  (Japan active, Iceland planning, Lisbon settled).
- **Planner** (`view: "planner"`): sidebar + main content with three tabs.
  - **Sidebar**: trip header, tabs (Map/Schedule/Budget), day pills
    (All days + Day 1..5), grouped itinerary list, per-stop vote + comment
    counters, collapsible; stop detail panel with voters, vote toggle,
    comments, and a comment composer.
  - **Map view**: MapLibre map with per-day colored routes, numbered markers,
    active-stop popup, and a day legend.
  - **Schedule view**: 5-column day board with category-iconed stop cards and
    insert-stop affordances between cards.
  - **Budget view**: expense summary stats, expense list, add-expense form
    (payer pills + split checkboxes), balances, and settle-up transfers.
  - **Floating members**: avatar cluster + invite button (copies link).

## Domain data captured from the prototype

- **Members**: `lynn` (me), `marco`, `aiko`, `sam` — each with display name,
  short name, initials, avatar background/foreground colors.
- **Days**: 5 days, each with date label, city label, and a route color.
- **Stops**: 22 seed stops with day, time, duration, name, area, category,
  lat/lng, per-person cost (yen), creator, votes, comments, and a `transit`
  flag (rendered as a rounded-square marker).
- **Expenses**: 8 seed expenses with description, payer, amount, split
  participants, and a "when" label.

## Key behaviors captured from the prototype logic

- **Votes**: toggle current user (`lynn`) in/out of a stop's voter list.
- **Comments**: append `{ by, time: "Just now", text }` to the selected stop.
- **Insert stop**: insert between two stops; interpolate lat/lng from
  neighbors (or day center fallback) and splice into ordering.
- **Balances/settlement**: `paid - fairShare` per member, then a greedy
  debtor/creditor match producing minimal transfers.
- **Money formatting**: `¥` + `Math.round(n).toLocaleString("en-US")`.

## Design system essentials

- Cool blue-grey ink ramp (`--ink-*`), one cornflower accent (`--corn-*`).
- Semantic tokens: `--background`, `--foreground`, `--card`, `--primary`,
  `--brand`, `--muted`, `--border`, status colors as tints.
- Fonts: Cal Sans (display), Cal Sans UI (interface), Paper Mono (numerics).
- Radius base 10px; card is `2xl` (16px). Restrained cool-tinted shadows plus a
  1px top highlight. Focus ring is a 3px cornflower ring.
- Interaction polish: scale-on-press `0.96`, specific-property transitions,
  staggered enters, tabular numerics, balanced/pretty text wrapping, image
  outlines, 40x40 hit areas.

Fonts binaries live in the bundle; we ship the token CSS and reference the
webfonts via `@font-face`. See [../frontend/ui-system.md](../frontend/ui-system.md).
