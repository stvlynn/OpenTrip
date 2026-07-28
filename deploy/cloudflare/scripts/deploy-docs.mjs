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
const customDomain = process.env.DOCS_CUSTOM_DOMAIN?.trim() || "";
const zoneName = process.env.DOCS_ZONE?.trim() || "";
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();

if (!apiToken) {
  console.error("CLOUDFLARE_API_TOKEN is required.");
  process.exit(1);
}
if (!accountId) {
  console.error("CLOUDFLARE_ACCOUNT_ID is required.");
  process.exit(1);
}
if (Boolean(customDomain) !== Boolean(zoneName)) {
  console.error(
    "DOCS_CUSTOM_DOMAIN and DOCS_ZONE must either both be set or both be omitted.",
  );
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

async function cloudflare(path, init = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const body = await response.json();
  if (!response.ok || !body.success) {
    throw new Error(
      `Cloudflare API ${init.method ?? "GET"} ${path} failed: ${JSON.stringify(body.errors)}`,
    );
  }
  return body.result;
}

async function ensureCustomDomain() {
  if (!customDomain) {
    console.log("Docs custom domain: skipped (DOCS_CUSTOM_DOMAIN unset)");
    return;
  }

  const domains = await cloudflare(
    `/accounts/${accountId}/pages/projects/${project}/domains`,
  );
  if (!domains.some((item) => item.name === customDomain)) {
    await cloudflare(
      `/accounts/${accountId}/pages/projects/${project}/domains`,
      {
        method: "POST",
        body: JSON.stringify({ name: customDomain }),
      },
    );
    console.log(`Pages custom domain added: ${customDomain}`);
  }

  const zones = await cloudflare(
    `/zones?name=${encodeURIComponent(zoneName)}&account.id=${encodeURIComponent(accountId)}`,
  );
  const zone = zones.find((item) => item.name === zoneName);
  if (!zone) {
    throw new Error(`Cloudflare zone not found in this account: ${zoneName}`);
  }

  const records = await cloudflare(
    `/zones/${zone.id}/dns_records?type=CNAME&name=${encodeURIComponent(customDomain)}`,
  );
  const target = `${project}.pages.dev`;
  const existing = records[0];
  if (existing && existing.content !== target) {
    throw new Error(
      `Refusing to replace existing ${customDomain} CNAME target ${existing.content}`,
    );
  }
  if (!existing) {
    await cloudflare(`/zones/${zone.id}/dns_records`, {
      method: "POST",
      body: JSON.stringify({
        type: "CNAME",
        name: customDomain,
        content: target,
        ttl: 1,
        proxied: true,
      }),
    });
    console.log(`DNS CNAME created: ${customDomain} → ${target}`);
  }
}

run(pnpm, ["install", "--frozen-lockfile"]);
run(pnpm, ["--filter", "@opentrip/docs", "build"]);

const output = resolve(root, "apps/docs/out");
if (!existsSync(output)) {
  console.error("Build did not produce apps/docs/out");
  process.exit(1);
}

await ensureCustomDomain();

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

const deploymentUrl = customDomain
  ? `https://${customDomain}`
  : `https://${project}.pages.dev`;
console.log(`Docs Pages deployed → ${deploymentUrl} (project ${project})`);
