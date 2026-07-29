---
title: "WeChat Mini Program native client"
---

# WeChat Mini Program native client

`apps/miniapp` is a native WeChat Mini Program built with Taro 4 + React +
TypeScript. It renders the whole product with Mini Program components and talks
to the same Hono API as the PWA over a Better Auth bearer token.

There is no `<web-view>` and no PWA embedding: WeChat does not grant the
embedded-web-page capability (业务域名) to personal accounts, so the shell
architecture was replaced by this client. See
[ADR 0011](../decisions/0011-native-taro-mini-program.md).

## Pages

| Page | Role |
| --- | --- |
| `pages/trips/index` | Trip list, status filters and create sheet (tab) |
| `pages/today/index` | Quick capture, highlighted trip, focus card, today's stops with weather, recent travelogues (tab) |
| `pages/journal/index` | Travelogue list, stored locally (tab) |
| `pages/journal-entry/index` | Travelogue reader and editor |
| `pages/trip/index` | Planner: custom nav bar (back / title / agent toggle), map / schedule / reservations / budget panels, floating members cluster, agent sheet |
| `pages/invite/index` | Invite preview and acceptance |
| `pages/settings/index` | Profile (WeChat avatar/nickname fill), currency, about |

The three hub pages are a native `tabBar`. The planner's four panels are
in-page segmented tabs because they belong to one trip, not to the app shell.
The planner page runs `navigationStyle: "custom"`: `ui/PlannerNavBar` mirrors
the PWA's mobile planner header (back + title left, agent toggle right of the
menu capsule, hidden when the agent is disabled), and the members/invite
cluster floats bottom-right over the content like the PWA's `FloatingMembers`.

## Source layout (FSD)

```text
src/app.config.ts        pages, window, tabBar, location permissions
src/app.tsx              React Query + SessionProvider roots
src/app.scss             design tokens (hex colors, system fonts)
src/pages/…              page-first product code (model/ + ui/ per page)
src/entities/…           trip, stop, expense, member, reservation, journal
src/shared/api/…         transport, client, per-feature contracts, realtime
src/shared/session/…     wx.login sign-in, token store, session context
src/shared/ui/…          Button, Sheet, Field, Screen, Tag, Avatar, tabs
src/shared/copy/…        single source of user-facing copy
src/shared/lib/…         navigation, feedback, formatting, markdown, polyfills
```

Imports flow downward only (`pages → entities → shared`), and each slice
exposes its public API through `index.ts`.

## Auth

1. `shared/session/session.ts` calls `Taro.login()` and posts the code to
   `POST /api/auth/wechat-mini-program/sign-in`.
2. The returned Better Auth token is persisted in Mini Program storage
   (`shared/session/token-store.ts`) so a cold start restores the session
   without a new sign-in round trip.
3. `shared/api/client.ts` sends `Authorization: Bearer …` on every request, and
   on `401` clears the stored token and re-runs `wx.login` — a silent WeChat
   re-auth — once before retrying.
4. There is no sign-out UI: a cleared token is silently renewed by the next
   automatic `wx.login`, so a sign-out button would be a no-op.

The bearer never travels in a URL. The AppSecret stays on the API as
`WECHAT_MINI_PROGRAM_APP_SECRET`. The legacy `mobile-auth/webview/*` bridge is
gone from both the client and the API.

## Data and realtime

- React Query owns caching; keys live in `shared/api/query-keys.ts`.
- Mutations follow the write-echo rule from
  [multi-client.md](../backend/api/multi-client.md): the response payload is
  written back into the cache instead of triggering a refetch, which keeps
  read-after-write correct behind Hyperdrive.
- Trip updates use `Taro.connectSocket` through `shared/api/realtime.ts`, which
  reconnects with backoff and reuses the PWA's message shapes. WeChat sends no
  `Origin` header on the upgrade, so the worker's trusted-origin check only
  fires when an Origin is present (browsers always send one); Origin-less
  upgrades are authenticated by the `Authorization: Bearer` header instead.
  Realtime is worker-only (`handleRealtimeUpgrade` intercepts before the Hono
  app), so the Node dev server has no realtime route — use the worker runtime.
- Agent chat sends a message and then polls `GET …/agent/events` with a cursor;
  Mini Program networking has no streaming response body. Replies are Markdown
  for the PWA, so `shared/lib/markdown.ts` flattens them for `Text` rendering.
- The Mini Program runtime has no `AbortController`, which React Query needs to
  cancel a query. `shared/lib/abort-controller.ts` installs a minimal shim from
  `app.tsx` before the client mounts; without it every query stays pending.

## Map

The planner map uses WeChat's native `<map>`:

- stops render as day-colored circles connected by a polyline;
- the viewport is computed from the stops' bounding box (`mapFrame`), because
  `include-points` only applies reliably through the imperative map context; the
  same span also sizes the circles so they stay legible at that zoom;
- the map never requests the device position, so opening a trip raises no
  location prompt — only stop creation asks, through `Taro.chooseLocation()`;
- `Taro.openLocation()` opens WeChat navigation for a stop.

Documented parity gaps against the PWA: MapLibre vector styling, custom marker
art (Mini Program markers need binary image assets), and the Mapillary street
view viewer. Street view is omitted rather than faked.

## Journal

Travelogues stay device-local (`entities/journal/store.ts` over
`Taro.getStorageSync` / `Taro.setStorageSync`), matching the PWA's local-only
journal. Entries do not sync across devices.

## Copy

All user-facing strings live in `src/shared/copy/index.ts` in Simplified
Chinese; the Mini Program ships a single locale, so it ports the PWA's copy
identifiers rather than its i18n runtime. Wording tracks the PWA's `zh`
resources, and the tab pages put the brand in the navigation bar because each
one already carries its own heading. One exception: `src/app.config.ts` is
bundled separately by Taro and cannot import copy, so its `tabBar` labels are
hardcoded next to a comment pointing back at `shared/copy` — keep the two in
sync by hand.

## Parity notes

The client aims at the PWA's phone layout, screen by screen. Where the platform
forces a different shape, the difference is deliberate:

- the trip create wizard is one sheet instead of stepped questions, but asks the
  same optional answers and derives the trip name from the destination;
- trip cards draw the PWA's seeded route dots without its dashed path, which
  would need a canvas per card;
- the journal has no publish state or filters because entries never leave the
  device;
- the Today weather comes from the current day's first located stop rather than
  a separately chosen place.

## Configuration

Copy `apps/miniapp/.env.example` to the gitignored `.env`:

```dotenv
MINIAPP_API_BASE_URL=https://api.example.com
MINIAPP_APP_ID=wx…
```

`MINIAPP_API_BASE_URL` is compiled into the bundle as a build-time constant
(`config/env.ts` → `OPENTRIP_API_BASE_URL`); unset builds target
`http://localhost:8780`. `scripts/sync-config.mjs` writes the AppID into the
gitignored `project.private.config.json`.

Production WeChat configuration requires the API origin in **request 合法域名**
with valid HTTPS, and a normal Mini Program AppID (not a Mini Game AppID). No
业务域名 is needed anymore. Two more allowlists matter once avatars are in use:
**uploadFile 合法域名** (avatar upload `POST /api/users/avatar`) and
**downloadFile 合法域名** (rendering uploaded avatar images) — both point at the
same API origin.

### WeChat avatar/nickname fill

Sign-in is silent (`wx.login` → openid/unionid only), so new users start as
"WeChat User". The settings profile sheet implements the official
[avatar/nickname fill capability](https://developers.weixin.qq.com/community/develop/doc/00022c683e8a80b29bed2142b56c01):
`open-type="chooseAvatar"` returns a temp file that `shared/api/users.ts`
uploads to `POST /api/users/avatar` (the service updates `user.image`
server-side), and the nickname field uses `type="nickname"` so the WeChat
keyboard offers the account nickname. `wx.getUserProfile` is intentionally not
used — it has returned a grey avatar + "微信用户" since 2022-11-08.

## Commands

```bash
make miniapp-build        # taro build --type weapp → apps/miniapp/dist
make miniapp-watch        # rebuild on change while DevTools stays open
make miniapp              # build, clear DevTools cache, open the project
make miniapp-sync-config  # AppID → project.private.config.json
make dev-miniapp-api      # Postgres + API for client development
```

WeChat DevTools loads `apps/miniapp/dist` (`miniprogramRoot` in
`project.config.json`), so a build must run before opening the project.

## Verification

Test in WeChat DevTools and real iOS/Android WeChat clients:

- first sign-in, cold-start session restore, and sign-out;
- expired token renewal on a protected request;
- trip create, day/stop CRUD, reorder, votes, comments;
- reservations create and cancel; budget expenses, balances, settle-up FX;
- agent chat including tool write-echo into the planner;
- realtime trip updates with two clients;
- map framing for a single day and for a multi-city trip, location picking, and
  WeChat navigation hand-off;
- stop overflow actions: reorder, move to another day, edit;
- share a trip and an invite, then open the card cold;
- invite acceptance for an already-joined and a new member;
- journal create/edit/delete after an app restart;
- offline and upstream failure states on every screen.
