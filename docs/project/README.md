---
title: "Product overview"
---

# Product overview

OpenTrip is a collaborative travel planning SaaS. A small group plans a trip
together — arranging stops on a map and schedule, recording reservations,
discussing what to keep, and splitting shared expenses fairly.

## Core user flows

1. **Browse trips** — a home grid of trips with status (active, planning,
   settled), dates, member avatars, totals, and place-based map thumbnails.
2. **Plan the itinerary** — inside a trip, switch between:
   - **Map** — stops as numbered markers and per-day routes; place search;
     street-view previews where imagery exists.
   - **Schedule** — a per-day board of stop cards; inline insert, notes, media.
   - **Reservations** — lodging, transport, and activity bookings with revision
     tracking.
   - **Budget** — expenses, balances, settlement, and optional FX display
     conversion.
3. **Collaborate** — invites with roles, votes, comments with `@member` /
   `@agent` mentions, and realtime refresh for connected sessions.
4. **Use the AI companion** — shared per-trip timeline with research tools
   (geo, lodging, weather, street-view grounding) and approval-gated writes.
5. **Use Today between journeys** — set a current city or region, see local
   weather, prepare an upcoming trip, or reflect on one that ended recently.
6. **Write travelogues (preview)** — capture a moment on this device, optionally
   link it to a journey, and read it in an editorial article view. Local draft /
   published filters and a mobile-friendly Markdown editor ship today; account
   sync, sharing, and model-backed article Q&A remain follow-ups.

## MVP scope (shipped)

- Trips home and a fully interactive single-trip planner.
- Guided create-trip wizard (destination, days, dates, budget, party — each
  optional / TBD), Unsplash cover when a destination is set, then navigate to
  the planner with a one-shot suggested `@agent` draft on first open; the member
  reviews or edits it before explicitly sending.
- Stops: list/group by day, detail panel, vote toggle, comments, media, inline
  insert.
- Reservations CRUD with cancel and optimistic concurrency.
- Budget: expense list, add/update expense with payer + split, balances,
  settlement, FX display rates.
- Auth: Better Auth email + password (OTP verify), optional Google / WeChat,
  2FA, WeChat Mini Program shell hosting the PWA.
- Weather proxy, street-view search/viewer, agent geo/lodging tools.
- Realtime trip change fan-out and presence on Cloudflare (Durable Objects).
- Installable mobile PWA shell with responsive planner.

## Prototype fidelity

We recreate the `Travel Planner.dc.html` visual design with cossUI. The exact
seed data (members, days, 22 stops, 8 expenses) is preserved as demo content.
See [handoff-implementation.md](handoff-implementation.md).

## Non-goals / explicit limits

- **Travelogue backend** — no account sync, sharing permissions, or live article
  Q&A yet; entries are device-local preview storage.
- **Public geo / lodging HTTP APIs** — place and Airbnb search are agent tools
  (and the web map uses client-side Photon search); they are not general REST
  resources for third-party clients.
- **Delete stop / delete expense product APIs** — not exposed yet (see
  [../backend/api/multi-client.md](../backend/api/multi-client.md)).
- **Party size → members / planned budget → expenses** — wizard fields do not
  pre-create members or expense rows.
- **Unsplash covers downloaded into trip media** — covers use CDN URLs.
- **FX as source of truth for balances** — amounts remain stored as entered;
  FX converts settle-up *display* only ([../backend/fx.md](../backend/fx.md)).
- **Native iOS/Android apps in this monorepo** — clients are `web`, `api`,
  `miniapp`, and `docs`; mobile-auth bridges exist for external native apps.

Email delivery (verification, reset, invites) is **environment-configured**
through the API email adapters — do not assume a provider is wired in every
deployment.
