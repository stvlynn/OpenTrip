/** Shared media validation for avatars and trip uploads (notes + agent). */

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

/** Trip note images and agent chat attachments. */
export const ALLOWED_TRIP_MEDIA_MIME_TYPES = new Set([
  ...ALLOWED_IMAGE_MIME_TYPES,
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
]);

/** Maximum decoded payload accepted by managed uploads. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export function extensionOf(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "application/pdf":
      return "pdf";
    case "text/plain":
      return "txt";
    case "text/markdown":
      return "md";
    case "text/csv":
      return "csv";
    default:
      return "bin";
  }
}

export function detectImageMimeType(content: Uint8Array): string | null {
  if (
    content.length >= 8 &&
    content[0] === 0x89 &&
    content[1] === 0x50 &&
    content[2] === 0x4e &&
    content[3] === 0x47 &&
    content[4] === 0x0d &&
    content[5] === 0x0a &&
    content[6] === 0x1a &&
    content[7] === 0x0a
  ) {
    return "image/png";
  }
  if (content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    content.length >= 12 &&
    ascii(content, 0, 4) === "RIFF" &&
    ascii(content, 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function detectPdfMimeType(content: Uint8Array): string | null {
  if (content.length >= 5 && ascii(content, 0, 5) === "%PDF-") {
    return "application/pdf";
  }
  return null;
}

/** True when bytes look like plain text (no NUL) for text/* uploads. */
function looksLikeText(content: Uint8Array): boolean {
  if (content.length === 0) return false;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === 0) return false;
  }
  return true;
}

/**
 * Resolve the MIME type for a trip media upload. Images and PDFs are detected
 * from magic bytes (authoritative). Text types use the claimed MIME or
 * filename extension and require a text-like payload (no NUL bytes).
 */
export function detectTripMediaMimeType(
  content: Uint8Array,
  claimedMimeType: string,
  filename?: string,
): string | null {
  const image = detectImageMimeType(content);
  if (image) return image;

  const pdf = detectPdfMimeType(content);
  if (pdf) return pdf;

  const textMime = normalizeTextMime(claimedMimeType, filename);
  if (textMime && looksLikeText(content)) {
    return textMime;
  }

  return null;
}

function normalizeTextMime(
  claimedMimeType: string,
  filename?: string,
): string | null {
  if (
    claimedMimeType === "text/plain" ||
    claimedMimeType === "text/markdown" ||
    claimedMimeType === "text/csv"
  ) {
    return claimedMimeType;
  }
  const name = (filename ?? "").toLowerCase();
  if (name.endsWith(".md") || name.endsWith(".markdown")) return "text/markdown";
  if (name.endsWith(".csv")) return "text/csv";
  if (name.endsWith(".txt")) return "text/plain";
  return null;
}

/** Hex-encode an opaque id so it is safe as a single storage path segment. */
export function storageNamespaceOf(id: string): string {
  return [...new TextEncoder().encode(id)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const AVATAR_FILE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|webp)$/i;

const TRIP_MEDIA_FILE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|webp|pdf|txt|md|csv)$/i;

/** Avatar objects live at `avatars/{hexUserId}/{uuid}.{ext}`. */
export function isAvatarStoragePath(path: string): boolean {
  const parts = path.split("/");
  if (parts.length !== 3 || parts[0] !== "avatars" || !/^[0-9a-f]+$/i.test(parts[1]!)) {
    return false;
  }
  return AVATAR_FILE.test(parts[2]!);
}

/** Trip media lives at `trips/{hexTripId}/{uuid}.{ext}`. */
export function isTripMediaStoragePath(path: string): boolean {
  const parts = path.split("/");
  if (parts.length !== 3 || parts[0] !== "trips" || !/^[0-9a-f]+$/i.test(parts[1]!)) {
    return false;
  }
  return TRIP_MEDIA_FILE.test(parts[2]!);
}

export function isManagedUploadPath(path: string): boolean {
  return isAvatarStoragePath(path) || isTripMediaStoragePath(path);
}

/**
 * Extract a managed storage path from a public upload URL (absolute or
 * relative). Returns null when the URL is not under `/api/uploads/`.
 */
export function storagePathFromPublicUrl(url: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(url, "http://local.invalid").pathname;
  } catch {
    return null;
  }
  const marker = "/api/uploads/";
  const idx = pathname.indexOf(marker);
  if (idx === -1) return null;
  const encoded = pathname.slice(idx + marker.length);
  if (!encoded) return null;
  try {
    return encoded.split("/").map(decodeURIComponent).join("/");
  } catch {
    return null;
  }
}

/** True when `url` points at a managed object in this trip's namespace. */
export function isTripOwnedMediaUrl(url: string, tripId: string): boolean {
  const path = storagePathFromPublicUrl(url);
  if (!path || !isTripMediaStoragePath(path)) return false;
  return path.split("/")[1] === storageNamespaceOf(tripId);
}

function ascii(content: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...content.subarray(start, end));
}
