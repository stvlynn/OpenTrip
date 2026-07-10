#!/usr/bin/env node
/**
 * Build the SPA and deploy it to Cloudflare Pages (opentrip-web).
 * Bakes BASE_URL=https://api.opentrip.im into the client bundle.
 */
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../../..");

const API_ORIGIN = process.env.API_ORIGIN || "https://api.opentrip.im";
const PROJECT = process.env.PAGES_PROJECT || "opentrip-web";
const BRANCH = process.env.PAGES_BRANCH || "main";

if (!process.env.CLOUDFLARE_API_TOKEN) {
  console.error("CLOUDFLARE_API_TOKEN is required.");
  process.exit(1);
}

function run(cmd, args, env = {}) {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Prefer pnpm when available; CI installs it via corepack/setup.
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

run(pnpm, ["install", "--frozen-lockfile"]);
run(pnpm, ["--filter", "@opentrip/web", "build"], {
  BASE_URL: API_ORIGIN,
  // Captcha disabled in production until real Turnstile keys are provisioned.
  CAPTCHA_PROVIDER: process.env.CAPTCHA_PROVIDER || "",
  TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY || "",
});

const dist = resolve(root, "apps/web/dist");
if (!existsSync(dist)) {
  console.error("Build did not produce apps/web/dist");
  process.exit(1);
}

run("npx", [
  "--yes",
  "wrangler@4",
  "pages",
  "deploy",
  dist,
  "--project-name",
  PROJECT,
  "--branch",
  BRANCH,
  "--commit-dirty=true",
]);

console.log(`Pages deployed → https://opentrip.im (project ${PROJECT})`);
