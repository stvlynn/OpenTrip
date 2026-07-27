/** Unsplash CDN photo id — the path segment of `images.unsplash.com/<id>`.
 *  Ids are stable, so they are referenced literally at the call site. */
export type UnsplashPhotoId = string;

/** Builds a responsive Unsplash CDN url. `auto=format` lets the CDN negotiate
 *  AVIF/WebP; the width is baked into the query so each srcSet entry is a
 *  distinct crop request. */
export function unsplashSrc(id: UnsplashPhotoId, width: number): string {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&q=80&w=${width}`;
}

/** `srcSet` across the widths a surface is likely to need, so the CDN serves
 *  the crop that fits rather than one oversized image. */
export function unsplashSrcSet(id: UnsplashPhotoId, widths: number[]): string {
  return widths.map((width) => `${unsplashSrc(id, width)} ${width}w`).join(", ");
}
