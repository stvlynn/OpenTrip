import Taro from "@tarojs/taro";

import { config } from "@/shared/config";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RawRequest {
  path: string;
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface RawResponse {
  statusCode: number;
  body: unknown;
}

/**
 * Lowest network layer. It performs no authentication and no envelope parsing
 * so both the Better Auth endpoints (bare JSON) and the business API (`{ data }`
 * / `{ error }` envelopes) can build on it.
 */
export async function rawRequest({
  path,
  method = "GET",
  body,
  headers,
}: RawRequest): Promise<RawResponse> {
  const response = await Taro.request({
    url: `${config.apiBaseUrl}${path}`,
    method,
    data: body as Taro.request.Option["data"],
    header: {
      "content-type": "application/json",
      ...headers,
    },
    timeout: 20_000,
  });
  return { statusCode: response.statusCode, body: response.data };
}
