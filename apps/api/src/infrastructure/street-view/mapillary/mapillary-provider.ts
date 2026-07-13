import type {
  StreetViewImage,
  StreetViewPreview,
  StreetViewProvider,
  StreetViewProviderSearchResult,
  StreetViewSearchQuery,
  StreetViewViewerConfig,
} from "../../../domain/street-view";
import { StreetViewError } from "../../../application/street-view";
import { captureException, logger } from "../../observability";

const GRAPH_URL = "https://graph.mapillary.com";
const IMAGE_FIELDS = [
  "id",
  "captured_at",
  "computed_compass_angle",
  "computed_geometry",
  "is_pano",
  "thumb_1024_url",
].join(",");
const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;
const CANDIDATE_LIMIT = 20;
const MAX_INITIAL_CELL_EDGE_METERS = 500;
const MAX_REGION_REQUESTS = 48;
const LANE_CONCURRENCY = 3;
const MAX_SPLIT_DEPTH = 4;
const SUPPORTED_MEDIA = new Set(["image/jpeg", "image/png", "image/webp"]);

type BoundingBox = [number, number, number, number];

interface SearchRegion {
  bbox: BoundingBox;
  depth: number;
}

interface SearchBudget {
  remainingRequests: number;
  deadline: number;
}

interface LaneSearchResult {
  images: StreetViewImage[];
  completeness: "complete" | "partial";
  attemptedRegions: number;
  splitRegions: number;
}

interface MapillaryImageJson {
  id?: string;
  captured_at?: number;
  computed_compass_angle?: number;
  computed_geometry?: { coordinates?: [number, number] };
  is_pano?: boolean;
  thumb_1024_url?: string;
}

export class MapillaryStreetViewProvider implements StreetViewProvider {
  constructor(
    private readonly accessToken: string,
    private readonly timeoutMs: number,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async searchNearby(query: StreetViewSearchQuery): Promise<StreetViewProviderSearchResult> {
    const bbox = boundingBox(query.lat, query.lng, query.radiusMeters);
    const regions = initialRegions(bbox, query.radiusMeters);
    const budget: SearchBudget = {
      remainingRequests: MAX_REGION_REQUESTS,
      deadline: Date.now() + this.timeoutMs,
    };
    const startedAt = Date.now();
    const [panoramas, general] = await Promise.allSettled([
      this.searchLane(regions, budget, "pano"),
      this.searchLane(regions, budget),
    ]);
    const successful = [panoramas, general].filter(
      (result): result is PromiseFulfilledResult<LaneSearchResult> =>
        result.status === "fulfilled",
    );
    if (successful.length === 0) {
      throw panoramas.status === "rejected"
        ? panoramas.reason
        : new StreetViewError("street_view_upstream_error", "Street-view provider request failed");
    }
    const merged = new Map<string, StreetViewImage>();
    for (const result of successful) {
      for (const image of result.value.images) merged.set(image.id, image);
    }
    const completeness =
      successful.length === 2 && successful.every((result) => result.value.completeness === "complete")
        ? "complete"
        : "partial";
    console.info("Mapillary street-view search completed", {
      event: "street_view.mapillary_search_completed",
      radiusMeters: query.radiusMeters,
      initialRegionCount: regions.length,
      attemptedRegionCount: successful.reduce(
        (count, result) => count + result.value.attemptedRegions,
        0,
      ),
      splitRegionCount: successful.reduce(
        (count, result) => count + result.value.splitRegions,
        0,
      ),
      resultCount: merged.size,
      completeness,
      durationMs: Date.now() - startedAt,
    });
    return {
      images: [...merged.values()],
      completeness,
    };
  }

  private async searchLane(
    initial: SearchRegion[],
    budget: SearchBudget,
    imageType?: "pano",
  ): Promise<LaneSearchResult> {
    const queue = [...initial];
    const images = new Map<string, StreetViewImage>();
    let attemptedRegions = 0;
    let splitRegions = 0;
    let successfulRegions = 0;
    let incomplete = false;
    let firstError: unknown;

    while (queue.length > 0) {
      const batch = queue.splice(0, LANE_CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (region) => {
          if (budget.remainingRequests <= 0 || Date.now() >= budget.deadline) {
            return { region, outcome: "budget_exhausted" as const };
          }
          attemptedRegions += 1;
          try {
            return {
              region,
              outcome: "success" as const,
              images: await this.searchRegion(
                region.bbox,
                budget,
                imageType,
              ),
            };
          } catch (error) {
            return { region, outcome: "failure" as const, error };
          }
        }),
      );

      for (const result of results) {
        if (result.outcome === "success") {
          successfulRegions += 1;
          for (const image of result.images) images.set(image.id, image);
          continue;
        }
        if (result.outcome === "budget_exhausted") {
          incomplete = true;
          firstError ??= new StreetViewError(
            Date.now() >= budget.deadline ? "street_view_timeout" : "street_view_upstream_error",
            Date.now() >= budget.deadline
              ? "Street-view provider timed out"
              : "Street-view provider request budget exhausted",
          );
          continue;
        }
        if (result.error instanceof MapillaryQueryTooLargeError && result.region.depth < MAX_SPLIT_DEPTH) {
          splitRegions += 1;
          queue.push(...splitRegion(result.region));
          continue;
        }
        incomplete = true;
        firstError ??= result.error;
      }
    }

    if (successfulRegions === 0 && firstError) throw firstError;
    return {
      images: [...images.values()],
      completeness: incomplete ? "partial" : "complete",
      attemptedRegions,
      splitRegions,
    };
  }

  private async searchRegion(
    bbox: BoundingBox,
    budget: SearchBudget,
    imageType?: "pano",
  ): Promise<StreetViewImage[]> {
    const url = new URL(`${GRAPH_URL}/images`);
    url.searchParams.set("access_token", this.accessToken);
    url.searchParams.set("fields", IMAGE_FIELDS);
    url.searchParams.set("bbox", bbox.join(","));
    url.searchParams.set("limit", String(CANDIDATE_LIMIT));
    if (imageType) url.searchParams.set("image_type", imageType);
    const payload = await this.readJson<{ data?: MapillaryImageJson[] }>(url, {
      recognizeOversizedRegion: true,
      budget,
      operation: imageType ? "search_panoramas" : "search_images",
    });
    const images = (payload.data ?? [])
      .map(toImage)
      .filter((image): image is StreetViewImage => image !== null);
    return imageType === "pano" ? images.filter((image) => image.supports360) : images;
  }

  async getImage(imageId: string): Promise<StreetViewImage | null> {
    const url = new URL(`${GRAPH_URL}/${encodeURIComponent(imageId)}`);
    url.searchParams.set("access_token", this.accessToken);
    url.searchParams.set("fields", IMAGE_FIELDS);
    try {
      return toImage(
        await this.readJson<MapillaryImageJson>(url, {
          budget: this.singleRequestBudget(),
          operation: "get_image",
        }),
      );
    } catch (error) {
      if (error instanceof StreetViewError && error.code === "street_view_image_not_found") return null;
      throw error;
    }
  }

  async readPreview(image: StreetViewImage): Promise<StreetViewPreview> {
    const response = await this.requestWithRetry(
      image.previewSource,
      this.singleRequestBudget(),
      "read_preview",
    );
    const mediaType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (!mediaType || !SUPPORTED_MEDIA.has(mediaType)) {
      throw new StreetViewError("street_view_unsupported_preview", "Unsupported street-view preview format");
    }
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_PREVIEW_BYTES) {
      throw new StreetViewError("street_view_preview_too_large", "Street-view preview exceeds 2 MiB");
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_PREVIEW_BYTES) {
      throw new StreetViewError("street_view_preview_too_large", "Street-view preview exceeds 2 MiB");
    }
    return { bytes, mediaType: mediaType as StreetViewPreview["mediaType"] };
  }

  getViewerConfig(): StreetViewViewerConfig {
    return { provider: "mapillary", accessToken: this.accessToken };
  }

  private async readJson<T>(
    url: URL,
    options: {
      recognizeOversizedRegion?: boolean;
      budget: SearchBudget;
      operation: string;
    },
  ): Promise<T> {
    const response = await this.requestWithRetry(
      url,
      options.budget,
      options.operation,
      options.recognizeOversizedRegion
        ? async (candidate) =>
            (await isOversizedRegionResponse(candidate))
              ? new MapillaryQueryTooLargeError()
              : null
        : undefined,
    );
    try {
      return (await response.json()) as T;
    } catch (cause) {
      throw new StreetViewError(
        "street_view_upstream_error",
        "Street-view provider returned invalid JSON",
        {
          retryable: false,
          providerOperation: options.operation,
          cause,
        },
      );
    }
  }

  private async requestWithRetry(
    input: URL | string,
    budget: SearchBudget,
    operation: string,
    classifyResponse?: (response: Response) => Promise<Error | null>,
  ): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const timeoutMs = takeRequestBudget(budget);
      if (timeoutMs === null) {
        throw new StreetViewError(
          Date.now() >= budget.deadline
            ? "street_view_timeout"
            : "street_view_upstream_error",
          Date.now() >= budget.deadline
            ? "Street-view provider timed out"
            : "Street-view provider request budget exhausted",
          {
            retryable: false,
            providerOperation: operation,
            attempt,
          },
        );
      }
      const startedAt = Date.now();
      try {
        const response = await this.fetchImpl(input, {
          signal: AbortSignal.timeout(Math.max(1, timeoutMs)),
        });
        if (response.ok) {
          logger.info("street_view.provider.request_completed", {
            provider: "mapillary",
            providerOperation: operation,
            attempt,
            upstreamStatus: response.status,
            durationMs: Date.now() - startedAt,
          });
          return response;
        }
        const classified = await classifyResponse?.(response.clone());
        if (classified) throw classified;
        const error = upstreamError(response.status, operation, attempt);
        lastError = error;
        if (!isRetryableError(error) || attempt === 2) throw error;
        logger.warn("street_view.provider.request_failed", {
          provider: "mapillary",
          providerOperation: operation,
          attempt,
          upstreamStatus: error.upstreamStatus,
          errorCode: error.code,
          retryable: error.retryable,
          durationMs: Date.now() - startedAt,
        });
        await this.waitBeforeRetry(response, budget, operation, attempt);
      } catch (cause) {
        if (cause instanceof MapillaryQueryTooLargeError) throw cause;
        const error = normalizeRequestError(cause, operation, attempt);
        lastError = error;
        logger.warn("street_view.provider.request_failed", {
          provider: "mapillary",
          providerOperation: operation,
          attempt,
          upstreamStatus: error.upstreamStatus,
          errorCode: error.code,
          retryable: error.retryable,
          durationMs: Date.now() - startedAt,
        });
        if (!error.retryable || attempt === 2) {
          if (error.code !== "street_view_image_not_found") {
            captureException(error, {
              provider: "mapillary",
              providerOperation: operation,
              attempt,
              upstreamStatus: error.upstreamStatus,
              errorCode: error.code,
            });
          }
          throw error;
        }
        if (!(cause instanceof StreetViewError)) {
          await this.waitBeforeRetry(null, budget, operation, attempt);
        }
      }
    }
    throw lastError;
  }

  private async waitBeforeRetry(
    response: Response | null,
    budget: SearchBudget,
    operation: string,
    attempt: number,
  ): Promise<void> {
    const retryAfterMs = Math.min(2_000, parseRetryAfterMs(response));
    const remainingMs = budget.deadline - Date.now();
    if (remainingMs <= retryAfterMs) return;
    logger.info("street_view.provider.retry_scheduled", {
      provider: "mapillary",
      providerOperation: operation,
      attempt,
      nextAttempt: attempt + 1,
      retryAfterMs,
    });
    if (retryAfterMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, retryAfterMs));
    }
  }

  private singleRequestBudget(): SearchBudget {
    return { remainingRequests: 2, deadline: Date.now() + this.timeoutMs };
  }
}

class MapillaryQueryTooLargeError extends Error {
  constructor() {
    super("Mapillary search region contains too much data");
    this.name = "MapillaryQueryTooLargeError";
  }
}

function toImage(value: MapillaryImageJson): StreetViewImage | null {
  const coordinates = value.computed_geometry?.coordinates;
  if (!value.id || !coordinates || coordinates.length !== 2 || !value.thumb_1024_url) return null;
  const [lng, lat] = coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: value.id,
    coordinate: { lat, lng },
    ...(value.captured_at ? { capturedAt: new Date(value.captured_at).toISOString() } : {}),
    ...(Number.isFinite(value.computed_compass_angle) ? { headingDegrees: value.computed_compass_angle } : {}),
    supports360: value.is_pano === true,
    previewSource: value.thumb_1024_url,
    attribution: { label: "Mapillary", url: "https://www.mapillary.com/" },
  };
}

function boundingBox(lat: number, lng: number, radiusMeters: number): BoundingBox {
  const latDelta = radiusMeters / 111_320;
  const lngDelta = radiusMeters / (111_320 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
  return [lng - lngDelta, lat - latDelta, lng + lngDelta, lat + latDelta];
}

function initialRegions(bbox: BoundingBox, radiusMeters: number): SearchRegion[] {
  const cellsPerAxis = Math.max(1, Math.ceil((radiusMeters * 2) / MAX_INITIAL_CELL_EDGE_METERS));
  const [west, south, east, north] = bbox;
  const lngStep = (east - west) / cellsPerAxis;
  const latStep = (north - south) / cellsPerAxis;
  const regions: SearchRegion[] = [];
  for (let latIndex = 0; latIndex < cellsPerAxis; latIndex += 1) {
    for (let lngIndex = 0; lngIndex < cellsPerAxis; lngIndex += 1) {
      regions.push({
        bbox: [
          west + lngStep * lngIndex,
          south + latStep * latIndex,
          west + lngStep * (lngIndex + 1),
          south + latStep * (latIndex + 1),
        ],
        depth: 0,
      });
    }
  }
  return regions;
}

function splitRegion(region: SearchRegion): SearchRegion[] {
  const [west, south, east, north] = region.bbox;
  const middleLng = (west + east) / 2;
  const middleLat = (south + north) / 2;
  const depth = region.depth + 1;
  return [
    { bbox: [west, south, middleLng, middleLat], depth },
    { bbox: [middleLng, south, east, middleLat], depth },
    { bbox: [west, middleLat, middleLng, north], depth },
    { bbox: [middleLng, middleLat, east, north], depth },
  ];
}

function takeRequestBudget(budget: SearchBudget): number | null {
  const remainingMs = budget.deadline - Date.now();
  if (budget.remainingRequests <= 0 || remainingMs <= 0) return null;
  budget.remainingRequests -= 1;
  return remainingMs;
}

async function isOversizedRegionResponse(response: Response): Promise<boolean> {
  if (response.status !== 500) return false;
  try {
    const payload = (await response.clone().json()) as {
      error?: { code?: number; message?: string };
    };
    return (
      payload.error?.code === 1 &&
      payload.error.message?.toLowerCase().includes("reduce the amount of data") === true
    );
  } catch {
    return false;
  }
}

function upstreamError(
  status: number,
  operation: string,
  attempt: number,
): StreetViewError {
  const options = {
    upstreamStatus: status,
    providerOperation: operation,
    attempt,
  };
  if (status === 401 || status === 403) {
    return new StreetViewError(
      "street_view_provider_auth_error",
      "Street-view provider authentication failed",
      { ...options, retryable: false },
    );
  }
  if (status === 404) {
    return new StreetViewError(
      "street_view_image_not_found",
      "Street-view image not found",
      { ...options, retryable: false },
    );
  }
  if (status === 429) {
    return new StreetViewError(
      "street_view_rate_limited",
      "Street-view provider rate limit reached",
      { ...options, retryable: true },
    );
  }
  return new StreetViewError(
    "street_view_upstream_error",
    "Street-view provider request failed",
    { ...options, retryable: [500, 502, 503, 504].includes(status) },
  );
}

function normalizeRequestError(
  cause: unknown,
  operation: string,
  attempt: number,
): StreetViewError {
  if (cause instanceof StreetViewError) return cause;
  if (cause instanceof DOMException && cause.name === "TimeoutError") {
    return new StreetViewError(
      "street_view_timeout",
      "Street-view provider timed out",
      { retryable: true, providerOperation: operation, attempt, cause },
    );
  }
  return new StreetViewError(
    "street_view_upstream_error",
    "Street-view provider request failed",
    { retryable: true, providerOperation: operation, attempt, cause },
  );
}

function isRetryableError(error: unknown): boolean {
  return error instanceof StreetViewError && error.retryable;
}

function parseRetryAfterMs(response: Response | null): number {
  const value = response?.headers.get("retry-after")?.trim();
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}
