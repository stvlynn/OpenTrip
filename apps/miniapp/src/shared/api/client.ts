import { currentToken, renewSession } from "@/shared/session/session";

import { rawRequest, type HttpMethod } from "./transport";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly current?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string; current?: unknown };
}

export interface ApiRequest {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Typed request against the business API: attaches the Bearer session, unwraps
 * the `{ data }` envelope, and throws `ApiError` on failure. A single retry
 * covers an expired session, since `wx.login` can mint a new one without user
 * interaction.
 */
export async function apiFetch<T>(path: string, init: ApiRequest = {}): Promise<T> {
  const first = await send(path, init, currentToken());
  if (first.statusCode !== 401) return unwrap<T>(first.statusCode, first.body);

  const { id } = await renewSession();
  if (!id) throw new ApiError("unauthorized", "Session renewal failed", 401);
  const second = await send(path, init, currentToken());
  return unwrap<T>(second.statusCode, second.body);
}

function send(path: string, init: ApiRequest, token: string) {
  return rawRequest({
    path,
    method: init.method,
    body: init.body,
    headers: {
      ...init.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

function unwrap<T>(statusCode: number, body: unknown): T {
  if (statusCode < 200 || statusCode >= 300) {
    const error = (body as ErrorEnvelope | null)?.error;
    throw new ApiError(
      error?.code ?? "unknown",
      error?.message ?? `Request failed with ${statusCode}`,
      statusCode,
      error?.current,
    );
  }
  return (body as { data: T }).data;
}
