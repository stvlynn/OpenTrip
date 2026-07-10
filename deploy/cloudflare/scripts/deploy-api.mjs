#!/usr/bin/env node
/**
 * Deploy the OpenTrip API Worker.
 * Fails fast when Hyperdrive is still a placeholder.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../../..");
const configPath = resolve(__dirname, "../wrangler.api.jsonc");

const source = readFileSync(configPath, "utf8");
const match = source.match(/"binding"\s*:\s*"HYPERDRIVE"\s*,\s*"id"\s*:\s*"([^"]+)"/);
const hyperdriveId = match?.[1] ?? "";

if (!hyperdriveId || hyperdriveId.startsWith("<") || hyperdriveId.includes("your-hyperdrive")) {
  console.error(`
Hyperdrive is not configured yet.

1. Create one (needs a public Postgres URL):
   npx wrangler hyperdrive create opentrip-db \\
     --connection-string "postgres://USER:PASSWORD@HOST:5432/DBNAME"

2. Write the id into wrangler.api.jsonc:
   node deploy/cloudflare/scripts/set-hyperdrive.mjs <id>

3. Migrate the database, then re-run this deploy.
`);
  process.exit(1);
}

if (!process.env.CLOUDFLARE_API_TOKEN) {
  console.error("CLOUDFLARE_API_TOKEN is required.");
  process.exit(1);
}

const result = spawnSync(
  "npx",
  ["--yes", "wrangler@4", "deploy", "--config", configPath],
  { cwd: root, stdio: "inherit", env: process.env },
);
process.exit(result.status ?? 1);
