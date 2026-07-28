---
title: "Incident: authenticated API responses cached before Worker execution"
---

# Incident: authenticated API responses cached before Worker execution

## Summary

On 2026-07-14, the production API served cached session and trip responses
because the default Worker entrypoint had Workers Caching enabled. A trip could
appear after creation and disappear on reload when the reload received a list
captured before the write. Sign-out cleared the server session cookie, but the
next session check could return an older authenticated response.

This was a shared-cache isolation failure, not a Better Auth deletion failure,
a PostgreSQL data-loss event, or a Hyperdrive read-after-write issue. Because
the cache did not vary by Cookie, treat the incident as potential cross-session
disclosure of response bodies, even when no such disclosure has been reported.

## Evidence

The browser Performance trace recorded this sequence at `2026-07-14T08:00:47Z`:

1. `POST /api/auth/sign-out` returned `200` with request id
   `5b5fac34-c925-4435-9bd1-611a0ff6ed0e`.
2. About 100 ms later, `GET /api/auth/get-session` returned `200` with
   `cf-cache-status: HIT`, `age: 821`, and a 758-byte body. Its request id was
   `0aaaf9a4-7113-4bc2-a701-3e6548e4e287`.

A Wrangler live-tail probe with a unique query string then showed:

- first request: `MISS`, Worker request id
  `20db4526-4ff9-446a-a510-aa12789645a9`;
- second identical request: `HIT`, `age: 0`, and the same request id;
- `wrangler tail` observed only the first invocation.

The repeated request id proves the second response was returned before the
Worker ran. An ordinary production session check also remained a `HIT` with an
age over one hour.

## Root cause

Commit `94b79d8` added a `CloudflareStreetViewCache` adapter that correctly uses
the Cache API (`caches.default`) with internal synthetic keys. The same change
also added this unrelated Wrangler configuration:

```jsonc
"cache": { "enabled": true }
```

Current Cloudflare Workers Caching checks this cache before invoking the
Worker. A `200` response without `Cache-Control` is heuristically fresh for two
hours. The API emitted neither `private` nor `no-store` on most JSON responses,
so session and business data became cacheable. See Cloudflare's
[Workers Caching configuration](https://developers.cloudflare.com/workers/cache/configuration/).

## Resolution

The permanent controls are intentionally redundant:

1. Keep the default authenticated Worker entrypoint at
   `cache.enabled: false`.
2. Default dynamic Hono responses and emergency Worker errors to
   `Cache-Control: private, no-store`; preserve explicit route policies.
3. Clear TanStack Query's authenticated server-state cache after successful
   sign-out so a later identity cannot mount fresh query keys over the prior
   user's in-memory trip data.
4. Keep provider-only street-view caching inside its explicit Cache API adapter.

Do not solve this by adding `Vary: Cookie`, cache-busting query strings, a
post-sign-out delay, repeated session refetches, or trip-specific invalidation.
Those approaches leave new authenticated routes vulnerable and still pay the
pre-Worker cache lookup cost.

## Deployment and verification

Deploy through the normal workflow so production bindings and Actions-managed
configuration are preserved. Do not run a bare manual deploy from the committed
fallback config.

After deploy:

1. Issue the same unique `GET /api/auth/get-session?cache_probe=...` twice while
   running `wrangler tail opentrip-api`. Both requests must invoke the Worker;
   neither may return `cf-cache-status: HIT`.
2. Confirm dynamic responses carry `Cache-Control: private, no-store`.
3. Sign in, create a trip, reload the trips page, and confirm the echoed trip is
   still present in the database-backed list.
4. Sign out and confirm the next `get-session` body is `null` and the trip query
   cache is empty before another account signs in.
5. If entrypoint caching might ever be re-enabled, purge the old Worker cache
   first; disabling lookup does not delete old entries.

## Reusable lesson

There are three separate cache planes and their names are easy to conflate:

| Plane | Intended use | OpenTrip policy |
| --- | --- | --- |
| Workers Caching (`wrangler cache.enabled`) | Whole response before Worker execution | Disabled on the authenticated API gateway |
| Cache API (`caches.default`) | Explicit application-owned entries | Allowed only in bounded adapters with synthetic keys |
| Hyperdrive query cache | Database SELECT acceleration | Fresh binding for auth/business truth; cached binding only for explicitly stale-tolerant reads |

Every new cache must document its key, user isolation, TTL, invalidation, and
which of these planes it occupies before it is enabled.
