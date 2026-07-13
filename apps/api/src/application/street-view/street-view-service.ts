import type {
  StreetViewImage,
  StreetViewPreview,
  StreetViewProvider,
  StreetViewViewerConfig,
} from "../../domain/street-view";
import { StreetViewError } from "./street-view-error";

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
}

export class StreetViewService {
  constructor(private readonly provider: StreetViewProvider) {}

  async searchNearby(input: StreetViewSearchInput): Promise<StreetViewImageDto[]> {
    validateCoordinate(input.lat, input.lng);
    const radiusMeters = clampInteger(
      input.radiusMeters ?? DEFAULT_RADIUS_METERS,
      1,
      MAX_RADIUS_METERS,
      "radiusMeters",
    );
    const limit = clampInteger(input.limit ?? DEFAULT_LIMIT, 1, MAX_LIMIT, "limit");
    const images = await this.provider.searchNearby({
      lat: input.lat,
      lng: input.lng,
      radiusMeters,
      limit,
    });
    return images
      .map((image) => ({ image, distance: distanceMeters(input, image.coordinate) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit)
      .map(({ image, distance }) => this.toDto(input.tripId, image, distance));
  }

  async getImage(tripId: string, imageId: string): Promise<StreetViewImageDto> {
    validateImageId(imageId);
    const image = await this.provider.getImage(imageId);
    if (!image) {
      throw new StreetViewError("street_view_image_not_found", "Street-view image not found");
    }
    return this.toDto(tripId, image);
  }

  async readPreview(imageId: string): Promise<StreetViewPreview> {
    validateImageId(imageId);
    return this.provider.readPreview(imageId);
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
