import Taro from "@tarojs/taro";

import { rawRequest } from "./transport";
import { config } from "@/shared/config";
import { currentToken } from "@/shared/session/session";

/** Better Auth `updateUser`. It is not enveloped, so it bypasses `apiFetch`. */
export async function updateProfile(input: {
  name?: string;
  defaultCurrency?: string;
}): Promise<void> {
  const response = await rawRequest({
    path: "/api/auth/update-user",
    method: "POST",
    body: input,
    headers: { Authorization: `Bearer ${currentToken()}` },
  });
  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw new Error(`Profile update failed with ${response.statusCode}`);
  }
}

interface AvatarUploadBody {
  data?: { url?: string };
  error?: { code?: string };
}

/**
 * Upload a `chooseAvatar` temp file. The server validates the real MIME type
 * (PNG/JPEG/WebP, ≤2MB) and updates `user.image` itself, returning the public
 * URL. Rejects with the API error code (`avatar_too_large`, …) on failure.
 */
export async function uploadAvatar(filePath: string): Promise<string> {
  const response = await Taro.uploadFile({
    url: `${config.apiBaseUrl}/api/users/avatar`,
    filePath,
    name: "avatar",
    header: { Authorization: `Bearer ${currentToken()}` },
  });
  let body: AvatarUploadBody = {};
  try {
    body = JSON.parse(response.data) as AvatarUploadBody;
  } catch {
    // Non-JSON error page (proxy/5xx) — fall through to the generic failure.
  }
  const url = body.data?.url;
  if (response.statusCode < 200 || response.statusCode >= 300 || !url) {
    throw new Error(body.error?.code ?? `avatar_upload_failed_${response.statusCode}`);
  }
  return url;
}
