import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Build-time configuration for the Mini Program client.
 *
 * Public origins are injected as compile constants (the same approach the PWA
 * uses for its API base URL) so no environment-specific value is committed and
 * no generated source file has to exist for typechecking.
 */

const LOCAL_API_BASE_URL = "http://localhost:8780";

export interface MiniappBuildEnv {
  apiBaseUrl: string;
}

export function readMiniappBuildEnv(): MiniappBuildEnv {
  loadEnvFile(path.resolve(__dirname, "..", ".env"));
  const configured = process.env.MINIAPP_API_BASE_URL?.trim();
  if (!configured) {
    // Local development target. Production builds must set the origin so it
    // matches the WeChat request-domain allowlist.
    console.warn(
      `MINIAPP_API_BASE_URL is not set; building against ${LOCAL_API_BASE_URL}`,
    );
    return { apiBaseUrl: LOCAL_API_BASE_URL };
  }
  return { apiBaseUrl: requireOrigin("MINIAPP_API_BASE_URL", configured) };
}

function loadEnvFile(filePath: string): void {
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

function requireOrigin(name: string, value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${name} must use http or https`);
  }
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${name} must be an origin without a path, query, or hash`);
  }
  return url.origin;
}
