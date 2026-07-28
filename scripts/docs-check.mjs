#!/usr/bin/env node
// Documentation integrity check:
//  - every required doc exists
//  - every relative markdown link inside docs/ resolves to a real file
//  - reference and ADR indexes list their sibling files
import { readFile, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const docsDir = join(root, "docs");

const required = [
  "docs/README.md",
  "docs/project/README.md",
  "docs/project/architecture.md",
  "docs/project/handoff-implementation.md",
  "docs/frontend/README.md",
  "docs/frontend/layers.md",
  "docs/frontend/ui-system.md",
  "docs/frontend/map.md",
  "docs/frontend/i18n.md",
  "docs/backend/README.md",
  "docs/backend/domain.md",
  "docs/backend/api.md",
  "docs/backend/api/README.md",
  "docs/backend/database.md",
  "docs/backend/auth.md",
  "docs/operations/README.md",
  "docs/operations/cloudflare.md",
  "docs/operations/docker.md",
  "docs/quality/README.md",
  "docs/decisions/README.md",
  "docs/reference/README.md",
  "docs/reference/handoff.md",
  "docs/reference/template-agentic-coding.md",
  "docs/reference/frontend-sources.md",
  "docs/reference/backend-sources.md",
  "docs/reference/deployment-sources.md",
];

const errors = [];

for (const rel of required) {
  if (!existsSync(join(root, rel))) errors.push(`missing required doc: ${rel}`);
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (/\.(md|mdx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const linkRe = /\[[^\]]+\]\(([^)]+)\)/g;

if (existsSync(docsDir)) {
  const mdFiles = await walk(docsDir);
  for (const file of mdFiles) {
    const content = await readFile(file, "utf8");
    let match;
    while ((match = linkRe.exec(content)) !== null) {
      const target = match[1].split("#")[0].trim();
      if (!target) continue;
      if (/^(https?:|mailto:)/.test(target)) continue;
      const resolved = target.startsWith("/assets/")
        ? join(docsDir, target.slice(1))
        : target.startsWith("/")
          ? join(root, target.slice(1))
          : resolve(dirname(file), target);
      if (!existsSync(resolved)) {
        errors.push(`${relative(root, file)}: broken link -> ${target}`);
      }
    }
  }
}

async function indexListsSiblings(indexRel) {
  const indexPath = join(root, indexRel);
  if (!existsSync(indexPath)) return;
  const dir = dirname(indexPath);
  const content = await readFile(indexPath, "utf8");
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !/\.(md|mdx)$/.test(entry.name)) continue;
    if (entry.name === "README.md") continue;
    if (!content.includes(entry.name)) {
      errors.push(`${indexRel}: does not reference sibling ${entry.name}`);
    }
  }
}

await indexListsSiblings("docs/reference/README.md");
await indexListsSiblings("docs/decisions/README.md");

if (errors.length) {
  console.error("docs:check failed:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log("docs:check passed");
