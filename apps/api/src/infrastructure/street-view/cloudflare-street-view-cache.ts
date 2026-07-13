import type { StreetViewCache } from "../../application/street-view";
import type { StreetViewImage, StreetViewPreview } from "../../domain/street-view";

const CACHE_TTL_SECONDS = 15 * 60;
const CACHE_SCHEMA_VERSION = "v1";

export interface CloudflareCacheLike {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

export class CloudflareStreetViewCache implements StreetViewCache {
  constructor(
    private readonly cache: CloudflareCacheLike,
    private readonly provider: string,
  ) {}

  async getImage(imageId: string): Promise<StreetViewImage | null> {
    const response = await this.cache.match(this.key("metadata", imageId));
    if (!response) return null;
    try {
      return (await response.json()) as StreetViewImage;
    } catch {
      return null;
    }
  }

  async putImage(image: StreetViewImage): Promise<void> {
    await this.cache.put(
      this.key("metadata", image.id),
      new Response(JSON.stringify(image), {
        headers: {
          "content-type": "application/json",
          "cache-control": `public, max-age=${CACHE_TTL_SECONDS}`,
        },
      }),
    );
  }

  async getPreview(imageId: string): Promise<StreetViewPreview | null> {
    const response = await this.cache.match(this.key("preview", imageId));
    if (!response) return null;
    const mediaType = response.headers.get("content-type");
    if (!isPreviewMediaType(mediaType)) return null;
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      mediaType,
    };
  }

  async putPreview(imageId: string, preview: StreetViewPreview): Promise<void> {
    await this.cache.put(
      this.key("preview", imageId),
      new Response(preview.bytes, {
        headers: {
          "content-type": preview.mediaType,
          "cache-control": `public, max-age=${CACHE_TTL_SECONDS}`,
        },
      }),
    );
  }

  private key(kind: "metadata" | "preview", imageId: string): Request {
    const url = new URL("https://street-view-cache.opentrip.invalid/");
    url.pathname = [
      CACHE_SCHEMA_VERSION,
      encodeURIComponent(this.provider),
      kind,
      encodeURIComponent(imageId),
    ].join("/");
    return new Request(url, { method: "GET" });
  }
}

function isPreviewMediaType(
  value: string | null,
): value is StreetViewPreview["mediaType"] {
  return value === "image/jpeg" || value === "image/png" || value === "image/webp";
}
