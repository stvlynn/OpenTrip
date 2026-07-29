#!/usr/bin/env node
/**
 * Generate the gitignored WeChat DevTools project configuration from
 * apps/miniapp/.env.
 *
 * Only the AppID lives here; the API origin is injected as a compile constant
 * by config/index.ts. The Mini Program AppSecret remains server-only.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const miniappRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(miniappRoot, "../..");
const envPath = path.join(miniappRoot, ".env");
const privateConfigPath = path.join(miniappRoot, "project.private.config.json");

loadEnvFile(envPath);

const appId = process.env.MINIAPP_APP_ID?.trim() ?? "";

const existing = existsSync(privateConfigPath)
  ? JSON.parse(readFileSync(privateConfigPath, "utf8"))
  : {};

writeFileSync(
  privateConfigPath,
  `${JSON.stringify({ ...existing, appid: appId, compileType: "miniprogram" }, null, 2)}\n`,
  { mode: 0o600 },
);

console.log(
  appId
    ? `Synced AppID into ${path.relative(repoRoot, privateConfigPath)}`
    : `Wrote ${path.relative(repoRoot, privateConfigPath)} without an AppID. Set MINIAPP_APP_ID in apps/miniapp/.env before opening DevTools.`,
);

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
