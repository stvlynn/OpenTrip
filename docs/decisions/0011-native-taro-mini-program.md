---
title: "0011 — Native Taro Mini Program client instead of a WebView shell"
---

# 0011 — Native Taro Mini Program client instead of a WebView shell

## Status

Accepted. Supersedes [0009](0009-mini-program-pwa-webview-shell.md) and
[0010](0010-miniapp-native-page-stack.md); revives the client separation of
[0007](0007-separate-taro-miniapp-client.md) under a new constraint.

## Context

WeChat does not open the embedded-web-page capability to personal accounts:
`<web-view>` requires a configured 业务域名, which is only available to verified
organization accounts. OpenTrip's Mini Program account is a personal account and
an organization upgrade is not available to the project.

That makes the 0009/0010 architecture unshippable, not merely suboptimal: every
product screen in it lived inside a `<web-view>` hosting `apps/web`. The
alternatives were to stop shipping on WeChat, or to render the product with Mini
Program components.

The reasons 0007 was originally reversed — a duplicated design system, and
MapLibre GL not running in the Mini Program renderer — still hold. They are now
costs to absorb rather than reasons to choose a WebView.

## Decision

- Rebuild `apps/miniapp` as a native Taro 4 + React + TypeScript client
  organized with FSD, replacing the dependency-free WebView shell. One Mini
  Program path only.
- Authenticate with `wx.login` against the existing
  `POST /api/auth/wechat-mini-program/sign-in` and send the Better Auth token as
  a bearer on every request. Persist the token in Mini Program storage so cold
  starts restore the session; renew once on `401`.
- Reuse the HTTP contracts, DTOs, and write-echo caching semantics of the PWA;
  rebuild the UI, navigation, and sheets with Mini Program components and a
  parallel token set (hex colors, system fonts).
- Replace MapLibre with WeChat's native `<map>` behind the planner's map panel:
  day-colored circles plus a polyline, `Taro.chooseLocation` for picking, and
  `Taro.openLocation` for navigation hand-off.
- Poll `GET …/agent/events` for agent chat and use `Taro.connectSocket` for trip
  realtime, since Mini Program networking cannot stream a response body.
- Delete the WebView bridge from the product: the `/miniapp` bootstrap route,
  the JSSDK bridge, embedded-mode branches in `apps/web`, and the
  `mobile-auth/webview/mint` + `mobile-auth/webview/exchange` endpoints.
- Do not release publicly on WeChat until the client reaches near parity with
  the PWA (hub, planner panels, agent, budget, invite, settings).

## Consequences

- The Mini Program ships without any WeChat account upgrade; only the API origin
  needs to be on the request-domain allowlist.
- The product UI exists twice. Contract and product-model changes must be
  applied to both clients, and the parallel design system will drift unless
  changes stay token-driven.
- Documented parity gaps: MapLibre vector styling, custom marker art, and the
  Mapillary street-view viewer. Journal entries stay device-local, as in the PWA.
- Browser-only auth flows (OAuth redirects, Turnstile) are out of scope for the
  Mini Program, which is WeChat-login-first.
- `apps/web` no longer has an embedded host mode, so its routing, headers, and
  session handling are simpler and browser-only.

## Addendum (2026-07)

- The realtime WebSocket upgrade accepts requests without an `Origin` header:
  browsers always send one (so the trusted-origin check only fires when an
  Origin is present), while WeChat `wx.connectSocket` sends none and is
  authenticated by the Bearer token at the session check instead. Without this,
  the Mini Program could never open a realtime connection.
- The Mini Program has no sign-out UI: on a `401` the client clears the token
  and silently re-runs `wx.login`, so a sign-out button would be undone by the
  next automatic login.
- The write-echo caching rule applies to the Mini Program too: invite-accept
  and reservation mutations merge their response DTOs into the React Query
  cache (`upsertTripSummary` into `queryKeys.trips`) instead of invalidating
  list queries, which would read stale through Hyperdrive.
