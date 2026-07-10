import { createContainer } from "./infrastructure/composition/container";
import { loadConfig, type RawEnv } from "./infrastructure/config";
import { createWorkerStorage } from "./infrastructure/storage/create-worker-storage";
import { createApp } from "./interfaces/http/app";

interface WorkerEnv extends RawEnv {
  /** Optional Hyperdrive binding (query cache enabled). Prefer when available. */
  HYPERDRIVE?: { connectionString: string };
  /**
   * Optional cache-disabled Hyperdrive for auth + agent session reads that
   * need read-after-write consistency. Falls back to HYPERDRIVE / DATABASE_URL.
   */
  HYPERDRIVE_CACHE_DISABLED?: { connectionString: string };
  /** Required when HYPERDRIVE is not bound (direct MySQL/Postgres). */
  DATABASE_URL?: string;
  BETTER_AUTH_SECRET: string;
  TRUSTED_ORIGINS?: string;
  BASE_URL?: string;
}

/** Minimal ExecutionContext so we do not depend on ambient Workers types. */
interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

function resolveConnectionString(env: WorkerEnv): string | undefined {
  const fromHyperdrive = env.HYPERDRIVE?.connectionString?.trim();
  if (fromHyperdrive) return fromHyperdrive;
  return env.DATABASE_URL?.trim() || undefined;
}

function resolveFreshConnectionString(
  env: WorkerEnv,
  cached: string | undefined,
): string | undefined {
  const fromFresh = env.HYPERDRIVE_CACHE_DISABLED?.connectionString?.trim();
  if (fromFresh) return fromFresh;
  return cached;
}

function buildApp(env: WorkerEnv) {
  const connectionString = resolveConnectionString(env);
  const freshDatabaseUrl = resolveFreshConnectionString(env, connectionString);
  const config = loadConfig(env, connectionString);
  const dualPools =
    Boolean(freshDatabaseUrl) &&
    freshDatabaseUrl !== config.databaseUrl.trim();
  // Keep total per-request client slots ≤ 5 when both Hyperdrive bindings are live.
  const container = createContainer(
    config,
    createWorkerStorage(config.storage),
    {
      poolMax: dualPools ? 3 : 5,
      poolMaxFresh: 2,
      freshDatabaseUrl,
    },
  );
  return { app: createApp(container), container };
}

/**
 * Platform-level failures (uncaught throws, hung isolate recovery) return CF
 * 1101 **without** CORS headers — the browser reports "blocked by CORS".
 * Mirror trusted-origin CORS on emergency JSON so the SPA sees a real error.
 */
function emergencyCorsResponse(
  request: Request,
  env: WorkerEnv,
  status: number,
  message: string,
): Response {
  const origin = request.headers.get("Origin") ?? "";
  const trusted = (env.TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const headers = new Headers({
    "content-type": "application/json",
    "access-control-allow-credentials": "true",
    vary: "Origin",
  });
  if (origin && trusted.includes(origin)) {
    headers.set("access-control-allow-origin", origin);
  }
  return new Response(
    JSON.stringify({ error: { code: "internal_error", message } }),
    { status, headers },
  );
}

export default {
  async fetch(
    request: Request,
    env: WorkerEnv,
    ctx: WorkerExecutionContext,
  ): Promise<Response> {
    // Always build a fresh client pool per request on Workers.
    // Hyperdrive still pools TCP to the origin at the edge; caching a
    // node-postgres Pool across isolate freezes left connections "pending"
    // forever → CF hang cancel (1101) which browsers report as CORS.
    const { app, container } = buildApp(env);
    try {
      return await app.fetch(request);
    } catch (err) {
      console.error("Worker fetch failed:", err);
      return emergencyCorsResponse(
        request,
        env,
        500,
        "Something went wrong",
      );
    } finally {
      // Dispose only after deferred ambient agent work finishes so we do not
      // race pool.end() against waitUntil(maybeReplyIfAddressed).
      ctx.waitUntil(
        container.disposeAfterDeferred().catch((err) => {
          console.error("Failed to dispose DB pools:", err);
        }),
      );
    }
  },
};
