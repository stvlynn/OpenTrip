#!/usr/bin/env node
/**
 * Create a cache-disabled Hyperdrive config for auth/agent fresh reads, then
 * print its id for `gh secret set HYPERDRIVE_CACHE_DISABLED_ID`.
 *
 * Requires env:
 *   CLOUDFLARE_API_TOKEN
 *   CLOUDFLARE_ACCOUNT_ID
 *   DATABASE_URL  (origin Postgres connection string)
 *
 * Optional:
 *   HYPERDRIVE_NAME (default: opentrip-fresh)
 *   ORIGIN_CONNECTION_LIMIT (default: 10)
 */
import { spawnSync } from "node:child_process";

const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const databaseUrl = process.env.DATABASE_URL?.trim();
const name = process.env.HYPERDRIVE_NAME?.trim() || "opentrip-fresh";
const originLimit = Number(process.env.ORIGIN_CONNECTION_LIMIT || "10");

if (!token || !accountId || !databaseUrl) {
  console.error(
    "CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, and DATABASE_URL are required.",
  );
  process.exit(1);
}

if (databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1")) {
  console.error(
    "DATABASE_URL looks local; refuse to create a production Hyperdrive from it.",
  );
  process.exit(1);
}

const listRes = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/hyperdrive/configs`,
  {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  },
);
const listJson = await listRes.json();
if (!listJson.success) {
  console.error("Failed to list Hyperdrive configs:", JSON.stringify(listJson.errors));
  process.exit(1);
}

const existing = (listJson.result || []).find(
  (c) => c.name === name || (c.caching?.disabled === true && c.name?.includes("fresh")),
);
if (existing) {
  console.log(`Reusing existing Hyperdrive ${existing.name} id=${existing.id}`);
  console.log(`HYPERDRIVE_CACHE_DISABLED_ID=${existing.id}`);
  process.exit(0);
}

// Prefer wrangler so PlanetScale / SSL defaults match prior creates.
const wrangler = spawnSync(
  "npx",
  [
    "--yes",
    "wrangler@4",
    "hyperdrive",
    "create",
    name,
    "--connection-string",
    databaseUrl,
    "--caching-disabled",
    "--origin-connection-limit",
    String(originLimit),
  ],
  {
    encoding: "utf8",
    env: process.env,
  },
);

if (wrangler.status !== 0) {
  console.error(wrangler.stdout || "");
  console.error(wrangler.stderr || "");
  console.error("wrangler hyperdrive create failed; trying Cloudflare REST API…");

  const parsed = new URL(databaseUrl);
  const body = {
    name,
    origin: {
      host: parsed.hostname,
      port: Number(parsed.port || 5432),
      database: parsed.pathname.replace(/^\//, "") || "postgres",
      scheme: parsed.protocol.replace(":", "") === "postgresql" ? "postgres" : parsed.protocol.replace(":", ""),
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
    },
    caching: { disabled: true },
    origin_connection_limit: originLimit,
  };

  const createRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/hyperdrive/configs`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  const createJson = await createRes.json();
  if (!createJson.success || !createJson.result?.id) {
    console.error("REST create failed:", JSON.stringify(createJson, null, 2));
    process.exit(1);
  }
  console.log(`Created Hyperdrive via API id=${createJson.result.id}`);
  console.log(`HYPERDRIVE_CACHE_DISABLED_ID=${createJson.result.id}`);
  process.exit(0);
}

const out = `${wrangler.stdout || ""}\n${wrangler.stderr || ""}`;
console.log(out);

const idMatch =
  out.match(/"id"\s*:\s*"([a-f0-9]{32})"/i) ||
  out.match(/\bid[=:]\s*([a-f0-9]{32})\b/i) ||
  out.match(/\b([a-f0-9]{32})\b/);
if (!idMatch) {
  // Re-list and pick by name
  const listRes2 = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/hyperdrive/configs`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );
  const listJson2 = await listRes2.json();
  const created = (listJson2.result || []).find((c) => c.name === name);
  if (!created) {
    console.error("Could not parse Hyperdrive id from wrangler output.");
    process.exit(1);
  }
  console.log(`HYPERDRIVE_CACHE_DISABLED_ID=${created.id}`);
  process.exit(0);
}

console.log(`HYPERDRIVE_CACHE_DISABLED_ID=${idMatch[1]}`);
