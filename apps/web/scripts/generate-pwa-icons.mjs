#!/usr/bin/env node
// Derives platform sizes from the image-generated master artwork. Run
// `pnpm --filter @opentrip/web icons:generate` after replacing the master and
// commit the regenerated PNGs.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), "../public");

const targets = [
  { out: "apple-touch-icon-180x180.png", size: 180 },
  { out: "pwa-192x192.png", size: 192 },
  { out: "pwa-512x512.png", size: 512 },
  { out: "pwa-maskable-512x512.png", size: 512 },
];

const master = await readFile(join(publicDir, "app-icon-master.png"));

for (const { out, size } of targets) {
  const image = sharp(master).resize(size, size, { fit: "cover" }).flatten({ background: "#fafbfd" });
  await writeFile(join(publicDir, out), await image.png().toBuffer());
  console.log(`wrote public/${out} (${size}x${size})`);
}
