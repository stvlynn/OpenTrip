# Reference: deployment sources

## Cloudflare Workers + Pages + Hyperdrive

### Source

- Cloudflare docs (search tool): Workers Wrangler configuration, Hyperdrive
  bindings, Pages Functions bindings, migrate-from-pages.
- Skills: `workers-best-practices`, `wrangler`.
- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://developers.cloudflare.com/hyperdrive/

### Relevant rule

- Connect to external PostgreSQL from Workers via **Hyperdrive**; do not open
  raw origin connections.
- Hyperdrive requires Node.js compatibility. The Wrangler docs show
  `"compatibility_flags": ["nodejs_compat_v2"]` with a `hyperdrive` binding
  `{ binding, id }`.
- Set a recent `compatibility_date`. Generate `Env` types with `wrangler types`
  after config changes; never hand-write bindings. Store secrets with
  `wrangler secret put`, never in config/source. Enable `observability`.
- Access the binding as `env.HYPERDRIVE.connectionString` inside the Worker.
  Optional `env.HYPERDRIVE_CACHE_DISABLED.connectionString` for auth/agent
  fresh reads (see [Hyperdrive query caching](https://developers.cloudflare.com/hyperdrive/concepts/query-caching/#read-after-write-behavior)).

### Project decision

- API deploys as a Worker using `deploy/cloudflare/wrangler.api.jsonc`
  (`nodejs_compat_v2`, Hyperdrive bindings `HYPERDRIVE` +
  `HYPERDRIVE_CACHE_DISABLED`, `observability`).
- Frontend deploys to Pages (build `apps/web`, publish `apps/web/dist`).
- `BETTER_AUTH_SECRET` is a Worker secret; `BASE_URL` is a Worker var, never
  committed. `deploy/cloudflare/secrets.example.json` lists key names only.
  See [../operations/cloudflare.md](../operations/cloudflare.md).

## Docker Compose

### Source

- Docker Compose: https://docs.docker.com/compose/
- `@hono/node-server`: https://github.com/honojs/node-server

### Relevant rule

- Multi-service local/self-hosted deployment: a database service plus app
  services, wired by service name over an internal network, secrets via env.

### Project decision

- `deploy/docker/docker-compose.yml` runs `postgres`, `api` (Node Hono server),
  and `web` (static build served by a lightweight server). The API uses a plain
  `DATABASE_URL` pointing at the `postgres` service — no Hyperdrive locally.
  `deploy/docker/.env.example` documents required env.
  See [../operations/docker.md](../operations/docker.md).
