import { createMDX } from "fumadocs-mdx/next";
import { fileURLToPath } from "node:url";

const withMDX = createMDX();
const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));

/** @type {import("next").NextConfig} */
const config = {
  output: "export",
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: workspaceRoot,
  },
};

export default withMDX(config);
