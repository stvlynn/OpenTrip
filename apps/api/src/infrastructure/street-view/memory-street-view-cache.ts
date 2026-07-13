import type { StreetViewCache } from "../../application/street-view";
import type { StreetViewImage, StreetViewPreview } from "../../domain/street-view";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  size: number;
}

export interface MemoryStreetViewCacheOptions {
  ttlMs?: number;
  maxImages?: number;
  maxPreviews?: number;
  maxPreviewBytes?: number;
  now?: () => number;
}

export class MemoryStreetViewCache implements StreetViewCache {
  private readonly images = new Map<string, CacheEntry<StreetViewImage>>();
  private readonly previews = new Map<string, CacheEntry<StreetViewPreview>>();
  private previewBytes = 0;
  private readonly ttlMs: number;
  private readonly maxImages: number;
  private readonly maxPreviews: number;
  private readonly maxPreviewBytes: number;
  private readonly now: () => number;

  constructor(options: MemoryStreetViewCacheOptions = {}) {
    this.ttlMs = options.ttlMs ?? 15 * 60 * 1_000;
    this.maxImages = options.maxImages ?? 512;
    this.maxPreviews = options.maxPreviews ?? 64;
    this.maxPreviewBytes = options.maxPreviewBytes ?? 64 * 1024 * 1024;
    this.now = options.now ?? Date.now;
  }

  async getImage(imageId: string): Promise<StreetViewImage | null> {
    return this.read(this.images, imageId);
  }

  async putImage(image: StreetViewImage): Promise<void> {
    this.write(this.images, image.id, structuredClone(image), 0);
    this.evictOldest(this.images, this.maxImages);
  }

  async getPreview(imageId: string): Promise<StreetViewPreview | null> {
    const preview = this.read(this.previews, imageId);
    return preview
      ? { ...preview, bytes: new Uint8Array(preview.bytes) }
      : null;
  }

  async putPreview(imageId: string, preview: StreetViewPreview): Promise<void> {
    const previous = this.previews.get(imageId);
    if (previous) this.previewBytes -= previous.size;
    const copy = { ...preview, bytes: new Uint8Array(preview.bytes) };
    this.write(this.previews, imageId, copy, copy.bytes.byteLength);
    this.previewBytes += copy.bytes.byteLength;
    this.evictPreviews();
  }

  private read<T>(entries: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      entries.delete(key);
      if (entries === this.previews) this.previewBytes -= entry.size;
      return null;
    }
    entries.delete(key);
    entries.set(key, entry);
    return entry.value;
  }

  private write<T>(
    entries: Map<string, CacheEntry<T>>,
    key: string,
    value: T,
    size: number,
  ): void {
    entries.delete(key);
    entries.set(key, { value, size, expiresAt: this.now() + this.ttlMs });
  }

  private evictOldest<T>(entries: Map<string, CacheEntry<T>>, limit: number): void {
    while (entries.size > limit) {
      const key = entries.keys().next().value as string | undefined;
      if (key === undefined) return;
      entries.delete(key);
    }
  }

  private evictPreviews(): void {
    while (
      this.previews.size > this.maxPreviews ||
      this.previewBytes > this.maxPreviewBytes
    ) {
      const key = this.previews.keys().next().value as string | undefined;
      if (key === undefined) return;
      const entry = this.previews.get(key);
      this.previews.delete(key);
      this.previewBytes -= entry?.size ?? 0;
    }
  }
}
