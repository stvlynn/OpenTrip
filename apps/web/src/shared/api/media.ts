import { config } from "@/shared/config";
import { ApiError } from "./client";

interface MediaUploadBody {
  data?: { url: string };
  error?: { code?: string; message?: string };
}

/** MIME types accepted for trip note images and agent chat attachments. */
export const TRIP_MEDIA_ACCEPT =
  "image/png,image/jpeg,image/webp,application/pdf,text/plain,text/markdown,text/csv,.md,.csv,.txt,.pdf";

/** Upload a file into the trip media namespace; returns a public URL. */
export async function uploadTripMedia(
  tripId: string,
  file: File,
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(
    `${config.baseUrl}/api/trips/${encodeURIComponent(tripId)}/media`,
    {
      method: "POST",
      body: formData,
      credentials: "include",
    },
  );
  const result = await readJson<MediaUploadBody>(response);
  if (!response.ok || !result.data?.url) {
    throw new ApiError(
      result.error?.code ?? "media_upload_failed",
      result.error?.message ?? response.statusText,
      response.status,
    );
  }
  return result.data.url;
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}
