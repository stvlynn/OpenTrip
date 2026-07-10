#!/usr/bin/env node
/**
 * Write a Hyperdrive config id into wrangler.api.jsonc.
 *
 * Usage:
 *   node deploy/cloudflare/scripts/set-hyperdrive.mjs <hyperdrive-id>
 *
 * Create Hyperdrive first:
 *   npx wrangler hyperdrive create opentrip-db \
 *     --connection-string "postgres://USER:PASSWORD@HOST:5432/DBNAME"
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const id = process.argv[2]?.trim();
if (!id || id.startsWith("<")) {
  console.error("Usage: node deploy/cloudflare/scripts/set-hyperdrive.mjs <hyperdrive-id>");
  process.exit(1);
}
if (!/^[a-f0-9-]{8,}$/i.test(id)) {
  console.error("Hyperdrive id looks invalid:", id);
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(__dirname, "../wrangler.api.jsonc");
const source = readFileSync(configPath, "utf8");

const next = source.replace(
  /("hyperdrive"\s*:\s*\[\s*\{\s*"binding"\s*:\s*"HYPERDRIVE"\s*,\s*"id"\s*:\s*")[^"]*(")/,
  `$1${id}$2`,
);

if (next === source) {
  console.error("Could not find hyperdrive id field in wrangler.api.jsonc");
  process.exit(1);
}

writeFileSync(configPath, next);
console.log(`Updated hyperdrive id → ${id}`);
console.log("Commit the change, then redeploy the API Worker.");
