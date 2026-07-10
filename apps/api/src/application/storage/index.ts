export type { FileStorage, StoredFile } from "./ports";
export {
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_TRIP_MEDIA_MIME_TYPES,
  MAX_IMAGE_BYTES,
  detectImageMimeType,
  detectTripMediaMimeType,
  extensionOf,
  isAvatarStoragePath,
  isManagedUploadPath,
  isTripMediaStoragePath,
  isTripOwnedMediaUrl,
  storageNamespaceOf,
  storagePathFromPublicUrl,
} from "./image";
