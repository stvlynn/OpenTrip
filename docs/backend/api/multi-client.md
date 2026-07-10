# Multi-client implementation notes


1. **Base URL** — API origin where `/api` is mounted (Docker, Workers, or local
   `:8780`). Web uses Vite proxy in dev; mobile should call the API host
   directly.
2. **JSON helpers** — unwrap `data` on success; throw on `error` (see web
   `apps/web/src/shared/api/client.ts` as a reference, not the contract).
3. **Do not use JSON unwrap for** agent chat stream or upload file GET.
4. **Multipart field names** — trip media: `file`; avatar: `avatar`.
5. **Optimistic / write-echo UI** — many mutations return the full trip (or the
   inserted row). Replace local state / query cache with the response rather
   than patching fields ad hoc or immediately refetching a list. On Cloudflare,
   a follow-up list GET can be stale for ~60s (Hyperdrive). See
   [../../frontend/data-caching.md](../../frontend/data-caching.md).
6. **Polling agent** — web polls `GET …/agent/events?after=<seq>` ~12s; mobile
   can use the same cursor protocol.
7. **Geo tools** are **agent-only** (no public HTTP geo routes). Clients do not
   call place search via REST; they use stops/map UX or the agent. See
   [geo.md](../geo.md).
8. **No product API** yet for deleting a stop or expense (human or agent).

---

[← API index](./README.md) · [Auth/session](./auth-session.md)
