#!/usr/bin/env node
/**
 * Build the static Fumadocs site and deploy it to its own Cloudflare Pages
 * project. This intentionally does not share the web or API runtime.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "../../..");
const project = process.env.DOCS_PAGES_PROJECT?.trim() || "opentrip-docs";
const branch = process.env.PAGES_BRANCH?.trim() || "main";
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

if (!process.env.CLOUDFLARE_API_TOKEN) {
  console.error("CLOUDFLARE_API_TOKEN is required.");
  process.exit(1);
}

function run(command, args) {
  console.log(`$ ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(pnpm, ["install", "--frozen-lockfile"]);
run(pnpm, ["--filter", "@opentrip/docs", "build"]);

const output = resolve(root, "apps/docs/out");
if (!existsSync(output)) {
  console.error("Build did not produce apps/docs/out");
  process.exit(1);
}

run("npx", [
  "--yes",
  "wrangler@4",
  "pages",
  "deploy",
  output,
  "--project-name",
  project,
  "--branch",
  branch,
  "--commit-dirty=true",
]);

console.log(
  `Docs Pages deployed → https://docs.opentrip.im (project ${project})`,
);
