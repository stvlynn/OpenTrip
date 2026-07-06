import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

const apiDir = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(apiDir, "../../.env") });

type Env = {
  DATABASE_URL: string;
};

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env<Env>("DATABASE_URL"),
  },
});
