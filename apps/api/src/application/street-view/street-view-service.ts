import type {
  StreetViewImage,
  StreetViewPreview,
  StreetViewProvider,
  StreetViewViewerConfig,
} from "../../domain/street-view";
import { StreetViewError } from "./street-view-error";
import {
  noopStreetViewCache,
  type StreetViewCache,
} from "./street-view-cache";
import {
  noopObservability,
  type Observability,
  type RuntimeName,
} from "../observability";

const DEFAULT_RADIUS_METERS = 100;
const MAX_RADIUS_METERS = 1_000;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const IMAGE_ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;

export interface StreetViewImageDto {
  id: string;
  coordinate: { lat: number; lng: number };
  distanceMeters?: number;
  capturedAt?: string;
  headingDegrees?: number;
  supports360: boolean;
  previewUrl: string;
  attribution: { label: string; url?: string };
}

export interface StreetViewSearchInput {
  tripId: string;
  lat: number;
  lng: number;
  radiusMeters?: number;
  limit?: number;
  observability?: StreetViewRequestContext;
}

export interface StreetViewRequestContext {
  requestId?: string;
  turnId?: string;
  runtime?: RuntimeName;
}

export interface StreetViewSearchResultDto {
  outcome: "found" | "empty";
  completeness: "complete" | "partial";
  panoramaAvailable: boolean;
  panoramaCount: number;
  candidateCount: number;
  images: StreetViewImageDto[];
}

export class StreetViewService {
  constructor(
    private readonly provider: StreetViewProvider,
    private readonly cache: StreetViewCache = noopStreetViewCache,
    private readonly observability: Observability = noopObservability,
  ) {}

  async searchNearby(input: StreetViewSearchInput): Promise<StreetViewSearchResultDto> {
    validateCoordinate(input.lat, input.lng);
    const radiusMeters = clampInteger(
      input.radiusMeters ?? DEFAULT_RADIUS_METERS,
      1,
      MAX_RADIUS_METERS,
      "radiusMeters",
    );
    const limit = clampInteger(input.limit ?? DEFAULT_LIMIT, 1, MAX_LIMIT, "limit");
    const result = await this.provider.searchNearby({
      lat: input.lat,
      lng: input.lng,
      radiusMeters,
      limit,
    });
    await Promise.all(
      result.images.map((image) =>
        this.writeCache("metadata", image.id, input.observability, () =>
          this.cache.putImage(image),
        ),
      ),
    );
    const candidates = result.images
      .map((image) => ({ image, distance: distanceMeters(input, image.coordinate) }))
      .filter(({ distance }) => distance <= radiusMeters)
      .sort(compareCandidates);
    const images = candidates
      .slice(0, limit)
      .map(({ image, distance }) => this.toDto(input.tripId, image, distance));
    const panoramaCount = images.filter((image) => image.supports360).length;
    return {
      outcome: images.length > 0 ? "found" : "empty",
      completeness: result.completeness,
      panoramaAvailable: panoramaCount > 0,
      panoramaCount,
      candidateCount: candidates.length,
      images,
    };
  }

  async getImage(
    tripId: string,
    imageId: string,
    context?: StreetViewRequestContext,
  ): Promise<StreetViewImageDto> {
    validateImageId(imageId);
    const cached = await this.readCache(
      "metadata",
      imageId,
      context,
      () => this.cache.getImage(imageId),
    );
    if (cached) return this.toDto(tripId, cached);
    const image = await this.provider.getImage(imageId);
    if (!image) {
      throw new StreetViewError("street_view_image_not_found", "Street-view image not found");
    }
    await this.writeCache("metadata", imageId, context, () =>
      this.cache.putImage(image),
    );
    return this.toDto(tripId, image);
  }

  async getInspectableImage(
    tripId: string,
    imageId: string,
    context?: StreetViewRequestContext,
  ): Promise<StreetViewImageDto> {
    const image = await this.getImage(tripId, imageId, context);
    if (image.supports360) {
      throw new StreetViewError(
        "street_view_panorama_inspection_forbidden",
        "Panorama content cannot be supplied to the model",
      );
    }
    return image;
  }

  async readPreview(
    imageId: string,
    context?: StreetViewRequestContext,
  ): Promise<StreetViewPreview> {
    validateImageId(imageId);
    const cachedPreview = await this.readCache(
      "preview",
      imageId,
      context,
      () => this.cache.getPreview(imageId),
    );
    if (cachedPreview) return cachedPreview;
    const image =
      (await this.readCache("metadata", imageId, context, () =>
        this.cache.getImage(imageId),
      )) ?? (await this.provider.getImage(imageId));
    if (!image) {
      throw new StreetViewError(
        "street_view_image_not_found",
        "Street-view image not found",
      );
    }
    await this.writeCache("metadata", imageId, context, () =>
      this.cache.putImage(image),
    );
    const preview = await this.provider.readPreview(image);
    await this.writeCache("preview", imageId, context, () =>
      this.cache.putPreview(imageId, preview),
    );
    return preview;
  }

  getViewerConfig(): StreetViewViewerConfig {
    return this.provider.getViewerConfig();
  }

  private toDto(tripId: string, image: StreetViewImage, distance?: number): StreetViewImageDto {
    return {
      id: image.id,
      coordinate: image.coordinate,
      ...(distance === undefined ? {} : { distanceMeters: Math.round(distance) }),
      ...(image.capturedAt ? { capturedAt: image.capturedAt } : {}),
      ...(image.headingDegrees === undefined ? {} : { headingDegrees: image.headingDegrees }),
      supports360: image.supports360,
      previewUrl: `/api/trips/${encodeURIComponent(tripId)}/street-view/images/${encodeURIComponent(image.id)}/preview`,
      attribution: image.attribution,
    };
  }

  private async readCache<T>(
    kind: "metadata" | "preview",
    imageId: string,
    context: StreetViewRequestContext | undefined,
    read: () => Promise<T | null>,
  ): Promise<T | null> {
    try {
      const value = await read();
      this.observability.logger.debug(
        value ? "street_view.cache.hit" : "street_view.cache.miss",
        { ...context, imageId, cacheKind: kind },
      );
      return value;
    } catch (error) {
      this.observability.logger.warn("street_view.cache.read_failed", {
        ...context,
        imageId,
        cacheKind: kind,
        error,
      });
      return null;
    }
  }

  private async writeCache(
    kind: "metadata" | "preview",
    imageId: string,
    context: StreetViewRequestContext | undefined,
    write: () => Promise<void>,
  ): Promise<void> {
    try {
      await write();
    } catch (error) {
      this.observability.logger.warn("street_view.cache.write_failed", {
        ...context,
        imageId,
        cacheKind: kind,
        error,
      });
    }
  }
}

function validateCoordinate(lat: number, lng: number): void {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new StreetViewError("street_view_invalid_query", "Latitude must be between -90 and 90");
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new StreetViewError("street_view_invalid_query", "Longitude must be between -180 and 180");
  }
}

function clampInteger(value: number, min: number, max: number, field: string): number {
  if (!Number.isFinite(value)) {
    throw new StreetViewError("street_view_invalid_query", `${field} must be a finite number`);
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

function validateImageId(imageId: string): void {
  if (!IMAGE_ID_PATTERN.test(imageId)) {
    throw new StreetViewError("street_view_invalid_image", "Invalid street-view image id");
  }
}

function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function compareCandidates(
  a: { image: StreetViewImage; distance: number },
  b: { image: StreetViewImage; distance: number },
): number {
  if (a.image.supports360 !== b.image.supports360) {
    return a.image.supports360 ? -1 : 1;
  }
  if (a.distance !== b.distance) return a.distance - b.distance;
  const capturedAt = timestamp(b.image.capturedAt) - timestamp(a.image.capturedAt);
  if (capturedAt !== 0) return capturedAt;
  return a.image.id.localeCompare(b.image.id);
}

function timestamp(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
