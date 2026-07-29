---
title: "0009 — Mini Program PWA WebView shell"
---

# 0009 — Mini Program PWA WebView shell

## Status

Superseded by [0011](0011-native-taro-mini-program.md). Superseded
[0007](0007-separate-taro-miniapp-client.md).

## Context

The separate Taro client duplicated product UI and exposed only a small subset
of the PWA. Maintaining two responsive trip experiences produced visible design
and capability drift. WeChat does not run a PWA directly, but a minimal native
Mini Program can securely host the existing PWA with `<web-view>`.

## Decision

- Keep a dependency-free native shell for `wx.login`, secure session handoff,
  WebView loading, and failure recovery.
- Render all product UI from `apps/web` in a dedicated embedded mode.
- Convert the shell bearer session to an HttpOnly browser cookie through
  Better Auth's hashed, single-use, short-lived one-time-token plugin.
- Put only the one-time code in the URL fragment; never expose or persist the
  bearer token.
- Keep critical state on the API rather than WebView lifecycle messaging.

## Consequences

- Taro and the duplicated mini-program trip UI are removed.
- The PWA, API contracts, and design system become the single product surface.
- WeChat business-domain configuration and WebView cookie behavior are
  production prerequisites.
- Native-only capabilities must remain in the thin shell or receive an explicit
  bridge; browser-heavy planner, map, and agent features need no second
  implementation.
