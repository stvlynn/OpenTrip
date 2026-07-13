import type { StreetViewImage, StreetViewPreview } from "../../domain/street-view";

export interface StreetViewCache {
  getImage(imageId: string): Promise<StreetViewImage | null>;
  putImage(image: StreetViewImage): Promise<void>;
  getPreview(imageId: string): Promise<StreetViewPreview | null>;
  putPreview(imageId: string, preview: StreetViewPreview): Promise<void>;
}

export const noopStreetViewCache: StreetViewCache = {
  getImage: async () => null,
  putImage: async () => {},
  getPreview: async () => null,
  putPreview: async () => {},
};
