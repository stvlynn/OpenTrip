import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { metaSchema, pageSchema } from "fumadocs-core/source/schema";

export const userDocs = defineDocs({
  dir: "../../docs/user",
  docs: {
    schema: pageSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    files: ["meta.json"],
    schema: metaSchema,
  },
});

export const developerDocs = defineDocs({
  dir: "../../docs",
  docs: {
    files: [
      "README.md",
      "CONTRIBUTING.md",
      "project/**/*.{md,mdx}",
      "frontend/**/*.{md,mdx}",
      "backend/**/*.{md,mdx}",
      "operations/**/*.{md,mdx}",
      "quality/**/*.{md,mdx}",
      "decisions/**/*.{md,mdx}",
      "reference/**/*.{md,mdx}"
    ],
    schema: pageSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    files: [
      "meta.json",
      "project/meta.json",
      "frontend/meta.json",
      "backend/meta.json",
      "backend/api/meta.json",
      "operations/meta.json",
      "operations/incidents/meta.json",
      "quality/meta.json",
      "decisions/meta.json",
      "reference/meta.json"
    ],
    schema: metaSchema,
  },
});

export default defineConfig();
